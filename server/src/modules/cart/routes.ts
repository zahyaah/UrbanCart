import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getCart, addToCart, setCartItemQuantity, removeFromCart, clearCart, applyCartMerge } from "./service.js";
import { db } from "../../db/index.js";
import { runWithSerializationRetry } from "../../lib/db-retry.js";
import {
    cartResponseSchema,
    mergeCartResponseSchema,
    mergeCartRequestSchema,
    addToCartSchema,
    setQuantitySchema,
    productIdParamsSchema,
} from "./schemas.js";
import { authenticate, requireCsrf } from "../identity/auth-plugin.js";
import { Errors } from "../../lib/errors.js";
import {
    IDEMPOTENCY_KEY_HEADER,
    isValidIdempotencyKey,
    computeRequestHash,
    claimIdempotencyKey,
    recordIdempotencySuccess,
    recordIdempotencyFailure,
} from "../../lib/idempotency.js";

const CART_MERGE_SCOPE = "cart:merge";

export async function cartRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    typedApp.route({
        method: "GET",
        url: "/cart",
        preValidation: [authenticate],
        schema: { response: { 200: cartResponseSchema } },
        handler: async (request) => {
            return { items: await getCart(request.user!.id) };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/cart/items",
        preValidation: [authenticate, requireCsrf],
        schema: { body: addToCartSchema, response: { 200: cartResponseSchema } },
        handler: async (request) => {
            const { productId, quantity } = request.body;
            return { items: await addToCart(request.user!.id, productId, quantity) };
        },
    });

    typedApp.route({
        method: "PATCH",
        url: "/cart/items/:productId",
        preValidation: [authenticate, requireCsrf],
        schema: { params: productIdParamsSchema, body: setQuantitySchema, response: { 200: cartResponseSchema } },
        handler: async (request) => {
            const { productId } = request.params;
            return { items: await setCartItemQuantity(request.user!.id, productId, request.body.quantity) };
        },
    });

    typedApp.route({
        method: "DELETE",
        url: "/cart/items/:productId",
        preValidation: [authenticate, requireCsrf],
        schema: { params: productIdParamsSchema, response: { 200: cartResponseSchema } },
        handler: async (request) => {
            return { items: await removeFromCart(request.user!.id, request.params.productId) };
        },
    });

    typedApp.route({
        method: "DELETE",
        url: "/cart",
        preValidation: [authenticate, requireCsrf],
        schema: { response: { 200: cartResponseSchema } },
        handler: async (request) => {
            await clearCart(request.user!.id);
            return { items: [] };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/cart/merge",
        preValidation: [authenticate, requireCsrf],
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
        schema: { body: mergeCartRequestSchema, response: { 200: mergeCartResponseSchema } },
        handler: async (request, reply) => {
            const userId = request.user!.id;
            const idempotencyKeyHeader = request.headers[IDEMPOTENCY_KEY_HEADER];
            if (!isValidIdempotencyKey(idempotencyKeyHeader)) {
                throw Errors.badRequest("A valid Idempotency-Key header is required");
            }

            const requestHash = computeRequestHash(request.body);
            const claim = await claimIdempotencyKey({
                userId,
                scope: CART_MERGE_SCOPE,
                idempotencyKey: idempotencyKeyHeader,
                requestHash,
            });

            if (claim.outcome === "replay") {
                // The stored body already passed this exact schema once,
                // when it was first recorded by recordIdempotencySuccess --
                // status is always 200 for this scope (only 200 is ever
                // written below), so this is a safe, narrow assertion, not
                // a bypass of validation.
                reply.status(200);
                return claim.body as z.infer<typeof mergeCartResponseSchema>;
            }
            if (claim.outcome === "conflict") {
                reply.header("Retry-After", "2");
                throw Errors.conflict("A request with this Idempotency-Key is already being processed");
            }
            if (claim.outcome === "hash_mismatch") {
                throw Errors.idempotencyKeyReused();
            }

            try {
                // Business logic and the idempotency success record commit
                // together, in one transaction -- a crash between the two
                // would otherwise leave the merge applied but the key still
                // 'in_progress', and a retry would double-apply it. See
                // service.ts's applyCartMerge doc comment.
                const result = await runWithSerializationRetry(() =>
                    db.transaction(
                        async (tx) => {
                            const merged = await applyCartMerge(tx, userId, request.body.items);
                            await recordIdempotencySuccess(tx, claim.id, 200, merged);
                            return merged;
                        },
                        { isolationLevel: "repeatable read" }
                    )
                );
                return result;
            } catch (err) {
                await recordIdempotencyFailure(claim.id);
                throw err;
            }
        },
    });
}
