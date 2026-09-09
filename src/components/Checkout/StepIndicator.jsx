import PropTypes from "prop-types";

const STEP_LABELS = {
    address: "Address",
    payment: "Payment",
    review: "Review",
};
const STEP_ORDER = ["address", "payment", "review"];

function StepIndicator({ currentStep }) {
    const currentIndex = STEP_ORDER.indexOf(currentStep);

    return (
        <ol className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
            {STEP_ORDER.map((step, index) => {
                const isActive = index === currentIndex;
                const isComplete = index < currentIndex;
                return (
                    <li key={step} className="flex items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2">
                            <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                                    isComplete
                                        ? "bg-black text-white border-black"
                                        : isActive
                                        ? "border-black text-black"
                                        : "border-gray-300 text-gray-400"
                                }`}
                            >
                                {index + 1}
                            </span>
                            <span className={`hidden sm:inline text-sm ${isActive ? "font-semibold" : "text-gray-500"}`}>
                                {STEP_LABELS[step]}
                            </span>
                        </div>
                        {index < STEP_ORDER.length - 1 && <div className="w-6 sm:w-12 h-px bg-gray-300" />}
                    </li>
                );
            })}
        </ol>
    );
}

StepIndicator.propTypes = {
    currentStep: PropTypes.oneOf(STEP_ORDER).isRequired,
};

export default StepIndicator;
