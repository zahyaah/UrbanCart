import "./NavBar.module.css"
import "../../fonts/fonts.css"
import { motion } from "framer-motion"
import CartSVG from "../../assets/Cart.svg"

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
    return (
        <motion.div variants={navVariants} initial="initial" animate="final" className="z-20 fixed top-5 left-0 right-0 m-4 h-24 border border-[#d3d3d3] rounded-xl flex justify-between items-center bg-[#8785A2]">
            <div className="ml-6"><p style={style} className="text-4xl text-[#FFE2E2]">Urban Cart</p></div>
            <div className="flex space-x-4">
                {/* <p className="font-mono text-4xl text-[#FF6F61]">Urban Cart</p>
                <p className="z-100000"><svg href="../../assets/Cart.svg" /></p> */}
                <button className="mr-6">
                    <img src={CartSVG} alt="Cart" />
                </button>
            </div>
        </motion.div>
    );
}

export default NavBar;

