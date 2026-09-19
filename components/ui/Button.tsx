"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "brandSoft" | "danger";
type ButtonSize = "sm" | "lg";

interface ButtonProps {
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-busy"?: boolean;
}

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--gradient-brand)",
    border: "none",
    color: "var(--color-foreground-inverse)",
  },
  ghost: {
    background: "transparent",
    border: "1px solid var(--color-border)",
    color: "var(--color-foreground-secondary)",
  },
  brandSoft: {
    background: "var(--color-brand-surface)",
    border: "1px solid var(--color-brand-soft)",
    color: "var(--color-brand-primary)",
  },
  danger: {
    background: "var(--color-danger-surface)",
    border: "1px solid var(--color-danger-border)",
    color: "var(--color-danger)",
  },
};

const sizeStyle: Record<ButtonSize, CSSProperties> = {
  sm: {
    padding: "var(--space-1-5) var(--space-3)",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-semibold)",
    borderRadius: "var(--radius-md)",
  },
  lg: {
    padding: "var(--space-3) var(--space-6)",
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-bold)",
    borderRadius: "var(--radius-lg)",
  },
};

export default function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
  style,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled && variant === "primary" ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        fontFamily: "inherit",
        letterSpacing: "var(--tracking-btn)",
        transition: "var(--transition-normal)",
        cursor: disabled ? "not-allowed" : "pointer",
        ...sizeStyle[size],
        ...variantStyle[variant],
        ...style,
        width: fullWidth ? "100%" : style?.width,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}