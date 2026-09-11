import { describe, it, expect, vi, afterEach } from "vitest";
import { buildApp } from "../../app.js";
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
