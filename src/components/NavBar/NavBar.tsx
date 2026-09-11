import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, ShoppingCart, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useCart } from "../../hooks/useCart";
import { useTheme } from "../../providers/ThemeProvider";
import { Button } from "../ui/button";
import AuthMenu from "./AuthMenu";
import { EASE } from "../../lib/motion";

interface NavBarProps {
    onOpenCart: () => void;
}

function NavBar({ onOpenCart }: NavBarProps) {
    const prefersReducedMotion = useReducedMotion();
    const { items } = useCart();
    const cartItemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const { theme, toggleTheme } = useTheme();
    const [scrolled, setScrolled] = useState(false);

    // Condense the bar once the page scrolls, so it recedes behind content.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <motion.header
            initial={prefersReducedMotion ? false : { y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            className={`fixed inset-x-0 top-4 z-20 mx-4 flex items-center justify-between rounded-xl border border-border px-4 backdrop-blur-md transition-[height,background-color,box-shadow] duration-300 sm:px-6 ${
                scrolled
                    ? "h-14 bg-card/85 shadow-md"
                    : "h-16 bg-card/60 shadow-sm"
            }`}
        >
            <Link
                to="/"
                className="font-display text-xl tracking-wide transition-opacity hover:opacity-70 sm:text-2xl md:text-display-sm"
            >
                Urban Cart
            </Link>

            <div className="flex items-center gap-1 sm:gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label="Toggle dark mode"
                    className="min-h-[44px] min-w-[44px]"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={theme}
                            initial={prefersReducedMotion ? false : { rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="flex items-center justify-center"
                        >
                            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                        </motion.span>
                    </AnimatePresence>
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onOpenCart}
                    aria-label={`Open cart, ${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`}
                    className="relative min-h-[44px] min-w-[44px]"
                >
                    <ShoppingCart aria-hidden="true" />
                    <AnimatePresence>
                        {cartItemCount !== 0 && (
                            <motion.span
                                key="badge"
                                initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                aria-live="polite"
                                className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground"
                            >
                                {cartItemCount}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Button>

                <AuthMenu />
            </div>
        </motion.header>
    );
}

export default NavBar;
