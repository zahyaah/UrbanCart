import { useCallback } from "react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { selectCartItems } from "../features/cart/cartSelectors";
import { clearCart } from "../features/cart/cartSlice";
import { useMergeGuestCartMutation } from "../features/cart/cartApi";

/** Fires once, immediately after a successful login/register -- merges
 * whatever was in the local (pre-login) cart into the server cart, then
 * clears the local copy. See SPEC-cart.md for the merge semantics
 * (sum quantities, capped, live prices) and its idempotency-key design. */
export function useGuestCartMerge() {
    const dispatch = useAppDispatch();
    const localItems = useAppSelector(selectCartItems);
    const [mergeGuestCart] = useMergeGuestCartMutation();

    const mergeAndClearLocalCart = useCallback(async () => {
        if (localItems.length === 0) return;

        try {
            const result = await mergeGuestCart({
                items: localItems.map((item) => ({ productId: String(item.id), quantity: item.quantity })),
                idempotencyKey: crypto.randomUUID(),
            }).unwrap();

            dispatch(clearCart());

            if (result.adjustments.length > 0) {
                toast.info(
                    `${result.adjustments.length} item${result.adjustments.length === 1 ? "" : "s"} from your cart needed adjusting`
                );
            }
        } catch {
            // A failed merge leaves the local guest cart intact -- nothing
            // is lost, the user can retry (e.g. by logging out and back in)
            // or keep shopping as a guest.
            toast.error("Couldn't merge your cart. Your items are still saved locally.");
        }
    }, [localItems, mergeGuestCart, dispatch]);

    return { mergeAndClearLocalCart };
}
