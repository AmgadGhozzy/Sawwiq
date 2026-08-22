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
      whileHover={!disabled && !loading ? { y: -2, boxShadow: "var(--shadow-brand)" } : undefined}
      aria-busy={loading}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        width: "100%", padding: "13px", borderRadius: "var(--radius-lg)", border: "none",
        background: isOff ? "color-mix(in srgb, var(--color-foreground) 10%, transparent)" : "var(--gradient-brand)",
        color: isOff ? "var(--color-foreground-disabled)" : "white",
        fontWeight: 700, fontSize: "14px",
        cursor: isOff || loading ? "not-allowed" : "pointer",
        opacity: isOff ? 0.6 : 1,
        fontFamily: "inherit",
        boxShadow: isOff ? "none" : "var(--shadow-brand)",
        transition: "all 0.2s ease",
      }}
    >
      {loading ? (
        <motion.span
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            style={{
              display: "inline-block", width: "16px", height: "16px",
              borderRadius: "var(--radius-circle)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              borderTopColor: "white",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
          />
          {t("loading")}
        </motion.span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{t("generate")}</span>
          <Sparkles size={15} />
        </span>
      )}
    </motion.button>
  );
}
