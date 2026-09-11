import { motion, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
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
            <UICard className="group/card h-full gap-0 overflow-hidden py-0 transition-shadow duration-300 hover:shadow-lg">
                <Link to={`/product/${id}`} className="block overflow-hidden">
                    <div className="aspect-square w-full overflow-hidden bg-card">
                        <motion.img
                            src={image}
                            alt={title}
                            width={400}
                            height={400}
                            className="h-full w-full object-contain p-3"
                            whileHover={prefersReducedMotion ? undefined : { scale: 1.07 }}
                            transition={{ duration: 0.45, ease: EASE }}
                        />
                    </div>
                </Link>

                <div className="flex flex-1 flex-col gap-1.5 px-2.5 pt-2 pb-2.5 sm:px-3">
                    <h3 className="line-clamp-2 break-words text-xs leading-normal sm:text-sm">
                        {title}
                    </h3>
                    <p className="font-display text-sm sm:text-base">
                        ${price}
                    </p>

                    <Button
                        size="sm"
                        className="mt-auto min-h-[44px] w-full text-[11px] tracking-wide sm:text-xs"
                        onClick={handleAddToCart}
                    >
                        ADD TO CART
                    </Button>
                </div>
            </UICard>
        </motion.div>
    );
}

export default Card;
