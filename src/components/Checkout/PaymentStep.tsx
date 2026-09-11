import { useEffect } from "react";
import { CheckoutElementsProvider } from "@stripe/react-stripe-js/checkout";
import { stripePromise } from "../../lib/stripe";
import { useCreateOrderMutation } from "../../features/orders/ordersApi";
import { getApiErrorMessage } from "../../lib/apiErrors";
import PaymentForm from "./PaymentForm";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import type { Address } from "./checkoutTypes";

interface PaymentStepProps {
    idempotencyKey: string;
    shippingAddress: Address;
    onBack: () => void;
}

function PaymentStep({ idempotencyKey, shippingAddress, onBack }: PaymentStepProps) {
    const [createOrder, { data, isLoading, error }] = useCreateOrderMutation();

    // Fires once per mount, not per render. Re-entering this step (address
    // -> back -> payment again) calls it again with the SAME idempotency
    // key, which the backend's claim/replay mechanism handles by returning
    // the exact same order and client secret rather than creating a second
    // order -- see server/spec/SPEC-orders.md. Editing the address and
    // coming back with the SAME key but a DIFFERENT address is treated as a
    // new intent server-side and 422s (the hash covers the address too).
    useEffect(() => {
        createOrder({ idempotencyKey, shippingAddress });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idempotencyKey]);

    if (isLoading || (!data && !error)) {
        return <p className="py-8 text-center text-muted-foreground">Preparing your order…</p>;
    }

    if (error || !data) {
        return (
            <Card className="space-y-4 p-6">
                <Alert variant="destructive">
                    <AlertDescription>{getApiErrorMessage(error)}</AlertDescription>
                </Alert>
                <Button type="button" variant="outline" onClick={onBack} className="min-h-[44px] w-full tracking-wide">
                    Back
                </Button>
            </Card>
        );
    }

    return (
        <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret: data.clientSecret }}>
            <PaymentForm onBack={onBack} />
        </CheckoutElementsProvider>
    );
}

export default PaymentStep;
