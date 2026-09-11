import type { FastifyInstance } from "fastify";

type InjectResponse = Awaited<ReturnType<FastifyInstance["inject"]>>;

export function getCookie(res: InjectResponse, name: string) {
    return res.cookies.find((c) => c.name === name);
}

/** Builds a Cookie header string from a prior response's Set-Cookie jar,
 * the way a browser would replay them on the next request. */
export function cookieHeader(res: InjectResponse, names: string[]): string {
    return names
        .map((name) => getCookie(res, name))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
}

/** The full set of headers a browser would send for an authenticated,
 * CSRF-protected mutating request, given a prior login/register response. */
export function authHeaders(sessionRes: InjectResponse, extra: Record<string, string> = {}) {
    return {
        cookie: cookieHeader(sessionRes, ["access_token", "refresh_token", "csrf_token"]),
        origin: "http://localhost:5173",
        "x-csrf-token": getCookie(sessionRes, "csrf_token")!.value,
        ...extra,
    };
}
