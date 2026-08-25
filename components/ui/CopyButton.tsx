"use client";

// ---------------------------------------------------------------------------
// CopyButton — single implementation of the "copy → check" interaction.
// Variants:
//   pill  — brand pill (copy-all actions)
//   ghost — bordered neutral button (inline copy actions)
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  getText: () => string;
  label: string;
  copiedLabel: string;
  variant?: "pill" | "ghost";
  onCopied?: () => void;
  /** Stop click propagation (for buttons nested inside clickable cards). */
  stopPropagation?: boolean;
}

const COPY_RESET_MS = 2000;

const variantStyle = {
  pill: {
    padding: "var(--space-1) var(--space-2-5)",
    borderRadius: "var(--radius-full)",
    background: "var(--color-brand-surface)",
    border: "1px solid var(--color-brand-soft)",
    color: "var(--color-brand-primary)",
  },
  ghost: {
    padding: "var(--space-1-5) var(--space-3)",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    border: "1px solid var(--color-border)",
    color: "var(--color-foreground-secondary)",
  },
} as const;

export default function CopyButton({
  getText,
  label,
  copiedLabel,
  variant = "ghost",
  onCopied,
  stopPropagation = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      onCopied?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      /* silent */
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? copiedLabel : label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-weight-semibold)",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        cursor: "pointer",
        transition: "var(--transition-fast)",
        ...(copied
          ? {
              background: "var(--color-success-surface)",
              borderColor: "var(--color-success-border)",
              color: "var(--color-success)",
            }
          : variantStyle[variant]),
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
