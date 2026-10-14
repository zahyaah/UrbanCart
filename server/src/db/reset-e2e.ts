import { sql } from "drizzle-orm";
import { db, pool } from "./index.js";
import * as schema from "./schema.js";
import { assertSafeSeedTarget, isLocalHost } from "./seed-guard.js";
import { redis } from "../lib/redis.js";

// Empties every app table, and the e2e Redis database, so each e2e run
// starts from the same state. The seed script alone can't do that: it wipes
// products, which carts and order items from a previous run still
// reference. Redis matters too: the catalog cache would keep serving the
// previous run's product ids (reseeding assigns new UUIDs) for up to its
// TTL, and rate-limit counters would carry over. Stricter than the seed
// guard: only a local database whose name ends in "_e2e", local Redis.
async function main() {
    assertSafeSeedTarget(process.env);
    const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    if (!dbName.endsWith("_e2e")) {
        throw new Error(`Refusing to reset "${dbName}": only a database named *_e2e can be reset.`);
    }

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
    if (redis) {
        const redisHost = new URL(process.env.REDIS_URL!).hostname;
        if (!isLocalHost(redisHost)) {
            throw new Error(`Refusing to flush Redis at "${redisHost}": not local.`);
        }
        await redis.flushdb();
        redis.disconnect();
    }

    console.log(`Reset ${dbName}${redis ? " and its Redis database" : ""}.`);
    await pool.end();
}

main().catch((err) => {
    console.error("E2E reset failed:", err);
    process.exit(1);
});
