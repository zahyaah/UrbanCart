import { createApi } from "@reduxjs/toolkit/query/react";
import { apiBaseQuery } from "../../lib/rtkBaseQuery";

// The SERVER cart -- distinct from cartSlice.js's local/guest cart. Once a
// user is logged in, this is the source of truth; cartSlice's Redux state
// is only used pre-login. See ADR-0004: server cart items never carry a
// snapshotted price, always resolved live.
export interface ServerCartItem {
    productId: string;
    title: string;
    price: number;
    image: string;
    quantity: number;
}

export interface Adjustment {
    productId: string;
    reason: "unknown_product" | "invalid_quantity" | "invalid_item_shape" | "quantity_capped";
    requestedQuantity: number | null;
    appliedQuantity: number;
}

export interface MergeCartItem {
    productId: string;
    quantity: number;
}

export const cartApi = createApi({
    reducerPath: "cartApi",
    baseQuery: apiBaseQuery,
    tagTypes: ["Cart"],
    endpoints: (builder) => ({
        getServerCart: builder.query<ServerCartItem[], void>({
            query: () => "/cart",
            transformResponse: (response: { items: ServerCartItem[] }) => response.items,
            providesTags: ["Cart"],
        }),
        addServerCartItem: builder.mutation<ServerCartItem[], { productId: string; quantity?: number }>({
            query: (body) => ({ url: "/cart/items", method: "POST", body }),
            transformResponse: (response: { items: ServerCartItem[] }) => response.items,
            invalidatesTags: ["Cart"],
        }),
        // Applied to the server's current quantity, not one computed from
        // this cache -- two quick clicks are two decrements. Increment needs
        // no counterpart: POST /cart/items already adds atomically.
        decrementServerCartItem: builder.mutation<ServerCartItem[], string>({
            query: (productId) => ({ url: `/cart/items/${productId}/decrement`, method: "POST" }),
            transformResponse: (response: { items: ServerCartItem[] }) => response.items,
            invalidatesTags: ["Cart"],
        }),
        removeServerCartItem: builder.mutation<ServerCartItem[], string>({
            query: (productId) => ({ url: `/cart/items/${productId}`, method: "DELETE" }),
            transformResponse: (response: { items: ServerCartItem[] }) => response.items,
            invalidatesTags: ["Cart"],
        }),
        clearServerCart: builder.mutation<void, void>({
            query: () => ({ url: "/cart", method: "DELETE" }),
            invalidatesTags: ["Cart"],
        }),
        // Guest-cart-merge-on-login. idempotencyKey is generated once by
        // the caller (see hooks/useGuestCartMerge.ts) and reused across
        // automatic retries of the same attempt -- see SPEC-cart.md.
        mergeGuestCart: builder.mutation<
            { items: ServerCartItem[]; adjustments: Adjustment[] },
            { items: MergeCartItem[]; idempotencyKey: string }
        >({
            query: ({ items, idempotencyKey }) => ({
                url: "/cart/merge",
                method: "POST",
                body: { items },
                headers: { "idempotency-key": idempotencyKey },
            }),
            invalidatesTags: ["Cart"],
        }),
    }),
});

export const {
    useGetServerCartQuery,
    useAddServerCartItemMutation,
    useDecrementServerCartItemMutation,
    useRemoveServerCartItemMutation,
    useClearServerCartMutation,
    useMergeGuestCartMutation,
} = cartApi;
