import { combineReducers, configureStore } from "@reduxjs/toolkit";
import cartReducer, { CART_STORAGE_KEY } from "../features/cart/cartSlice";
import { productsApi } from "../features/products/productsApi";

// Defined independently of the store so RootState (below) doesn't depend on
// createStore's own preloadedState parameter, which is itself typed against
// RootState -- store -> createStore -> RootState -> store would be a
// circular type.
const rootReducer = combineReducers({
    cart: cartReducer,
    [productsApi.reducerPath]: productsApi.reducer,
});

// Inferred from the reducer map, so this can never drift from the actual
// state shape -- see src/redux/hooks.ts for the typed useSelector/
// useDispatch built on top of it.
export type RootState = ReturnType<typeof rootReducer>;

// Factory so tests can build an isolated store (with preloaded state) that is
// wired exactly like the real one, instead of reaching for the app singleton.
export function createStore(preloadedState?: Partial<RootState>) {
    return configureStore({
        reducer: rootReducer,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(productsApi.middleware),
        preloadedState,
    });
}

export const store = createStore();

export type AppDispatch = typeof store.dispatch;

store.subscribe(() => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(store.getState().cart));
    } catch (e) {
        console.error("Could not persist cart state", e);
    }
});
