import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const API_PORT = 3001;
const baseURL = `http://localhost:${PORT}`;

// The storefront loads its catalog from the backend, so the suite needs a
// real one: without it /products fails and no product card (or ADD TO
// CART button) ever renders, on every project. CI provides Postgres and
// Redis as service containers (ci.yml); locally, point E2E_DATABASE_URL at
// a disposable local database -- it is migrated and its catalog reseeded
// (the seed script refuses non-local hosts) -- and E2E_REDIS_URL at Redis.
const E2E_DATABASE_URL =
    process.env.E2E_DATABASE_URL ?? "postgres://urbancart:urbancart_dev_only@localhost:5433/urbancart_e2e";
const E2E_REDIS_URL = process.env.E2E_REDIS_URL ?? "redis://localhost:6379/2";

export default defineConfig({
    testDir: "./e2e",
    // The suite mutates localStorage per test, but each test gets its own
    // browser context, so files can run in parallel safely.
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },

    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", use: { ...devices["Pixel 5"] } },
    ],

    webServer: [
        {
            command:
                "npx tsx src/db/migrate.ts && npx tsx src/db/reset-e2e.ts && npx tsx src/db/seed.ts && npx tsx src/server.ts",
            cwd: "server",
            url: `http://localhost:${API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
                NODE_ENV: "development",
                PORT: String(API_PORT),
                DATABASE_URL: E2E_DATABASE_URL,
                JWT_ACCESS_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
                // The browser only ever talks to the preview origin; vite
                // forwards /api/* there, Origin header intact (CSRF check).
                CORS_ORIGIN: baseURL,
                FRONTEND_URL: baseURL,
                COOKIE_PATH_PREFIX: "/api",
                // Same store as production (shared Redis, fail-closed auth
                // limits), not the in-memory fallback.
                REDIS_URL: E2E_REDIS_URL,
                // Every test registers and logs in from one IP; the
                // production defaults would 429 the suite partway through.
                AUTH_RATE_LIMIT_MAX: "1000",
                LOGIN_EMAIL_RATE_LIMIT_MAX: "1000",
                REFRESH_RATE_LIMIT_MAX: "1000",
            },
        },
        {
            // Test the production build, not the dev server -- that is what
            // ships. VITE_API_URL=/api mirrors the Vercel deployment.
            command: "npm run build && npm run preview -- --port " + PORT,
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { VITE_API_URL: "/api", API_PROXY_TARGET: `http://localhost:${API_PORT}` },
        },
    ],
});
