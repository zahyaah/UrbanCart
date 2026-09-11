import { z } from "zod";

export const shippingAddressSchema = z.object({
    fullName: z.string().trim().min(1).max(200),
    addressLine1: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().max(120).optional(),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).max(120),
});

export const createOrderRequestSchema = z.object({
    shippingAddress: shippingAddressSchema,
});

export const createOrderResponseSchema = z.object({
    orderId: z.uuid(),
    clientSecret: z.string(),
});

export const orderItemResponseSchema = z.object({
    productId: z.uuid(),
    title: z.string(),
    price: z.number(),
    quantity: z.number().int(),
});

export const orderResponseSchema = z.object({
    id: z.uuid(),
    status: z.enum(["pending_payment", "paid", "failed", "cancelled"]),
    subtotal: z.number(),
    items: z.array(orderItemResponseSchema),
    shippingAddress: shippingAddressSchema,
    createdAt: z.string(),
});

export const orderIdParamsSchema = z.object({
    id: z.uuid(),
});
