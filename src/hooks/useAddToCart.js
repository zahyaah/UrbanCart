import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { addToCart } from "../features/cart/cartSlice";

const TOAST_DURATION_MS = 3000;

// Shared "add to cart + show a confirmation toast" behavior used by both
// the product card and the product detail page.
export function useAddToCart() {
    const dispatch = useDispatch();
    const [toastVisible, setToastVisible] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

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

            setToastVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS);
        },
        [dispatch]
    );

    return { addProductToCart, toastVisible };
}
