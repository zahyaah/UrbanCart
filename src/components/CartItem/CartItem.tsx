import { motion, useReducedMotion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart, type CartLine } from "../../hooks/useCart";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { fadeUp, reduce, EASE } from "../../lib/motion";

function CartItem({ item }: { item: CartLine }) {
    const { incrementItem, decrementItem, removeItem } = useCart();
    const prefersReducedMotion = useReducedMotion();

    return (
        <motion.div
            layout={!prefersReducedMotion}
            variants={reduce(fadeUp, prefersReducedMotion)}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24, transition: { duration: 0.25, ease: EASE } }}
        >
            <Card className="flex-row items-center gap-4 p-3 sm:p-4">
                <div className="h-24 w-24 flex-shrink-0 sm:h-32 sm:w-32">
                    <img
                        src={item.image}
                        alt={item.title}
                        width={400}
                        height={400}
                        className="h-full w-full rounded-md object-contain"
                    />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <h2 className="line-clamp-2 break-words text-sm leading-normal sm:text-base">
                        {item.title}
                    </h2>

                    <p className="font-display text-base sm:text-lg">
                        $ {(item.quantity * item.price).toFixed(2)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() => decrementItem(item.id)}
                            aria-label={`Decrease quantity of ${item.title}`}
                        >
                            <Minus aria-hidden="true" />
                        </Button>
                        <span className="w-8 text-center text-base font-medium tabular-nums">
                            {item.quantity}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() => incrementItem(item.id)}
                            aria-label={`Increase quantity of ${item.title}`}
                        >
                            <Plus aria-hidden="true" />
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-auto min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.title} from cart`}
                        >
                            <Trash2 aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

export default CartItem;
