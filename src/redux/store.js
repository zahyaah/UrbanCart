import { configureStore } from "@reduxjs/toolkit";
import cartReducer, { CART_STORAGE_KEY } from "../features/cart/cartSlice";
import { productsApi } from "../features/products/productsApi";

export const store = configureStore({
    reducer: {
        cart: cartReducer,
        [productsApi.reducerPath]: productsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(productsApi.middleware),
});

store.subscribe(() => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.getState().cart));
    } catch (e) {
        console.error("Could not persist cart state", e);
    }
});
