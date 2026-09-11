import * as Sentry from "@sentry/node";
import { config } from "../config.js";

// A no-op SDK (Sentry.init() never called) when SENTRY_DSN is unset -- every
// Sentry.* call becomes a harmless no-op, same pattern as the frontend's
// pk_test_replace_me placeholder for Stripe. Import this before anything
// else boots (see server.ts) so the SDK is ready before the first request.
if (config.SENTRY_DSN) {
    Sentry.init({
        dsn: config.SENTRY_DSN,
        environment: config.NODE_ENV,
        // Manual error capture only (see app.ts's error handler) -- no
        // performance/tracing integrations enabled, so there's no sample
        // rate to tune beyond this.
        tracesSampleRate: 0,
    });
} else {
    console.warn("SENTRY_DSN not set -- error reporting disabled");
}

// A plain object, not a re-export of Sentry's own namespace -- ES module
// namespace exports can't be spied on/mocked, and app.ts only ever needs
// this one operation, not the whole SDK surface.
export const errorReporter = {
    captureException(error: unknown, tags?: Record<string, string>) {
        Sentry.captureException(error, tags ? { tags } : undefined);
    },
};
