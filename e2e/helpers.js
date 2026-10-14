import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";

/**
 * Fails the test if the page scrolls horizontally. Every layout regression
 * this project has actually shipped showed up here first.
 */
export async function expectNoHorizontalOverflow(page) {
    const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflows, "page should not scroll horizontally").toBe(false);
}

// Chrome logs failed sub-resource requests to the console as type "error".
// Product images load from a third-party CDN (fakestoreapi.com) this app does
// not control, and the browser's own network stack can drop them transiently
// (e.g. ERR_NETWORK_IO_SUSPENDED) independent of anything the app did wrong.
// Only "Failed to load resource:" carries that browser-generated prefix --
// real console.error calls from app code never do.
const isResourceLoadNoise = (text) => text.startsWith("Failed to load resource:");

/** Collects console errors and page exceptions for the life of the page. */
export function trackConsoleErrors(page) {
    const errors = [];
    page.on("console", (msg) => {
        if (msg.type() === "error" && !isResourceLoadNoise(msg.text())) errors.push(msg.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    return errors;
}

/** Adds the first product in the catalog to the cart. */
export async function addFirstProductToCart(page) {
    await page.goto("/");
    const addButton = page.getByRole("button", { name: "ADD TO CART" }).first();
    await addButton.click();
    await expect(page.getByRole("button", { name: /^Open cart, 1 item$/ })).toBeVisible();
}

export async function fillAddressStep(page) {
    await expect(page.getByRole("heading", { name: "Shipping Address" })).toBeVisible();

    await page.fill('input[name="fullName"]', "Test User");
    await page.fill('input[name="addressLine1"]', "123 Main St");
    await page.fill('input[name="city"]', "Springfield");
    await page.fill('input[name="postalCode"]', "12345");
    await page.fill('input[name="country"]', "USA");
    await expect(page.locator('input[name="country"]')).toHaveValue("USA");

    await page.getByRole("button", { name: "Continue to Payment" }).click();
}

/**
 * Registers a fresh account through the API, in a request context separate
 * from the page's browser context, so the page itself stays signed out.
 * Credentials are generated per run, never hardcoded.
 */
export async function createUser(request) {
    const credentials = { email: `e2e-${randomUUID()}@urbancart.test`, password: randomUUID() };
    const res = await request.post("/api/auth/register", { data: credentials });
    expect(res.status(), await res.text()).toBe(201);
    return credentials;
}

/** Fills and submits the sign-in form; the page must already be on /login. */
export async function signIn(page, { email, password }) {
    await expect(page).toHaveURL(/\/login$/);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("button", { name: `Account menu for ${email}` })).toBeVisible();
}
