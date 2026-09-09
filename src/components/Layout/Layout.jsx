import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import NavBar from "../NavBar/NavBar";
import Footer from "../Footer/Footer";
import CartSheet from "../CartDrawer/CartSheet";

function Layout() {
    const [cartOpen, setCartOpen] = useState(false);
    const location = useLocation();

    // Auto-close whenever the route changes (e.g. "View Cart"/"Checkout" links).
    useEffect(() => {
        setCartOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex min-h-screen flex-col">
            <NavBar onOpenCart={() => setCartOpen(true)} />
            <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
            <main className="flex-1 pt-28 px-4 sm:px-6 lg:px-8">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}

export default Layout;
