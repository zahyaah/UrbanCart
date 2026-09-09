import PropTypes from "prop-types";
import { useCheckoutForm } from "../../hooks/useCheckoutForm";
import FormField from "./FormField";
import { paymentPropType } from "./checkoutPropTypes";

const EMPTY_PAYMENT = {
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
};

function validatePayment(values) {
    const errors = {};
    if (!values.cardholderName.trim()) errors.cardholderName = "Cardholder name is required";
    if (!/^\d{13,19}$/.test(values.cardNumber.replace(/\s/g, ""))) errors.cardNumber = "Enter a valid card number";
    if (!/^\d{2}\/\d{2}$/.test(values.expiry)) errors.expiry = "Use MM/YY format";
    if (!/^\d{3,4}$/.test(values.cvc)) errors.cvc = "Enter a valid CVC";
    return errors;
}

function PaymentStep({ initialValues, onSubmit, onBack }) {
    const { values, errors, handleChange, validateAll } = useCheckoutForm(
        initialValues || EMPTY_PAYMENT,
        validatePayment
    );

    const handleSubmit = (event) => {
        event.preventDefault();
        if (validateAll()) {
            onSubmit(values);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display text-display-sm">Payment</h2>
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
                This is a demo checkout. No real payment is processed and no card details are transmitted anywhere.
            </p>

            <FormField label="Cardholder name" name="cardholderName" value={values.cardholderName} error={errors.cardholderName} onChange={handleChange} />
            <FormField label="Card number" name="cardNumber" value={values.cardNumber} error={errors.cardNumber} onChange={handleChange} placeholder="4242 4242 4242 4242" />
            <div className="grid grid-cols-2 gap-4">
                <FormField label="Expiry (MM/YY)" name="expiry" value={values.expiry} error={errors.expiry} onChange={handleChange} placeholder="04/28" />
                <FormField label="CVC" name="cvc" value={values.cvc} error={errors.cvc} onChange={handleChange} placeholder="123" />
            </div>

            <div className="flex gap-3">
                <button type="button" onClick={onBack} className="min-h-[44px] flex-1 border-2 border-black font-display tracking-wide rounded-md hover:bg-gray-100">
                    Back
                </button>
                <button type="submit" className="min-h-[44px] flex-1 bg-black text-white font-display tracking-wide rounded-md hover:bg-gray-800">
                    Review Order
                </button>
            </div>
        </form>
    );
}

PaymentStep.propTypes = {
    initialValues: paymentPropType,
    onSubmit: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
};

export default PaymentStep;
