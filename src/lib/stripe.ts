import { loadStripe } from "@stripe/stripe-js";

// Called once, outside any component's render, per Stripe's own guidance --
// re-calling this on every render would recreate the Stripe object needlessly.
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
