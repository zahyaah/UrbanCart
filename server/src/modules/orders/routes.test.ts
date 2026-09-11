import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { authHeaders } from "../../test/helpers.js";
import { db } from "../../db/index.js";
import { products, orders } from "../../db/schema.js";

const createCheckoutSession = vi.fn();
const verifyWebhookSignature = vi.fn();

vi.mock("../../lib/stripe.js", () => ({
    createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
    verifyWebhookSignature: (...args: unknown[]) => verifyWebhookSignature(...args),
}));

// Imported AFTER the mock is registered, so buildApp's route registration
// picks up the mocked module.
const { buildApp } = await import("../../app.js");

const VALID_ADDRESS = {
    fullName: "Ada Lovelace",
    addressLine1: "12 Analytical Way",
    city: "London",
    region: "Greater London",
    postalCode: "NW1 6XE",
    country: "United Kingdom",
};

beforeEach(() => {
    createCheckoutSession.mockReset();
    createCheckoutSession.mockResolvedValue({ id: `cs_test_${randomUUID()}`, clientSecret: "cs_secret_test" });
    verifyWebhookSignature.mockReset();
});

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

    it("400s when the cart is empty", async () => {
        const { app, session } = await registerAndGetApp();

        const res = await createOrder(app, session);

        expect(res.statusCode).toBe(400);
    });

    it("creates an order from the live cart and returns a Stripe client secret", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ priceCents: 2500 });
        await addToCart(app, session, product.id, 3);

        const res = await createOrder(app, session);

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.orderId).toBeDefined();
        expect(body.clientSecret).toBe("cs_secret_test");
        expect(createCheckoutSession).toHaveBeenCalledTimes(1);
        expect(createCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ subtotalCents: 7500 }) // 2500 * 3
        );
    });

    it("never trusts a client-supplied amount -- the order total always comes from live product prices", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct({ priceCents: 999 });
        await addToCart(app, session, product.id, 1);

        await app.inject({
            method: "POST",
            url: "/orders",
            headers: authHeaders(session, { "idempotency-key": randomUUID() }),
            payload: { shippingAddress: VALID_ADDRESS, subtotalCents: 1 }, // ignored even if sent
        });

        expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ subtotalCents: 999 }));
    });

    it("regression: a double-submitted request with the same Idempotency-Key creates exactly one order and one Stripe session", async () => {
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
        // Stripe and the DB only ever recorded ONE order between them.
        for (const res of [first, second]) {
            expect([201, 409]).toContain(res.statusCode);
        }
        expect(createCheckoutSession).toHaveBeenCalledTimes(1);

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
        expect(createCheckoutSession).toHaveBeenCalledTimes(1);
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

describe("POST /webhooks/stripe", () => {
    it("marks the order paid and clears the paid items from the cart", async () => {
        const { app, session } = await registerAndGetApp();
        const paidProduct = await seedProduct({ title: "Paid Item" });
        const otherProduct = await seedProduct({ title: "Untouched Item" });
        await addToCart(app, session, paidProduct.id, 1);
        const createRes = await createOrder(app, session);
        const { orderId } = JSON.parse(createRes.body);
        const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
        // Simulate the shopper adding something new while payment was
        // pending -- the webhook must not touch it.
        await addToCart(app, session, otherProduct.id, 1);

        verifyWebhookSignature.mockReturnValue({ type: "checkout.session.completed", sessionId: orderRow!.stripeSessionId });

        const webhookRes = await app.inject({
            method: "POST",
            url: "/webhooks/stripe",
            headers: { "stripe-signature": "t=1,v1=fake" },
            payload: { id: "evt_test" },
        });

        expect(webhookRes.statusCode).toBe(200);
        const orderCheck = await app.inject({
            method: "GET",
            url: `/orders/${orderId}`,
            headers: { cookie: authHeaders(session).cookie },
        });
        expect(JSON.parse(orderCheck.body).status).toBe("paid");

        const cartRes = await app.inject({ method: "GET", url: "/cart", headers: authHeaders(session) });
        const cart = JSON.parse(cartRes.body);
        expect(cart.items.map((i: { title: string }) => i.title)).toEqual(["Untouched Item"]);
    });

    it("is a no-op for an already-paid order -- redelivered webhooks don't error", async () => {
        const { app, session } = await registerAndGetApp();
        const product = await seedProduct();
        await addToCart(app, session, product.id, 1);
        const createRes = await createOrder(app, session);
        const { orderId } = JSON.parse(createRes.body);
        const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
        verifyWebhookSignature.mockReturnValue({ type: "checkout.session.completed", sessionId: orderRow!.stripeSessionId });

        const first = await app.inject({
            method: "POST",
            url: "/webhooks/stripe",
            headers: { "stripe-signature": "t=1,v1=fake" },
            payload: { id: "evt_test" },
        });
        const second = await app.inject({
            method: "POST",
            url: "/webhooks/stripe",
            headers: { "stripe-signature": "t=1,v1=fake" },
            payload: { id: "evt_test" },
        });

        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
    });

    it("rejects a request with an invalid signature", async () => {
        const app = await buildApp();
        verifyWebhookSignature.mockImplementation(() => {
            throw new Error("bad signature");
        });

        const res = await app.inject({
            method: "POST",
            url: "/webhooks/stripe",
            headers: { "stripe-signature": "garbage" },
            payload: { id: "evt_test" },
        });

        expect(res.statusCode).toBe(500); // thrown Error, not an ApiError -- caught by the generic handler
    });
});
