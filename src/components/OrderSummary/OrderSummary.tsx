import { useNavigate } from "react-router-dom";
import { useCart } from "../../hooks/useCart";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

interface OrderSummaryProps {
    mode?: "cart" | "checkout";
    ctaLabel?: string;
    onCtaClick?: () => void;
    /** false on the Payment step: Stripe's own form has the submit button
     * there, so a second "PLACE ORDER" button would be redundant. */
    showCta?: boolean;
}

function OrderSummary({ mode = "cart", ctaLabel, onCtaClick, showCta = true }: OrderSummaryProps) {
    const navigate = useNavigate();
    const { items } = useCart();
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    // No discount logic here on purpose -- this used to show a decorative
    // "$5 + 5% off" that never corresponded to anything real. Now that
    // checkout charges a real Stripe amount computed server-side from the
    // same live prices (see server's snapshotCartForOrder), showing a
    // different, lower number here would mean the total on screen doesn't
    // match what the shopper is actually charged. Total Amount is exactly
    // the subtotal until a real discount exists on both sides.
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const label = ctaLabel || (mode === "checkout" ? "PLACE ORDER" : "PROCEED TO CHECKOUT");

    const handleClick = () => {
        if (onCtaClick) {
            onCtaClick();
        } else {
            navigate("/checkout");
        }
    };

    return (
        <Card className="w-full p-6">
            <h2 className="mb-6 font-display text-xl">Price Details ({itemCount} items)</h2>
            <div className="space-y-3">
                <div className="flex justify-between text-muted-foreground">
                    <span>Total MRP</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                    <span>Platform Fee</span>
                    <span className="font-medium text-success">FREE</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                    <span>Shipping Fee</span>
                    <span className="font-medium text-success">FREE</span>
                </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount</span>
                <span>${subtotal.toFixed(2)}</span>
            </div>
            {showCta && itemCount > 0 && (
                <Button
                    className="mt-6 min-h-[44px] w-full tracking-wide"
                    onClick={handleClick}
                >
                    {label}
                </Button>
            )}
        </Card>
    );
}

export default OrderSummary;
