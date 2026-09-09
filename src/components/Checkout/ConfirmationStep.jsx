import { Link } from "react-router-dom";

function ConfirmationStep({ order }) {
    if (!order) return null;

    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center space-y-4">
            <h2 className="text-2xl font-semibold text-green-700">Order Placed!</h2>
            <p className="text-gray-600">
                Order number <span className="font-mono font-semibold">{order.orderNumber}</span>
            </p>
            <p className="text-gray-600">
                {itemCount} item{itemCount === 1 ? "" : "s"} &middot; $ {order.subtotal.toFixed(2)} subtotal
            </p>
            <p className="text-sm text-gray-500">This is a demo order confirmation. No real purchase was made.</p>

            <Link
                to="/"
                className="inline-flex min-h-[44px] px-6 items-center justify-center bg-black text-white font-semibold rounded-md hover:bg-gray-800"
            >
                Continue Shopping
            </Link>
        </div>
    );
}

export default ConfirmationStep;
