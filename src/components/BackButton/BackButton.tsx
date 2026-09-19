import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

/** Every page reached by drilling in (a product, sign in/register) needs a
 * way back out -- see redesign audit's "Strategic Omissions: no back
 * navigation" note. Goes to the previous history entry rather than a fixed
 * route, so it returns to wherever the visitor actually came from. */
function BackButton({ className = "" }: { className?: string }) {
    const navigate = useNavigate();

    return (
        <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
            className={`min-h-[44px] gap-1.5 pl-2.5 text-muted-foreground hover:text-foreground ${className}`}
        >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
        </Button>
    );
}

export default BackButton;
