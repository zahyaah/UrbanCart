import { db, pool } from "./index.js";
import { products } from "./schema.js";
import { loadSeedProducts } from "./seed-data.js";

async function main() {
    const seedProducts = loadSeedProducts();
    console.log(`Seeding ${seedProducts.length} products (replacing any existing catalog)...`);

    // Wipe-and-reload: this script establishes a known catalog state for
    // dev/demo, it isn't a repeated sync. Safe in this project's scope --
    // products are soft-deleted only and nothing else references them by
    // an id that would survive a reseed.
    await db.delete(products);
    await db.insert(products).values(seedProducts);

    console.log("Seed complete.");
    await pool.end();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
