import { beforeEach } from "vitest";

// Loaded before any test module's imports resolve, so config.ts sees these
// values when it parses process.env at import time.
process.loadEnvFile(new URL("../../.env.test", import.meta.url));

const { db } = await import("../db/index.js");
const schema = await import("../db/schema.js");
const { sql } = await import("drizzle-orm");

beforeEach(async () => {
    // TRUNCATE ... CASCADE, not DELETE: instant and doesn't need FK-order
    // sequencing across the 7 tables.
    await db.execute(sql`
        TRUNCATE TABLE
            ${schema.idempotencyKeys},
            ${schema.orderItems},
            ${schema.orders},
            ${schema.cartItems},
            ${schema.refreshTokens},
            ${schema.products},
            ${schema.users}
        RESTART IDENTITY CASCADE
    `);
});
