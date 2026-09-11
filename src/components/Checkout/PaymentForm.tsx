import { useState } from "react";
import { PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import OrderSummary from "../OrderSummary/OrderSummary";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";

/** Lives inside CheckoutElementsProvider -- useCheckoutElements() only
 * works there, which is why this is a separate component from PaymentStep
 * (which renders the provider itself). */
function PaymentForm({ onBack }: { onBack: () => void }) {
    const checkoutState = useCheckoutElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (checkoutState.type === "loading") {
        return <p className="py-8 text-center text-muted-foreground">Loading payment form…</p>;
    }
    if (checkoutState.type === "error") {
        return (
            <Alert variant="destructive">
                <AlertDescription>{checkoutState.error.message}</AlertDescription>
            </Alert>
        );
    }

    const { checkout } = checkoutState;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage(null);
        setIsSubmitting(true);

        const result = await checkout.confirm();
        // Reached only on an immediate error -- otherwise the browser is
        // redirected to return_url (some payment methods go through an
        // intermediate authorization page first).
        if (result.type === "error") {
            setMessage(result.error.message);
        }
        setIsSubmitting(false);
    };

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Card className="flex-1 p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="font-display text-display-sm">Payment</h2>
                    <Alert>
                        <AlertDescription>
                            This is Stripe test mode. Use card number 4242 4242 4242 4242, any future
                            expiry, and any CVC -- no real payment is processed.
                        </AlertDescription>
                    </Alert>

                    {message && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                    )}

                    <PaymentElement id="payment-element" />

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onBack}
                            className="min-h-[44px] flex-1 tracking-wide"
                            disabled={isSubmitting}
                        >
                            Back
                        </Button>
                        <Button type="submit" className="min-h-[44px] flex-1 tracking-wide" disabled={isSubmitting}>
                            {isSubmitting ? "Processing…" : `Pay $${checkout.total.total.amount}`}
                        </Button>
                    </div>
                </form>
            </Card>

            <div className="w-full lg:sticky lg:top-28 lg:w-[22rem]">
                <OrderSummary mode="checkout" showCta={false} />
            </div>
        </div>
    );
}

export default PaymentForm;
