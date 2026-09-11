import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, type Product as ProductRow } from "../../db/schema.js";
import { redis } from "../../lib/redis.js";

// Catalog is seed-only right now (no admin/write path exists), so a
// short TTL is the only invalidation strategy needed -- there's nothing to
// bust the cache on. Revisit if/when a product-write path is added.
const LIST_TTL_SECONDS = 60;
const DETAIL_TTL_SECONDS = 300;

async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    if (!redis) return load();

    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;

    const value = await load();
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return value;
}

export interface PublicProduct {
    id: string;
    title: string;
    description: string;
    price: number;
    category: string;
    image: string;
    rating: { rate: number; count: number };
}

function toPublicProduct(row: ProductRow): PublicProduct {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        price: row.priceCents / 100,
        category: row.category,
        image: row.image,
        rating: { rate: (row.ratingRate ?? 0) / 10, count: row.ratingCount ?? 0 },
    };
}

export async function listProducts(): Promise<PublicProduct[]> {
    return cached("catalog:products", LIST_TTL_SECONDS, async () => {
        const rows = await db.query.products.findMany({ where: eq(products.isActive, true) });
        return rows.map(toPublicProduct);
    });
}

export async function getProductById(id: string): Promise<PublicProduct | null> {
    return cached(`catalog:product:${id}`, DETAIL_TTL_SECONDS, async () => {
        const row = await db.query.products.findFirst({
            where: and(eq(products.id, id), eq(products.isActive, true)),
        });
        return row ? toPublicProduct(row) : null;
    });
}
