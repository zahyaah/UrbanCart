import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { useGetMeQuery } from "../features/auth/authApi";
import { selectCartItems as selectLocalCartItems } from "../features/cart/cartSelectors";
import {
    addToCart as addToLocalCart,
    incrementQuantity as incrementLocalQuantity,
    decrementQuantity as decrementLocalQuantity,
    removeFromCart as removeFromLocalCart,
    clearCart as clearLocalCart,
} from "../features/cart/cartSlice";
import {
    useGetServerCartQuery,
    useAddServerCartItemMutation,
    useSetServerCartItemQuantityMutation,
    useRemoveServerCartItemMutation,
    useClearServerCartMutation,
} from "../features/cart/cartApi";

export interface CartLine {
    id: string;
    title: string;
    price: number;
    image: string;
    quantity: number;
}

interface AddableProduct {
    id: string;
    title: string;
    price: number;
    image: string;
}

/** The single cart data source the rest of the UI reads from. Pre-login,
 * this is the local (guest) Redux cart; once authenticated, it's the
 * server cart -- the switch happens here, once, so components (CartItem,
 * Cart, CartSheet, OrderSummary, Card) don't each need their own
 * guest-vs-server branching. */
export function useCart() {
    const dispatch = useAppDispatch();
    const { data: user, isLoading: isSessionLoading } = useGetMeQuery();
    const isAuthenticated = Boolean(user);

    const localItems = useAppSelector(selectLocalCartItems);
    const { data: serverItems, isLoading: isServerCartLoading } = useGetServerCartQuery(undefined, {
        skip: !isAuthenticated,
    });

    const [addServerItem] = useAddServerCartItemMutation();
    const [setServerQuantity] = useSetServerCartItemQuantityMutation();
    const [removeServerItem] = useRemoveServerCartItemMutation();
    const [clearServer] = useClearServerCartMutation();

    const items: CartLine[] = isAuthenticated
        ? (serverItems ?? []).map((i) => ({ id: i.productId, title: i.title, price: i.price, image: i.image, quantity: i.quantity }))
        : localItems.map((i) => ({ id: String(i.id), title: i.title, price: i.price, image: i.image, quantity: i.quantity }));

    const addItem = (product: AddableProduct, quantity = 1) => {
        if (isAuthenticated) {
            addServerItem({ productId: product.id, quantity });
        } else {
            dispatch(addToLocalCart({ ...product, quantity }));
        }
    };

    const incrementItem = (productId: string) => {
        if (isAuthenticated) {
            const current = items.find((i) => i.id === productId)?.quantity ?? 0;
            setServerQuantity({ productId, quantity: current + 1 });
        } else {
            dispatch(incrementLocalQuantity({ id: productId }));
        }
    };

    const decrementItem = (productId: string) => {
        if (isAuthenticated) {
            const current = items.find((i) => i.id === productId)?.quantity ?? 0;
            setServerQuantity({ productId, quantity: Math.max(0, current - 1) });
        } else {
            dispatch(decrementLocalQuantity({ id: productId }));
        }
    };

    const removeItem = (productId: string) => {
        if (isAuthenticated) {
            removeServerItem(productId);
        } else {
            dispatch(removeFromLocalCart({ id: productId }));
        }
    };

    const clear = () => {
        if (isAuthenticated) {
            clearServer();
        } else {
            dispatch(clearLocalCart());
        }
    };

    return {
        items,
        // True while we don't yet have a final answer: the session itself
        // is still resolving (isAuthenticated defaults to false during that
        // window, which would otherwise make an about-to-be-authenticated
        // user look like an empty-cart guest for a moment), or the session
        // is known and the server cart it depends on is still fetching.
        isLoading: isSessionLoading || (isAuthenticated && isServerCartLoading),
        addItem,
        incrementItem,
        decrementItem,
        removeItem,
        clear,
    };
}
