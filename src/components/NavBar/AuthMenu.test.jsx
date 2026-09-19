import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { authApi } from "../../features/auth/authApi";
import { createStore } from "../../redux/store";
import AuthMenu from "./AuthMenu";

const user = { id: "u1", email: "shopper@example.com" };

// Seeding the cache *before* render (rather than after, the way
// UnmergedCartNotice's tests do it) matters here specifically: AuthMenu is
// the one component that subscribes to getMe directly, so if the cache is
// still empty when it mounts, RTK Query fires a real fetch. This test
// environment can't complete a real fetch (jsdom's AbortSignal isn't
// recognized by Node's undici-backed Request/fetch, a pre-existing
// environment gap visible as console noise on every other test that touches
// an RTK Query endpoint) -- pre-seeding means that query already has cached
// data on mount and RTK Query's default refetchOnMountOrArgChange: false
// never fires it in the first place.
function renderWithSeededUser() {
    const store = createStore();
    store.dispatch(authApi.util.upsertQueryData("getMe", undefined, user));
    return renderWithProviders(<AuthMenu />, { store });
}

describe("AuthMenu", () => {
    it("shows the account menu while getMe holds a cached, successful user", async () => {
        renderWithSeededUser();

        expect(
            await screen.findByRole("button", { name: /Account menu for shopper@example\.com/ })
        ).toBeInTheDocument();
    });

    // Regression: logging out invalidates the "Session" tag, which
    // re-triggers this same getMe query -- RTK Query keeps the *last
    // successful* `data` around even after that refetch errors, so a stale
    // cached user kept rendering the signed-in dropdown after a logout that
    // had already succeeded server-side. Indistinguishable, from the
    // user's side, from logout silently doing nothing.
    it("switches to Sign In once a Session-invalidating refetch fails, even though `data` still holds the old user", async () => {
        const { store } = renderWithSeededUser();
        expect(await screen.findByRole("button", { name: /Account menu for/ })).toBeInTheDocument();

        // What the logout mutation actually does to the cache
        // (invalidatesTags: ["Session"]) -- re-triggers getMe for every
        // active subscriber, exactly as it would after a real logout. The
        // refetch itself fails (see the environment note above), landing
        // getMe in the same data-present/isError-true state a real 401
        // would.
        await store.dispatch(authApi.util.invalidateTags(["Session"]));

        expect(await screen.findByRole("link", { name: "Sign In" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Account menu for/ })).not.toBeInTheDocument();
    });
});
