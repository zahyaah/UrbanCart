import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { addToCart } from "../features/cart/cartSlice";

// Shared "add to cart + confirm" behavior used by both the product card
// and the product detail page.
export function useAddToCart() {
    const dispatch = useDispatch();

    const addProductToCart = useCallback(
        (product, quantity = 1) => {
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
