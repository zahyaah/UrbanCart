import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "../redux/store";
import { authApi } from "../features/auth/authApi";
import { useSession } from "./useSession";

const user = { id: "u1", email: "shopper@example.com" };

// Pre-seeding the cache before rendering (rather than after) matters here:
// this hook subscribes to getMe directly, so an empty cache at mount fires
// a real fetch, which this test environment can't complete (see
// AuthMenu.test.jsx's note on jsdom/undici's AbortSignal gap).
function renderSessionWithSeededUser() {
    const store = createStore();
    store.dispatch(authApi.util.upsertQueryData("getMe", undefined, user));
    const { result } = renderHook(() => useSession(), {
        wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    return { result, store };
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
    // fails, but raw `data` would still hold the old user. Every caller of
    // this hook needs `user` to become undefined at that point -- for
    // useCart specifically, the alternative is a shopper who logs out and
    // keeps shopping getting routed through server-cart calls that 401.
    it("clears user to undefined once a Session-invalidating refetch fails, even though getMe's data still holds the old user", async () => {
        const { result, store } = renderSessionWithSeededUser();
        await waitFor(() => expect(result.current.user).toEqual(user));

        await store.dispatch(authApi.util.invalidateTags(["Session"]));

        await waitFor(() => expect(result.current.user).toBeUndefined());
    });
});
