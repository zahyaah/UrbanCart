import { eq, and, sql, asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { cartItems, products, MAX_LINE_ITEM_QTY } from "../../db/schema.js";
import { Errors } from "../../lib/errors.js";

export interface CartItemView {
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function loadCart(userId: string, tx: Tx | typeof db = db): Promise<CartItemView[]> {
    const rows = await tx
        .select({
            productId: cartItems.productId,
            quantity: cartItems.quantity,
            title: products.title,
            priceCents: products.priceCents,
            image: products.image,
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.userId, userId))
        .orderBy(asc(cartItems.createdAt));

    return rows.map((r) => ({
        productId: r.productId,
        title: r.title,
        price: r.priceCents / 100,
        image: r.image,
        quantity: r.quantity,
    }));
}

export async function getCart(userId: string): Promise<CartItemView[]> {
    return loadCart(userId);
}

export async function addToCart(userId: string, productId: string, quantity: number): Promise<CartItemView[]> {
    const product = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.isActive, true)),
    });
    if (!product) throw Errors.notFound("Product not found");

    // Clamp on the INSERT path too, not just ON CONFLICT's UPDATE -- the
    // first add for a product has no existing row to LEAST() against, so an
    // unclamped quantity here would hit the CHECK constraint directly
    // instead of being handled as an ordinary cap.
    const initialQuantity = Math.min(quantity, MAX_LINE_ITEM_QTY);

    await db
        .insert(cartItems)
        .values({ userId, productId, quantity: initialQuantity })
        .onConflictDoUpdate({
            target: [cartItems.userId, cartItems.productId],
            set: {
                quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, ${MAX_LINE_ITEM_QTY})`,
                updatedAt: sql`now()`,
            },
        });

    return loadCart(userId);
}

export async function setCartItemQuantity(userId: string, productId: string, quantity: number): Promise<CartItemView[]> {
    if (quantity === 0) {
        return removeFromCart(userId, productId);
    }

    const product = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.isActive, true)),
    });
    if (!product) throw Errors.notFound("Product not found");

    const cappedQuantity = Math.min(quantity, MAX_LINE_ITEM_QTY);
    await db
        .insert(cartItems)
        .values({ userId, productId, quantity: cappedQuantity })
        .onConflictDoUpdate({
            target: [cartItems.userId, cartItems.productId],
            set: { quantity: cappedQuantity, updatedAt: sql`now()` },
        });

    return loadCart(userId);
}

export async function removeFromCart(userId: string, productId: string): Promise<CartItemView[]> {
    await db.delete(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
    return loadCart(userId);
}

export async function clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

// ---------------------------------------------------------------------------
// Guest-cart-merge-on-login. See server/spec/SPEC-cart.md for the full
// design and the doubt review that shaped it.
// ---------------------------------------------------------------------------

interface RawMergeItem {
    productId: unknown;
    quantity: unknown;
}

interface ParsedMergeItem {
    productId: string;
    quantity: number;
}

function parseItemShape(raw: unknown): ParsedMergeItem | { invalid: true; productId: string | null } {
    if (typeof raw !== "object" || raw === null) return { invalid: true, productId: null };
    const item = raw as RawMergeItem;
    const productId = typeof item.productId === "string" ? item.productId : null;
    const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);

    if (!productId || !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        return { invalid: true, productId };
    }
    return { productId, quantity };
}

/** Does the actual merge work inside an already-open transaction -- it owns
 * no transaction boundary of its own. The caller (routes.ts) runs this
 * inside the SAME transaction as the idempotency-key success record, under
 * REPEATABLE READ, with a retry on serialization failure. That pairing
 * matters: on its own, re-running this logic against the same request body
 * would double-apply the merge exactly like the bug the idempotency
 * mechanism exists to prevent (summing quantities is not naturally
 * idempotent) -- see SPEC-orders.md's doubt review, finding #2, which
 * applies here just as much as to order creation. */
export async function applyCartMerge(
    tx: Tx,
    userId: string,
    rawItems: unknown[]
): Promise<{ items: CartItemView[]; adjustments: Adjustment[] }> {
    const adjustments: Adjustment[] = [];
    const aggregated = new Map<string, number>();

    for (const raw of rawItems) {
        const parsed = parseItemShape(raw);
        if ("invalid" in parsed) {
            adjustments.push({
                productId: parsed.productId ?? "unknown",
                reason: "invalid_item_shape",
                requestedQuantity: null,
                appliedQuantity: 0,
            });
            continue;
        }
        aggregated.set(parsed.productId, (aggregated.get(parsed.productId) ?? 0) + parsed.quantity);
    }

    for (const [productId, requestedQuantity] of aggregated) {
        const product = await tx.query.products.findFirst({
            where: and(eq(products.id, productId), eq(products.isActive, true)),
        });
        if (!product) {
            adjustments.push({ productId, reason: "unknown_product", requestedQuantity, appliedQuantity: 0 });
            continue;
        }

        const existing = await tx.query.cartItems.findFirst({
            where: and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
        });
        const existingQuantity = existing?.quantity ?? 0;
        const wanted = existingQuantity + requestedQuantity;
        const applied = Math.min(wanted, MAX_LINE_ITEM_QTY);

        await tx
            .insert(cartItems)
            .values({ userId, productId, quantity: applied })
            .onConflictDoUpdate({
                target: [cartItems.userId, cartItems.productId],
                set: { quantity: applied, updatedAt: sql`now()` },
            });

        if (applied < wanted) {
            adjustments.push({ productId, reason: "quantity_capped", requestedQuantity: wanted, appliedQuantity: applied });
        }
    }

    return { items: await loadCart(userId, tx), adjustments };
}
