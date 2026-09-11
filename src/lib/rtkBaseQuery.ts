import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { getCookie } from "./cookies";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// Shared by every RTK Query API slice that talks to our own backend: sends
// the httpOnly session cookies automatically (credentials: 'include') and
// echoes the csrf_token cookie back as a header on every request -- the
// double-submit pattern the backend's requireCsrf preHandler expects.
const rawBaseQuery = fetchBaseQuery({
    baseUrl: API_URL,
    credentials: "include",
    prepareHeaders: (headers) => {
        const csrfToken = getCookie("csrf_token");
        if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
        return headers;
    },
});

// Single-flight refresh: concurrent 401s from several in-flight requests
// must trigger exactly one /auth/refresh call, not one per request -- this
// is the exact race SPEC-identity.md's grace-window fix exists to tolerate
// server-side, but tolerating it is cheaper than causing it. Official RTK
// Query reauth recipe: https://redux-toolkit.js.org/rtk-query/usage/customizing-queries
const refreshMutex = new Mutex();

const AUTH_ENDPOINTS = new Set(["/auth/login", "/auth/register", "/auth/refresh"]);

export const apiBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
    args,
    api,
    extraOptions
) => {
    await refreshMutex.waitForUnlock();
    let result = await rawBaseQuery(args, api, extraOptions);

    const url = typeof args === "string" ? args : args.url;
    // csrf_token is always set alongside refresh_token and cleared alongside
    // it too (see the backend's setAuthCookies/clearAuthCookies) -- its
    // absence is a reliable, client-readable proxy for "there is no session
    // to refresh." Skipping the attempt entirely avoids a doomed
    // refresh-then-403 round trip (and matching console error) on every
    // single 401 an ordinary logged-out visitor generates.
    const hasPossibleSession = Boolean(getCookie("csrf_token"));
    if (result.error?.status === 401 && hasPossibleSession && !AUTH_ENDPOINTS.has(url)) {
        if (!refreshMutex.isLocked()) {
            const release = await refreshMutex.acquire();
            try {
                const refreshResult = await rawBaseQuery(
                    { url: "/auth/refresh", method: "POST" },
                    api,
                    extraOptions
                );
                if (!refreshResult.error) {
                    result = await rawBaseQuery(args, api, extraOptions);
                }
                // A failed refresh means the session is genuinely over --
                // return the original 401 as-is, no retry. The UI treats
                // any 401 from a protected query as "logged out."
            } finally {
                release();
            }
        } else {
            // Another request is already refreshing -- wait for it, then
            // retry once with whatever session state resulted.
            await refreshMutex.waitForUnlock();
            result = await rawBaseQuery(args, api, extraOptions);
        }
    }

    return result;
};
