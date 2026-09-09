import { Outlet } from "react-router-dom";
import NavBar from "../NavBar/NavBar";
import CartDrawer from "../CartDrawer/CartDrawer";

function Layout() {
    return (
        <CartDrawer>
            <NavBar />
            <CartDrawer.Panel />
            <main className="pt-44 px-4 sm:px-6 lg:px-8">
                <Outlet />
            </main>
        </CartDrawer>
    );
}

export default Layout;
