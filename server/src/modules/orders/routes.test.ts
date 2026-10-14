import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { buildApp } from "../../app.js";
import { authHeaders } from "../../test/helpers.js";
import { db } from "../../db/index.js";
import { products, orders } from "../../db/schema.js";

const VALID_ADDRESS = {
    fullName: "Ada Lovelace",
    addressLine1: "12 Analytical Way",
    city: "London",
    region: "Greater London",
    postalCode: "NW1 6XE",
    country: "United Kingdom",
};

async function registerAndGetApp() {
    const app = await buildApp();
    const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: `${randomUUID()}@test.com`, password: "password123" },
    });
    return { app, session: res };
}

async function seedProduct(overrides: Partial<{ title: string; priceCents: number }> = {}) {
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

async function addToCart(app: Awaited<ReturnType<typeof buildApp>>, session: Awaited<ReturnType<typeof app.inject>>, productId: string, quantity = 1) {
    await app.inject({
        method: "POST",
        url: "/cart/items",
        headers: authHeaders(session),
        payload: { productId, quantity },
    });
}

function createOrder(
    app: Awaited<ReturnType<typeof buildApp>>,
    session: Awaited<ReturnType<typeof app.inject>>,
    { idempotencyKey = randomUUID(), shippingAddress = VALID_ADDRESS }: { idempotencyKey?: string; shippingAddress?: unknown } = {}
) {
    return app.inject({
        method: "POST",
        url: "/orders",
        headers: authHeaders(session, { "idempotency-key": idempotencyKey }),
        payload: { shippingAddress },
    });
}

describe("POST /orders", () => {
    it("requires authentication", async () => {
        const app = await buildApp();

        const res = await app.inject({ method: "POST", url: "/orders" });

        expect(res.statusCode).toBe(401);
    });

    it("requires an Idempotency-Key header", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await app.inject({
            method: "POST",
            url: "/orders",
            headers: authHeaders(session),
            payload: { shippingAddress: VALID_ADDRESS },
        });

        expect(res.statusCode).toBe(400);
    });

    it("requires a shipping address", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, session, product.id, 1);

        const res = await app.inject({
            method: "POST",
            url: "/orders",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
        });

        expect(res.statusCode).toBe(422);
    });

    it.each(["fullName", "addressLine1", "city", "postalCode", "country"])(
        "rejects a shipping address missing %s",
        async (field) => {
            const { app, session } = await registerAndGetApp();
            const product = await seedProduct();
            await addToCart(app, session, product.id, 1);
            const incomplete = { ...VALID_ADDRESS, [field]: "" };

            const res = await createOrder(app, session, { shippingAddress: incomplete });

            expect(res.statusCode).toBe(422);
        }
    );

    it("does not require the region field", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, session, product.id, 1);
        const { region: _region, ...withoutRegion } = VALID_ADDRESS;

        const res = await createOrder(app, session, { shippingAddress: withoutRegion });

        expect(res.statusCode).toBe(201);
    });

    it("409s listing every inactive product in the cart, and creates no order", async () => {
        const { app, session } = await registerAndGetApp();
        const active = await seedProduct({ title: "Still Sold" });
        const retired = await seedProduct({ title: "Retired Item" });
        await addToCart(app, session, active.id, 1);
        await addToCart(app, session, retired.id, 1);
        await db.update(products).set({ isActive: false }).where(eq(products.id, retired.id));

        const res = await createOrder(app, session);

        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatchObject({
            code: "PRODUCTS_UNAVAILABLE",
            details: { products: [{ productId: retired.id, title: "Retired Item" }] },
        });
        expect(await db.select().from(orders)).toHaveLength(0);
    });

    it("400s when the cart is empty", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await createOrder(app, session);

        expect(res.statusCode).toBe(400);
    });

    it("creates a pending order from the live cart, totalled from DB prices", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ priceCents: 2500 });
        await addToCart(app, session, product.id, 3);

        const res = await createOrder(app, session);

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(Object.keys(body)).toEqual(["orderId"]);
        const [row] = await db.select().from(orders).where(eq(orders.id, body.orderId));
        expect(row).toMatchObject({ status: "pending_payment", subtotalCents: 7500 }); // 2500 * 3
    });

    it("never trusts a client-supplied amount -- the order total always comes from live product prices", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ priceCents: 999 });
        await addToCart(app, session, product.id, 1);

        const res = await app.inject({
            method: "POST",
            url: "/orders",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: { shippingAddress: VALID_ADDRESS, subtotalCents: 1 }, // ignored even if sent
        });

        const [row] = await db.select().from(orders).where(eq(orders.id, JSON.parse(res.body).orderId));
        expect(row!.subtotalCents).toBe(999);
    });

    it("regression: a double-submitted request with the same Idempotency-Key creates exactly one order", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, session, product.id, 1);
        const key = randomUUID();

        const [first, second] = await Promise.all([
            createOrder(app, session, { idempotencyKey: key }),
            createOrder(app, session, { idempotencyKey: key }),
        ]);

        // Depending on exact timing, the loser of the claim race either
        // sees 'in_progress' (409, told to retry) or arrives just after the
        // winner already committed and sees 'succeeded' (a replay of the
        // same 201) -- both are correct outcomes of the same mechanism, so
        // the real invariant isn't which status pairing occurs, it's that
        // the DB only ever recorded ONE order between them.
        for (const res of [first, second]) {
            expect([201, 409]).toContain(res.statusCode);
        }

        const successResponses = [first, second].filter((r) => r.statusCode === 201).map((r) => JSON.parse(r.body));
        const orderIds = new Set(successResponses.map((b) => b.orderId));
        expect(orderIds.size).toBe(1); // every successful response names the SAME order

        const rows = await db.select().from(orders).where(eq(orders.id, [...orderIds][0]!));
        expect(rows).toHaveLength(1);
    });

    it("regression: retrying the same key sequentially after success replays the same order, not a new one", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, session, product.id, 1);
        const key = randomUUID();

        const first = await createOrder(app, session, { idempotencyKey: key });
        const second = await createOrder(app, session, { idempotencyKey: key });

        expect(second.statusCode).toBe(201);
        expect(JSON.parse(second.body)).toEqual(JSON.parse(first.body));
        const userOrders = await db.select().from(orders).where(eq(orders.id, JSON.parse(first.body).orderId));
        expect(userOrders).toHaveLength(1);
    });

    it("422s when the same Idempotency-Key is reused with a different shipping address", async () => {
        // The address is genuine client input, unlike items/amount -- a
        // changed address under the same key is a different intent, not a
        // retry, and must not silently keep the first address.
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, session, product.id, 1);
        const key = randomUUID();

        await createOrder(app, session, { idempotencyKey: key });
        const res = await createOrder(app, session, {
            idempotencyKey: key,
            shippingAddress: { ...VALID_ADDRESS, city: "A Different City" },
        });

        expect(res.statusCode).toBe(422);
    });
});

describe("GET /orders/:id", () => {
    it("returns the order with items, status, and the shipping address it was placed with", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ title: "Backpack", priceCents: 5000 });
        await addToCart(app, session, product.id, 2);
        const createRes = await createOrder(app, session);
        const { orderId } = JSON.parse(createRes.body);

        const res = await app.inject({
            method: "GET",
            url: `/orders/${orderId}`,
            headers: { cookie: authHeaders(session).cookie },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe("pending_payment");
        expect(body.subtotal).toBe(100);
        expect(body.items).toEqual([{ productId: product.id, title: "Backpack", price: 50, quantity: 2 }]);
        expect(body.shippingAddress).toEqual(VALID_ADDRESS);
    });

    it("404s for another user's order rather than exposing it", async () => {
        const { app, session: ownerSession } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, ownerSession, product.id, 1);
        const createRes = await createOrder(app, ownerSession);
        const { orderId } = JSON.parse(createRes.body);

        const otherRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: { email: `${randomUUID()}@test.com`, password: "password123" },
        });

        const res = await app.inject({
            method: "GET",
            url: `/orders/${orderId}`,
            headers: { cookie: authHeaders(otherRes).cookie },
        });

        expect(res.statusCode).toBe(404);
    });
});

describe("POST /orders/:id/pay", () => {
    async function placeOrder(app: Awaited<ReturnType<typeof buildApp>>, session: Awaited<ReturnType<typeof app.inject>>, productId: string) {
        await addToCart(app, session, productId, 1);
        const res = await createOrder(app, session);
        return JSON.parse(res.body).orderId as string;
    }

    function pay(app: Awaited<ReturnType<typeof buildApp>>, orderId: string, headers: Record<string, string>) {
        return app.inject({ method: "POST", url: `/orders/${orderId}/pay`, headers });
    }

    it("marks the caller's own pending order paid and removes only its items from the cart", async () => {
        const { app, session } = await registerAndGetApp();
        const paidProduct = await seedProduct({ title: "Paid Item" });
        const otherProduct = await seedProduct({ title: "Untouched Item" });
        const orderId = await placeOrder(app, session, paidProduct.id);
        // Added while the order was pending -- not part of it, must survive.
        await addToCart(app, session, otherProduct.id, 1);

        const res = await pay(app, orderId, authHeaders(session));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ id: orderId, status: "paid", subtotal: 10 });
        const cartRes = await app.inject({ method: "GET", url: "/cart", headers: authHeaders(session) });
        expect(JSON.parse(cartRes.body).items.map((i: { title: string }) => i.title)).toEqual(["Untouched Item"]);
    });

    it("404s for another user's order and leaves it unpaid", async () => {
        const { app, session: ownerSession } = await registerAndGetApp();
        const product = await seedProduct();
        const orderId = await placeOrder(app, ownerSession, product.id);
        const otherSession = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: { email: `${randomUUID()}@test.com`, password: "password123" },
        });

        const res = await pay(app, orderId, authHeaders(otherSession));

        expect(res.statusCode).toBe(404);
        const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
        expect(row!.status).toBe("pending_payment");
    });

    it("404s for an order id that doesn't exist", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await pay(app, randomUUID(), authHeaders(session));

        expect(res.statusCode).toBe(404);
    });

    it("returns 200 with no change for an already-paid order", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        const orderId = await placeOrder(app, session, product.id);
        const first = await pay(app, orderId, authHeaders(session));
        const [afterFirst] = await db.select().from(orders).where(eq(orders.id, orderId));

        const second = await pay(app, orderId, authHeaders(session));

        expect(second.statusCode).toBe(200);
        expect(JSON.parse(second.body)).toEqual(JSON.parse(first.body));
        const [afterSecond] = await db.select().from(orders).where(eq(orders.id, orderId));
        expect(afterSecond!.updatedAt).toEqual(afterFirst!.updatedAt);
    });

    it("409s for an order that is no longer payable", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        const orderId = await placeOrder(app, session, product.id);
        await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));

        const res = await pay(app, orderId, authHeaders(session));

        expect(res.statusCode).toBe(409);
    });

    it("403s without a CSRF token", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        const orderId = await placeOrder(app, session, product.id);
        const { "x-csrf-token": _omitted, ...headers } = authHeaders(session);

        const res = await pay(app, orderId, headers);

        expect(res.statusCode).toBe(403);
        const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
        expect(row!.status).toBe("pending_payment");
    });

    it("401s when unauthenticated", async () => {
        const app = await buildApp();

        const res = await pay(app, randomUUID(), { origin: "http://localhost:5173" });

        expect(res.statusCode).toBe(401);
    });

    it("ignores any amount in the request body", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ priceCents: 4321 });
        const orderId = await placeOrder(app, session, product.id);

        const res = await app.inject({
            method: "POST",
            url: `/orders/${orderId}/pay`,
            headers: authHeaders(session),
            payload: { subtotal: 0.01, amount: 1 },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).subtotal).toBe(43.21);
    });
});
