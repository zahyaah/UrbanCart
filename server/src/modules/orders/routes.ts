import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { snapshotCartForOrder, applyOrderCreation, getOrderById } from "./service.js";
import {
    createOrderRequestSchema,
    createOrderResponseSchema,
    orderResponseSchema,
    orderIdParamsSchema,
} from "./schemas.js";
import { authenticate, requireCsrf } from "../identity/auth-plugin.js";
import { Errors } from "../../lib/errors.js";
import { createCheckoutSession } from "../../lib/stripe.js";
import { db } from "../../db/index.js";
import { runWithSerializationRetry } from "../../lib/db-retry.js";
import {
    IDEMPOTENCY_KEY_HEADER,
    isValidIdempotencyKey,
    computeRequestHash,
    claimIdempotencyKey,
    recordIdempotencySuccess,
    recordIdempotencyFailure,
} from "../../lib/idempotency.js";
import { config } from "../../config.js";

const ORDER_CREATE_SCOPE = "orders:create";

export async function orderRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    typedApp.route({
        method: "POST",
        url: "/orders",
        preValidation: [authenticate, requireCsrf],
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
        schema: { body: createOrderRequestSchema, response: { 201: createOrderResponseSchema } },
        handler: async (request, reply) => {
            const userId = request.user!.id;
            const idempotencyKeyHeader = request.headers[IDEMPOTENCY_KEY_HEADER];
            if (!isValidIdempotencyKey(idempotencyKeyHeader)) {
                throw Errors.badRequest("A valid Idempotency-Key header is required");
            }

            // The order's ITEMS and AMOUNT never come from the client (see
            // snapshotCartForOrder below) -- but the shipping address is
            // legitimately client-supplied input, so it's part of what the
            // hash covers: reusing this Idempotency-Key with a different
            // address is a different intent, not a retry, and must 422
            // rather than silently keep the first address.
            const requestHash = computeRequestHash(request.body);
            const claim = await claimIdempotencyKey({
                userId,
                scope: ORDER_CREATE_SCOPE,
                idempotencyKey: idempotencyKeyHeader,
                requestHash,
            });

            if (claim.outcome === "replay") {
                reply.status(201);
                return claim.body as z.infer<typeof createOrderResponseSchema>;
            }
            if (claim.outcome === "conflict") {
                reply.header("Retry-After", "2");
                throw Errors.conflict("A request with this Idempotency-Key is already being processed");
            }
            if (claim.outcome === "hash_mismatch") {
                throw Errors.idempotencyKeyReused();
            }

            try {
                // Generated here, before the Stripe call, specifically so
                // the return_url below can name it -- the alternative would
                // need a "look up an order by Stripe session id" endpoint
                // just to land back on the right confirmation page, for a
                // value this handler already knows before it ever talks to
                // Stripe.
                const orderId = randomUUID();

                // The Stripe call is a real network request -- it runs
                // outside any DB transaction, using its OWN idempotency key
                // (derived from ours) as defense in depth. See
                // SPEC-orders.md's doubt review, finding #12.
                const snapshot = await snapshotCartForOrder(userId);
                const session = await createCheckoutSession({
                    orderId,
                    subtotalCents: snapshot.subtotalCents,
                    idempotencyKey: idempotencyKeyHeader,
                    returnUrl: `${config.FRONTEND_URL}/checkout/confirmation?orderId=${orderId}`,
                });

                const result = await runWithSerializationRetry(() =>
                    db.transaction(async (tx) => {
                        await applyOrderCreation(tx, orderId, userId, snapshot, session.id, request.body.shippingAddress);
                        const responseBody = { orderId, clientSecret: session.clientSecret };
                        await recordIdempotencySuccess(tx, claim.id, 201, responseBody);
                        return responseBody;
                    })
                );

                reply.status(201);
                return result;
            } catch (err) {
                await recordIdempotencyFailure(claim.id);
                throw err;
            }
        },
    });

    typedApp.route({
        method: "GET",
        url: "/orders/:id",
        preValidation: [authenticate],
        schema: { params: orderIdParamsSchema, response: { 200: orderResponseSchema } },
        handler: async (request) => {
            const order = await getOrderById(request.user!.id, request.params.id);
            if (!order) throw Errors.notFound("Order not found");
            return order;
        },
    });
}
