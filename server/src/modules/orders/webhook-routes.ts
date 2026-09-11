import type { FastifyInstance } from "fastify";
import { verifyWebhookSignature } from "../../lib/stripe.js";
import { markOrderPaidByStripeSession } from "./service.js";

/** Registered as its own encapsulated plugin specifically so the raw-body
 * content-type parser below applies ONLY to this route -- every other
 * route in the app keeps Fastify's normal JSON parsing. Stripe's signature
 * verification needs the exact bytes it sent; a parsed-then-reserialized
 * body would never match the signature. */
export async function stripeWebhookRoutes(app: FastifyInstance) {
    app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
        done(null, body);
    });

    app.post("/webhooks/stripe", async (request, reply) => {
        const rawBody = request.body as Buffer;
        const signature = request.headers["stripe-signature"];
        const event = verifyWebhookSignature(rawBody, Array.isArray(signature) ? signature[0] : signature);

        if (event.type === "checkout.session.completed" && event.sessionId) {
            await markOrderPaidByStripeSession(event.sessionId);
        }
        // Unhandled event types are a documented, expected no-op -- see
        // Stripe's own guidance to only act on event types the integration
        // actually needs, not to error on the rest.

        reply.status(200);
        return { received: true };
    });
}
