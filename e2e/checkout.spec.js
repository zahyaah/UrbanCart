import { test, expect } from "@playwright/test";
import {
    addFirstProductToCart,
    createUser,
    expectNoHorizontalOverflow,
    fillAddressStep,
    signIn,
    trackConsoleErrors,
} from "./helpers";

const ORDER_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

test.describe("checkout", () => {
    test("sends a guest to the login gate instead of the address step", async ({ page }) => {
        await addFirstProductToCart(page);

        await page.goto("/cart");
        await page.getByRole("button", { name: "PROCEED TO CHECKOUT" }).click();

        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole("heading", { name: "Shipping Address" })).toBeHidden();
    });

    // Enters checkout by clicking through from the cart rather than going
    // straight to /checkout: the regression guard for the layout's
    // page-transition double-mount, which discarded the typed address.
    test("signs in, places an order and pays it with the demo button", async ({ page, request }) => {
        const errors = trackConsoleErrors(page);
        const user = await createUser(request);
        await addFirstProductToCart(page);

        await page.goto("/cart");
        await page.getByRole("button", { name: "PROCEED TO CHECKOUT" }).click();
        await signIn(page, user);

        // Back at checkout with the guest item merged into the server cart.
        await expect(page).toHaveURL(/\/checkout$/);
        await fillAddressStep(page);

        await expect(page).toHaveURL(new RegExp(`/checkout/${ORDER_ID.source}$`));
        await expect(page.getByText("Demo: no real payment")).toBeVisible();
        await expect(page.locator("input")).toHaveCount(0);
        await page.getByRole("button", { name: "Pay (demo)" }).click();

        await expect(page).toHaveURL(new RegExp(`/checkout/confirmation\\?orderId=${ORDER_ID.source}$`));
        await expect(page.getByText("Order Placed!")).toBeVisible();
        await expect(page.locator("span.font-mono")).toHaveText(ORDER_ID);
        // Paying removes the order's items from the cart.
        await expect(page.getByRole("button", { name: /^Open cart, 0 items$/ })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        expect(errors).toEqual([]);
    });

    test("blocks the address step until required fields are filled", async ({ page, request }) => {
        const user = await createUser(request);
        await addFirstProductToCart(page);
        await page.goto("/checkout");
        await signIn(page, user);
        await expect(page.getByRole("heading", { name: "Shipping Address" })).toBeVisible();

        await page.getByRole("button", { name: "Continue to Payment" }).click();

        await expect(page.getByText("Full name is required")).toBeVisible();
        await expect(page).toHaveURL(/\/checkout$/);
    });

    test("redirects a signed-in shopper with an empty cart to the cart page", async ({ page, request }) => {
        const user = await createUser(request);
        await page.goto("/login");
        await signIn(page, user);

        await page.goto("/checkout");

        await expect(page).toHaveURL(/\/cart$/);
    });
});
