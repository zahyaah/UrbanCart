import { z } from "zod";

export const productResponseSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    description: z.string(),
    price: z.number(), // dollars -- converted from priceCents at the boundary
    category: z.string(),
    image: z.string(),
    rating: z.object({
        rate: z.number(),
        count: z.number(),
    }),
});

export const productListResponseSchema = z.object({
    products: z.array(productResponseSchema),
});

export const productIdParamsSchema = z.object({
    id: z.uuid(),
});
