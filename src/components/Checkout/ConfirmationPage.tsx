import { Link, useSearchParams } from "react-router-dom";
import { useGetOrderQuery } from "../../features/orders/ordersApi";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import ErrorPage from "../ErrorPage/ErrorPage";

// Landed on after Stripe's own redirect (return_url on the Checkout
// Session -- see server's createCheckoutSession). The order's status here
// comes from the server, not from anything the client-side confirm() call
// returned -- the webhook, not this page, is what actually marks an order
// paid, and it can arrive slightly after this redirect. Polling until it
// does is what turns "payment processing" into "Order Placed!" without a
// manual refresh.
function ConfirmationPage() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get("orderId");

    const { data: order, isLoading, isError } = useGetOrderQuery(orderId ?? "", {
        skip: !orderId,
        pollingInterval: 2000,
        skipPollingIfUnfocused: true,
    });

    if (!orderId || isError) {
        return <ErrorPage errorMessage="We couldn't find that order." />;
    }

    if (isLoading || !order) {
        return <p className="py-16 text-center text-muted-foreground">Loading your order…</p>;
    }

    if (order.status === "pending_payment") {
        return (
            <div className="mx-auto max-w-md pb-12">
                <Card className="space-y-4 p-8 text-center">
                    <h1 className="font-display text-display-md">Confirming your payment…</h1>
                    <p className="text-muted-foreground">This usually takes just a moment.</p>
                </Card>
            </div>
        );
    }

    if (order.status === "failed" || order.status === "cancelled") {
        return (
            <div className="mx-auto max-w-md pb-12">
                <Alert variant="destructive">
                    <AlertDescription>
                        This order couldn&apos;t be completed. No charge was made -- your cart is
                        still available if you&apos;d like to try again.
                    </AlertDescription>
                </Alert>
                <Button asChild className="mt-6 min-h-[44px] w-full tracking-wide">
                    <Link to="/cart">Back to Cart</Link>
                </Button>
            </div>
        );
    }

    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="mx-auto max-w-md pb-12">
            <Card className="space-y-4 p-8 text-center">
                <h1 className="font-display text-display-md text-success">Order Placed!</h1>
                <p className="text-muted-foreground">
                    Order number <span className="font-mono font-semibold text-foreground">{order.id}</span>
                </p>
                <p className="text-muted-foreground">
                    {itemCount} item{itemCount === 1 ? "" : "s"} &middot; $ {order.subtotal.toFixed(2)} total
                </p>
                <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Shipping to</p>
                    <p>{order.shippingAddress.fullName}</p>
                    <p>{order.shippingAddress.addressLine1}</p>
                    <p>
                        {order.shippingAddress.city}
                        {order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ""}{" "}
                        {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                    This is a demo order confirmation. No real purchase was made.
                </p>

                <Button asChild className="min-h-[44px] tracking-wide">
                    <Link to="/">Continue Shopping</Link>
                </Button>
            </Card>
        </div>
    );
}

export default ConfirmationPage;
