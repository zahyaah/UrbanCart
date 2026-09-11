// Shared shapes for the checkout wizard. Payment/PlacedOrder used to live
// here (the old mock card form + a client-side-only "confirmation" step),
// but real payment collection is now Stripe's embedded Payment Element --
// see PaymentStep.tsx/PaymentForm.tsx -- and confirmation is a real routed
// page (ConfirmationPage.tsx) that fetches the order from the server, not
// wizard state carried in memory.
export interface Address {
    fullName: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
}

export type WizardStep = "address" | "payment";
