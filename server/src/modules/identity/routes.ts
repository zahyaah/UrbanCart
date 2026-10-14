import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { credentialsSchema, userResponseSchema } from "./schemas.js";
import { register, login, refresh, logout } from "./service.js";
import { setAuthCookies, clearAuthCookies } from "./cookies.js";
import { hashRefreshToken } from "./tokens.js";
import { authenticate, requireCsrf } from "./auth-plugin.js";
import { Errors } from "../../lib/errors.js";
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
const AUTH_RATE_LIMIT = { max: 10, timeWindow: "15 minutes", skipOnError: false };

// Refresh is NOT a password-guessing surface (the token is 256 bits of
// randomness), and it runs every ACCESS_TOKEN_TTL for every active tab.
// Keyed per refresh token, not per IP: an IP bucket is shared by everyone
// behind one NAT or proxy (and by every user at once if TRUST_PROXY_HOPS is
// wrong), so a busy shared IP would 429 refreshes and log users out en
// masse. A token rotates on every successful refresh, so a legitimate one
// is presented about once; 10 only bounds one token being replayed in a
// loop. Fail-open: a Redis blip must not log every active user out.
// Trade-off: a client inventing a new bogus token per request gets a fresh
// bucket each time -- harmless for guessing (2^256), and the lookup it
// costs is one indexed SELECT.
const REFRESH_RATE_LIMIT = {
    max: 10,
    timeWindow: "15 minutes",
    skipOnError: true,
    keyGenerator: (request: FastifyRequest) => {
        const rawToken = request.cookies.refresh_token;
        return rawToken ? `token:${hashRefreshToken(rawToken)}` : `ip:${request.ip}`;
    },
};

export async function identityRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

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
        handler: async (request, reply) => {
            const { email, password } = request.body;
            const { user, tokens } = await login(email, password);
            setAuthCookies(reply, tokens);
            // req.ip is the login rate-limit key. Logging it beside the raw
            // X-Forwarded-For chain is how TRUST_PROXY_HOPS gets set: pick
            // the value at which `ip` equals the client's real address.
            request.log.info(
                { ip: request.ip, xForwardedFor: request.headers["x-forwarded-for"] },
                "login client address"
            );
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
