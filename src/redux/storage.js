import { configureStore } from "@reduxjs/toolkit"
import CartReducer from "../features/cart/cartSlice"

export const storage = configureStore({
    reducer: CartReducer,
})
