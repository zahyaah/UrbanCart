import { configureStore } from "@reduxjs/toolkit";
import cartReducer, { CART_STORAGE_KEY } from "../features/cart/cartSlice";
import { productsApi } from "../features/products/productsApi";

// Factory so tests can build an isolated store (with preloaded state) that is
// wired exactly like the real one, instead of reaching for the app singleton.
export function createStore(preloadedState) {
    return configureStore({
        reducer: {
            cart: cartReducer,
            [productsApi.reducerPath]: productsApi.reducer,
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(productsApi.middleware),
        preloadedState,
    });
}

export const store = createStore();

store.subscribe(() => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.getState().cart));
    } catch (e) {
        console.error("Could not persist cart state", e);
    }
});
