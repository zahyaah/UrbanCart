import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import {
    serializerCompiler,
    validatorCompiler,
    hasZodFastifySchemaValidationErrors,
    type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { ZodError } from "zod";
import { config } from "./config.js";
import { ApiError } from "./lib/errors.js";
import { redis } from "./lib/redis.js";
import { errorReporter } from "./lib/sentry.js";
import { healthRoutes } from "./modules/health/routes.js";
import { identityRoutes } from "./modules/identity/routes.js";
import { catalogRoutes } from "./modules/catalog/routes.js";
import { cartRoutes } from "./modules/cart/routes.js";
import { orderRoutes } from "./modules/orders/routes.js";
import { stripeWebhookRoutes } from "./modules/orders/webhook-routes.js";

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: config.isProduction ? "info" : "debug",
            // Never let a password/token/card field reach the log stream,
            // even accidentally via a body/header dump during debugging.
            redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "*.passwordHash"],
        },
        trustProxy: config.isProduction,
        // Lets a request carry its own id across service boundaries
        // (frontend -> backend -> logs -> Sentry) instead of a fresh one
        // being minted at every hop. Falls back to Fastify's default
        // generator when the header is absent, same as today.
        requestIdHeader: "x-request-id",
    }).withTypeProvider<ZodTypeProvider>();

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(helmet);
    await app.register(cors, {
        origin: config.corsOrigins,
        credentials: true,
    });
    await app.register(cookie);
    await app.register(rateLimit, {
        global: true,
        // 200/min per IP looked reasonable on paper but a k6 load test
        // (k6/catalog.js) showed it's exhausted by ONE active shopper within
        // seconds -- ConfirmationPage alone polls every 2s (SPEC-orders.md),
        // and any shared-IP scenario (office NAT, corporate proxy) multiplies
        // that across every concurrent user behind it. Raised to a number a
        // real browsing session won't hit under normal use while still
        // bounding abuse; the auth-specific limit below is unaffected and
        // stays deliberately strict.
        max: 600,
        timeWindow: "1 minute",
        // Without a shared store, each instance counts independently -- the
        // effective limit becomes max * instanceCount, and the per-route
        // AUTH_RATE_LIMIT in identity/routes.ts loses its meaning entirely
        // once there's more than one backend process. Falls back to
        // @fastify/rate-limit's default in-memory store when Redis isn't
        // configured (single-instance local dev).
        redis: redis ?? undefined,
        skipOnError: true,
    });

    // Every error response follows { error: { code, message, details? } } --
    // see lib/errors.ts. Unexpected errors never leak internals (stack
    // traces, driver error text) to the client; they're logged instead.
    app.setErrorHandler((error: FastifyError | ApiError | ZodError, request, reply) => {
        if (error instanceof ApiError) {
            // Most ApiErrors are expected (4xx) and not worth reporting, but
            // Errors.internal() (identity/service.ts, orders/service.ts)
            // deliberately signals "this should never happen" with a 500 --
            // exactly the kind of unexpected-but-detected error Sentry
            // exists for. Log/report it the same way the catch-all branch
            // below does for an unexpected raw Error.
            if (error.statusCode >= 500) {
                request.log.error(error);
                errorReporter.captureException(error, { requestId: request.id });
            }
            reply.status(error.statusCode).send({
                error: { code: error.code, message: error.message, details: error.details },
            });
            return;
        }

        if (error instanceof ZodError) {
            reply.status(422).send({
                error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.flatten() },
            });
            return;
        }

        // fastify-type-provider-zod never throws a raw ZodError for a
        // route-schema failure -- it converts it into Fastify's own
        // validation-error shape (error.validation), which otherwise falls
        // through to Fastify's default 400. This is the documented way to
        // detect that shape and map it to this API's one error format.
        if (hasZodFastifySchemaValidationErrors(error)) {
            reply.status(422).send({
                error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.validation },
            });
            return;
        }

        // Fastify's own schema-validation failures (when not routed through
        // Zod, e.g. a malformed header) carry a statusCode already.
        if (error.statusCode && error.statusCode < 500) {
            reply.status(error.statusCode).send({
                error: { code: "BAD_REQUEST", message: error.message },
            });
            return;
        }

        request.log.error(error);
        // Only unexpected errors reach here -- every expected branch above
        // (ApiError, ZodError, Fastify validation, any sub-500 statusCode)
        // returns before this point. A no-op when SENTRY_DSN isn't set.
        errorReporter.captureException(error, { requestId: request.id });
        reply.status(500).send({
            error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
        });
    });

    app.register(healthRoutes);
    app.register(identityRoutes);
    app.register(catalogRoutes);
    app.register(cartRoutes);
    app.register(orderRoutes);
    app.register(stripeWebhookRoutes);

    return app;
}
