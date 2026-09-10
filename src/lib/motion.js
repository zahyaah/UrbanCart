// Shared Framer Motion presets so entrances/transitions feel like one
// system instead of per-component one-offs.

// Quint-out: fast start, long soft settle. Reads as "considered" rather
// than the default springy bounce.
export const EASE = [0.22, 1, 0.36, 1];

export const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const fadeIn = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.45, ease: EASE } },
};

export const scaleIn = {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE } },
};

export const staggerContainer = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.055, delayChildren: 0.08 },
    },
};

// Route-level transition used by the Layout's AnimatePresence.
export const pageTransition = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.22, ease: "easeIn" } },
};

// Checkout wizard steps slide horizontally so forward/back reads spatially.
export const stepTransition = {
    hidden: { opacity: 0, x: 32 },
    show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE } },
    exit: { opacity: 0, x: -32, transition: { duration: 0.2, ease: "easeIn" } },
};

// Collapses any of the above to a plain cross-fade with no movement.
const STATIC = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
};

export function reduce(variants, prefersReducedMotion) {
    return prefersReducedMotion ? STATIC : variants;
}
