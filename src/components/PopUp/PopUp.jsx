import { motion } from "framer-motion";
import { useState, useEffect } from "react";

function PopUp() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    const popupVariants = {
        initial: {
            opacity: 0,
            x: "-50px"
        },
        final: {
            opacity: 1,
            x: "0",
            transition: {
                duration: 0.5,
                ease: "easeInOut"
            }
        },
        exit: {
            opacity: 0,
            x: "+870px",
            transition: {
                duration: 0.8,
                ease: "easeInOut"
            }
        }
    };

    return (
        <motion.div 
            className="fixed top-[65px] left-6 z-[999] h-[36px] w-[150px] px-[5px] py-[5px] bg-blue-200 text-center rounded-md"
            variants={popupVariants}
            initial="initial"
            animate={visible ? "final" : "exit"}
            exit="exit"
        >
            Item Added
        </motion.div>

    );
}

export default PopUp;
