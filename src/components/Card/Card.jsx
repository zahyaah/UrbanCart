import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import PropTypes from "prop-types"
import { useAddToCart } from "../../hooks/useAddToCart"
import PopUp from "../PopUp/PopUp"

function Card(props) {
    const cardVariants = {
        whileHover: {
          scale: 1.09,
          boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.2)"
        },
    };

    const { addProductToCart, toastVisible } = useAddToCart();

    const handleAddToCart = () => {
        addProductToCart({
            id: parseInt(props.id, 10),
            title: props.title,
            price: props.price,
            image: props.image,
        });
    }


    return (
        <>
            { toastVisible && <PopUp /> }
            <motion.div variants={cardVariants} whileHover="whileHover" className="w-full flex flex-col">
                <Link to={`/product/${parseInt(props.id, 10)}`} className="block">
                    <div className="aspect-square w-full border-black border-2 border-b-0">
                        <img src={props.image} alt={props.title} className="h-full w-full object-contain p-4" />
                    </div>
                </Link>

                <div className="flex flex-col">
                    <div className="flex bg-white border-black border-2">
                        <div className="flex-1 border-r-2 border-black font-display text-base sm:text-lg font-semibold p-2 flex items-start justify-center text-center">
                            {props.title.length >= 15 ? props.title.slice(0, 15)+"..." : props.title}
                        </div>
                        <div className="flex-1 flex p-2 items-center justify-center">
                            ${props.price}
                        </div>
                    </div>

                    <button className="min-h-[44px] border-2 border-t-0 p-2 border-black font-display tracking-wide text-center bg-white hover:bg-black hover:text-white"
                        onClick={handleAddToCart}
                    >
                        ADD TO CART
                    </button>
                </div>
            </motion.div>
        </>
    );
}

Card.propTypes = {
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    image: PropTypes.string.isRequired,
};

export default Card;
