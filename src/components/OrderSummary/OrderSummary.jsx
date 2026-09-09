import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { selectCartItemCount, selectCartSubtotal } from "../../features/cart/cartSelectors";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

function OrderSummary({ mode = "cart", ctaLabel, onCtaClick }) {
    const navigate = useNavigate();
    const itemCount = useSelector(selectCartItemCount);
    const totalAmount = useSelector(selectCartSubtotal);

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
        <Card className="w-full md:w-5/6 lg:w-1/2 border-2 border-foreground p-6 mb-4">
            <h2 className="font-display text-display-sm mb-6">PRICE DETAILS ({itemCount} Items)</h2>
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
                    className="min-h-[44px] w-full mt-6 bg-accent text-accent-foreground hover:bg-accent/90 font-display tracking-wide"
                    onClick={handleClick}
                >
                    {label}
                </Button>
            )}
        </Card>
    );
}

OrderSummary.propTypes = {
    mode: PropTypes.oneOf(["cart", "checkout"]),
    ctaLabel: PropTypes.string,
    onCtaClick: PropTypes.func,
};

export default OrderSummary;
