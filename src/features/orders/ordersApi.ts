import { createApi } from "@reduxjs/toolkit/query/react";
import { apiBaseQuery } from "../../lib/rtkBaseQuery";
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
    endpoints: (builder) => ({
        // idempotencyKey is generated once when the Review step's "Place
        // Order" is first clicked and reused across automatic retries of
        // that same attempt -- a fresh click after a genuine failure gets
        // a fresh key. See SPEC-orders.md.
        createOrder: builder.mutation<
            { orderId: string; clientSecret: string },
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
        }),
    }),
});

export const { useCreateOrderMutation, useGetOrderQuery, useLazyGetOrderQuery } = ordersApi;
