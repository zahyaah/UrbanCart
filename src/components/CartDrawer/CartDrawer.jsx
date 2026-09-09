import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { decrementQuantity, incrementQuantity, removeFromCart } from "../../features/cart/cartSlice";
import { selectCartItems, selectCartSubtotal } from "../../features/cart/cartSelectors";

const CartDrawerContext = createContext(null);

function useCartDrawerContext() {
    const context = useContext(CartDrawerContext);
    if (!context) {
        throw new Error("CartDrawer subcomponents must be rendered within <CartDrawer>");
    }
    return context;
}

function CartDrawer({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const location = useLocation();

    // Auto-close whenever the route changes (e.g. "View Cart"/"Checkout" links).
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    return (
        <CartDrawerContext.Provider value={{ isOpen, open, close }}>
            {children}
        </CartDrawerContext.Provider>
    );
}

function Trigger({ children }) {
    const { open } = useCartDrawerContext();
    return (
        <button
            type="button"
            onClick={open}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open cart"
        >
            {children}
        </button>
    );
}

function Panel() {
    const { isOpen, close } = useCartDrawerContext();
    const items = useSelector(selectCartItems);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") close();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, close]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/40 z-40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={close}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Cart"
                        className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-50 shadow-xl flex flex-col"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h2 className="font-display text-xl">Your Cart</h2>
                            <button
                                type="button"
                                onClick={close}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-2xl leading-none"
                                aria-label="Close cart"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {items.length === 0 ? (
                                <p className="text-center text-gray-500 mt-8">Cart is empty!</p>
                            ) : (
                                items.map((item) => <Item key={item.id} item={item} />)
                            )}
                        </div>

                        <Footer />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function Item({ item }) {
    const dispatch = useDispatch();

    return (
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
            <img src={item.image} alt={item.title} className="h-14 w-14 object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-medium truncate">{item.title}</p>
                <p className="text-sm text-gray-500">$ {item.price.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-1">
                    <button
                        type="button"
                        onClick={() => dispatch(decrementQuantity({ id: item.id }))}
                        className="min-h-[32px] min-w-[32px] bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                        -
                    </button>
                    <span className="text-sm w-5 text-center">{item.quantity}</span>
                    <button
                        type="button"
                        onClick={() => dispatch(incrementQuantity({ id: item.id }))}
                        className="min-h-[32px] min-w-[32px] bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                        +
                    </button>
                </div>
            </div>
            <button
                type="button"
                onClick={() => dispatch(removeFromCart({ id: item.id }))}
                className="text-red-600 text-sm hover:underline flex-shrink-0"
            >
                Remove
            </button>
        </div>
    );
}

function Footer() {
    const { close } = useCartDrawerContext();
    const items = useSelector(selectCartItems);
    const subtotal = useSelector(selectCartSubtotal);

    if (items.length === 0) return null;

    return (
        <div className="border-t border-gray-200 p-4 space-y-3">
            <div className="flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>$ {subtotal.toFixed(2)}</span>
            </div>
            <Link
                to="/cart"
                onClick={close}
                className="min-h-[44px] flex items-center justify-center border-2 border-black font-display tracking-wide hover:bg-black hover:text-white"
            >
                VIEW CART
            </Link>
            <Link
                to="/checkout"
                onClick={close}
                className="min-h-[44px] flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white font-display tracking-wide"
            >
                CHECKOUT
            </Link>
        </div>
    );
}

CartDrawer.Trigger = Trigger;
CartDrawer.Panel = Panel;
CartDrawer.Item = Item;
CartDrawer.Footer = Footer;

export default CartDrawer;
