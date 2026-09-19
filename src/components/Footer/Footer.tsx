import { Link } from "react-router-dom";

function Footer() {
    return (
        <footer className="mt-24 border-t border-border/70">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="flex flex-col items-start justify-between gap-10 sm:flex-row sm:items-end">
                    <div>
                        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-secondary-foreground uppercase">
                            Since 2026
                        </span>
                        <Link
                            to="/"
                            className="mt-4 block font-display text-4xl leading-none transition-opacity hover:opacity-70 sm:text-5xl"
                        >
                            Urban Cart
                        </Link>
                        <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                            A demo storefront. Product data via Fake Store API — no real orders are placed.
                        </p>
                    </div>
                    <nav className="flex gap-8 text-sm font-semibold">
                        <Link to="/" className="group/link relative pb-1">
                            Shop
                            <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/link:scale-x-100" />
                        </Link>
                        <Link to="/cart" className="group/link relative pb-1">
                            Cart
                            <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/link:scale-x-100" />
                        </Link>
                    </nav>
                </div>
                <div className="mt-12 flex flex-col-reverse items-start justify-between gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center">
                    <p className="text-xs text-muted-foreground">
                        &copy; {new Date().getFullYear()} Urban Cart. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
