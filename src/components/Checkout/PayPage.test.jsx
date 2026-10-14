import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import PayPage from "./PayPage";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const pendingOrder = {
    id: ORDER_ID,
    status: "pending_payment",
    subtotal: 50,
    items: [
        { productId: "p1", title: "Backpack", price: 21.25, quantity: 2 },
        { productId: "p2", title: "Tee", price: 7.5, quantity: 1 },
    ],
    shippingAddress: { fullName: "A", addressLine1: "1 St", city: "C", region: "", postalCode: "1", country: "X" },
    createdAt: "2026-10-14T00:00:00.000Z",
};

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }));

// Every RTK Query slice goes through apiBaseQuery; this records each call and
// answers per URL (see useSession.test.jsx for why fetch itself can't run here).
const api = vi.hoisted(() => ({ calls: [], byUrl: {} }));
vi.mock("../../lib/rtkBaseQuery", () => ({
    apiBaseQuery: async (args) => {
        const url = typeof args === "string" ? args : args.url;
        api.calls.push({ url, method: typeof args === "string" ? "GET" : args.method, body: args.body });
        return api.byUrl[url] ?? { error: { status: 404, data: {} } };
    },
}));

beforeEach(() => {
    toastError.mockClear();
    api.calls = [];
    api.byUrl = { [`/orders/${ORDER_ID}`]: { data: pendingOrder } };
});

function renderPayPage() {
    return renderWithProviders(
        <Routes>
            <Route path="/checkout/:orderId" element={<PayPage />} />
            <Route path="/checkout/confirmation" element={<p>Confirmation page</p>} />
        </Routes>,
        { route: `/checkout/${ORDER_ID}` }
    );
}

describe("PayPage", () => {
    it("shows the server's order total and a demo label, with no payment input fields", async () => {
        renderPayPage();

        expect(await screen.findByText("$50.00")).toBeInTheDocument();
        expect(screen.getByText("Demo: no real payment")).toBeInTheDocument();
        expect(screen.queryAllByRole("textbox")).toHaveLength(0);
        expect(document.querySelectorAll("input")).toHaveLength(0);
    });

    it("pays the order with no amount in the request, then goes to the confirmation page", async () => {
        api.byUrl[`/orders/${ORDER_ID}/pay`] = { data: { ...pendingOrder, status: "paid" } };
        renderPayPage();

        await userEvent.click(await screen.findByRole("button", { name: "Pay (demo)" }));

        expect(await screen.findByText("Confirmation page")).toBeInTheDocument();
        const payCall = api.calls.find((c) => c.url === `/orders/${ORDER_ID}/pay`);
        expect(payCall).toMatchObject({ method: "POST" });
        expect(payCall.body).toBeUndefined();
        expect(toastError).not.toHaveBeenCalled();
    });

    it("shows an error toast and stays on the page when payment fails", async () => {
        api.byUrl[`/orders/${ORDER_ID}/pay`] = {
            error: { status: 409, data: { error: { code: "CONFLICT", message: "This order can no longer be paid" } } },
        };
        renderPayPage();

        await userEvent.click(await screen.findByRole("button", { name: "Pay (demo)" }));

        await waitFor(() => expect(toastError).toHaveBeenCalledWith("Payment failed: This order can no longer be paid"));
        expect(await screen.findByRole("button", { name: "Pay (demo)" })).toBeInTheDocument();
        expect(screen.queryByText("Confirmation page")).not.toBeInTheDocument();
    });
});
