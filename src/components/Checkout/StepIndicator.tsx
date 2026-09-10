import { Separator } from "../ui/separator";
import type { WizardStep } from "./checkoutTypes";

type ActiveStep = Exclude<WizardStep, "confirmation">;

const STEP_LABELS: Record<ActiveStep, string> = {
    address: "Address",
    payment: "Payment",
    review: "Review",
};
const STEP_ORDER: ActiveStep[] = ["address", "payment", "review"];

function StepIndicator({ currentStep }: { currentStep: ActiveStep }) {
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
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : isActive
                                        ? "border-primary text-primary"
                                        : "border-muted-foreground/40 text-muted-foreground"
                                }`}
                            >
                                {index + 1}
                            </span>
                            <span className={`hidden sm:inline text-sm ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                                {STEP_LABELS[step]}
                            </span>
                        </div>
                        {index < STEP_ORDER.length - 1 && <Separator className="w-6 sm:w-12" />}
                    </li>
                );
            })}
        </ol>
    );
}

export default StepIndicator;
