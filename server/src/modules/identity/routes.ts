import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { credentialsSchema, userResponseSchema } from "./schemas.js";
import { register, login, refresh, logout } from "./service.js";
import { setAuthCookies, clearAuthCookies } from "./cookies.js";
import { hashRefreshToken } from "./tokens.js";
import { authenticate, requireCsrf } from "./auth-plugin.js";
import { Errors } from "../../lib/errors.js";
import { config } from "../../config.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

// skipOnError:false, unlike the global limiter in app.ts, which stays
// fail-open so a Redis blip can't take the whole API down. These routes are
// the brute-force surface: with the global setting inherited, a Redis
// outage silently removed password-guessing protection entirely (verified
// locally: 14/14 bad logins allowed from one IP with Redis stopped).
// Rejecting auth attempts while the limiter is blind is the right trade --
// a login outage is recoverable, an unthrottled credential-stuffing window
// is not.
const AUTH_RATE_LIMIT = { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: "15 minutes", skipOnError: false };

// A second login limit keyed on the target account, on top of the per-IP
// one. The Render origin is publicly reachable, so a client calling it
// directly controls X-Forwarded-For and can mint a fresh "IP" per attempt;
// a per-email bucket still caps guesses against any one account. Same
// fail-closed reasoning as AUTH_RATE_LIMIT. The trade-off: anyone can lock
// a known email out of password login for one window -- accepted, the
// window is short and a lockout is recoverable, a guessed password isn't.
const LOGIN_EMAIL_RATE_LIMIT = {
    max: config.LOGIN_EMAIL_RATE_LIMIT_MAX,
    timeWindow: "15 minutes",
    skipOnError: false,
    // request.body.email is already trimmed + lowercased by credentialsSchema
    // (preHandler runs after validation), so "A@x.com " and "a@x.com" share
    // one bucket.
    keyGenerator: (request: FastifyRequest) => `login-email:${(request.body as { email: string }).email}`,
};

// Refresh is NOT a password-guessing surface (the token is 256 bits of
// randomness), and it runs every ACCESS_TOKEN_TTL for every active tab.
// Keyed per refresh token, not per IP: an IP bucket is shared by everyone
// behind one NAT or proxy (and by every user at once if TRUST_PROXY_HOPS is
// wrong), so a busy shared IP would 429 refreshes and log users out en
// masse. A token rotates on every successful refresh, so a legitimate one
// is presented about once; the limit only bounds one token replayed in a
// loop. Fail-open: a Redis blip must not log every active user out.
// Trade-off: a client inventing a new bogus token per request gets a fresh
// bucket each time -- harmless for guessing (2^256), and the lookup it
// costs is one indexed SELECT.
const REFRESH_RATE_LIMIT = {
    max: config.REFRESH_RATE_LIMIT_MAX,
    timeWindow: "15 minutes",
    skipOnError: true,
    keyGenerator: (request: FastifyRequest) => {
        const rawToken = request.cookies.refresh_token;
        return rawToken ? `token:${hashRefreshToken(rawToken)}` : `ip:${request.ip}`;
    },
};

export async function identityRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();
    // createRateLimit, not the route's `config.rateLimit` (one per route,
    // already the per-IP limit) or app.rateLimit() (a hook that no-ops once
    // any limiter has run on the request).
    const checkLoginEmailLimit = app.createRateLimit(LOGIN_EMAIL_RATE_LIMIT);

    typedApp.route({
        method: "POST",
        url: "/auth/register",
        config: { rateLimit: AUTH_RATE_LIMIT },
        schema: { body: credentialsSchema, response: { 201: userResponseSchema } },
        handler: async (request, reply) => {
            const { email, password } = request.body;
            const { user, tokens } = await register(email, password);
            setAuthCookies(reply, tokens);
            reply.status(201);
            return { user };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/auth/login",
        config: { rateLimit: AUTH_RATE_LIMIT },
        schema: { body: credentialsSchema, response: { 200: userResponseSchema } },
        preHandler: async (request, reply) => {
            const limit = await checkLoginEmailLimit(request);
            if (!limit.isAllowed && limit.isExceeded) {
                reply.header("Retry-After", String(limit.ttlInSeconds));
                throw Errors.tooManyRequests("Too many login attempts for this account. Try again later.");
            }
        },
        handler: async (request, reply) => {
            const { email, password } = request.body;
            const { user, tokens } = await login(email, password);
            setAuthCookies(reply, tokens);
            return { user };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/auth/refresh",
        config: { rateLimit: REFRESH_RATE_LIMIT },
        preValidation: [requireCsrf],
        schema: { response: { 200: z.object({ ok: z.literal(true) }) } },
        handler: async (request, reply) => {
            const rawToken = request.cookies.refresh_token;
            if (!rawToken) throw Errors.unauthorized();

            const result = await refresh(rawToken);
            if (result === "invalid" || result === "theft") {
                clearAuthCookies(reply);
                throw Errors.unauthorized();
            }

            setAuthCookies(reply, result);
            return { ok: true as const };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/auth/logout",
        preValidation: [requireCsrf],
        schema: { response: { 200: z.object({ ok: z.literal(true) }) } },
        handler: async (request, reply) => {
            const rawToken = request.cookies.refresh_token;
            if (rawToken) await logout(rawToken);
            clearAuthCookies(reply);
            return { ok: true as const };
        },
    });

    typedApp.route({
        method: "GET",
        url: "/auth/me",
        preValidation: [authenticate],
        schema: { response: { 200: userResponseSchema } },
        handler: async (request) => {
            const user = await db.query.users.findFirst({ where: eq(users.id, request.user!.id) });
            if (!user) throw Errors.unauthorized();
            return { user: { id: user.id, email: user.email } };
        },
    });
}
