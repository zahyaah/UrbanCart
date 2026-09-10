import type { CartItem } from "../../features/cart/cartSlice";

// Shared shapes for the checkout wizard's captured step data, used by the
// step that produces each one, ReviewStep (which displays both), and
// Checkout's own wizard state.
export interface Address {
    fullName: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
}

export interface Payment {
    cardholderName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
}

// Captured at place-order time -- see Checkout.tsx's handlePlaceOrder.
export interface PlacedOrder {
    items: CartItem[];
    subtotal: number;
    orderNumber: string;
}

export type WizardStep = "address" | "payment" | "review" | "confirmation";
