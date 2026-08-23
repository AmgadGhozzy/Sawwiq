"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

interface GenerateButtonProps {
  loading: boolean;
  disabled: boolean;
}

export default function GenerateButton({ loading, disabled }: GenerateButtonProps) {
  const t = useTranslations("GenerateButton");
  const isOff = disabled && !loading;

  return (
    <motion.button
      type="submit"
      disabled={disabled || loading}
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      whileHover={!disabled && !loading ? { y: -2, scale: 1.01 } : undefined}
      aria-busy={loading}
      animate={undefined}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
        borderRadius: "var(--radius-xl)", border: "none",
        padding: "var(--space-3) var(--space-5)",
        fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-extrabold)", color: "var(--color-foreground-inverse)",
        cursor: isOff || loading ? "not-allowed" : "pointer",
        opacity: isOff ? 0.45 : 1,
        fontFamily: "inherit",
        background: isOff
          ? "color-mix(in srgb, var(--color-foreground) 5%, transparent)"
          : "var(--gradient-brand)",
        boxShadow: "none",
        transition: "var(--transition-normal)",
        letterSpacing: "0.01em",
      }}
    >
      {loading ? (
        <motion.span
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            style={{
              display: "inline-block", width: "16px", height: "16px",
              borderRadius: "var(--radius-circle)",
              border: "2px solid color-mix(in srgb, var(--color-foreground-inverse) 30%, transparent)",
              borderTopColor: "var(--color-foreground-inverse)",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
          />
          {t("loading")}
        </motion.span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span>{t("generate")}</span>
          <Sparkles size={18} />
        </span>
      )}
    </motion.button>
  );
}
