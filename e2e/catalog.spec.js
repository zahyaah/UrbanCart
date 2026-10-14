import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, trackConsoleErrors } from "./helpers";

const VIEWPORTS = [
    { name: "mobile", width: 375, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
];

test.describe("product catalog", () => {
    for (const { name, width, height } of VIEWPORTS) {
        test(`renders without layout or console errors at ${name} (${width}px)`, async ({ page }) => {
            const errors = trackConsoleErrors(page);
            await page.setViewportSize({ width, height });

            await page.goto("/");
            await expect(page.getByRole("button", { name: "ADD TO CART" }).first()).toBeVisible();

            await expectNoHorizontalOverflow(page);
            expect(errors).toEqual([]);
        });

        test(`renders without layout or console errors at ${name} in dark mode`, async ({ page }) => {
            const errors = trackConsoleErrors(page);
            await page.setViewportSize({ width, height });

            await page.goto("/");
            await page.getByRole("button", { name: "Toggle dark mode" }).click();
            await expect(page.locator("html")).toHaveClass(/dark/);

            await expectNoHorizontalOverflow(page);
            expect(errors).toEqual([]);
        });
    }

    test("shows the first product card without scrolling", async ({ page }) => {
        // Each project's own configured viewport (Desktop Chrome, Pixel 5):
        // the first card's product image must be fully on screen on load.
        await page.goto("/");

        await expect(page.locator('a[href^="/product/"]').first()).toBeInViewport({ ratio: 1 });
    });

    test("confirms an add-to-cart with a toast", async ({ page }) => {
        const errors = trackConsoleErrors(page);
        await page.goto("/");

        await page.getByRole("button", { name: "ADD TO CART" }).first().click();

        await expect(page.getByText(/added to cart/i)).toBeVisible();
        expect(errors).toEqual([]);
    });
});

test.describe("product detail", () => {
    test("renders a single product without layout or console errors", async ({ page }) => {
        const errors = trackConsoleErrors(page);
        await page.setViewportSize({ width: 375, height: 800 });

        // Product ids are UUIDs assigned by the backend, so reach a product
        // the way a shopper does: through the first card on the listing.
        await page.goto("/");
        const firstCard = page.locator('a[href^="/product/"]').first();
        const href = await firstCard.getAttribute("href");
        const title = await firstCard.getByRole("img").getAttribute("alt");
        await firstCard.click();

        await expect(page).toHaveURL(new RegExp(`${href}$`));
        // The product's own heading -- the listing also has an <h1>, and it
        // stays mounted while the route transition plays.
        await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        await expect(page.getByRole("button", { name: "ADD TO CART" })).toBeVisible();

        await expectNoHorizontalOverflow(page);
        expect(errors).toEqual([]);
    });
});

test.describe("unknown routes", () => {
    test("renders the error page instead of a blank screen", async ({ page }) => {
        const errors = trackConsoleErrors(page);

        await page.goto("/nonexistent-route");

        await expect(page.getByText("This page doesn't exist.")).toBeVisible();
        expect(errors).toEqual([]);
    });
});

test.describe("theme", () => {
    test("persists the dark-mode choice across a reload", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Toggle dark mode" }).click();
        await expect(page.locator("html")).toHaveClass(/dark/);

        await page.reload();

        await expect(page.locator("html")).toHaveClass(/dark/);
    });
});
