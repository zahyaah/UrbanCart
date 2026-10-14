import { describe, it, expect, vi, afterEach } from "vitest";
import { buildApp } from "../../app.js";
import { redis } from "../../lib/redis.js";
import { getCookie, cookieHeader } from "../../test/helpers.js";

const CREDENTIALS = { email: "shopper@urbancart.test", password: "correct-horse-battery" };

async function registerAndGetApp() {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: CREDENTIALS });
    return { app, res };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("POST /auth/register", () => {
    it("creates an account and sets session cookies, never a token in the body", async () => {
        const { res } = await registerAndGetApp();

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.user.email).toBe(CREDENTIALS.email);
        expect(JSON.stringify(body)).not.toContain(getCookie(res, "access_token")?.value);
        expect(JSON.stringify(body)).not.toContain(getCookie(res, "refresh_token")?.value);

        expect(getCookie(res, "access_token")).toMatchObject({ httpOnly: true, path: "/" });
        expect(getCookie(res, "refresh_token")).toMatchObject({ httpOnly: true, path: "/auth" });
        // A cookie set with httpOnly:false omits the HttpOnly attribute
        // entirely from Set-Cookie, so the parsed cookie has no httpOnly
        // key at all rather than an explicit `false`.
        expect(getCookie(res, "csrf_token")?.httpOnly).toBeFalsy();
        expect(getCookie(res, "csrf_token")).toMatchObject({ path: "/" });
    });

    it("rejects a duplicate email with 409", async () => {
        const { app } = await registerAndGetApp();

        const res = await app.inject({ method: "POST", url: "/auth/register", payload: CREDENTIALS });

        expect(res.statusCode).toBe(409);
    });

    it("rejects a password under 8 characters", async () => {
        const app = await buildApp();

        const res = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: { email: "short@test.com", password: "short" },
        });

        expect(res.statusCode).toBe(422);
    });
});

describe("POST /auth/login", () => {
    it("logs in with correct credentials", async () => {
        const { app } = await registerAndGetApp();

        const res = await app.inject({ method: "POST", url: "/auth/login", payload: CREDENTIALS });

        expect(res.statusCode).toBe(200);
        expect(getCookie(res, "access_token")).toBeDefined();
    });

    it("rejects the wrong password", async () => {
        const { app } = await registerAndGetApp();

        const res = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: CREDENTIALS.email, password: "wrong-password" },
        });

        expect(res.statusCode).toBe(401);
    });

    it("rejects a non-existent email with the same status as a wrong password", async () => {
        const app = await buildApp();

        const res = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: "nobody@test.com", password: "whatever123" },
        });

        expect(res.statusCode).toBe(401);
    });
});

describe("GET /auth/me", () => {
    it("requires authentication", async () => {
        const app = await buildApp();

        const res = await app.inject({ method: "GET", url: "/auth/me" });

        expect(res.statusCode).toBe(401);
    });

    it("returns the current user when the access token cookie is valid", async () => {
        const { app, res: registerRes } = await registerAndGetApp();

        const res = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: { cookie: cookieHeader(registerRes, ["access_token"]) },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).user.email).toBe(CREDENTIALS.email);
    });
});

describe("POST /auth/refresh", () => {
    async function refreshRequest(app: Awaited<ReturnType<typeof buildApp>>, sessionRes: Parameters<typeof cookieHeader>[0]) {
        return app.inject({
            method: "POST",
            url: "/auth/refresh",
            headers: {
                cookie: cookieHeader(sessionRes, ["refresh_token", "csrf_token"]),
                origin: "http://localhost:5173",
                "x-csrf-token": getCookie(sessionRes, "csrf_token")!.value,
            },
        });
    }

    it("rejects a refresh with no CSRF token", async () => {
        const { app, res: sessionRes } = await registerAndGetApp();

        const res = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            headers: { cookie: cookieHeader(sessionRes, ["refresh_token"]), origin: "http://localhost:5173" },
        });

        expect(res.statusCode).toBe(403);
    });

    it("rejects a refresh from a disallowed origin", async () => {
        const { app, res: sessionRes } = await registerAndGetApp();

        const res = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            headers: {
                cookie: cookieHeader(sessionRes, ["refresh_token", "csrf_token"]),
                origin: "https://evil.example.com",
                "x-csrf-token": getCookie(sessionRes, "csrf_token")!.value,
            },
        });

        expect(res.statusCode).toBe(403);
    });

    it("rotates the refresh token on a valid request", async () => {
        const { app, res: sessionRes } = await registerAndGetApp();

        const res = await refreshRequest(app, sessionRes);

        expect(res.statusCode).toBe(200);
        const newRefresh = getCookie(res, "refresh_token");
        expect(newRefresh?.value).not.toBe(getCookie(sessionRes, "refresh_token")?.value);
    });

    it("regression: a same-token reuse within the grace window does NOT revoke the session", async () => {
        // SPEC-identity.md doubt review finding #1 -- the false-positive
        // race this whole grace-window mechanism exists to prevent.
        const { app, res: sessionRes } = await registerAndGetApp();

        const first = await refreshRequest(app, sessionRes);
        expect(first.statusCode).toBe(200);

        // Immediately reuse the now-stale original refresh cookie, as a
        // second racing tab/request would.
        const second = await refreshRequest(app, sessionRes);
        expect(second.statusCode).toBe(200);

        // The session must still be usable afterwards -- proof it wasn't
        // treated as theft.
        const third = await refreshRequest(app, second);
        expect(third.statusCode).toBe(200);
    });

    it("regression: a same-token reuse outside the grace window revokes the whole session", async () => {
        const { app, res: sessionRes } = await registerAndGetApp();

        const first = await refreshRequest(app, sessionRes);
        expect(first.statusCode).toBe(200);

        // Jump the application clock forward past the 30s grace window.
        // Only Date.now() inside this Node process is faked -- the
        // revokedAt timestamp already written to Postgres stays at the
        // real time it was recorded, so the comparison genuinely reflects
        // "31 seconds have passed."
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 31_000);

        const reuseOriginal = await refreshRequest(app, sessionRes);
        expect(reuseOriginal.statusCode).toBe(401);

        // Deliberately still under the faked (advanced) clock here, not
        // real time: the revocation above just stamped revokedAt using the
        // advanced clock, so checking it against a real-time rollback would
        // compute a negative elapsed time and look like a fresh grace
        // window -- an artifact of mixing two clocks mid-test, not
        // something that can happen with the single real clock in
        // production. The theft response must have revoked the ENTIRE
        // session -- the token from the first (legitimate) rotation is
        // dead too.
        const afterTheft = await refreshRequest(app, first);
        expect(afterTheft.statusCode).toBe(401);
    });

    it("rejects an unknown refresh token", async () => {
        const app = await buildApp();

        const res = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            headers: {
                cookie: "refresh_token=not-a-real-token; csrf_token=fake",
                origin: "http://localhost:5173",
                "x-csrf-token": "fake",
            },
        });

        expect(res.statusCode).toBe(401);
    });
});

describe("POST /auth/logout", () => {
    it("revokes the refresh token so it can no longer be used", async () => {
        const { app, res: sessionRes } = await registerAndGetApp();
        const csrfToken = getCookie(sessionRes, "csrf_token")!.value;

        const logoutRes = await app.inject({
            method: "POST",
            url: "/auth/logout",
            headers: {
                cookie: cookieHeader(sessionRes, ["refresh_token", "csrf_token"]),
                origin: "http://localhost:5173",
                "x-csrf-token": csrfToken,
            },
        });
        expect(logoutRes.statusCode).toBe(200);
        expect(getCookie(logoutRes, "access_token")?.value).toBe("");

        // Regression: the clearing Set-Cookie must carry the same attributes
        // the cookie was set with -- a bare { path } defaulted to
        // SameSite=Lax, which browsers drop on a cross-site response, so
        // logout left every auth cookie in place in production.
        for (const name of ["access_token", "refresh_token", "csrf_token"]) {
            const set = getCookie(sessionRes, name)!;
            const cleared = getCookie(logoutRes, name)!;
            expect(cleared).toMatchObject({ path: set.path, sameSite: set.sameSite });
            expect(Boolean(cleared.secure)).toBe(Boolean(set.secure));
        }

        const refreshRes = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            headers: {
                cookie: cookieHeader(sessionRes, ["refresh_token", "csrf_token"]),
                origin: "http://localhost:5173",
                "x-csrf-token": csrfToken,
            },
        });
        expect(refreshRes.statusCode).toBe(401);
    });
});

describe("auth rate limiting", () => {
    function badLogin(app: Awaited<ReturnType<typeof buildApp>>, headers: Record<string, string> = {}) {
        return app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: "nobody@urbancart.test", password: "wrong-password" },
            headers,
        });
    }

    // Regression: trustProxy: true resolved req.ip (the rate-limit key) to
    // the leftmost X-Forwarded-For entry, which any client controls --
    // rotating it per request bypassed the login limit entirely.
    it("still returns 429 on the 11th login when X-Forwarded-For rotates every request", async () => {
        const app = await buildApp();

        const statuses: number[] = [];
        for (let i = 0; i < 11; i++) {
            const res = await badLogin(app, { "x-forwarded-for": `203.0.113.${i + 1}` });
            statuses.push(res.statusCode);
        }

        expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
        expect(statuses[10]).toBe(429);
    });

    // Regression: refresh shared the login limit's per-IP bucket, so
    // shoppers behind one NAT/proxy address exhausted it together and got
    // logged out. One token being hammered must not affect anyone else's.
    it("keys the refresh limit per token, so another session on the same IP is unaffected", async () => {
        const { app, res: sessionRes } = await registerAndGetApp();
        const csrfToken = getCookie(sessionRes, "csrf_token")!.value;
        const refreshWith = (refreshToken: string) =>
            app.inject({
                method: "POST",
                url: "/auth/refresh",
                headers: {
                    cookie: `refresh_token=${refreshToken}; csrf_token=${csrfToken}`,
                    origin: "http://localhost:5173",
                    "x-csrf-token": csrfToken,
                },
            });

        const statuses: number[] = [];
        for (let i = 0; i < 11; i++) {
            statuses.push((await refreshWith("not-a-real-refresh-token")).statusCode);
        }
        expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
        expect(statuses[10]).toBe(429);

        const res = await refreshWith(getCookie(sessionRes, "refresh_token")!.value);
        expect(res.statusCode).toBe(200);
    });

    describe("when the Redis rate-limit store errors", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        // RedisStore.incr calls the custom `rateLimit` command it defines on
        // the shared client the first time a store is built (in buildApp).
        function breakRateLimitStore() {
            if (!redis) throw new Error("these tests need REDIS_URL (see server/.env.test)");
            vi.spyOn(redis as unknown as { rateLimit: (...args: unknown[]) => void }, "rateLimit").mockImplementation(
                (...args: unknown[]) => {
                    const cb = args[args.length - 1] as (err: Error) => void;
                    cb(new Error("simulated Redis outage"));
                }
            );
        }

        it("fails closed on login: no password check runs while the limiter is blind", async () => {
            const app = await buildApp();
            breakRateLimitStore();

            const res = await badLogin(app);

            // @fastify/rate-limit rethrows the store error; it reaches the
            // global error handler as an unexpected error (500), never 401.
            expect(res.statusCode).toBe(500);
        });

        it("fails open on refresh: an outage must not log every active user out", async () => {
            const { app, res: sessionRes } = await registerAndGetApp();
            breakRateLimitStore();

            const res = await app.inject({
                method: "POST",
                url: "/auth/refresh",
                headers: {
                    cookie: cookieHeader(sessionRes, ["refresh_token", "csrf_token"]),
                    origin: "http://localhost:5173",
                    "x-csrf-token": getCookie(sessionRes, "csrf_token")!.value,
                },
            });

            expect(res.statusCode).toBe(200);
        });
    });
});
