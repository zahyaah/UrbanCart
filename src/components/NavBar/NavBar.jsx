import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { Moon, ShoppingCart, Sun } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { selectCartItemCount } from "../../features/cart/cartSelectors";
import { useTheme } from "../../providers/ThemeProvider";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

function NavBar({ onOpenCart }) {
    const prefersReducedMotion = useReducedMotion();
    const navVariants = {
        initial: { opacity: prefersReducedMotion ? 1 : 0 },
        final: { opacity: 1, transition: { duration: prefersReducedMotion ? 0 : 0.6 } },
    };

    const cartItemCount = useSelector(selectCartItemCount);
    const { theme, toggleTheme } = useTheme();

    return (
        <motion.header
            variants={navVariants}
            initial="initial"
            animate="final"
            className="fixed top-5 left-0 right-0 z-20 mx-4 flex h-16 items-center justify-between rounded-xl border-2 border-foreground bg-primary px-6 shadow-[4px_4px_0_0_var(--foreground)]"
        >
            <Link to="/" className="font-display text-2xl sm:text-3xl md:text-display-md text-primary-foreground">
                Urban Cart
            </Link>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label="Toggle dark mode"
                    className="min-h-[44px] min-w-[44px] text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                >
                    {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onOpenCart}
                    aria-label={`Open cart, ${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`}
                    className="relative min-h-[44px] min-w-[44px] text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                >
                    <ShoppingCart aria-hidden="true" />
                    {cartItemCount !== 0 && (
                        <Badge
                            aria-live="polite"
                            className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full border border-foreground bg-accent px-1 text-accent-foreground"
                        >
                            {cartItemCount}
                        </Badge>
                    )}
                </Button>
            </div>
        </motion.header>
    );
}

NavBar.propTypes = {
    onOpenCart: PropTypes.func.isRequired,
};

export default NavBar;
