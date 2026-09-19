import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { authApi } from "../../features/auth/authApi";
import UnmergedCartNotice from "./UnmergedCartNotice";

const guestItem = {
    id: 1,
    title: "Fjallraven Foldsack No. 1",
    price: 109.95,
    image: "backpack.jpg",
    quantity: 2,
};

describe("UnmergedCartNotice", () => {
    it("renders nothing pre-login, even with items in the local cart", () => {
        renderWithProviders(<UnmergedCartNotice />, { preloadedState: { cart: [guestItem] } });

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("renders nothing once authenticated if the local cart is already empty", async () => {
        const { store } = renderWithProviders(<UnmergedCartNotice />, { preloadedState: { cart: [] } });
        await store.dispatch(authApi.util.upsertQueryData("getMe", undefined, { id: "u1", email: "shopper@example.com" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("warns once authenticated with items still stuck in the local (unmerged) cart", async () => {
        const { store } = renderWithProviders(<UnmergedCartNotice />, { preloadedState: { cart: [guestItem] } });
        await store.dispatch(authApi.util.upsertQueryData("getMe", undefined, { id: "u1", email: "shopper@example.com" }));

        expect(await screen.findByText(/1 item from before you signed in/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });
});
