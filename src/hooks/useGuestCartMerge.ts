import { useCallback } from "react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { selectCartItems } from "../features/cart/cartSelectors";
import { removeMergedItems } from "../features/cart/cartSlice";
import { useMergeGuestCartMutation } from "../features/cart/cartApi";

/** Fires once, immediately after a successful login/register -- merges
 * whatever was in the local (pre-login) cart into the server cart, then
 * clears the local copy. See SPEC-cart.md for the merge semantics
 * (sum quantities, capped, live prices) and its idempotency-key design. */
export function useGuestCartMerge() {
    const dispatch = useAppDispatch();
    const localItems = useAppSelector(selectCartItems);
    const [mergeGuestCart, { isLoading: isMerging }] = useMergeGuestCartMutation();

    const mergeAndClearLocalCart = useCallback(async () => {
        if (localItems.length === 0) return;
        const sentItems = localItems;

        try {
            const result = await mergeGuestCart({
                items: sentItems.map((item) => ({ productId: String(item.id), quantity: item.quantity })),
                idempotencyKey: crypto.randomUUID(),
            }).unwrap();

            dispatch(removeMergedItems(sentItems));

            if (result.adjustments.length > 0) {
                toast.info(
                    `${result.adjustments.length} item${result.adjustments.length === 1 ? "" : "s"} from your cart needed adjusting`
                );
            }
        } catch {
            // A failed merge leaves the local guest cart intact -- nothing
            // is lost, and UnmergedCartNotice offers a Retry on the cart
            // page and in the cart drawer.
            toast.error("Couldn't move your saved items into your cart. Open your cart to retry.");
        }
    }, [localItems, mergeGuestCart, dispatch]);

    return { mergeAndClearLocalCart, isMerging };
}
