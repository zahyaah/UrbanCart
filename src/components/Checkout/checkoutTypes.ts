// Shared shapes for the checkout wizard. The wizard only collects the
// address; PaymentStep creates the order and hands off to the routed demo
// pay page (PayPage.tsx) and confirmation page (ConfirmationPage.tsx), both
// of which read the order from the server rather than wizard state.
export interface Address {
    fullName: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
}

export type WizardStep = "address" | "payment";
