import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "../redux/store";
import { authApi } from "../features/auth/authApi";
import { useSession } from "./useSession";

const user = { id: "u1", email: "shopper@example.com" };

// Every RTK Query slice goes through apiBaseQuery; replacing it lets each
// test choose what the next getMe refetch returns (a real 401, a 500, a
// network failure) instead of depending on this environment's fetch, which
// can't complete a request at all (jsdom's AbortSignal isn't recognized by
// Node's undici-backed Request).
const nextResponse = vi.hoisted(() => ({ current: null }));
vi.mock("../lib/rtkBaseQuery", () => ({ apiBaseQuery: async () => nextResponse.current }));

beforeEach(() => {
    nextResponse.current = { data: { user } };
});

function renderSessionWithSeededUser() {
    const store = createStore();
    store.dispatch(authApi.util.upsertQueryData("getMe", undefined, user));
    const { result } = renderHook(() => useSession(), {
        wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    return { result, store };
}

async function refetchSessionWith(store, response) {
    nextResponse.current = response;
    await store.dispatch(authApi.util.invalidateTags(["Session"]));
}

describe("useSession", () => {
    it("returns the cached user while getMe holds a successful result", async () => {
        const { result } = renderSessionWithSeededUser();

        await waitFor(() => expect(result.current.user).toEqual(user));
    });

    // The bug this hook exists to fix once, for every consumer
    // (AuthMenu, useCart, Checkout): RTK Query keeps the last *successful*
    // `data` around even after a later refetch errors. Logging out
    // invalidates the "Session" tag and re-triggers getMe, which correctly
    // 401s, but raw `data` would still hold the old user.
    it("clears user to undefined once a Session refetch returns 401, even though getMe's data still holds the old user", async () => {
        const { result, store } = renderSessionWithSeededUser();
        await waitFor(() => expect(result.current.user).toEqual(user));

        await refetchSessionWith(store, { error: { status: 401, data: {} } });

        await waitFor(() => expect(result.current.user).toBeUndefined());
    });

    // Regression: any error used to count as "logged out", so a Render cold
    // start or a dropped connection flipped a signed-in shopper to guest
    // mode and routed add-to-cart into the local cart.
    it.each([
        ["a 500", { error: { status: 500, data: {} } }],
        ["a network failure", { error: { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" } }],
    ])("keeps the last known user when the refetch fails with %s", async (_label, response) => {
        const { result, store } = renderSessionWithSeededUser();
        await waitFor(() => expect(result.current.user).toEqual(user));

        await refetchSessionWith(store, response);

        await waitFor(() => expect(authApi.endpoints.getMe.select()(store.getState()).isError).toBe(true));
        expect(result.current.user).toEqual(user);
    });
});
