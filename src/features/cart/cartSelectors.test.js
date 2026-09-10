import { describe, it, expect, beforeEach } from "vitest";
import {
    selectCartItems,
    selectCartItemCount,
    selectCartSubtotal,
} from "./cartSelectors";

const stateWith = (items) => ({ cart: items });

const backpack = { id: 1, title: "Backpack", price: 109.95, image: "a.jpg", quantity: 1 };
const tshirt = { id: 2, title: "T-Shirt", price: 22.3, image: "b.jpg", quantity: 3 };

describe("selectCartItems", () => {
    it("returns the cart slice", () => {
        expect(selectCartItems(stateWith([backpack]))).toEqual([backpack]);
    });
});

describe("selectCartItemCount", () => {
    it("returns 0 for an empty cart", () => {
        expect(selectCartItemCount(stateWith([]))).toBe(0);
    });

    it("sums quantities rather than counting line items", () => {
        // 1 backpack + 3 t-shirts = 4 units across 2 line items.
        expect(selectCartItemCount(stateWith([backpack, tshirt]))).toBe(4);
    });
});

describe("selectCartSubtotal", () => {
    it("returns 0 for an empty cart", () => {
        expect(selectCartSubtotal(stateWith([]))).toBe(0);
    });

    it("multiplies price by quantity for each line and sums them", () => {
        // 109.95 * 1 + 22.30 * 3 = 176.85
        expect(selectCartSubtotal(stateWith([backpack, tshirt]))).toBeCloseTo(176.85, 2);
    });
});

describe("memoization", () => {
    // These selectors exist as createSelector instances specifically to stop
    // NavBar/Cart/OrderSummary each recomputing the same totals on every render.
    // Recomputation counts are module-level and cumulative, so reset per test.
    beforeEach(() => {
        selectCartItemCount.resetRecomputations();
        selectCartSubtotal.resetRecomputations();
    });

    it("returns a cached result when the cart reference is unchanged", () => {
        const items = [backpack, tshirt];
        const state = stateWith(items);

        const first = selectCartSubtotal(state);
        const second = selectCartSubtotal(state);

        expect(second).toBe(first);
        expect(selectCartSubtotal.recomputations()).toBe(1);
    });

    it("recomputes when the cart reference changes", () => {
        selectCartItemCount(stateWith([backpack]));
        selectCartItemCount(stateWith([backpack, tshirt]));

        expect(selectCartItemCount.recomputations()).toBe(2);
    });
});
