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

    test("shows at least four products above the fold on mobile", async ({ page }) => {
        // The two-column mobile grid exists so shoppers can compare without
        // scrolling; a regression to one column silently breaks that.
        await page.setViewportSize({ width: 375, height: 800 });
        await page.goto("/");
        await expect(page.getByRole("button", { name: "ADD TO CART" }).first()).toBeVisible();

        const cards = page.getByRole("button", { name: "ADD TO CART" });
        const visibleInViewport = await cards.evaluateAll((nodes) =>
            nodes.filter((node) => node.getBoundingClientRect().top < 800).length
        );

        expect(visibleInViewport).toBeGreaterThanOrEqual(4);
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

        await page.goto("/product/1");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
