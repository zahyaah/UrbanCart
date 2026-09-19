import { motion, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { useAddToCart } from "../../hooks/useAddToCart"
import { Card as UICard } from "../ui/card"
import { Button } from "../ui/button"
import { fadeUp, reduce, EASE } from "../../lib/motion"

interface CardProps {
    id: string;
    title: string;
    price: number;
    image: string;
}

function Card({ id, title, price, image }: CardProps) {
    const prefersReducedMotion = useReducedMotion();
    const { addProductToCart } = useAddToCart();

    const handleAddToCart = () => {
        addProductToCart({ id, title, price, image });
    }

    return (
        <motion.div
            variants={reduce(fadeUp, prefersReducedMotion)}
            whileHover={prefersReducedMotion ? undefined : { y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="h-full"
        >
            <UICard className="group/card flex h-full flex-col gap-3 p-3 transition-shadow duration-300 hover:shadow-lg">
                {/* Double-bezel: the card itself is the outer shell (its own
                    padding is the "tray" margin); this inner core gets a
                    distinct tinted fill, an inset highlight, and a slightly
                    smaller concentric radius -- reads as a glass plate set
                    into the card rather than an image glued flat on top. */}
                <Link to={`/product/${id}`} className="block overflow-hidden rounded-[1.125rem]">
                    <div className="aspect-square w-full overflow-hidden rounded-[1.125rem] bg-secondary/70 shadow-[inset_0_1px_3px_rgba(39,35,31,0.06)] dark:bg-secondary/40">
                        <motion.img
                            src={image}
                            alt={title}
                            width={400}
                            height={400}
                            className="h-full w-full object-contain p-4"
                            whileHover={prefersReducedMotion ? undefined : { scale: 1.07 }}
                            transition={{ duration: 0.45, ease: EASE }}
                        />
                    </div>
                </Link>

                <div className="flex flex-1 flex-col gap-1.5 px-0.5">
                    <h3 className="line-clamp-2 break-words text-xs leading-normal sm:text-sm">
                        {title}
                    </h3>
                    {/* Prices stay in the body face, bold + tabular -- a
                        high-contrast Didone serif is the wrong tool for
                        numerals shoppers need to scan quickly. */}
                    <p className="font-sans text-sm font-bold tabular-nums sm:text-base">
                        ${price}
                    </p>

                    <Button
                        size="sm"
                        className="mt-auto min-h-[44px] w-full justify-between pl-4 text-[11px] tracking-wide sm:text-xs"
                        onClick={handleAddToCart}
                    >
                        ADD TO CART
                        <span
                            data-icon="inline-end"
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15"
                        >
                            <Plus className="size-3.5" aria-hidden="true" />
                        </span>
                    </Button>
                </div>
            </UICard>
        </motion.div>
    );
}

export default Card;
