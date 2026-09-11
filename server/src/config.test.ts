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
});
