import { test, expect } from "@playwright/test";

const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

async function signIn(page) {
    await page.goto("/login");
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("button", { name: `Account menu for ${EMAIL}` })).toBeVisible();
}

async function signOut(page) {
    await page.getByRole("button", { name: `Account menu for ${EMAIL}` }).click();
    await page.getByRole("menuitem", { name: /Log out/ }).click();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
}

test("guest cart merges on login, session survives access-token expiry, logout sticks", async ({ page, context }) => {
    // Start from a clean, signed-out state with an empty server cart.
    await signIn(page);
    await page.goto("/cart");
    const remove = page.getByLabel(/^Remove /);
    while (await remove.count()) {
        await remove.first().click();
    }
    await expect(page.getByText("Cart is empty!")).toBeVisible();
    await signOut(page);

    // 1. Guest adds an item, then signs in: the item must land in the
    //    server cart (POST /cart/merge, CSRF-protected).
    await page.goto("/");
    await page.getByRole("button", { name: "ADD TO CART" }).first().click();
    await expect(page.getByRole("button", { name: /^Open cart, 1 item$/ })).toBeVisible();
    await signIn(page);
    await page.goto("/cart");
    await expect(page.getByText(/didn.t make it into your cart/)).toHaveCount(0);
    await expect(page.locator("span.tabular-nums").first()).toHaveText("1");

    // 2. A signed-in mutation works (POST /cart/items, CSRF-protected).
    await page.getByLabel(/^Increase quantity of/).first().click();
    await expect(page.locator("span.tabular-nums").first()).toHaveText("2");

    // 3. Access token expiry: drop it and reload. The app must refresh via
    //    refresh_token (scoped to the browser-visible /api/auth path) and
    //    stay signed in, instead of silently logging the user out.
    const cookies = await context.cookies();
    expect(cookies.map((c) => c.name)).toEqual(expect.arrayContaining(["access_token", "refresh_token", "csrf_token"]));
    await context.clearCookies({ name: "access_token" });
    await page.reload();
    await expect(page.getByRole("button", { name: `Account menu for ${EMAIL}` })).toBeVisible();
    await expect(page.locator("span.tabular-nums").first()).toHaveText("2");

    // 4. Logout clears the session for real: still signed out after reload,
    //    and the auth cookies are gone.
    await signOut(page);
    await page.reload();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
    const remaining = (await context.cookies()).map((c) => c.name);
    expect(remaining).not.toContain("access_token");
    expect(remaining).not.toContain("refresh_token");
});
