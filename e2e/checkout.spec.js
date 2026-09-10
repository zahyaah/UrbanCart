import { test, expect } from "@playwright/test";
import {
    addFirstProductToCart,
    expectNoHorizontalOverflow,
    fillAddressStep,
    fillPaymentStep,
    trackConsoleErrors,
} from "./helpers";

test.describe("checkout wizard", () => {
    // This test enters checkout by clicking through from the cart rather than
    // navigating straight to /checkout, which is what makes it the regression
    // guard for the layout's page-transition double-mount: rendering <Outlet />
    // inside the exiting AnimatePresence child mounted the incoming page twice
    // and discarded the address typed in between. Verified to fail without the
    // useOutlet() fix in Layout.jsx.
    test("walks a shopper from cart to order confirmation", async ({ page }) => {
        const errors = trackConsoleErrors(page);
        await addFirstProductToCart(page);

        await page.goto("/cart");
        await page.getByRole("button", { name: "PROCEED TO CHECKOUT" }).click();
        await expect(page).toHaveURL(/\/checkout$/);

        await fillAddressStep(page);
        await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();

        await fillPaymentStep(page);
        await expect(page.getByRole("heading", { name: "Review Your Order" })).toBeVisible();

        await page.getByRole("button", { name: "PLACE ORDER" }).click();

        await expect(page.getByText("Order Placed!")).toBeVisible();
        await expect(page.locator("span.font-mono")).toBeVisible();
        await expectNoHorizontalOverflow(page);
        expect(errors).toEqual([]);
    });

    test("keeps the order details on the confirmation after the cart is cleared", async ({ page }) => {
        // The confirmation renders from a snapshot taken before clearCart(),
        // so an emptied cart must not blank out the receipt.
        await addFirstProductToCart(page);
        await page.goto("/checkout");
        await fillAddressStep(page);
        await fillPaymentStep(page);
        await page.getByRole("button", { name: "PLACE ORDER" }).click();

        await expect(page.getByText("Order Placed!")).toBeVisible();
        await expect(page.getByRole("button", { name: /^Open cart, 0 items$/ })).toBeVisible();
    });

    test("blocks the address step until required fields are filled", async ({ page }) => {
        await addFirstProductToCart(page);
        await page.goto("/checkout");

        await page.getByRole("button", { name: "Continue to Payment" }).click();

        await expect(page.getByText("Full name is required")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Payment" })).toBeHidden();
    });

    test("rejects an invalid card number at the payment step", async ({ page }) => {
        await addFirstProductToCart(page);
        await page.goto("/checkout");
        await fillAddressStep(page);

        await page.fill('input[name="cardholderName"]', "Test User");
        await page.fill('input[name="cardNumber"]', "1234");
        await page.fill('input[name="expiry"]', "04/28");
        await page.fill('input[name="cvc"]', "123");
        await page.getByRole("button", { name: "Review Order" }).click();

        await expect(page.getByText("Enter a valid card number")).toBeVisible();
    });

    test("lets a shopper step back to the address form without losing data", async ({ page }) => {
        await addFirstProductToCart(page);
        await page.goto("/checkout");
        await fillAddressStep(page);
        await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();

        await page.getByRole("button", { name: "Back" }).click();

        await expect(page.locator('input[name="fullName"]')).toHaveValue("Test User");
    });

    test("redirects to the cart when opened with nothing in the cart", async ({ page }) => {
        await page.goto("/checkout");

        await expect(page).toHaveURL(/\/cart$/);
    });
});
