import styles from "./NavBar.module.css";
import "../../fonts/fonts.css";
import { motion } from "framer-motion";
import CartSVG from "../../assets/Cart.svg";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom"

function NavBar() {
    const style = {
        fontFamily: "Swiss721, sans-serif",
        fontSize: "45px"
    };
    const navVariants = {
        initial: {
            opacity: 0
        },
        final: {
            opacity: 1,
            transition: {
                duration: 1
            }
        }
    };

    const [cartItemCount, setCartItemCount] = useState(0);

    // accessing the cart state from the redux store
    const cart = useSelector(state => state.cart);

    // effect to update cart item count whenever the cart state changes
    useEffect(() => {
        const totalItems = cart.reduce((sum, item) => sum + parseInt(item.quantity, 10), 0);
        setCartItemCount(totalItems);
    }, [cart]);

    return (
        <motion.div
            variants={navVariants}
            initial="initial"
            animate="final"
            className={`${styles.navBar} z-20 fixed top-5 left-0 right-0 m-4 h-24 border border-[#d3d3d3] rounded-xl flex justify-between items-center bg-[#8785A2]`}
        >
            <div className="ml-6">
                <Link to="/" style={style} className="text-4xl text-[#FFE2E2]">Urban Cart</Link>
            </div>
            <div className="flex space-x-4 relative mr-6">
                <Link to="/cart" className="relative">
                    <img src={CartSVG} alt="Cart" />
                    {cartItemCount !== 0 ? (
                        <div className="absolute -bottom-1 -right-1 bg-[#FFC7C7] text-white text-xs rounded-full h-[25px] w-[25px] flex items-center justify-center">
                            {cartItemCount}
                        </div>
                    ) : null}
                </Link>
            </div>
        </motion.div>
    );
}

export default NavBar;
