import { useNavigate } from "react-router-dom";
import { selectCartItemCount, selectCartSubtotal } from "../../features/cart/cartSelectors";
import { useAppSelector } from "../../redux/hooks";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

interface OrderSummaryProps {
    mode?: "cart" | "checkout";
    ctaLabel?: string;
    onCtaClick?: () => void;
}

function OrderSummary({ mode = "cart", ctaLabel, onCtaClick }: OrderSummaryProps) {
    const navigate = useNavigate();
    const itemCount = useAppSelector(selectCartItemCount);
    const totalAmount = useAppSelector(selectCartSubtotal);

    const initialAmount = parseFloat(totalAmount.toFixed(2));
    const fivePercentDiscount = parseFloat((initialAmount * 0.05).toFixed(2));
    const finalAmount = Math.max(0, initialAmount - (5 + fivePercentDiscount)).toFixed(2);

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
                    <span className="font-medium">${initialAmount}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Fixed Discount</span>
                    <span className="font-medium">- $5</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Discount on MRP (5%)</span>
                    <span className="font-medium text-success">- ${fivePercentDiscount}</span>
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
                <span>${finalAmount}</span>
            </div>
            {itemCount > 0 && (
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
