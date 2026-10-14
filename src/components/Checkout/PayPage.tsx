import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useGetOrderQuery, usePayOrderMutation } from "../../features/orders/ordersApi";
import { getApiErrorMessage } from "../../lib/apiErrors";
import ErrorPage from "../ErrorPage/ErrorPage";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

/** Demo payment page for one order. Deliberately has no card, expiry, CVC
 * or any other payment input: nothing is charged, and the button only asks
 * the server to mark this order paid. Everything shown comes from the
 * server's order record (prices fixed when the order was created), not
 * from the cart, which may have changed since. */
function PayPage() {
    const { orderId = "" } = useParams();
    const navigate = useNavigate();
    const { data: order, isLoading, isError } = useGetOrderQuery(orderId);
    const [payOrder, { isLoading: isPaying }] = usePayOrderMutation();

    if (isError) {
        return <ErrorPage errorMessage="We couldn't find that order." />;
    }
    if (isLoading || !order) {
        return <p className="py-16 text-center text-muted-foreground">Loading your order…</p>;
    }
    if (order.status !== "pending_payment") {
        return <Navigate to={`/checkout/confirmation?orderId=${order.id}`} replace />;
    }

    const handlePay = async () => {
        try {
            await payOrder(order.id).unwrap();
            navigate(`/checkout/confirmation?orderId=${order.id}`, { replace: true });
        } catch (err) {
            toast.error(`Payment failed: ${getApiErrorMessage(err as Parameters<typeof getApiErrorMessage>[0])}`);
        }
    };

    return (
        <div className="mx-auto max-w-md pb-12">
            <Card className="space-y-5 p-6">
                <h1 className="font-display text-display-sm">Review and pay</h1>
                <p className="rounded-md bg-secondary px-3 py-2 text-center text-sm font-semibold text-secondary-foreground">
                    Demo: no real payment
                </p>

                <ul className="space-y-2 text-sm" aria-label="Order items">
                    {order.items.map((item) => (
                        <li key={item.productId} className="flex justify-between gap-4">
                            <span className="min-w-0 truncate">
                                {item.title} &times; {item.quantity}
                            </span>
                            <span className="tabular-nums">${(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                    ))}
                </ul>
                <Separator />
                <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="font-sans text-xl font-bold tabular-nums">${order.subtotal.toFixed(2)}</span>
                </div>

                <Button
                    type="button"
                    onClick={handlePay}
                    disabled={isPaying}
                    className="min-h-[44px] w-full tracking-wide"
                >
                    {isPaying ? "Processing…" : "Pay (demo)"}
                </Button>
            </Card>
        </div>
    );
}

export default PayPage;
