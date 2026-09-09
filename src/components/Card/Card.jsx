import { motion, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import PropTypes from "prop-types"
import { useAddToCart } from "../../hooks/useAddToCart"
import { Card as UICard } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"

function Card(props) {
    const prefersReducedMotion = useReducedMotion();
    const cardVariants = {
        whileHover: prefersReducedMotion
            ? {}
            : {
                scale: 1.03,
                boxShadow: "0 12px 24px -8px rgba(0,0,0,0.35)"
              },
    };

    const { addProductToCart } = useAddToCart();

    const handleAddToCart = () => {
        addProductToCart({
            id: parseInt(props.id, 10),
            title: props.title,
            price: props.price,
            image: props.image,
        });
    }

    return (
        <motion.div variants={cardVariants} whileHover="whileHover" className="w-full">
            <UICard className="gap-0 overflow-hidden rounded-lg border-2 border-foreground py-0">
                <Link to={`/product/${parseInt(props.id, 10)}`} className="block">
                    <div className="aspect-square w-full border-b-2 border-foreground bg-card">
                        <img src={props.image} alt={props.title} width={400} height={400} className="h-full w-full object-contain p-4" />
                    </div>
                </Link>

                <div className="flex items-start justify-between gap-2 p-3">
                    <h3 className="font-display text-base leading-tight sm:text-lg">
                        {props.title.length >= 15 ? props.title.slice(0, 15) + "…" : props.title}
                    </h3>
                    <Badge className="shrink-0 bg-accent text-accent-foreground">${props.price}</Badge>
                </div>

                <Button
                    className="min-h-[44px] w-full rounded-none border-t-2 border-foreground font-display tracking-wide"
                    onClick={handleAddToCart}
                >
                    ADD TO CART
                </Button>
            </UICard>
        </motion.div>
    );
}

Card.propTypes = {
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    image: PropTypes.string.isRequired,
};

export default Card;
