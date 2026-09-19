import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "./tokens.js";
import { Errors } from "../../lib/errors.js";
import { config } from "../../config.js";

declare module "fastify" {
    interface FastifyRequest {
        user?: { id: string };
    }
}

/** preHandler: verifies the access_token cookie, attaches request.user.
 * Any route behind this is authenticated -- see security-and-hardening's
 * "Broken Access Control" pattern: authentication alone isn't authorization,
 * but every protected route in this app scopes its queries to request.user.id,
 * so there's no separate resource-ownership check to bolt on separately. */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    const token = request.cookies.access_token;
    if (!token) throw Errors.unauthorized();

    try {
        const { userId } = await verifyAccessToken(token);
        request.user = { id: userId };
    } catch {
        throw Errors.unauthorized();
    }
}

// config.corsOrigins is the same allowlist @fastify/cors is registered
// with (app.ts) -- one shared source of truth, see config.ts, which also
// fails loudly at boot if FRONTEND_URL isn't a member of it. Kept as a Set
// here purely for O(1) lookup on every request.
const ALLOWED_ORIGINS = new Set(config.corsOrigins);

/** preHandler: double-submit CSRF check for cookie-authenticated mutating
 * requests. Origin (falling back to Referer) must match an allowlisted
 * frontend origin, AND the X-CSRF-Token header must match the csrf_token
 * cookie. Both must pass -- see SPEC-identity.md's doubt review finding #8. */
export async function requireCsrf(request: FastifyRequest, _reply: FastifyReply) {
    const origin = request.headers.origin ?? refererOrigin(request.headers.referer);
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        // 4xx responses aren't logged by the global error handler (app.ts
        // only reports statusCode >= 500), so a rejected Origin otherwise
        // leaves no server-side trace at all. Only log when an Origin (or
        // Referer) was actually present but didn't match -- that's the
        // deploy-drift/attack signal. A request with neither header (health
        // checks, curl, other non-browser clients) is routine and logging
        // it here would just be noise keyed on whatever an untrusted client
        // sends, not evidence of a stale CORS_ORIGIN.
        if (origin) {
            request.log.warn({ origin, path: request.url }, "rejected request: Origin not in CORS_ORIGIN allowlist");
        }
        throw Errors.forbidden("Origin not allowed");
    }

    const headerToken = request.headers["x-csrf-token"];
    const cookieToken = request.cookies.csrf_token;
    if (!cookieToken || typeof headerToken !== "string" || headerToken !== cookieToken) {
        throw Errors.forbidden("Missing or invalid CSRF token");
    }
}

function refererOrigin(referer: string | undefined): string | undefined {
    if (!referer) return undefined;
    try {
        return new URL(referer).origin;
    } catch {
        return undefined;
    }
}
