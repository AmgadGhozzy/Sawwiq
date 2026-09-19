"use client";

import { motion } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shadcn/button";

interface GenerateButtonProps {
  loading: boolean;
  disabled: boolean;
  hasResult?: boolean;
}

export default function GenerateButton({ loading, disabled, hasResult }: GenerateButtonProps) {
  const t = useTranslations("GenerateButton");
  const isOff = disabled && !loading;

  // ponytail: hasResult uses a distinct brand-tinted gradient, kept as an inline override on primary.
  const isOffStyle = isOff ? { opacity: "var(--opacity-subtle)" } : {};

  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading}
      className="h-auto w-full rounded-xl px-4 py-4 text-lg font-extrabold disabled:opacity-100"
      style={{
        borderRadius: "var(--radius-xl)",
        fontSize: "var(--text-lg)",
        fontWeight: "var(--font-weight-extrabold)",
        background: hasResult
          ? "linear-gradient(135deg, var(--color-brand-hover) 0%, var(--color-brand-primary) 50%, var(--color-brand-hover) 100%)"
          : "var(--gradient-brand)",
        ...isOffStyle,
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
              display: "inline-block", width: "var(--space-4)", height: "var(--space-4)",
              borderRadius: "var(--radius-circle)",
              border: "2px solid color-mix(in srgb, var(--color-foreground-inverse) 30%, transparent)",
              borderTopColor: "var(--color-foreground-inverse)",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
          />
          {t("loading")}
        </motion.span>
      ) : hasResult ? (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <RefreshCw size={16} />
          <span>{t("regenerate")}</span>
        </span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span>{t("generate")}</span>
          <Sparkles size={18} />
        </span>
      )}
    </Button>
  );
}