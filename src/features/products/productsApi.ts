import { createApi } from "@reduxjs/toolkit/query/react";
import { apiBaseQuery } from "../../lib/rtkBaseQuery";

// Matches the backend's public product shape (server/src/modules/catalog/schemas.ts).
// id is a uuid string, not a number -- our own database, not fakestoreapi.
export interface Product {
    id: string;
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
    baseQuery: apiBaseQuery,
    endpoints: (builder) => ({
        getProducts: builder.query<Product[], void>({
            query: () => "/products",
            transformResponse: (response: { products: Product[] }) => response.products,
        }),
        getProductById: builder.query<Product, string>({
            query: (id) => `/products/${id}`,
        }),
    }),
});

export const { useGetProductsQuery, useGetProductByIdQuery } = productsApi;
