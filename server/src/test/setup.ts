import { beforeEach } from "vitest";

// Loaded before any test module's imports resolve, so config.ts sees these
// values when it parses process.env at import time.
process.loadEnvFile(new URL("../../.env.test", import.meta.url));

const { db } = await import("../db/index.js");
const schema = await import("../db/schema.js");
const { sql } = await import("drizzle-orm");
const { redis } = await import("../lib/redis.js");

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

    // Without this, the rate-limit plugin's shared store (see app.ts) counts
    // requests across every test in the run, not just the current one --
    // register/login calls from earlier tests would push later tests past
    // AUTH_RATE_LIMIT and turn a 200/201 into an unrelated 429.
    if (redis) await redis.flushdb();
});
