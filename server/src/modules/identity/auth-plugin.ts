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

const ALLOWED_ORIGINS = new Set([...config.corsOrigins, config.FRONTEND_URL]);

/** preHandler: double-submit CSRF check for cookie-authenticated mutating
 * requests. Origin (falling back to Referer) must match an allowlisted
 * frontend origin, AND the X-CSRF-Token header must match the csrf_token
 * cookie. Both must pass -- see SPEC-identity.md's doubt review finding #8. */
export async function requireCsrf(request: FastifyRequest, _reply: FastifyReply) {
    const origin = request.headers.origin ?? refererOrigin(request.headers.referer);
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
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
