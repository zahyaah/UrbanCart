import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import CartItem from "../CartItem/CartItem";
import OrderSummary from "../OrderSummary/OrderSummary";
import { selectCartItems } from "../../features/cart/cartSelectors";
import { useAppSelector } from "../../redux/hooks";
import { staggerContainer, fadeUp, reduce } from "../../lib/motion";

function Cart() {
    const prefersReducedMotion = useReducedMotion();
    const items = useAppSelector(selectCartItems);

    return (
        <div className="pb-10">
            <motion.h1
                variants={reduce(fadeUp, prefersReducedMotion)}
                initial="hidden"
                animate="show"
                className="mb-6 font-display text-display-sm sm:text-display-md"
            >
                Your Cart
            </motion.h1>

            {items.length !== 0 ? (
                <motion.div
                    variants={reduce(staggerContainer, prefersReducedMotion)}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col gap-6 lg:flex-row lg:items-start"
                >
                    <div className="flex flex-1 flex-col gap-4">
                        {/* Default mode (not popLayout): popLayout measures children
                            via a ref, which a plain function component can't receive.
                            Each item's own `layout` prop handles the reflow anyway. */}
                        <AnimatePresence>
                            {items.map((item) => (
                                <CartItem key={item.id} item={item} />
                            ))}
                        </AnimatePresence>
                    </div>

                    <motion.div
                        variants={reduce(fadeUp, prefersReducedMotion)}
                        className="w-full lg:sticky lg:top-28 lg:w-[22rem]"
                    >
                        <OrderSummary mode="cart" />
                    </motion.div>
                </motion.div>
            ) : (
                <motion.p
                    variants={reduce(fadeUp, prefersReducedMotion)}
                    initial="hidden"
                    animate="show"
                    className="py-16 text-center text-lg text-muted-foreground sm:text-xl"
                >
                    Cart is empty!
                </motion.p>
            )}
        </div>
    );
}

export default Cart;
