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
      animate={!isOff && !loading ? {
        boxShadow: [
          "0 0 20px rgba(139, 92, 246, 0.4)",
          "0 0 40px rgba(217, 70, 239, 0.6)",
          "0 0 20px rgba(139, 92, 246, 0.4)"
        ]
      } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      dir="rtl"
      style={{
        width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        borderRadius: "16px", border: "none",
        padding: "16px 24px",
        fontSize: "16px", fontWeight: 800, color: "white",
        cursor: isOff || loading ? "not-allowed" : "pointer",
        opacity: isOff ? 0.45 : 1,
        fontFamily: "inherit",
        background: isOff
          ? "rgba(255, 255, 255, 0.05)"
          : "linear-gradient(to right, #7c3aed, #4f46e5, #c026d3)",
        transition: "opacity 0.2s ease",
        letterSpacing: "0.01em",
        marginTop: "8px",
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
              borderRadius: "50%",
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
          <span>توليد المحتوى السحري</span>
          <Sparkles size={18} />
        </span>
      )}
    </motion.button>
  );
}
