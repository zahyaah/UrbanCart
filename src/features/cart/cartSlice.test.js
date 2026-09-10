import { describe, it, expect } from "vitest";
import reducer, {
    addToCart,
    incrementQuantity,
    decrementQuantity,
    removeFromCart,
    clearCart,
} from "./cartSlice";

const backpack = {
    id: 1,
    title: "Fjallraven Foldsack No. 1",
    price: 109.95,
    image: "backpack.jpg",
};

const tshirt = {
    id: 2,
    title: "Mens Casual Premium Slim Fit T-Shirt",
    price: 22.3,
    image: "tshirt.jpg",
};

describe("cartSlice / addToCart", () => {
    it("adds a full product snapshot so the cart never needs to re-fetch", () => {
        const state = reducer([], addToCart({ ...backpack, quantity: 1 }));

        // The snapshot is the whole point: price/title/image live in cart state,
        // which is what removed the per-render product fetch.
        expect(state).toEqual([
            {
                id: 1,
                title: "Fjallraven Foldsack No. 1",
                price: 109.95,
                image: "backpack.jpg",
                quantity: 1,
            },
        ]);
    });

    it("defaults quantity to 1 when the payload omits it", () => {
        const state = reducer([], addToCart(backpack));

        expect(state[0].quantity).toBe(1);
    });

    it("merges into the existing line item instead of duplicating it", () => {
        let state = reducer([], addToCart({ ...backpack, quantity: 2 }));
        state = reducer(state, addToCart({ ...backpack, quantity: 3 }));

        expect(state).toHaveLength(1);
        expect(state[0].quantity).toBe(5);
    });

    it("keeps separate products as separate line items", () => {
        let state = reducer([], addToCart(backpack));
        state = reducer(state, addToCart(tshirt));

        expect(state.map((item) => item.id)).toEqual([1, 2]);
    });
});

describe("cartSlice / incrementQuantity", () => {
    it("increments the matching item by one", () => {
        const initial = [{ ...backpack, quantity: 2 }];

        const state = reducer(initial, incrementQuantity({ id: 1 }));

        expect(state[0].quantity).toBe(3);
    });

    it("is a no-op for an id that is not in the cart", () => {
        const initial = [{ ...backpack, quantity: 1 }];

        const state = reducer(initial, incrementQuantity({ id: 999 }));

        // Guard against the malformed-entry bug: a stale stepper must never
        // create a line item with undefined title/price/image.
        expect(state).toEqual(initial);
    });
});

describe("cartSlice / decrementQuantity", () => {
    it("decrements the matching item by one", () => {
        const initial = [{ ...backpack, quantity: 3 }];

        const state = reducer(initial, decrementQuantity({ id: 1 }));

        expect(state[0].quantity).toBe(2);
    });

    it("removes the item entirely when the last unit is decremented", () => {
        const initial = [{ ...backpack, quantity: 1 }];

        const state = reducer(initial, decrementQuantity({ id: 1 }));

        expect(state).toEqual([]);
    });

    it("never leaves an item at zero or negative quantity", () => {
        let state = [{ ...backpack, quantity: 2 }];
        state = reducer(state, decrementQuantity({ id: 1 }));
        state = reducer(state, decrementQuantity({ id: 1 }));
        state = reducer(state, decrementQuantity({ id: 1 }));

        expect(state).toEqual([]);
    });

    it("is a no-op for an id that is not in the cart", () => {
        const initial = [{ ...backpack, quantity: 1 }];

        const state = reducer(initial, decrementQuantity({ id: 999 }));

        expect(state).toEqual(initial);
    });

    it("leaves sibling items untouched when one is removed", () => {
        const initial = [
            { ...backpack, quantity: 1 },
            { ...tshirt, quantity: 4 },
        ];

        const state = reducer(initial, decrementQuantity({ id: 1 }));

        expect(state).toEqual([{ ...tshirt, quantity: 4 }]);
    });
});

describe("cartSlice / removeFromCart", () => {
    it("removes the item regardless of quantity", () => {
        const initial = [{ ...backpack, quantity: 7 }];

        const state = reducer(initial, removeFromCart({ id: 1 }));

        expect(state).toEqual([]);
    });

    it("is a no-op for an id that is not in the cart", () => {
        const initial = [{ ...backpack, quantity: 1 }];

        const state = reducer(initial, removeFromCart({ id: 999 }));

        expect(state).toEqual(initial);
    });
});

describe("cartSlice / clearCart", () => {
    it("empties a populated cart", () => {
        const initial = [
            { ...backpack, quantity: 2 },
            { ...tshirt, quantity: 1 },
        ];

        const state = reducer(initial, clearCart());

        expect(state).toEqual([]);
    });
});

describe("cartSlice / rapid sequential dispatches", () => {
    // Regression guard for the original bug: quantity changes used to trigger
    // overlapping product re-fetches that could resolve out of order and
    // overwrite state. Cart state is now derived purely from dispatch order.
    it("applies every increment in a rapid burst exactly once", () => {
        let state = reducer([], addToCart(backpack));

        for (let i = 0; i < 10; i += 1) {
            state = reducer(state, incrementQuantity({ id: 1 }));
        }

        expect(state).toHaveLength(1);
        expect(state[0].quantity).toBe(11);
    });

    it("survives an interleaved increment/decrement burst without drift", () => {
        let state = reducer([], addToCart({ ...backpack, quantity: 5 }));

        state = reducer(state, incrementQuantity({ id: 1 }));
        state = reducer(state, decrementQuantity({ id: 1 }));
        state = reducer(state, incrementQuantity({ id: 1 }));
        state = reducer(state, decrementQuantity({ id: 1 }));

        expect(state[0].quantity).toBe(5);
    });
});
