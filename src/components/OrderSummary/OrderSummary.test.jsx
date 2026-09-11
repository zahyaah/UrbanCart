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
    it("shows the total as exactly the subtotal -- no discount is applied here or by the server", () => {
        // ADR: this used to show a decorative "$5 + 5% off" that never
        // matched what checkout actually charged. Total Amount must equal
        // what Stripe is asked to charge (server/src/modules/orders'
        // snapshotCartForOrder computes the same plain sum), so there's no
        // discount math on either side until a real one exists on both.
        renderSummary([line({ price: 100, quantity: 1 })]);

        // "Total MRP" and "Total Amount" are now the identical figure --
        // both rows genuinely show $100.00, which is the point of the fix.
        expect(screen.getAllByText("$100.00")).toHaveLength(2);
        expect(totalAmount()).toBe("$100.00");
    });

    it("prices multiple units and multiple line items together", () => {
        // (109.95 * 2) + (22.30 * 3) = 286.80
        renderSummary([
            line({ id: 1, price: 109.95, quantity: 2 }),
            line({ id: 2, price: 22.3, quantity: 3 }),
        ]);

        expect(totalAmount()).toBe("$286.80");
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
