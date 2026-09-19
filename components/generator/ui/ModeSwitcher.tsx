"use client";

import { motion } from "framer-motion";
import { Briefcase, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { ContentMode } from "@/types/content";

interface ModeSwitcherProps {
  mode: ContentMode;
  onChange: (mode: ContentMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ mode, onChange, disabled }: ModeSwitcherProps) {
  const t = useTranslations("GeneratorSettings.modes");
  const isMarketing = mode === "marketing";

  return (
    <div
      style={{
        display: "flex",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-2xl)",
        padding: "var(--space-1)",
        position: "relative",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("marketing")}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-2xl)",
          border: "none",
          background: "transparent",
          color: isMarketing ? "var(--color-foreground-inverse)" : "var(--color-foreground-secondary)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--font-weight-semibold)",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          zIndex: 1,
          transition: "color var(--transition-fast)",
          fontFamily: "inherit",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <Briefcase size={14} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("marketing")}</span>
        {isMarketing && (
          <motion.div
            layoutId="mode-indicator"
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-brand-soft)",
              border: "none",
              borderRadius: "var(--radius-2xl)",
              zIndex: -1,
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
        )}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("creator")}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-2xl)",
          border: "none",
          background: "transparent",
          color: !isMarketing ? "var(--color-foreground-inverse)" : "var(--color-foreground-secondary)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--font-weight-semibold)",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          zIndex: 1,
          transition: "color var(--transition-fast)",
          fontFamily: "inherit",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <UserCheck size={13} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("creator")}</span>
        {!isMarketing && (
          <motion.div
            layoutId="mode-indicator"
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-brand-soft)",
              border: "none",
              borderRadius: "var(--radius-2xl)",
              zIndex: -1,
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
        )}
      </button>
    </div>
  );
}
