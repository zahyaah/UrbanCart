import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentStep from "./PaymentStep";

const VALID_PAYMENT = {
    cardholderName: "Ada Lovelace",
    cardNumber: "4242 4242 4242 4242",
    expiry: "04/28",
    cvc: "123",
};

const renderStep = (props = {}) => {
    const onSubmit = vi.fn();
    const onBack = vi.fn();
    render(
        <PaymentStep initialValues={null} onSubmit={onSubmit} onBack={onBack} {...props} />
    );
    return { onSubmit, onBack, user: userEvent.setup() };
};

const submit = (user) => user.click(screen.getByRole("button", { name: "Review Order" }));

describe("PaymentStep", () => {
    it("blocks submission on an empty form", async () => {
        const { onSubmit, user } = renderStep();

        await submit(user);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Cardholder name is required")).toBeInTheDocument();
        expect(screen.getByText("Enter a valid card number")).toBeInTheDocument();
        expect(screen.getByText("Use MM/YY format")).toBeInTheDocument();
        expect(screen.getByText("Enter a valid CVC")).toBeInTheDocument();
    });

    it("accepts a card number typed with spaces", async () => {
        // Users paste and type card numbers in groups of four; the validator
        // strips whitespace before checking length.
        const { onSubmit, user } = renderStep({ initialValues: VALID_PAYMENT });

        await submit(user);

        expect(onSubmit).toHaveBeenCalledWith(VALID_PAYMENT);
    });

    it.each([
        ["too short", "424242424242"],
        ["too long", "42424242424242424242"],
        ["containing letters", "4242abcd42424242"],
    ])("rejects a card number %s", async (_label, cardNumber) => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_PAYMENT, cardNumber },
        });

        await submit(user);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Enter a valid card number")).toBeInTheDocument();
    });

    it.each([
        ["13 digits", "4242424242424"],
        ["19 digits", "4242424242424242424"],
    ])("accepts a card number of %s (boundary)", async (_label, cardNumber) => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_PAYMENT, cardNumber },
        });

        await submit(user);

        expect(onSubmit).toHaveBeenCalled();
    });

    it.each([
        ["a single-digit month", "4/28"],
        ["a four-digit year", "04/2028"],
        ["a dash separator", "04-28"],
        ["non-numeric text", "ab/cd"],
    ])("rejects an expiry with %s", async (_label, expiry) => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_PAYMENT, expiry },
        });

        await submit(user);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Use MM/YY format")).toBeInTheDocument();
    });

    it.each([
        ["3 digits", "123"],
        ["4 digits (Amex)", "1234"],
    ])("accepts a CVC of %s", async (_label, cvc) => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_PAYMENT, cvc },
        });

        await submit(user);

        expect(onSubmit).toHaveBeenCalled();
    });

    it.each([
        ["2 digits", "12"],
        ["5 digits", "12345"],
        ["non-numeric", "12a"],
    ])("rejects a CVC of %s", async (_label, cvc) => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_PAYMENT, cvc },
        });

        await submit(user);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Enter a valid CVC")).toBeInTheDocument();
    });

    it("moves focus to the first invalid field on a failed submit", async () => {
        const { user } = renderStep({
            initialValues: { ...VALID_PAYMENT, cardNumber: "nope", cvc: "" },
        });

        await submit(user);

        expect(screen.getByLabelText("Card number")).toHaveFocus();
    });

    it("calls onBack without validating the form", async () => {
        // Going back must never be gated on a valid card.
        const { onBack, onSubmit, user } = renderStep();

        await user.click(screen.getByRole("button", { name: "Back" }));

        expect(onBack).toHaveBeenCalledTimes(1);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("tells the user no real payment is processed", () => {
        renderStep();

        expect(screen.getByText(/demo checkout/i)).toBeInTheDocument();
    });
});
