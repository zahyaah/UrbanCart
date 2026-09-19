import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { useCart } from "../../hooks/useCart";
import { useGuestCartMerge } from "../../hooks/useGuestCartMerge";

// Shown only when a guest-cart merge failed silently on login (network
// error, cold start, CORS/CSRF rejection) and left items sitting in local
// storage that the signed-in cart view otherwise never shows. See
// useCart's unmergedGuestItemCount.
function UnmergedCartNotice() {
    const { unmergedGuestItemCount } = useCart();
    const { mergeAndClearLocalCart, isMerging } = useGuestCartMerge();

    if (unmergedGuestItemCount === 0) return null;

    return (
        <Alert className="mb-6">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                    {unmergedGuestItemCount} item{unmergedGuestItemCount === 1 ? "" : "s"} from before you signed in
                    didn&apos;t make it into your cart.
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => mergeAndClearLocalCart()}
                    disabled={isMerging}
                >
                    {isMerging ? "Retrying…" : "Retry"}
                </Button>
            </AlertDescription>
        </Alert>
    );
}

export default UnmergedCartNotice;
