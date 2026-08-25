"use client";

// ---------------------------------------------------------------------------
// CtaButton — the single primary call-to-action style (gradient brand).
// Every primary button in the app renders through this component so padding,
// radius, typography and shadow stay identical everywhere.
// ---------------------------------------------------------------------------

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

interface CtaButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** Disabled look with muted surface instead of gradient (e.g. invalid form). */
  muted?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-busy"?: boolean;
}

const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-2)",
  borderRadius: "var(--radius-lg)",
  border: "none",
  padding: "var(--space-3) var(--space-6)",
  fontSize: "var(--text-base)",
  fontWeight: "var(--font-weight-bold)",
  color: "var(--color-foreground-inverse)",
  fontFamily: "inherit",
  letterSpacing: "var(--tracking-btn)",
  background: "var(--gradient-brand)",
  boxShadow: "none",
  cursor: "pointer",
  transition: "var(--transition-normal)",
};

export default function CtaButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  muted = false,
  fullWidth = false,
  className,
  style,
  ...rest
}: CtaButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled && !muted ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      className={className}
      style={{
        ...baseStyle,
        ...style,
        width: fullWidth ? "100%" : style?.width,
        ...(muted
          ? {
              background:
                "color-mix(in srgb, var(--color-foreground) 5%, transparent)",
              color: "var(--color-foreground)",
              opacity: 0.45,
              boxShadow: "none",
            }
          : {}),
        cursor: disabled || muted ? "not-allowed" : "pointer",
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
