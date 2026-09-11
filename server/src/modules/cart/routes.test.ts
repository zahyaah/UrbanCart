import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../app.js";
import { authHeaders } from "../../test/helpers.js";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";

async function registerAndGetApp() {
    const app = await buildApp();
    const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `${randomUUID()}@test.com`, password: "password123" },
    });
    return { app, session: res };
}

async function seedProduct(overrides: Partial<{ title: string; priceCents: number; isActive: boolean }> = {}) {
    const [row] = await db
        .insert(products)
        .values({
            title: "Test Product",
            description: "desc",
            priceCents: 1000,
            category: "test",
            image: "https://example.com/x.jpg",
            ...overrides,
        })
        .returning();
    if (!row) throw new Error("seed failed");
    return row;
}

describe("GET /cart", () => {
    it("requires authentication", async () => {
        const app = await buildApp();

        const res = await app.inject({ method: "GET", url: "/cart" });

        expect(res.statusCode).toBe(401);
    });

    it("returns an empty cart for a new user", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await app.inject({
            method: "GET",
            url: "/cart",
            headers: { cookie: `access_token=${session.cookies.find((c) => c.name === "access_token")!.value}` },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ items: [] });
    });
});

describe("POST /cart/items", () => {
    it("adds a new item to the cart, resolving price/title live from the product", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ title: "Backpack", priceCents: 10995 });

        const res = await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 2 },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toEqual([
            { productId: product.id, title: "Backpack", price: 109.95, image: product.image, quantity: 2 },
        ]);
    });

    it("adds to the existing quantity when the product is already in the cart", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 3 },
        });

        const res = await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 2 },
        });

        expect(JSON.parse(res.body).items[0].quantity).toBe(5);
    });

    it("caps quantity at the per-line-item maximum", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();

        const res = await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 999 },
        });

        expect(JSON.parse(res.body).items[0].quantity).toBe(10);
    });

    it("404s for an unknown product", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: "00000000-0000-0000-0000-000000000000", quantity: 1 },
        });

        expect(res.statusCode).toBe(404);
    });

    it("requires a CSRF token", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();

        const res = await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: { cookie: `access_token=${session.cookies.find((c) => c.name === "access_token")!.value}` },
            payload: { productId: product.id, quantity: 1 },
        });

        expect(res.statusCode).toBe(403);
    });
});

describe("PATCH /cart/items/:productId", () => {
    it("sets the exact quantity", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 3 },
        });

        const res = await app.inject({
            method: "PATCH",
            url: `/cart/items/${product.id}`,
            headers: authHeaders(session),
            payload: { quantity: 7 },
        });

        expect(JSON.parse(res.body).items[0].quantity).toBe(7);
    });

    it("removes the line item when quantity is set to 0", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 3 },
        });

        const res = await app.inject({
            method: "PATCH",
            url: `/cart/items/${product.id}`,
            headers: authHeaders(session),
            payload: { quantity: 0 },
        });

        expect(JSON.parse(res.body).items).toEqual([]);
    });
});

describe("DELETE /cart/items/:productId", () => {
    it("removes the line item regardless of quantity", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 5 },
        });

        const res = await app.inject({
            method: "DELETE",
            url: `/cart/items/${product.id}`,
            headers: authHeaders(session),
        });

        expect(JSON.parse(res.body).items).toEqual([]);
    });
});

describe("DELETE /cart", () => {
    it("clears the entire cart", async () => {
        const { app, session } = await registerAndGetApp();
        const p1 = await seedProduct({ title: "A" });
        const p2 = await seedProduct({ title: "B" });
        await app.inject({ method: "POST", url: "/cart/items", headers: authHeaders(session), payload: { productId: p1.id, quantity: 1 } });
        await app.inject({ method: "POST", url: "/cart/items", headers: authHeaders(session), payload: { productId: p2.id, quantity: 1 } });

        const res = await app.inject({ method: "DELETE", url: "/cart", headers: authHeaders(session) });

        expect(JSON.parse(res.body).items).toEqual([]);
    });
});

describe("POST /cart/merge", () => {
    it("requires an Idempotency-Key header", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session),
            payload: { items: [] },
        });

        expect(res.statusCode).toBe(400);
    });

    it("merges a guest cart into an empty server cart", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ title: "Guest Item" });

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: { items: [{ productId: product.id, quantity: 3 }] },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toEqual([
            { productId: product.id, title: "Guest Item", price: 10, image: product.image, quantity: 3 },
        ]);
        expect(body.adjustments).toEqual([]);
    });

    it("sums quantities for a product already in the server cart", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await app.inject({
            method: "POST",
            url: "/cart/items",
            headers: authHeaders(session),
            payload: { productId: product.id, quantity: 2 },
        });

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: { items: [{ productId: product.id, quantity: 3 }] },
        });

        expect(JSON.parse(res.body).items[0].quantity).toBe(5);
    });

    it("reports an unknown product as an adjustment instead of failing the whole request", async () => {
        const { app, session } = await registerAndGetApp();
        const known = await seedProduct({ title: "Known" });

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: {
                items: [
                    { productId: known.id, quantity: 1 },
                    { productId: "00000000-0000-0000-0000-000000000000", quantity: 1 },
                ],
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.adjustments).toEqual([
            {
                productId: "00000000-0000-0000-0000-000000000000",
                reason: "unknown_product",
                requestedQuantity: 1,
                appliedQuantity: 0,
            },
        ]);
    });

    it("reports a malformed item as an adjustment without blocking the rest of the merge", async () => {
        // Regression for SPEC-cart.md finding #7: one corrupted localStorage
        // entry must not 400 the whole request.
        const { app, session } = await registerAndGetApp();
        const known = await seedProduct();

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: {
                items: [
                    { productId: known.id, quantity: 1 },
                    { productId: known.id, quantity: -5 },
                    { productId: "not-a-uuid", quantity: "banana" },
                ],
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.adjustments.length).toBeGreaterThan(0);
    });

    it("reports a quantity clamp as an adjustment", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: { items: [{ productId: product.id, quantity: 999 }] },
        });

        const body = JSON.parse(res.body);
        expect(body.items[0].quantity).toBe(10);
        expect(body.adjustments).toEqual([
            { productId: product.id, reason: "quantity_capped", requestedQuantity: 999, appliedQuantity: 10 },
        ]);
    });

    it("pre-aggregates duplicate productIds within one request", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: {
                items: [
                    { productId: product.id, quantity: 2 },
                    { productId: product.id, quantity: 3 },
                ],
            },
        });

        expect(JSON.parse(res.body).items[0].quantity).toBe(5);
    });

    it("regression: retrying with the same Idempotency-Key does not double-apply quantities", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        const key = randomUUID();
        const payload = { items: [{ productId: product.id, quantity: 3 }] };

        const first = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": key }),
            payload,
        });
        const second = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": key }),
            payload,
        });

        expect(JSON.parse(first.body)).toEqual(JSON.parse(second.body));
        expect(JSON.parse(second.body).items[0].quantity).toBe(3); // not 6
    });

    it("422s when the same Idempotency-Key is reused with a different body", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        const key = randomUUID();

        await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": key }),
            payload: { items: [{ productId: product.id, quantity: 1 }] },
        });
        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": key }),
            payload: { items: [{ productId: product.id, quantity: 2 }] },
        });

        expect(res.statusCode).toBe(422);
    });

    it("does not merge an inactive product", async () => {
        const { app, session } = await registerAndGetApp();
        const inactive = await seedProduct({ isActive: false });

        const res = await app.inject({
            method: "POST",
            url: "/cart/merge",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: { items: [{ productId: inactive.id, quantity: 1 }] },
        });

        const body = JSON.parse(res.body);
        expect(body.items).toEqual([]);
        expect(body.adjustments[0].reason).toBe("unknown_product");
    });
});
