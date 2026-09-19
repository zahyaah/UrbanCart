import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-secondary-foreground uppercase">
                {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <h2 className="mt-3 mb-5 font-display text-2xl">Price details</h2>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                    <span>Total MRP</span>
                    <span className="font-sans font-bold tabular-nums text-foreground">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                    <span>Platform Fee</span>
                    <span className="font-sans font-bold text-success">FREE</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                    <span>Shipping Fee</span>
                    <span className="font-sans font-bold text-success">FREE</span>
                </div>
            </div>
            <Separator className="my-5" />
            <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold">Total Amount</span>
                <span className="font-sans text-xl font-bold tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            {showCta && itemCount > 0 && (
                <Button
                    size="lg"
                    className="mt-6 min-h-[44px] w-full justify-between pl-6 tracking-wide"
                    onClick={handleClick}
                >
                    {label}
                    <span
                        data-icon="inline-end"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15"
                    >
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                </Button>
            )}
        </Card>
    );
}

export default OrderSummary;
