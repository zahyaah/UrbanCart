import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// The core domain type: a full product snapshot captured at add-to-cart
// time. See ADR-0001 -- storing this instead of just an id is what removed
// the cart's original race condition, and it's why the cart never needs to
// re-fetch product data to render.
export interface CartItem {
    id: number | string;
    title: string;
    price: number;
    image: string;
    quantity: number;
}

type CartState = CartItem[];

// quantity defaults to 1 when omitted -- see the addToCart reducer below.
type AddToCartPayload = Omit<CartItem, "quantity"> & { quantity?: number };
type CartItemId = { id: CartItem["id"] };

export const CART_STORAGE_KEY = "urbancart-cart";

// Persisted cart state is untrusted input -- it can be hand-edited, come
// from an older schema, or be corrupted. Narrow it before trusting the
// shape, rather than assuming JSON.parse returned well-formed CartItems.
const isValidCartItem = (item: unknown): item is CartItem => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    const { id, title, price, image, quantity } = candidate;

    return (
        (typeof id === "number" || typeof id === "string") &&
        typeof title === "string" &&
        typeof price === "number" &&
        typeof image === "string" &&
        typeof quantity === "number" &&
        Number.isInteger(quantity) &&
        quantity > 0
    );
};

const loadState = (): CartState => {
    try {
        const serialized = localStorage.getItem(CART_STORAGE_KEY);
        if (!serialized) return [];
        const parsed: unknown = JSON.parse(serialized);
        return Array.isArray(parsed) ? parsed.filter(isValidCartItem) : [];
    } catch (e) {
        console.error("Could not load cart state", e);
        return [];
    }
};

const initialState: CartState = loadState();

export const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        // Adds a full product snapshot. Price/title/image are locked in at
        // add time so the cart never needs to re-fetch product data.
        addToCart: (state, action: PayloadAction<AddToCartPayload>) => {
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
        incrementQuantity: (state, action: PayloadAction<CartItemId>) => {
            const existingItem = state.find((item) => item.id === action.payload.id);
            if (existingItem) {
                existingItem.quantity += 1;
            }
        },
        decrementQuantity: (state, action: PayloadAction<CartItemId>) => {
            const existingItem = state.find((item) => item.id === action.payload.id);
            if (!existingItem) return;
            if (existingItem.quantity <= 1) {
                return state.filter((item) => item.id !== action.payload.id);
            }
            existingItem.quantity -= 1;
        },
        removeFromCart: (state, action: PayloadAction<CartItemId>) => {
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
