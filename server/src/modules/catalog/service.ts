import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products, type Product as ProductRow } from "../../db/schema.js";

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
    const rows = await db.query.products.findMany({ where: eq(products.isActive, true) });
    return rows.map(toPublicProduct);
}

export async function getProductById(id: string): Promise<PublicProduct | null> {
    const row = await db.query.products.findFirst({
        where: and(eq(products.id, id), eq(products.isActive, true)),
    });
    return row ? toPublicProduct(row) : null;
}
