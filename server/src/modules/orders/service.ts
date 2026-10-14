import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { cartItems, products, orders, orderItems } from "../../db/schema.js";
import { ApiError, Errors } from "../../lib/errors.js";
import { shippingAddressSchema } from "./schemas.js";

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CartSnapshotLine {
    productId: string;
    title: string;
    unitPriceCents: number;
    quantity: number;
}

export interface CartSnapshot {
    lines: CartSnapshotLine[];
    subtotalCents: number;
}

/** Reads the live server cart and resolves current prices -- this is the
 * ONLY place order amounts come from. Never the client. See
 * security-and-hardening's "never trust client-supplied amounts." */
export async function snapshotCartForOrder(userId: string): Promise<CartSnapshot> {
    const rows = await db
        .select({
            productId: cartItems.productId,
            quantity: cartItems.quantity,
            title: products.title,
            priceCents: products.priceCents,
            isActive: products.isActive,
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.userId, userId))
        .orderBy(asc(cartItems.createdAt));

    if (rows.length === 0) {
        throw Errors.badRequest("Cart is empty");
    }

    // A product can be deactivated while it sits in someone's cart; cart
    // writes already refuse inactive products, so the order must too. 409
    // with the offending lines, so the client can name them and the shopper
    // can remove them -- nothing is silently dropped from what they ordered.
    const inactive = rows.filter((r) => !r.isActive);
    if (inactive.length > 0) {
        throw new ApiError(409, "PRODUCTS_UNAVAILABLE", "Some items in your cart are no longer available", {
            products: inactive.map((r) => ({ productId: r.productId, title: r.title })),
        });
    }

    const lines = rows.map((r) => ({
        productId: r.productId,
        title: r.title,
        unitPriceCents: r.priceCents,
        quantity: r.quantity,
    }));
    const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

    return { lines, subtotalCents };
}

/** Writes the order + order_items (price/title snapshotted -- see
 * ADR-0004) inside the caller's transaction, alongside the idempotency
 * success record. Does not touch the cart -- the paid items are removed
 * from it by payOrder, not at order-creation time, so an abandoned pending
 * order doesn't silently empty the shopper's cart. */
export async function applyOrderCreation(
    tx: Tx,
    orderId: string,
    userId: string,
    snapshot: CartSnapshot,
    shippingAddress: ShippingAddress
): Promise<{ orderId: string }> {
    const [order] = await tx
        .insert(orders)
        .values({
            id: orderId,
            userId,
            subtotalCents: snapshot.subtotalCents,
            shippingFullName: shippingAddress.fullName,
            shippingAddressLine1: shippingAddress.addressLine1,
            shippingCity: shippingAddress.city,
            shippingRegion: shippingAddress.region,
            shippingPostalCode: shippingAddress.postalCode,
            shippingCountry: shippingAddress.country,
        })
        .returning();
    if (!order) throw Errors.internal();

    await tx.insert(orderItems).values(
        snapshot.lines.map((l) => ({
            orderId: order.id,
            productId: l.productId,
            title: l.title,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
        }))
    );

    return { orderId: order.id };
}

export interface OrderView {
    id: string;
    status: "pending_payment" | "paid" | "failed" | "cancelled";
    subtotal: number;
    items: { productId: string; title: string; price: number; quantity: number }[];
    shippingAddress: ShippingAddress;
    createdAt: string;
}

export async function getOrderById(userId: string, orderId: string): Promise<OrderView | null> {
    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
    });
    if (!order) return null;

    const items = await db.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });

    return {
        id: order.id,
        status: order.status,
        subtotal: order.subtotalCents / 100,
        items: items.map((i) => ({
            productId: i.productId,
            title: i.title,
            price: i.unitPriceCents / 100,
            quantity: i.quantity,
        })),
        shippingAddress: {
            fullName: order.shippingFullName,
            addressLine1: order.shippingAddressLine1,
            city: order.shippingCity,
            region: order.shippingRegion ?? undefined,
            postalCode: order.shippingPostalCode,
            country: order.shippingCountry,
        },
        createdAt: order.createdAt.toISOString(),
    };
}

/** Demo payment for the caller's own order. Moves only pending_payment ->
 * paid, then removes the items THIS order covered from the cart -- not the
 * whole cart: a shopper could have added something new while the order was
 * pending, and that addition was never part of it. Already paid: returns
 * the order unchanged, so a double-click or retry is harmless. Returns null
 * when the order doesn't exist or belongs to someone else (the route maps
 * both to the same 404). The row lock serializes concurrent pays. */
export async function payOrder(userId: string, orderId: string): Promise<OrderView | null> {
    const outcome = await db.transaction(async (tx) => {
        const [order] = await tx
            .select({ id: orders.id, status: orders.status })
            .from(orders)
            .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
            .for("update");
        if (!order) return "not_found" as const;
        if (order.status === "paid") return "ok" as const;
        if (order.status !== "pending_payment") return "not_payable" as const;

        await tx.update(orders).set({ status: "paid", updatedAt: sql`now()` }).where(eq(orders.id, order.id));

        const paidItems = await tx
            .select({ productId: orderItems.productId })
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));
        const paidProductIds = paidItems.map((i) => i.productId);
        if (paidProductIds.length > 0) {
            await tx
                .delete(cartItems)
                .where(and(eq(cartItems.userId, userId), inArray(cartItems.productId, paidProductIds)));
        }
        return "ok" as const;
    });

    if (outcome === "not_found") return null;
    if (outcome === "not_payable") throw Errors.conflict("This order can no longer be paid");
    return getOrderById(userId, orderId);
}
