import { createSelector } from "@reduxjs/toolkit";

export const selectCartItems = (state) => state.cart;

export const selectCartItemCount = createSelector([selectCartItems], (items) =>
    items.reduce((sum, item) => sum + item.quantity, 0)
);

export const selectCartSubtotal = createSelector([selectCartItems], (items) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);
