"use client";

import { motion } from "framer-motion";

interface GenerateButtonProps {
  loading: boolean;
  disabled: boolean;
}

export default function GenerateButton({ loading, disabled }: GenerateButtonProps) {
  const isOff = disabled && !loading;

  return (
    <motion.button
      type="submit"
      disabled={disabled || loading}
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      whileHover={!disabled && !loading ? { y: -2, boxShadow: "0 8px 25px rgba(124,58,237,0.5)" } : undefined}
      aria-busy={loading}
      animate={!isOff && !loading ? {
        boxShadow: [
          "0 4px 20px rgba(124,58,237,0.5), 0 1px 0 rgba(255,255,255,0.1) inset, 0 0 5px rgba(124,58,237,0)",
          "0 4px 20px rgba(124,58,237,0.5), 0 1px 0 rgba(255,255,255,0.1) inset, 0 0 25px rgba(124,58,237,0.8)",
          "0 4px 20px rgba(124,58,237,0.5), 0 1px 0 rgba(255,255,255,0.1) inset, 0 0 5px rgba(124,58,237,0)"
        ]
      } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        borderRadius: "12px", border: "none",
        padding: "14px 20px",
        fontSize: "15px", fontWeight: 700, color: "#fff",
        cursor: isOff || loading ? "not-allowed" : "pointer",
        opacity: isOff ? 0.45 : 1,
        fontFamily: "inherit",
        background: isOff
          ? "rgba(124,58,237,0.3)"
          : "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
        boxShadow: isOff ? "none" : "0 4px 20px rgba(124,58,237,0.5), 0 1px 0 rgba(255,255,255,0.1) inset",
        transition: "opacity 0.2s ease",
        letterSpacing: "0.01em",
      }}
    >
      {loading ? (
        <motion.span
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            style={{
              display: "inline-block", width: "15px", height: "15px",
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.25)",
              borderTopColor: "#fff",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
          />
          جارٍ التوليد...
        </motion.span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          توليد المحتوى
        </span>
      )}
    </motion.button>
  );
}
