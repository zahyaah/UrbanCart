import { db, pool } from "./index.js";
import { products } from "./schema.js";
import { loadSeedProducts } from "./seed-data.js";
import { assertSafeSeedTarget } from "./seed-guard.js";
import { Redis } from "ioredis";
import { CATALOG_CACHE_PREFIX } from "../modules/catalog/cache-keys.js";

// Reseeding gives every product a new UUID, so a warm catalog cache would
// keep serving dead ids (up to its TTL) that fail add-to-cart and merge.
// Deletes only catalog keys -- the same Redis holds rate-limit counters.
// Its own short-lived client, so seeding doesn't need the full app config.
async function flushCatalogCache(redisUrl: string): Promise<number> {
    const client = new Redis(redisUrl, { connectTimeout: 2000, maxRetriesPerRequest: 1 });
    try {
        let deleted = 0;
        for await (const keys of client.scanStream({ match: `${CATALOG_CACHE_PREFIX}*`, count: 100 })) {
            if ((keys as string[]).length > 0) deleted += await client.del(...(keys as string[]));
        }
        return deleted;
    } finally {
        client.disconnect();
    }
}

async function main() {
    assertSafeSeedTarget(process.env);
    const seedProducts = loadSeedProducts();
    console.log(`Seeding ${seedProducts.length} products (replacing any existing catalog)...`);

    // Wipe-and-reload: this script establishes a known catalog state for
    // dev/demo, it isn't a repeated sync. cart_items and order_items
    // reference products by foreign key, so the delete fails once any cart
    // or order exists -- reseeding needs an empty database (the e2e suite
    // runs reset-e2e.ts first). That failure is the safe outcome: the
    // alternative, cascading the delete, would silently erase carts and
    // order history.
    await db.delete(products);
    await db.insert(products).values(seedProducts);

    if (process.env.REDIS_URL) {
        const deleted = await flushCatalogCache(process.env.REDIS_URL);
        console.log(`Cleared ${deleted} catalog cache key(s).`);
    }

    console.log("Seed complete.");
    await pool.end();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
