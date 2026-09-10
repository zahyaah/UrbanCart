import { useCallback } from "react";
import { toast } from "sonner";
import { addToCart, type CartItem } from "../features/cart/cartSlice";
import { useAppDispatch } from "../redux/hooks";

type AddableProduct = Omit<CartItem, "quantity">;

// Shared "add to cart + confirm" behavior used by both the product card
// and the product detail page.
export function useAddToCart() {
    const dispatch = useAppDispatch();

    const addProductToCart = useCallback(
        (product: AddableProduct, quantity = 1) => {
            dispatch(
                addToCart({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                    quantity,
                })
            );
            toast.success(`${product.title} added to cart`);
        },
        [dispatch]
    );

    return { addProductToCart };
}
