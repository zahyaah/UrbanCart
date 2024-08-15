import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { useDispatch } from "react-redux";
import { addToCart } from "../../features/cart/cartSlice"
import { useState } from "react"
import PopUp from "../PopUp/PopUp"

function Card(props) {
    const cardVariants = {
        whileHover: {
          scale: 1.09,
          boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.2)"
        },
    };

    const dispatch = useDispatch(); 
    const [visible, setVisible] = useState(false);

    const handleAddToCart = () => {
        setVisible(true);
        const getId = parseInt(props.id, 10);
        dispatch(addToCart({id: getId}));
        setTimeout(() => {
            setVisible(false);
        }, 3000);
    }


    return (
        <>
            
            { visible && <PopUp /> }
            <motion.div variants={cardVariants} whileHover="whileHover" key={props.id} className="m-4 h-[32rem]">
                <Link to={`/product/${parseInt(props.id)}`}>
                <div className="h-96 w-80 border-black border-2 border-b-0 md:h-80 md:w-64 lg:h-96 lg:w-80">
                    <img src={props.image} alt={props.title} className="h-full w-full object-contain" />
                </div>

                </Link>

                <div className="flex flex-col h-32 w-80 md:w-64 lg:w-80">
                    <div className="flex h-1/2 bg-white border-black border-2 md:h-24 md:w-64 lg:h-32 lg:w-80">
                        <div className="flex-1 border-2 border-black border-t-0 border-l-0 border-b-0 border-r-0 text-xl font-bold p-2 flex items-start justify-center">
                            {props.title.length >= 15 ? props.title.slice(0, 15)+"..." : props.title}
                        </div>
                        <div className="flex-1 border-2 border-black border-t-0 border-r-0 border-b-0 flex p-2 items-center justify-center">
                            ${props.price}
                        </div>
                    </div>

                    <button className="h-1/2 border-2 p-2 border-t-0 border-black font-mono text-center bg-white hover:bg-black hover:text-white"
                        onClick={handleAddToCart}        
                    >
                        ADD TO CART
                    </button>
                </div>
            </motion.div>
        </>
    );
}

export default Card;
