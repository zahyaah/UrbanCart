import type { ButtonHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from "react";

// button.jsx is a vendored JS primitive (see eslint.config.js's note on
// src/components/ui/**) -- this sibling .d.ts is what TypeScript resolves
// instead of inferring from the JS source. Needed once Button became
// React.forwardRef: forwardRef's callback loses its destructured prop shape
// under inference in an untyped .jsx file, collapsing every consumer's
// props to just RefAttributes<any>.
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
    size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
    asChild?: boolean;
}

export declare const buttonVariants: (props?: {
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    className?: string;
}) => string;

export declare const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;
