import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { useCheckoutForm } from "../../hooks/useCheckoutForm";
import FormField from "./FormField";
import { paymentPropType } from "./checkoutPropTypes";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";

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
        const validationErrors = validateAll();
        const firstErrorField = Object.keys(validationErrors)[0];
        if (!firstErrorField) {
            onSubmit(values);
        } else {
            document.getElementsByName(firstErrorField)[0]?.focus();
        }
    };

    return (
        <Card className="border-2 border-foreground p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-display text-display-sm">Payment</h2>
                <Alert>
                    <Info aria-hidden="true" />
                    <AlertDescription>
                        This is a demo checkout. No real payment is processed and no card details are transmitted anywhere.
                    </AlertDescription>
                </Alert>

                <FormField label="Cardholder name" name="cardholderName" autoComplete="cc-name" value={values.cardholderName} error={errors.cardholderName} onChange={handleChange} />
                <FormField label="Card number" name="cardNumber" autoComplete="cc-number" inputMode="numeric" spellCheck={false} value={values.cardNumber} error={errors.cardNumber} onChange={handleChange} placeholder="4242 4242 4242 4242" />
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Expiry (MM/YY)" name="expiry" autoComplete="cc-exp" inputMode="numeric" spellCheck={false} value={values.expiry} error={errors.expiry} onChange={handleChange} placeholder="04/28" />
                    <FormField label="CVC" name="cvc" autoComplete="cc-csc" inputMode="numeric" spellCheck={false} value={values.cvc} error={errors.cvc} onChange={handleChange} placeholder="123" />
                </div>

                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onBack} className="min-h-[44px] flex-1 font-display tracking-wide">
                        Back
                    </Button>
                    <Button type="submit" className="min-h-[44px] flex-1 font-display tracking-wide">
                        Review Order
                    </Button>
                </div>
            </form>
        </Card>
    );
}

PaymentStep.propTypes = {
    initialValues: paymentPropType,
    onSubmit: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
};

export default PaymentStep;
