import { useCallback } from "react";
import { toast } from "sonner";
import { useCart } from "./useCart";

interface AddableProduct {
    id: string;
    title: string;
    price: number;
    image: string;
}

// Shared "add to cart + confirm" behavior used by both the product card
// and the product detail page. Routes through useCart, which is what
// decides guest (local Redux) vs. server cart.
export function useAddToCart() {
    const { addItem } = useCart();

    const addProductToCart = useCallback(
        (product: AddableProduct, quantity = 1) => {
            addItem(product, quantity);
            toast.success(`${product.title} added to cart`);
        },
        [addItem]
    );

    return { addProductToCart };
}
