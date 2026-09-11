import { describe, it, expect, vi, afterEach } from "vitest";
import { buildApp } from "./app.js";
import { errorReporter } from "./lib/sentry.js";
import { Errors } from "./lib/errors.js";

// Sentry itself is a third-party reporting sink with real network side
// effects -- a legitimate place to mock, unlike the app's own business
// logic (see test-driven-development's guidance on what's acceptable to
// mock). This proves the error handler's Sentry.captureException call is
// actually reachable and wired correctly, not just present in the source.
describe("unexpected error handling", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the standard error shape and reports to Sentry for a genuinely unexpected error", async () => {
        const captureSpy = vi.spyOn(errorReporter, "captureException");
        const app = await buildApp();
        app.get("/__test/boom", () => {
            throw new Error("something genuinely broke");
        });

        const res = await app.inject({ method: "GET", url: "/__test/boom" });

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body)).toEqual({
            error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
        });
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    });

    it("does not report an expected 4xx (ApiError) to Sentry", async () => {
        const captureSpy = vi.spyOn(errorReporter, "captureException");
        const app = await buildApp();

        const res = await app.inject({ method: "GET", url: "/products/not-a-uuid" });

        expect(res.statusCode).toBe(422);
        expect(captureSpy).not.toHaveBeenCalled();
    });

    it("reports a 500-status ApiError (Errors.internal()) to Sentry -- not just a raw Error", async () => {
        // identity/service.ts and orders/service.ts both throw
        // Errors.internal() for a "this should never happen" state -- an
        // ApiError, but every bit as unexpected as an uncaught Error, and
        // easy to silently exclude by only checking `instanceof ApiError`
        // without also checking its statusCode.
        const captureSpy = vi.spyOn(errorReporter, "captureException");
        const app = await buildApp();
        app.get("/__test/internal-api-error", () => {
            throw Errors.internal("simulated should-never-happen state");
        });

        const res = await app.inject({ method: "GET", url: "/__test/internal-api-error" });

        expect(res.statusCode).toBe(500);
        expect(captureSpy).toHaveBeenCalledTimes(1);
    });
});
