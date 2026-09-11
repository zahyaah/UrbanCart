import {
    pgTable,
    pgEnum,
    uuid,
    text,
    varchar,
    integer,
    boolean,
    timestamp,
    jsonb,
    primaryKey,
    index,
    unique,
    check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// refresh_tokens -- see server/spec/SPEC-identity.md for the rotation +
// reuse-detection design this table backs.
// ---------------------------------------------------------------------------

export const refreshTokens = pgTable(
    "refresh_tokens",
    {
        id: uuid().primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        // sha256 of the raw refresh token cookie value -- the raw value is
        // never persisted, only its hash.
        tokenHash: text("token_hash").notNull().unique(),
        // Copied forward on every rotation. Rotation refuses to extend a
        // session past 30 days from this original login, even though each
        // individual token's own TTL is shorter -- see doubt review finding #6.
        sessionCreatedAt: timestamp("session_created_at").notNull(),
        // Set when this token is rotated. Presenting a hash that matches
        // *this* field within a short grace window is treated as a benign
        // race (multi-tab, retry), not theft -- see doubt review finding #1.
        replacedByHash: text("replaced_by_hash"),
        revokedAt: timestamp("revoked_at"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        index("refresh_tokens_expires_at_idx").on(table.expiresAt),
        index("refresh_tokens_user_id_idx").on(table.userId),
    ]
);

// ---------------------------------------------------------------------------
// products -- replaces fakestoreapi.com. Soft-delete only (isActive), never
// hard-deleted: order_items and cart_items reference product_id, and a
// vanished row mid-transaction is exactly the read-consistency hazard
// SPEC-cart.md's doubt review flagged (finding #9).
// ---------------------------------------------------------------------------

export const products = pgTable("products", {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    description: text().notNull(),
    // Cents, not decimal -- see ADR-0004 for why money is an integer
    // throughout this schema.
    priceCents: integer("price_cents").notNull(),
    category: text().notNull(),
    image: text().notNull(),
    ratingRate: integer("rating_rate"), // tenths of a star, e.g. 45 = 4.5
    ratingCount: integer("rating_count"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;

// ---------------------------------------------------------------------------
// cart_items -- server-side cart. Deliberately holds NO price: always
// resolved live from `products`. See ADR-0004.
// ---------------------------------------------------------------------------

export const MAX_LINE_ITEM_QTY = 10;

export const cartItems = pgTable(
    "cart_items",
    {
        userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        productId: uuid("product_id").notNull().references(() => products.id),
        quantity: integer().notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.productId] }),
        // sql.raw, not a plain template interpolation: a CHECK constraint is
        // DDL, evaluated per-row at write time -- it can't contain a bound
        // query parameter ($1), which is what `sql` would otherwise produce
        // for an interpolated value. MAX_LINE_ITEM_QTY is an internal
        // constant, never external input, so inlining it as raw SQL text is
        // safe here.
        check(
            "cart_items_quantity_range",
            sql`${table.quantity} > 0 AND ${table.quantity} <= ${sql.raw(String(MAX_LINE_ITEM_QTY))}`
        ),
    ]
);

// ---------------------------------------------------------------------------
// orders / order_items -- price and title ARE snapshotted here, on purpose.
// Cart is live; an order is frozen at purchase. See ADR-0004.
// ---------------------------------------------------------------------------

export const orderStatusEnum = pgEnum("order_status", ["pending_payment", "paid", "failed", "cancelled"]);

export const orders = pgTable("orders", {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    status: orderStatusEnum().notNull().default("pending_payment"),
    subtotalCents: integer("subtotal_cents").notNull(),
    stripeSessionId: text("stripe_session_id"),
    // Snapshotted at order-creation time, same reasoning as order_items'
    // price/title: a later edit to the user's saved address (if that ever
    // exists) must never rewrite where THIS order already shipped.
    shippingFullName: text("shipping_full_name").notNull(),
    shippingAddressLine1: text("shipping_address_line1").notNull(),
    shippingCity: text("shipping_city").notNull(),
    shippingRegion: text("shipping_region"), // optional -- matches AddressStep's own validation
    shippingPostalCode: text("shipping_postal_code").notNull(),
    shippingCountry: text("shipping_country").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id),
    title: text().notNull(), // snapshotted -- survives a later product rename
    unitPriceCents: integer("unit_price_cents").notNull(), // snapshotted
    quantity: integer().notNull(),
});

// ---------------------------------------------------------------------------
// idempotency_keys -- shared claim/replay ledger for POST /orders and
// POST /cart/merge. See server/spec/SPEC-orders.md for the full design and
// the doubt review that shaped it (two findings here were classified
// critical: the atomic-reclaim requirement and the single-transaction
// requirement between business logic and outcome recording).
// ---------------------------------------------------------------------------

export const idempotencyStatusEnum = pgEnum("idempotency_status", ["in_progress", "succeeded", "failed"]);

export const idempotencyKeys = pgTable(
    "idempotency_keys",
    {
        id: uuid().primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull().references(() => users.id),
        scope: text().notNull(), // 'orders:create' | 'cart:merge'
        idempotencyKey: text("idempotency_key").notNull(),
        requestHash: text("request_hash").notNull(),
        status: idempotencyStatusEnum().notNull().default("in_progress"),
        responseStatus: integer("response_status"),
        responseBody: jsonb("response_body"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        // created_at + 7 days -- comfortably outlives Stripe's ~3-day webhook
        // redelivery window (doubt review finding #7).
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        unique("idempotency_keys_user_scope_key").on(table.userId, table.scope, table.idempotencyKey),
        index("idempotency_keys_expires_at_idx").on(table.expiresAt),
    ]
);
