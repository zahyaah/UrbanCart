import PropTypes from "prop-types";
import OrderSummary from "../OrderSummary/OrderSummary";
import { addressPropType, paymentPropType } from "./checkoutPropTypes";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

function ReviewStep({ address, payment, onBack, onPlaceOrder }) {
    const maskedCardNumber = payment?.cardNumber
        ? `•••• •••• •••• ${payment.cardNumber.replace(/\s/g, "").slice(-4)}`
        : "";

    return (
        <div className="space-y-6">
            <Card className="border-2 border-foreground p-6 space-y-4">
                <h2 className="font-display text-display-sm">Review Your Order</h2>

                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase">Shipping to</h3>
                    <p>
                        {address?.fullName}<br />
                        {address?.addressLine1}<br />
                        {address?.city}{address?.region ? `, ${address.region}` : ""} {address?.postalCode}<br />
                        {address?.country}
                    </p>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase">Payment</h3>
                    <p>{payment?.cardholderName} &middot; {maskedCardNumber}</p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="min-h-[44px] w-full font-display tracking-wide"
                >
                    Back
                </Button>
            </Card>

            <OrderSummary mode="checkout" ctaLabel="PLACE ORDER" onCtaClick={onPlaceOrder} />
        </div>
    );
}

ReviewStep.propTypes = {
    address: addressPropType,
    payment: paymentPropType,
    onBack: PropTypes.func.isRequired,
    onPlaceOrder: PropTypes.func.isRequired,
};

export default ReviewStep;
