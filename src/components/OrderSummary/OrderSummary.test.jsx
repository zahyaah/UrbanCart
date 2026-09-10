import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import OrderSummary from "./OrderSummary";

const line = (overrides) => ({
    id: 1,
    title: "Backpack",
    price: 100,
    image: "a.jpg",
    quantity: 1,
    ...overrides,
});

const renderSummary = (cart, props = {}) =>
    renderWithProviders(<OrderSummary {...props} />, { preloadedState: { cart } });

// The displayed total is the row labelled "Total Amount", not any of the
// intermediate price rows.
const totalAmount = () =>
    screen.getByText("Total Amount").parentElement.querySelector("span:last-child").textContent;

describe("OrderSummary", () => {
    it("applies the $5 fixed discount and the 5% discount to the subtotal", () => {
        // 100.00 subtotal - $5 fixed - $5.00 (5%) = $90.00
        renderSummary([line({ price: 100, quantity: 1 })]);

        expect(screen.getByText("$100")).toBeInTheDocument();
        expect(totalAmount()).toBe("$90.00");
    });

    it("prices multiple units and multiple line items together", () => {
        // (109.95 * 2) + (22.30 * 3) = 286.80; -5 fixed; -14.34 (5%) = 267.46
        renderSummary([
            line({ id: 1, price: 109.95, quantity: 2 }),
            line({ id: 2, price: 22.3, quantity: 3 }),
        ]);

        expect(totalAmount()).toBe("$267.46");
    });

    it("never charges a negative total when the cart is worth less than the fixed discount", () => {
        // A $4 cart cannot become -$1.20; the floor keeps it at zero.
        renderSummary([line({ price: 4, quantity: 1 })]);

        expect(totalAmount()).toBe("$0.00");
    });

    it("reports the unit count rather than the line-item count", () => {
        renderSummary([
            line({ id: 1, quantity: 2 }),
            line({ id: 2, quantity: 3 }),
        ]);

        expect(screen.getByText(/Price Details \(5 items\)/)).toBeInTheDocument();
    });

    it("hides the call to action when the cart is empty", () => {
        renderSummary([]);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("labels the action for the cart page by default", () => {
        renderSummary([line()]);

        expect(screen.getByRole("button", { name: "PROCEED TO CHECKOUT" })).toBeInTheDocument();
    });

    it("labels the action for the checkout page in checkout mode", () => {
        renderSummary([line()], { mode: "checkout" });

        expect(screen.getByRole("button", { name: "PLACE ORDER" })).toBeInTheDocument();
    });

    it("calls the supplied handler instead of navigating when one is given", async () => {
        const onCtaClick = vi.fn();
        renderSummary([line()], { onCtaClick, ctaLabel: "CONFIRM" });

        await userEvent.setup().click(screen.getByRole("button", { name: "CONFIRM" }));

        expect(onCtaClick).toHaveBeenCalledTimes(1);
    });
});
