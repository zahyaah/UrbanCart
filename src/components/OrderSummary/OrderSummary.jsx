import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { selectCartItemCount, selectCartSubtotal } from "../../features/cart/cartSelectors";

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
        <div className="w-full md:w-5/6 lg:w-1/2 border border-gray-300 shadow-lg rounded-lg p-6 mb-4 bg-white">
            <h2 className="font-display text-display-sm mb-6 text-gray-800">PRICE DETAILS ({itemCount} Items)</h2>
            <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                    <span>Total MRP</span>
                    <span className="font-medium">${initialAmount}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                    <span>Fixed Discount</span>
                    <span className="font-medium">- $5</span>
                </div>
                <div className="flex justify-between text-gray-600">
                    <span>Discount on MRP (5%)</span>
                    <span className="font-medium text-green-600">- ${fivePercentDiscount}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                    <span>Platform Fee</span>
                    <span className="font-medium text-green-600">FREE</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                    <span>Shipping Fee</span>
                    <span className="font-medium text-green-600">FREE</span>
                </div>
            </div>
            <hr className="my-4 border-gray-300"/>
            <div className="flex justify-between text-gray-800 text-lg font-semibold">
                <span>Total Amount</span>
                <span>${finalAmount}</span>
            </div>
            {itemCount > 0 && (
                <button
                    className="min-h-[44px] w-full bg-yellow-500 hover:bg-yellow-600 text-white font-display tracking-wide py-3 rounded-lg mt-6"
                    onClick={handleClick}
                >
                    {label}
                </button>
            )}
        </div>
    );
}

OrderSummary.propTypes = {
    mode: PropTypes.oneOf(["cart", "checkout"]),
    ctaLabel: PropTypes.string,
    onCtaClick: PropTypes.func,
};

export default OrderSummary;
