import { eq, and, inArray, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { cartItems, products, orders, orderItems } from "../../db/schema.js";
import { Errors } from "../../lib/errors.js";
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
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.userId, userId))
        .orderBy(asc(cartItems.createdAt));

    if (rows.length === 0) {
        throw Errors.badRequest("Cart is empty");
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
 * success record. Does not touch the cart -- the cart is cleared once
 * payment is confirmed by the webhook, not at order-creation time, so an
 * abandoned pending order doesn't silently empty the shopper's cart. */
export async function applyOrderCreation(
    tx: Tx,
    orderId: string,
    userId: string,
    snapshot: CartSnapshot,
    stripeSessionId: string,
    shippingAddress: ShippingAddress
): Promise<{ orderId: string }> {
    const [order] = await tx
        .insert(orders)
        .values({
            id: orderId,
            userId,
            subtotalCents: snapshot.subtotalCents,
            stripeSessionId,
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

/** Idempotent by construction, not by a ledger: the conditional UPDATE is a
 * no-op if already applied, which is all a webhook handler needs --
 * Stripe's own at-least-once redelivery means this can run more than once
 * for the same event. See SPEC-orders.md's design section for why this
 * doesn't need the heavier idempotency_keys mechanism the client-facing
 * routes use (no client is waiting on a specific replayed response here). */
export async function markOrderPaidByStripeSession(stripeSessionId: string): Promise<void> {
    const [order] = await db
        .update(orders)
        .set({ status: "paid" })
        .where(and(eq(orders.stripeSessionId, stripeSessionId), eq(orders.status, "pending_payment")))
        .returning();

    // No row updated: either an unknown session, or a redelivered event for
    // an order already marked paid -- both are a correct no-op, matching
    // the idempotent-by-construction design above.
    if (!order) return;

    // Only remove the items THIS order paid for, not the whole cart -- a
    // shopper could have added something new while payment was pending, and
    // that new addition was never part of what they just paid for.
    const paidItems = await db.query.orderItems.findMany({ where: eq(orderItems.orderId, order.id) });
    const paidProductIds = paidItems.map((i) => i.productId);
    if (paidProductIds.length > 0) {
        await db
            .delete(cartItems)
            .where(and(eq(cartItems.userId, order.userId), inArray(cartItems.productId, paidProductIds)));
    }
}
