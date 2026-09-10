import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import NavBar from "../NavBar/NavBar";
import Footer from "../Footer/Footer";
import CartSheet from "../CartDrawer/CartSheet";
import { pageTransition, reduce } from "../../lib/motion";

function Layout() {
    const [cartOpen, setCartOpen] = useState(false);
    const location = useLocation();
    const prefersReducedMotion = useReducedMotion();

    // Auto-close whenever the route changes (e.g. "View Cart"/"Checkout" links).
    useEffect(() => {
        setCartOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex min-h-screen flex-col">
            <NavBar onOpenCart={() => setCartOpen(true)} />
            <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
            <main className="flex-1 px-4 pt-28 sm:px-6 lg:px-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        variants={reduce(pageTransition, prefersReducedMotion)}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>
            <Footer />
        </div>
    );
}

export default Layout;
