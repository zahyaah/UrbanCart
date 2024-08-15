import "./NavBar.module.css"
import "../../fonts/fonts.css"
import { motion } from "framer-motion"
import CartSVG from "../../assets/Cart.svg"
import { useState, useEffect } from "react"

function NavBar() {
    const style = {
        fontFamily: "Swiss721, sans-serif",
        fontSize: "45px"
    }
    const navVariants = {
        "initial": {
            opacity: 0
        }, 
        "final": {
            opacity: 1,
            transition: {
                duration: 1
            }
        }
    }

    const [cartItemCount, setCartItemCount] = useState(0);


    useEffect(() => {
        let sum = 0; 
        for (const [_, value] of Object.entries(localStorage))
            sum += parseInt(value, 10);
        setCartItemCount(sum);
    }, []);

    return (
        <motion.div
            variants={navVariants}
            initial="initial"
            animate="final"
            className="z-20 fixed top-5 left-0 right-0 m-4 h-24 border border-[#d3d3d3] rounded-xl flex justify-between items-center bg-[#8785A2]"
            >
            <div className="ml-6">
                <p style={style} className="text-4xl text-[#FFE2E2]">Urban Cart</p>
            </div>
            <div className="flex space-x-4 relative mr-6">
                <button className="relative">
                <img src={CartSVG} alt="Cart" />
                {cartItemCount !== 0 ? (
                    <div className="absolute -bottom-1 -right-1 bg-[#FFC7C7] text-white text-xs rounded-full h-[25px] w-[25px] flex items-center justify-center">
                        {cartItemCount}
                    </div>
                ) : null}
                </button>
            </div>
        </motion.div>

    );
}

export default NavBar;

