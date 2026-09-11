import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        // Integration tests share one real Postgres instance (truncated
        // between tests in setup.ts) -- run serially so they don't race
        // each other's truncation.
        fileParallelism: false,
        testTimeout: 15000,
    },
});
