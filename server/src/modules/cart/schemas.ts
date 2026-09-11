import { z } from "zod";

export const cartItemResponseSchema = z.object({
    productId: z.uuid(),
    title: z.string(),
    price: z.number(),
    image: z.string(),
    quantity: z.number().int(),
});

export const cartResponseSchema = z.object({
    items: z.array(cartItemResponseSchema),
});

export const addToCartSchema = z.object({
    productId: z.uuid(),
    quantity: z.number().int().positive().default(1),
});

export const setQuantitySchema = z.object({
    quantity: z.number().int().nonnegative(),
});

export const productIdParamsSchema = z.object({
    productId: z.uuid(),
});

export const adjustmentSchema = z.object({
    productId: z.string(),
    reason: z.enum(["unknown_product", "invalid_quantity", "invalid_item_shape", "quantity_capped"]),
    requestedQuantity: z.number().nullable(),
    appliedQuantity: z.number(),
});

export const mergeCartResponseSchema = z.object({
    items: z.array(cartItemResponseSchema),
    adjustments: z.array(adjustmentSchema),
});

// Deliberately permissive at the schema boundary -- SPEC-cart.md finding #7.
// Each element is validated individually in application code so one
// malformed item becomes an `adjustments` entry, not a whole-request 400.
export const mergeCartRequestSchema = z.object({
    items: z.array(z.unknown()).max(50),
});
