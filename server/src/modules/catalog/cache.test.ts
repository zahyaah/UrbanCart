import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { redis } from "../../lib/redis.js";
import { listProducts, getProductById } from "./service.js";

const BACKPACK = {
    title: "Fjallraven - Foldsack No. 1 Backpack",
    description: "Fits 15 laptops.",
    priceCents: 10995,
    category: "men's clothing",
    image: "https://example.com/backpack.jpg",
    ratingRate: 43,
    ratingCount: 120,
};

async function seedProduct() {
    const [row] = await db.insert(products).values(BACKPACK).returning();
    if (!row) throw new Error("seed failed");
    return row;
}

// These assert on the cache's user-visible effect (a DB change made outside
// the service layer doesn't show up until the cache entry expires) rather
// than spying on the DB client -- state-based, survives a refactor of how
// the cache is implemented as long as the cache-aside contract holds.
describe("catalog cache", () => {
    beforeEach(() => {
        // src/test/setup.ts already flushes Redis before every test.
        if (!redis) throw new Error("REDIS_URL must be set for this test (see .env.test)");
    });

    it("serves a cached list even after the underlying row changes", async () => {
        const row = await seedProduct();

        const first = await listProducts();
        expect(first[0]?.title).toBe(BACKPACK.title);

        // Bypasses the service layer entirely -- a real change the cache
        // should still be masking.
        await db.update(products).set({ title: "Renamed" }).where(eq(products.id, row.id));

        const second = await listProducts();
        expect(second[0]?.title).toBe(BACKPACK.title);
    });

    it("serves a cached product detail even after the underlying row changes", async () => {
        const row = await seedProduct();

        const first = await getProductById(row.id);
        expect(first?.title).toBe(BACKPACK.title);

        await db.update(products).set({ title: "Renamed" }).where(eq(products.id, row.id));

        const second = await getProductById(row.id);
        expect(second?.title).toBe(BACKPACK.title);
    });

    it("misses the cache and reflects a fresh row once the entry is evicted", async () => {
        const row = await seedProduct();

        await listProducts();
        await redis!.flushdb(); // simulates TTL expiry without waiting on it
        await db.update(products).set({ title: "Renamed" }).where(eq(products.id, row.id));

        const fresh = await listProducts();
        expect(fresh[0]?.title).toBe("Renamed");
    });
});
