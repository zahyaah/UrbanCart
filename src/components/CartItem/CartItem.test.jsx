import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import CartItem from "./CartItem";

const backpack = {
    id: 1,
    title: "Fjallraven Foldsack No. 1",
    price: 109.95,
    image: "backpack.jpg",
    quantity: 2,
};

const renderItem = (item = backpack) =>
    renderWithProviders(<CartItem item={item} />, { preloadedState: { cart: [item] } });

describe("CartItem", () => {
    it("shows the line total, not the unit price", () => {
        renderItem();

        // 109.95 x 2 -- the number the shopper is actually being charged.
        expect(screen.getByText("$ 219.90")).toBeInTheDocument();
    });

    it("renders the snapshot fields without needing a product fetch", () => {
        renderItem();

        expect(screen.getByRole("img", { name: backpack.title })).toHaveAttribute("src", "backpack.jpg");
        expect(screen.getByText(backpack.title)).toBeInTheDocument();
    });

    it("increments the quantity in the store", async () => {
        const { store } = renderItem();

        await userEvent.setup().click(
            screen.getByRole("button", { name: `Increase quantity of ${backpack.title}` })
        );

        expect(store.getState().cart[0].quantity).toBe(3);
    });

    it("decrements the quantity in the store", async () => {
        const { store } = renderItem();

        await userEvent.setup().click(
            screen.getByRole("button", { name: `Decrease quantity of ${backpack.title}` })
        );

        expect(store.getState().cart[0].quantity).toBe(1);
    });

    it("removes the line item outright regardless of quantity", async () => {
        const { store } = renderItem();

        await userEvent.setup().click(
            screen.getByRole("button", { name: `Remove ${backpack.title} from cart` })
        );

        expect(store.getState().cart).toEqual([]);
    });

    it("applies every click of a rapid increment burst", async () => {
        // The UI-level guard for the original race condition: clicking the
        // stepper faster than any async work could settle must not drop or
        // duplicate updates.
        const { store } = renderItem();
        const user = userEvent.setup();
        const plus = screen.getByRole("button", {
            name: `Increase quantity of ${backpack.title}`,
        });

        for (let i = 0; i < 5; i += 1) {
            await user.click(plus);
        }

        expect(store.getState().cart[0].quantity).toBe(7);
    });

    it("gives every control an accessible name that identifies the product", () => {
        // Icon-only buttons -- without these labels a screen reader announces
        // three unlabelled buttons per row.
        renderItem();

        expect(screen.getAllByRole("button")).toHaveLength(3);
        screen.getAllByRole("button").forEach((button) => {
            expect(button).toHaveAccessibleName(new RegExp(backpack.title));
        });
    });
});
