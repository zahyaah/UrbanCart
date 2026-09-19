import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// config.ts parses process.env as a side effect of being imported, so each
// case needs a fresh module instance (vi.resetModules) rather than relying
// on the one import cached by every other test file.
describe("config", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("treats an empty-string optional var the same as an absent one", async () => {
        // Docker Compose and Render both emit "" rather than omitting a
        // variable that was left unset -- see docker-compose.yml's
        // `SENTRY_DSN: ${SENTRY_DSN:-}`.
        process.env.SENTRY_DSN = "";
        process.env.REDIS_URL = "";

        const { config } = await import("./config.js");

        expect(config.SENTRY_DSN).toBeUndefined();
        expect(config.REDIS_URL).toBeUndefined();
    });

    it("still accepts a real value for an optional var", async () => {
        process.env.REDIS_URL = "redis://localhost:6379/0";

        const { config } = await import("./config.js");

        expect(config.REDIS_URL).toBe("redis://localhost:6379/0");
    });

    it("normalizes CORS_ORIGIN entries to their bare origin", async () => {
        // Trailing slash is an easy env-var typo -- request.headers.origin
        // from a real browser never has one, so leaving it unnormalized
        // would make this entry silently never match.
        process.env.CORS_ORIGIN = "http://localhost:5173/, HTTP://Localhost:5174";
        process.env.FRONTEND_URL = "http://localhost:5173";

        const { config } = await import("./config.js");

        expect(config.corsOrigins).toEqual(["http://localhost:5173", "http://localhost:5174"]);
    });

    it("exits at boot when FRONTEND_URL is not included in CORS_ORIGIN", async () => {
        // This is the deploy-drift bug this schema guards against: an
        // operator updates one of these two vars (e.g. a new frontend
        // deployment URL) without updating the other, and CORS/CSRF
        // silently disagree on what the frontend's origin is. Failing
        // loudly at boot turns that into a deploy-time error instead of a
        // production 403 discovered days later.
        process.env.CORS_ORIGIN = "http://localhost:5173";
        process.env.FRONTEND_URL = "https://a-different-deploy.example.com";
        const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await import("./config.js");

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("FRONTEND_URL"));

        exitSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
