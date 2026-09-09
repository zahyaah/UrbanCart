import { Outlet } from "react-router-dom";
import NavBar from "../NavBar/NavBar";

function Layout() {
    return (
        <>
            <NavBar />
            <main className="pt-44 px-4 sm:px-6 lg:px-8">
                <Outlet />
            </main>
        </>
    );
}

export default Layout;
