import { useReducer } from "react";
import { Navigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { stepTransition, reduce } from "../../lib/motion";
import { clearCart } from "../../features/cart/cartSlice";
import { selectCartItemCount, selectCartItems, selectCartSubtotal } from "../../features/cart/cartSelectors";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import StepIndicator from "./StepIndicator";
import AddressStep from "./AddressStep";
import PaymentStep from "./PaymentStep";
import ReviewStep from "./ReviewStep";
import ConfirmationStep from "./ConfirmationStep";
import type { Address, Payment, PlacedOrder, WizardStep } from "./checkoutTypes";

interface WizardState {
    step: WizardStep;
    address: Address | null;
    payment: Payment | null;
    // Snapshot captured at place-order time -- the confirmation step must
    // render from this, not live cart selectors, since placing an order
    // clears the cart.
    placedOrder: PlacedOrder | null;
}

type WizardAction =
    | { type: "SUBMIT_ADDRESS"; payload: Address }
    | { type: "SUBMIT_PAYMENT"; payload: Payment }
    | { type: "BACK_TO_ADDRESS" }
    | { type: "BACK_TO_PAYMENT" }
    | { type: "PLACE_ORDER"; payload: PlacedOrder };

const initialWizardState: WizardState = {
    step: "address",
    address: null,
    payment: null,
    placedOrder: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
        case "SUBMIT_ADDRESS":
            return { ...state, address: action.payload, step: "payment" };
        case "SUBMIT_PAYMENT":
            return { ...state, payment: action.payload, step: "review" };
        case "BACK_TO_ADDRESS":
            return { ...state, step: "address" };
        case "BACK_TO_PAYMENT":
            return { ...state, step: "payment" };
        case "PLACE_ORDER":
            return { ...state, placedOrder: action.payload, step: "confirmation" };
        default:
            return state;
    }
}

function Checkout() {
    const [state, dispatchWizard] = useReducer(wizardReducer, initialWizardState);
    const prefersReducedMotion = useReducedMotion();
    const dispatch = useAppDispatch();
    const itemCount = useAppSelector(selectCartItemCount);
    const items = useAppSelector(selectCartItems);
    const subtotal = useAppSelector(selectCartSubtotal);

    const handlePlaceOrder = () => {
        const orderNumber = `UC-${Date.now().toString(36).toUpperCase()}`;
        dispatchWizard({
            type: "PLACE_ORDER",
            payload: { items, subtotal, orderNumber },
        });
        dispatch(clearCart());
    };

    // An empty cart can't check out -- except once an order has just been
    // placed, since placing it clears the cart but confirmation must still show.
    if (itemCount === 0 && state.step !== "confirmation") {
        return <Navigate to="/cart" replace />;
    }

    return (
        // Steps slide in horizontally; without clipping, that transform pushes
        // a full-width card past the viewport edge on narrow screens and the
        // page picks up a horizontal scrollbar for the length of the animation.
        <div className="mx-auto max-w-3xl overflow-x-hidden pb-12">
            {state.step !== "confirmation" && <StepIndicator currentStep={state.step} />}

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
                    {state.step === "payment" && (
                        <PaymentStep
                            initialValues={state.payment}
                            onSubmit={(values) => dispatchWizard({ type: "SUBMIT_PAYMENT", payload: values })}
                            onBack={() => dispatchWizard({ type: "BACK_TO_ADDRESS" })}
                        />
                    )}
                    {state.step === "review" && (
                        <ReviewStep
                            address={state.address}
                            payment={state.payment}
                            onBack={() => dispatchWizard({ type: "BACK_TO_PAYMENT" })}
                            onPlaceOrder={handlePlaceOrder}
                        />
                    )}
                    {state.step === "confirmation" && <ConfirmationStep order={state.placedOrder} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

export default Checkout;
