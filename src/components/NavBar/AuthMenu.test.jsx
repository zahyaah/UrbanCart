import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import { authApi } from "../../features/auth/authApi";
import { createStore } from "../../redux/store";
import AuthMenu from "./AuthMenu";

const user = { id: "u1", email: "shopper@example.com" };

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }));

// See useSession.test.jsx: lets each test decide what the backend answers,
// per URL, instead of depending on a fetch this environment can't complete.
const responses = vi.hoisted(() => ({ byUrl: {} }));
vi.mock("../../lib/rtkBaseQuery", () => ({
    apiBaseQuery: async (args) => responses.byUrl[typeof args === "string" ? args : args.url],
}));

beforeEach(() => {
    toastError.mockClear();
    responses.byUrl = { "/auth/me": { data: { user } } };
});

// Seeded before render so the account menu is there on first paint.
function renderWithSeededUser() {
    const store = createStore();
    store.dispatch(authApi.util.upsertQueryData("getMe", undefined, user));
    return renderWithProviders(<AuthMenu />, { store });
}

async function clickLogout() {
    await userEvent.click(await screen.findByRole("button", { name: /Account menu for/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Log out/ }));
}

describe("AuthMenu", () => {
    it("shows the account menu while getMe holds a cached, successful user", async () => {
        renderWithSeededUser();

        expect(
            await screen.findByRole("button", { name: /Account menu for shopper@example\.com/ })
        ).toBeInTheDocument();
    });

    // Regression: logout invalidates "Session" and re-triggers getMe; RTK
    // Query keeps the last *successful* `data` even after that refetch
    // 401s, so a stale user kept rendering the signed-in dropdown.
    it("switches to Sign In after a successful logout, even though getMe's data still holds the old user", async () => {
        renderWithSeededUser();
        responses.byUrl["/auth/logout"] = { data: { ok: true } };
        responses.byUrl["/auth/me"] = { error: { status: 401, data: {} } };

        await clickLogout();

        expect(await screen.findByRole("link", { name: "Sign In" })).toBeInTheDocument();
        expect(toastError).not.toHaveBeenCalled();
    });

    // Regression: the result was never unwrapped, so a rejected logout
    // (e.g. the cross-site CSRF 403) did nothing visible at all.
    it("tells the user when logout fails, and keeps them signed in", async () => {
        renderWithSeededUser();
        responses.byUrl["/auth/logout"] = { error: { status: 403, data: {} } };

        await clickLogout();

        expect(toastError).toHaveBeenCalledWith("Couldn't log out. Please try again.");
        expect(await screen.findByRole("button", { name: /Account menu for/ })).toBeInTheDocument();
    });
});
