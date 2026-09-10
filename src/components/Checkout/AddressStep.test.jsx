import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressStep from "./AddressStep";

const VALID_ADDRESS = {
    fullName: "Ada Lovelace",
    addressLine1: "12 Analytical Way",
    city: "London",
    region: "Greater London",
    postalCode: "NW1 6XE",
    country: "United Kingdom",
};

const renderStep = (props = {}) => {
    const onSubmit = vi.fn();
    render(<AddressStep initialValues={null} onSubmit={onSubmit} {...props} />);
    return { onSubmit, user: userEvent.setup() };
};

const submit = (user) => user.click(screen.getByRole("button", { name: /continue|payment/i }));

describe("AddressStep", () => {
    it("blocks submission and reports every missing required field", async () => {
        const { onSubmit, user } = renderStep();

        await submit(user);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("Full name is required")).toBeInTheDocument();
        expect(screen.getByText("Address is required")).toBeInTheDocument();
        expect(screen.getByText("City is required")).toBeInTheDocument();
        expect(screen.getByText("Postal code is required")).toBeInTheDocument();
        expect(screen.getByText("Country is required")).toBeInTheDocument();
    });

    it("treats a whitespace-only value as missing", async () => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_ADDRESS, city: "   " },
        });

        await submit(user);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText("City is required")).toBeInTheDocument();
    });

    it("does not require the region field", async () => {
        const { onSubmit, user } = renderStep({
            initialValues: { ...VALID_ADDRESS, region: "" },
        });

        await submit(user);

        expect(onSubmit).toHaveBeenCalledWith({ ...VALID_ADDRESS, region: "" });
    });

    it("moves focus to the first invalid field on a failed submit", async () => {
        // Without this the user is left at the bottom of the form with no
        // indication of which field above them failed.
        const { user } = renderStep({
            initialValues: { ...VALID_ADDRESS, city: "", country: "" },
        });

        await submit(user);

        expect(screen.getByLabelText("City")).toHaveFocus();
    });

    it("marks invalid fields with aria-invalid", async () => {
        const { user } = renderStep();

        await submit(user);

        expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-invalid", "true");
    });

    it("submits the typed values once the form is complete", async () => {
        const { onSubmit, user } = renderStep();

        await user.type(screen.getByLabelText("Full name"), "Ada Lovelace");
        await user.type(screen.getByLabelText("Address"), "12 Analytical Way");
        await user.type(screen.getByLabelText("City"), "London");
        await user.type(screen.getByLabelText("Postal code"), "NW1 6XE");
        await user.type(screen.getByLabelText("Country"), "United Kingdom");
        await submit(user);

        expect(onSubmit).toHaveBeenCalledWith({
            ...VALID_ADDRESS,
            region: "",
        });
    });

    it("rehydrates from initialValues when the user steps back into it", async () => {
        renderStep({ initialValues: VALID_ADDRESS });

        expect(screen.getByLabelText("Full name")).toHaveValue("Ada Lovelace");
        expect(screen.getByLabelText("City")).toHaveValue("London");
    });
});
