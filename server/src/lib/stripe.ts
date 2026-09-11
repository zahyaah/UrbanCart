import Stripe from "stripe";
import { config } from "../config.js";
import { Errors } from "./errors.js";

// A real network call, given an explicit timeout so a hung request can
// never occupy an idempotency claim indefinitely -- see
// STALE_IN_PROGRESS_MS's comment in lib/idempotency.ts.
const stripe = new Stripe(config.STRIPE_SECRET_KEY, { timeout: 10_000 });

export interface CheckoutSessionParams {
    orderId: string;
    subtotalCents: number;
    idempotencyKey: string;
    returnUrl: string;
}

export interface CheckoutSessionResult {
    id: string;
    clientSecret: string;
}

/** Thin wrapper, not a re-export of the SDK: this is the module tests
 * replace at the boundary (Stripe is exactly the kind of dependency
 * test-driven-development says to mock rather than call for real -- slow,
 * external, and its own side effects). Everything downstream depends on
 * this narrow interface, not the Stripe SDK directly. */
export async function createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const session = await stripe.checkout.sessions.create(
        {
            ui_mode: "elements",
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: { name: `Urban Cart order ${params.orderId}` },
                        unit_amount: params.subtotalCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: { orderId: params.orderId },
            return_url: params.returnUrl,
        },
        {
            // Stripe's own idempotency, derived deterministically from ours
            // -- defense in depth if our DB write fails after this call
            // already succeeded and a retry reaches Stripe again with the
            // same derived key. See SPEC-orders.md doubt review finding #12.
            idempotencyKey: `order-create:${params.idempotencyKey}`,
        }
    );

    if (!session.client_secret) {
        throw new Error("Stripe did not return a client_secret for the created session");
    }

    return { id: session.id, clientSecret: session.client_secret };
}

export interface VerifiedWebhookEvent {
    type: string;
    sessionId: string | null;
}

/** Verifies the Stripe-Signature header against the RAW request body --
 * this only works given the exact bytes Stripe sent, before any JSON
 * parsing touches them. See routes.ts's rawBody content-type parser. */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): VerifiedWebhookEvent {
    if (!signatureHeader) throw Errors.badRequest("Missing Stripe-Signature header");

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signatureHeader, config.STRIPE_WEBHOOK_SECRET);
    } catch {
        throw Errors.badRequest("Invalid webhook signature");
    }

    const sessionId =
        event.type.startsWith("checkout.session.") && "id" in event.data.object
            ? (event.data.object.id as string)
            : null;

    return { type: event.type, sessionId };
}
