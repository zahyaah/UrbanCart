import { createSlice } from "@reduxjs/toolkit";

export const CART_STORAGE_KEY = "urbancart-cart";

const isValidCartItem = (item) =>
    Boolean(item) &&
    (typeof item.id === "number" || typeof item.id === "string") &&
    typeof item.title === "string" &&
    typeof item.price === "number" &&
    typeof item.image === "string" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0;

const loadState = () => {
    try {
        const serialized = localStorage.getItem(CART_STORAGE_KEY);
        if (!serialized) return [];
        const parsed = JSON.parse(serialized);
        return Array.isArray(parsed) ? parsed.filter(isValidCartItem) : [];
    } catch (e) {
        console.error("Could not load cart state", e);
        return [];
    }
};

const initialState = loadState();

export const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        // Adds a full product snapshot. Price/title/image are locked in at
        // add time so the cart never needs to re-fetch product data.
        addToCart: (state, action) => {
            const { id, title, price, image, quantity = 1 } = action.payload;
            const existingItem = state.find((item) => item.id === id);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                state.push({ id, title, price, image, quantity });
            }
        },
        // Stepper actions only ever operate on items already in the cart,
        // so a stale trigger can never create a malformed entry.
        incrementQuantity: (state, action) => {
            const existingItem = state.find((item) => item.id === action.payload.id);
            if (existingItem) {
                existingItem.quantity += 1;
            }
        },
        decrementQuantity: (state, action) => {
            const existingItem = state.find((item) => item.id === action.payload.id);
            if (!existingItem) return;
            if (existingItem.quantity <= 1) {
                return state.filter((item) => item.id !== action.payload.id);
            }
            existingItem.quantity -= 1;
        },
        removeFromCart: (state, action) => {
            return state.filter((item) => item.id !== action.payload.id);
        },
        clearCart: () => {
            return [];
        },
    },
});

export const {
    addToCart,
    incrementQuantity,
    decrementQuantity,
    removeFromCart,
    clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
