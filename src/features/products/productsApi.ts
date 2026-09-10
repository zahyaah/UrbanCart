import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// The Fake Store API's actual product shape (https://fakestoreapi.com/docs).
// category and rating are on the wire but currently unread by the app --
// kept here because the type should describe what the endpoint returns, not
// just today's usage; a consumer reaching for either next week shouldn't
// have to widen this type first.
export interface Product {
    id: number;
    title: string;
    price: number;
    description: string;
    category: string;
    image: string;
    rating: {
        rate: number;
        count: number;
    };
}

export const productsApi = createApi({
    reducerPath: "productsApi",
    baseQuery: fetchBaseQuery({ baseUrl: "https://fakestoreapi.com" }),
    endpoints: (builder) => ({
        getProducts: builder.query<Product[], void>({
            query: () => "/products",
        }),
        getProductById: builder.query<Product, number>({
            query: (id) => `/products/${id}`,
        }),
    }),
});

export const { useGetProductsQuery, useGetProductByIdQuery } = productsApi;
