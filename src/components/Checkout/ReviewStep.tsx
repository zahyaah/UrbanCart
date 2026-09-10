import OrderSummary from "../OrderSummary/OrderSummary";
import type { Address, Payment } from "./checkoutTypes";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

interface ReviewStepProps {
    address: Address | null;
    payment: Payment | null;
    onBack: () => void;
    onPlaceOrder: () => void;
}

function ReviewStep({ address, payment, onBack, onPlaceOrder }: ReviewStepProps) {
    const maskedCardNumber = payment?.cardNumber
        ? `•••• •••• •••• ${payment.cardNumber.replace(/\s/g, "").slice(-4)}`
        : "";

    return (
        <div className="space-y-6">
            <Card className="p-6 space-y-4">
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
                    className="min-h-[44px] w-full tracking-wide"
                >
                    Back
                </Button>
            </Card>

            <OrderSummary mode="checkout" ctaLabel="PLACE ORDER" onCtaClick={onPlaceOrder} />
        </div>
    );
}

export default ReviewStep;
