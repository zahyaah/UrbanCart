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
        max: 200,
        timeWindow: "1 minute",
    });

    // Every error response follows { error: { code, message, details? } } --
    // see lib/errors.ts. Unexpected errors never leak internals (stack
    // traces, driver error text) to the client; they're logged instead.
    app.setErrorHandler((error: FastifyError | ApiError | ZodError, request, reply) => {
        if (error instanceof ApiError) {
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
