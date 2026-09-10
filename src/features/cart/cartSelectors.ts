import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../redux/store";
import type { CartItem } from "./cartSlice";

export const selectCartItems = (state: RootState): CartItem[] => state.cart;

export const selectCartItemCount = createSelector([selectCartItems], (items) =>
    items.reduce((sum, item) => sum + item.quantity, 0)
);

export const selectCartSubtotal = createSelector([selectCartItems], (items) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);
