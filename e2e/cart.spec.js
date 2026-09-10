import { test, expect } from "@playwright/test";
import { addFirstProductToCart, trackConsoleErrors } from "./helpers";

test.describe("cart", () => {
    test("shows an added item on the cart page", async ({ page }) => {
        await addFirstProductToCart(page);

        await page.goto("/cart");

        await expect(page.getByRole("button", { name: "PROCEED TO CHECKOUT" })).toBeVisible();
        await expect(page.locator("span.tabular-nums").first()).toHaveText("1");
    });

    test("applies every click of a rapid increment burst", async ({ page }) => {
        // Regression guard for the original race condition: quantity changes
        // used to trigger overlapping refetches that could resolve out of
        // order. Clicking faster than any network round-trip must still land.
        const errors = trackConsoleErrors(page);
        await addFirstProductToCart(page);
        await page.goto("/cart");

        const plus = page.getByLabel(/^Increase quantity of/).first();
        await plus.click();
        await plus.click();
        await plus.click();

        await expect(page.locator("span.tabular-nums").first()).toHaveText("4");
        expect(errors).toEqual([]);
    });

    test("removes the line item when decremented past the last unit", async ({ page }) => {
        await addFirstProductToCart(page);
        await page.goto("/cart");

        const minus = page.getByLabel(/^Decrease quantity of/).first();
        await minus.click();

        await expect(page.getByText("Cart is empty!")).toBeVisible();
    });

    test("survives an interleaved increment/decrement burst without drift", async ({ page }) => {
        await addFirstProductToCart(page);
        await page.goto("/cart");

        const plus = page.getByLabel(/^Increase quantity of/).first();
        const minus = page.getByLabel(/^Decrease quantity of/).first();
        await plus.click();
        await plus.click();
        await minus.click();
        await plus.click();
        await minus.click();

        await expect(page.locator("span.tabular-nums").first()).toHaveText("2");
    });

    test("persists the cart across a reload", async ({ page }) => {
        await addFirstProductToCart(page);
        await page.goto("/cart");
        await page.getByLabel(/^Increase quantity of/).first().click();
        await expect(page.locator("span.tabular-nums").first()).toHaveText("2");

        await page.reload();

        await expect(page.locator("span.tabular-nums").first()).toHaveText("2");
    });
});

test.describe("cart sheet", () => {
    test("opens from the navbar, traps focus, and closes on Escape", async ({ page }) => {
        const errors = trackConsoleErrors(page);
        await addFirstProductToCart(page);

        await page.getByRole("button", { name: /^Open cart/ }).click();
        const sheet = page.getByRole("dialog");
        await expect(sheet).toBeVisible();

        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        const focusInsideSheet = await page.evaluate(
            () => document.activeElement.closest('[role="dialog"]') !== null
        );
        expect(focusInsideSheet, "focus should stay inside the open sheet").toBe(true);

        await page.keyboard.press("Escape");

        await expect(sheet).toBeHidden();
        expect(errors).toEqual([]);
    });
});
