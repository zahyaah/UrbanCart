import { useEffect, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import NavBar from "../NavBar/NavBar";
import Footer from "../Footer/Footer";
import CartSheet from "../CartDrawer/CartSheet";
import { pageTransition, reduce } from "../../lib/motion";

function Layout() {
    const [cartOpen, setCartOpen] = useState(false);
    const location = useLocation();
    const prefersReducedMotion = useReducedMotion();
    // A concrete element, not <Outlet />. <Outlet /> resolves the route from
    // context at render time, so the page that is animating OUT would swap to
    // the incoming page's content mid-exit -- mounting every page twice and
    // discarding anything typed during the transition. AnimatePresence caches
    // this element, so the exiting subtree keeps rendering the page it owns.
    const outlet = useOutlet();

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
                        {outlet}
                    </motion.div>
                </AnimatePresence>
            </main>
            <Footer />
        </div>
    );
}

export default Layout;
