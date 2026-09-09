import { Link } from "react-router-dom";

function Footer() {
    return (
        <footer className="mt-16 border-t-2 border-foreground bg-card">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                    <div>
                        <Link to="/" className="font-display text-2xl">
                            Urban Cart
                        </Link>
                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                            A demo storefront. Product data via Fake Store API — no real orders are placed.
                        </p>
                    </div>
                    <nav className="flex gap-6 text-sm font-medium">
                        <Link to="/" className="hover:text-primary">
                            Shop
                        </Link>
                        <Link to="/cart" className="hover:text-primary">
                            Cart
                        </Link>
                    </nav>
                </div>
                <p className="mt-8 text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} Urban Cart. All rights reserved.
                </p>
            </div>
        </footer>
    );
}

export default Footer;
