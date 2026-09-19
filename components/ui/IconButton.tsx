"use client";

import type { CSSProperties, ReactNode } from "react";

type IconButtonVariant = "surface" | "brandSoft" | "border";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps {
  onClick: () => void;
  "aria-label": string;
  title?: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  badge?: ReactNode;
  style?: CSSProperties;
}

const variantStyle: Record<IconButtonVariant, CSSProperties> = {
  surface: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
  },
  brandSoft: {
    background: "var(--color-brand-surface)",
    border: "1px solid var(--color-border)",
  },
  border: {
    background: "transparent",
    border: "1px solid var(--color-border)",
  },
};

const sizeStyle: Record<IconButtonSize, CSSProperties> = {
  sm: { width: "var(--space-8)", height: "var(--space-8)", borderRadius: "var(--radius-md)" },
  md: { width: "var(--space-9)", height: "var(--space-9)", borderRadius: "var(--radius-circle)" },
  lg: { width: "var(--control-h-lg)", height: "var(--control-h-lg)", borderRadius: "var(--radius-circle)" },
};

export default function IconButton({
  onClick,
  "aria-label": ariaLabel,
  title,
  icon,
  variant = "surface",
  size = "md",
  badge,
  style,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-foreground-secondary)",
        cursor: "pointer",
        transition: "var(--transition-normal)",
        boxShadow: size === "lg" ? "var(--shadow-sm)" : undefined,
        fontFamily: "inherit",
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-surface-elevated)";
        e.currentTarget.style.color = "var(--color-foreground)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = variantStyle[variant].background as string;
        e.currentTarget.style.color = "var(--color-foreground-secondary)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {icon}
      {badge}
    </button>
  );
}