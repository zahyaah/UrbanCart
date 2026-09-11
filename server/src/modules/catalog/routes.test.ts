import { describe, it, expect } from "vitest";
import { buildApp } from "../../app.js";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";

const BACKPACK = {
    title: "Fjallraven - Foldsack No. 1 Backpack",
    description: "Fits 15 laptops.",
    priceCents: 10995, // $109.95
    category: "men's clothing",
    image: "https://example.com/backpack.jpg",
    ratingRate: 43, // 4.3 stars
    ratingCount: 120,
};

const INACTIVE_PRODUCT = {
    title: "Discontinued Widget",
    description: "No longer sold.",
    priceCents: 500,
    category: "misc",
    image: "https://example.com/widget.jpg",
    isActive: false,
};

async function seedProduct(overrides: Partial<typeof BACKPACK & { isActive: boolean }> = {}) {
    const [row] = await db
        .insert(products)
        .values({ ...BACKPACK, ...overrides })
        .returning();
    if (!row) throw new Error("seed failed");
    return row;
}

describe("GET /products", () => {
    it("returns an empty list when the catalog is empty", async () => {
        const app = await buildApp();

        const res = await app.inject({ method: "GET", url: "/products" });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ products: [] });
    });

    it("returns active products with price converted to dollars and rating as a nested object", async () => {
        const app = await buildApp();
        await seedProduct();

        const res = await app.inject({ method: "GET", url: "/products" });

        expect(res.statusCode).toBe(200);
        const { products: list } = JSON.parse(res.body);
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({
            title: BACKPACK.title,
            price: 109.95,
            category: BACKPACK.category,
            rating: { rate: 4.3, count: 120 },
        });
    });

    it("never returns an inactive (soft-deleted) product", async () => {
        const app = await buildApp();
        await seedProduct(INACTIVE_PRODUCT);

        const res = await app.inject({ method: "GET", url: "/products" });

        expect(JSON.parse(res.body).products).toEqual([]);
    });
});

describe("GET /products/:id", () => {
    it("returns a single active product", async () => {
        const app = await buildApp();
        const row = await seedProduct();

        const res = await app.inject({ method: "GET", url: `/products/${row.id}` });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ id: row.id, price: 109.95 });
    });

    it("404s for an unknown id", async () => {
        const app = await buildApp();

        const res = await app.inject({ method: "GET", url: "/products/00000000-0000-0000-0000-000000000000" });

        expect(res.statusCode).toBe(404);
    });

    it("404s for an inactive product, same as an unknown one", async () => {
        const app = await buildApp();
        const row = await seedProduct(INACTIVE_PRODUCT);

        const res = await app.inject({ method: "GET", url: `/products/${row.id}` });

        expect(res.statusCode).toBe(404);
    });

    it("422s for a non-uuid id rather than a raw DB error", async () => {
        const app = await buildApp();

        const res = await app.inject({ method: "GET", url: "/products/not-a-uuid" });

        expect(res.statusCode).toBe(422);
    });
});
