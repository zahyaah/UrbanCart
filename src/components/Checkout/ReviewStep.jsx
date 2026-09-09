import OrderSummary from "../OrderSummary/OrderSummary";

function ReviewStep({ address, payment, onBack, onPlaceOrder }) {
    const maskedCardNumber = payment?.cardNumber
        ? `•••• •••• •••• ${payment.cardNumber.replace(/\s/g, "").slice(-4)}`
        : "";

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <h2 className="font-display text-display-sm">Review Your Order</h2>

                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase">Shipping to</h3>
                    <p className="text-gray-800">
                        {address?.fullName}<br />
                        {address?.addressLine1}<br />
                        {address?.city}{address?.region ? `, ${address.region}` : ""} {address?.postalCode}<br />
                        {address?.country}
                    </p>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase">Payment</h3>
                    <p className="text-gray-800">{payment?.cardholderName} &middot; {maskedCardNumber}</p>
                </div>

                <button
                    type="button"
                    onClick={onBack}
                    className="min-h-[44px] w-full border-2 border-black font-display tracking-wide rounded-md hover:bg-gray-100"
                >
                    Back
                </button>
            </div>

            <OrderSummary mode="checkout" ctaLabel="PLACE ORDER" onCtaClick={onPlaceOrder} />
        </div>
    );
}

export default ReviewStep;
