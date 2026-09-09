import { useReducer } from "react";
import { Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearCart } from "../../features/cart/cartSlice";
import { selectCartItemCount, selectCartItems, selectCartSubtotal } from "../../features/cart/cartSelectors";
import StepIndicator from "./StepIndicator";
import AddressStep from "./AddressStep";
import PaymentStep from "./PaymentStep";
import ReviewStep from "./ReviewStep";
import ConfirmationStep from "./ConfirmationStep";

const initialWizardState = {
    step: "address",
    address: null,
    payment: null,
    // Snapshot captured at place-order time -- the confirmation step must
    // render from this, not live cart selectors, since placing an order
    // clears the cart.
    placedOrder: null,
};

function wizardReducer(state, action) {
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
    const dispatch = useDispatch();
    const itemCount = useSelector(selectCartItemCount);
    const items = useSelector(selectCartItems);
    const subtotal = useSelector(selectCartSubtotal);

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
        <div className="max-w-3xl mx-auto pb-12">
            {state.step !== "confirmation" && <StepIndicator currentStep={state.step} />}

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
        </div>
    );
}

export default Checkout;
