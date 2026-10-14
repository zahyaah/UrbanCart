import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateOrderMutation } from "../../features/orders/ordersApi";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import type { Address } from "./checkoutTypes";

interface PaymentStepProps {
    idempotencyKey: string;
    shippingAddress: Address;
    onBack: () => void;
}

/** Creates the order from the server cart, then hands off to the order's
 * own pay page (/checkout/:orderId), which reads everything it shows from
 * the server -- so a reload or a shared link lands on the same order. */
function PaymentStep({ idempotencyKey, shippingAddress, onBack }: PaymentStepProps) {
    const [createOrder, { error }] = useCreateOrderMutation();
    const navigate = useNavigate();

    // Fires once per mount, not per render. Re-entering this step (address
    // -> back -> payment again) calls it again with the SAME idempotency
    // key, which the backend's claim/replay mechanism handles by returning
    // the exact same order rather than creating a second one -- see
    // server/spec/SPEC-orders.md. Editing the address and coming back with
    // the SAME key but a DIFFERENT address is treated as a new intent
    // server-side and 422s (the hash covers the address too).
    useEffect(() => {
        createOrder({ idempotencyKey, shippingAddress })
            .unwrap()
            .then(({ orderId }) => navigate(`/checkout/${orderId}`, { replace: true }))
            .catch(() => {
                // Rendered below from the mutation's own error state.
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idempotencyKey]);

    if (!error) {
        return <p className="py-8 text-center text-muted-foreground">Preparing your order…</p>;
    }

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

export default PaymentStep;
