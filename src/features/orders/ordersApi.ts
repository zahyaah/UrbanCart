import { createApi } from "@reduxjs/toolkit/query/react";
import { apiBaseQuery } from "../../lib/rtkBaseQuery";
import { cartApi } from "../cart/cartApi";
import type { Address } from "../../components/Checkout/checkoutTypes";

export interface OrderItem {
    productId: string;
    title: string;
    price: number;
    quantity: number;
}

export interface Order {
    id: string;
    status: "pending_payment" | "paid" | "failed" | "cancelled";
    subtotal: number;
    items: OrderItem[];
    shippingAddress: Address;
    createdAt: string;
}

export const ordersApi = createApi({
    reducerPath: "ordersApi",
    baseQuery: apiBaseQuery,
    tagTypes: ["Order"],
    endpoints: (builder) => ({
        // idempotencyKey is generated once when the Review step's "Place
        // Order" is first clicked and reused across automatic retries of
        // that same attempt -- a fresh click after a genuine failure gets
        // a fresh key. See SPEC-orders.md.
        createOrder: builder.mutation<
            { orderId: string },
            { idempotencyKey: string; shippingAddress: Address }
        >({
            query: ({ idempotencyKey, shippingAddress }) => ({
                url: "/orders",
                method: "POST",
                headers: { "idempotency-key": idempotencyKey },
                body: { shippingAddress },
            }),
        }),
        getOrder: builder.query<Order, string>({
            query: (id) => `/orders/${id}`,
            providesTags: (_result, _error, id) => [{ type: "Order", id }],
        }),
        // Demo payment: sends no amount and no payment details -- the
        // server marks the caller's own pending order paid at the total it
        // fixed from DB prices when the order was created.
        payOrder: builder.mutation<Order, string>({
            query: (id) => ({ url: `/orders/${id}/pay`, method: "POST" }),
            invalidatesTags: (_result, _error, id) => [{ type: "Order", id }],
            // Paying removes the order's items from the server cart, which
            // lives in a different API slice -- refetch it explicitly.
            async onQueryStarted(_id, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled;
                    dispatch(cartApi.util.invalidateTags(["Cart"]));
                } catch {
                    // The caller handles a failed payment (unwrap + toast).
                }
            },
        }),
    }),
});

export const { useCreateOrderMutation, useGetOrderQuery, useLazyGetOrderQuery, usePayOrderMutation } = ordersApi;
