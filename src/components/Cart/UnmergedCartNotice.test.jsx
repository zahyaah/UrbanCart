import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { authApi } from "../../features/auth/authApi";
import { createStore } from "../../redux/store";
import UnmergedCartNotice from "./UnmergedCartNotice";

const guestItem = {
    id: 1,
    title: "Fjallraven Foldsack No. 1",
    price: 109.95,
    image: "backpack.jpg",
    quantity: 2,
};

// Seeded before render, not after: useCart now reads the session through
// useSession, which folds getMe's isError into whether `user` is truthy
// (see useSession.ts). If the cache is still empty when this component
// mounts, useGetMeQuery fires a real fetch -- one this test environment
// can't complete (jsdom's AbortSignal isn't recognized by Node's
// undici-backed Request/fetch) -- and that fetch's eventual rejection can
// land *after* a same-tick upsertQueryData call, clobbering the seeded user
// back to signed-out. Pre-seeding means the query already has cached data
// on mount, so RTK Query's default refetchOnMountOrArgChange: false never
// fires that real request in the first place.
function renderAuthenticated(ui, { preloadedState } = {}) {
    const store = createStore(preloadedState);
    store.dispatch(authApi.util.upsertQueryData("getMe", undefined, { id: "u1", email: "shopper@example.com" }));
    return renderWithProviders(ui, { store });
}

describe("UnmergedCartNotice", () => {
    it("renders nothing pre-login, even with items in the local cart", () => {
        renderWithProviders(<UnmergedCartNotice />, { preloadedState: { cart: [guestItem] } });

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("renders nothing once authenticated if the local cart is already empty", async () => {
        renderAuthenticated(<UnmergedCartNotice />, { preloadedState: { cart: [] } });

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("warns once authenticated with items still stuck in the local (unmerged) cart", async () => {
        renderAuthenticated(<UnmergedCartNotice />, { preloadedState: { cart: [guestItem] } });

        expect(await screen.findByText(/1 item from before you signed in/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
});
