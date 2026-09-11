import { useReducer } from "react";
import { Navigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { stepTransition, reduce } from "../../lib/motion";
import { useCart } from "../../hooks/useCart";
import { useGetMeQuery } from "../../features/auth/authApi";
import StepIndicator from "./StepIndicator";
import AddressStep from "./AddressStep";
import PaymentStep from "./PaymentStep";
import type { Address, WizardStep } from "./checkoutTypes";

interface WizardState {
    step: WizardStep;
    address: Address | null;
    // Regenerated on every SUBMIT_ADDRESS, not once per wizard mount -- the
    // backend hashes the shipping address into the idempotency claim (see
    // SPEC-orders.md), so reusing a key after the shopper edits their
    // address would 422 as a "different intent" rather than letting them
    // fix a typo. A fresh key per submitted address keeps each attempt
    // independent while still deduping true in-flight retries within one
    // Payment-step visit.
    idempotencyKey: string;
}

type WizardAction = { type: "SUBMIT_ADDRESS"; payload: Address } | { type: "BACK_TO_ADDRESS" };

const initialWizardState: WizardState = { step: "address", address: null, idempotencyKey: "" };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
        case "SUBMIT_ADDRESS":
            return { ...state, address: action.payload, step: "payment", idempotencyKey: crypto.randomUUID() };
        case "BACK_TO_ADDRESS":
            return { ...state, step: "address" };
        default:
            return state;
    }
}

function Checkout() {
    const [state, dispatchWizard] = useReducer(wizardReducer, initialWizardState);
    const prefersReducedMotion = useReducedMotion();
    const { items, isLoading: isCartLoading } = useCart();
    const { data: user, isLoading: isSessionLoading } = useGetMeQuery();

    // POST /orders requires auth -- send a guest to log in rather than let
    // them reach the Payment step and hit a raw 401 there.
    if (!isSessionLoading && !user) {
        return <Navigate to="/login" state={{ from: "/checkout" }} replace />;
    }

    // Wait for the server cart to actually resolve before judging it empty
    // -- items defaults to [] while the query is still in flight, and
    // redirecting on that transient state (rather than a real empty cart)
    // bounced a just-logged-in shopper straight back to /cart before their
    // merged cart had even loaded.
    if (isCartLoading) {
        return <p className="py-16 text-center text-muted-foreground">Loading your cart…</p>;
    }

    if (items.length === 0) {
        return <Navigate to="/cart" replace />;
    }

    return (
        // Steps slide in horizontally; without clipping, that transform pushes
        // a full-width card past the viewport edge on narrow screens and the
        // page picks up a horizontal scrollbar for the length of the animation.
        <div className="mx-auto max-w-3xl overflow-x-hidden pb-12">
            <StepIndicator currentStep={state.step} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={state.step}
                    variants={reduce(stepTransition, prefersReducedMotion)}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                >
                    {state.step === "address" && (
                        <AddressStep
                            initialValues={state.address}
                            onSubmit={(values) => dispatchWizard({ type: "SUBMIT_ADDRESS", payload: values })}
                        />
                    )}
                    {state.step === "payment" && state.address && (
                        <PaymentStep
                            idempotencyKey={state.idempotencyKey}
                            shippingAddress={state.address}
                            onBack={() => dispatchWizard({ type: "BACK_TO_ADDRESS" })}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

export default Checkout;
