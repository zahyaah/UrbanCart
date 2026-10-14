import { defineConfig, devices } from "@playwright/test";

// Smoke test against the DEPLOYED site -- the only check that exercises the
// real Vercel -> Render hop, cookie attributes and CSRF Origin check that
// unit tests and the local e2e suite can't reproduce. Run manually after a
// deploy; it logs into a real account, so it never runs in CI by default.
//
//   PROD_URL=https://<frontend>.vercel.app \
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... \
//   npx playwright test -c playwright.prod.config.js
if (!process.env.PROD_URL || !process.env.SMOKE_EMAIL || !process.env.SMOKE_PASSWORD) {
    throw new Error("Set PROD_URL, SMOKE_EMAIL and SMOKE_PASSWORD (an existing account on the deployed site)");
}

export default defineConfig({
    testDir: "./e2e-prod",
    // One shared account: runs must not interleave.
    workers: 1,
    retries: 0,
    // Render's free tier cold-starts after 15 idle minutes.
    timeout: 120_000,
    expect: { timeout: 30_000 },
    reporter: [["list"]],
    use: {
        baseURL: process.env.PROD_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        // WebKit blocks third-party cookies by default -- the browser where
        // a cross-site cookie setup fails first.
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
});
