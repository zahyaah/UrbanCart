import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;

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

    // Test the production build, not the dev server -- that is what ships.
    webServer: {
        command: "npm run build && npm run preview -- --port " + PORT,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
