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
        async (product: AddableProduct, quantity = 1) => {
            try {
                await addItem(product, quantity);
                toast.success(`${product.title} added to cart`);
            } catch {
                // addItem only throws for the authenticated (server-cart)
                // path -- the toast was previously fired unconditionally,
                // so a failed request (cold start, CORS/CSRF rejection,
                // network error) still told the user it worked.
                toast.error(`Couldn't add ${product.title} to cart. Please try again.`);
            }
        },
        [addItem]
    );

    return { addProductToCart };
}
