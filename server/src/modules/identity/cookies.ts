import type { FastifyReply } from "fastify";
import { config } from "../../config.js";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from "./tokens.js";

const baseCookieOptions = {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.COOKIE_SAME_SITE,
    path: "/",
} as const;

export function setAuthCookies(
    reply: FastifyReply,
    { accessToken, refreshToken, csrfToken }: { accessToken: string; refreshToken: string; csrfToken: string }
) {
    reply.setCookie("access_token", accessToken, {
        ...baseCookieOptions,
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
    reply.setCookie("refresh_token", refreshToken, {
        ...baseCookieOptions,
        // Scoped to /auth only -- the refresh token never needs to leave the
        // browser on every ordinary API call, just the refresh/logout ones.
        path: "/auth",
        maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    });
    // Deliberately NOT httpOnly -- the frontend must read this value to echo
    // it back as the X-CSRF-Token header. Its role is proving the request
    // came from same-origin JS, not secrecy from that same JS.
    reply.setCookie("csrf_token", csrfToken, {
        ...baseCookieOptions,
        httpOnly: false,
        maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    });
}

export function clearAuthCookies(reply: FastifyReply) {
    reply.clearCookie("access_token", { path: "/" });
    reply.clearCookie("refresh_token", { path: "/auth" });
    reply.clearCookie("csrf_token", { path: "/" });
}
