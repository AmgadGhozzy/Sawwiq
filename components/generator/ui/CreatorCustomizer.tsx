"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { DropdownPill } from "./ContextPills";

interface Option {
  value: string;
  label: string;
}

interface CreatorCustomizerProps {
  styles: Option[];
  selectedStyle: string;
  onStyleChange: (val: string) => void;

  originalityOptions: Option[];
  selectedOriginality: string;
  onOriginalityChange: (val: string) => void;

  disabled?: boolean;
}

export function CreatorCustomizer({
  styles, selectedStyle, onStyleChange,
  originalityOptions, selectedOriginality, onOriginalityChange,
  disabled
}: CreatorCustomizerProps) {
  const t = useTranslations("GeneratorSettings");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2-5)",
        padding: "var(--space-3)",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        marginTop: "var(--space-1)",
      }}
    >
      <div>
        <DropdownPill 
          label={t("styleLabel")} 
          options={styles} 
          value={selectedStyle} 
          onChange={onStyleChange} 
          disabled={disabled} 
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>
          {t("originalityLabel")}
        </span>
        <div style={{
          display: "flex",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-2xl)",
          padding: "var(--space-1)",
          border: "1px solid var(--color-border)",
          position: "relative",
          gap: "var(--space-1)",
        }}>
          {originalityOptions.map((opt) => {
            const isActive = selectedOriginality === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onOriginalityChange(opt.value)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "var(--space-1) var(--space-2)",
                  borderRadius: "var(--radius-2xl)",
                  border: "none",
                  background: "transparent",
                  color: isActive ? "var(--color-foreground-inverse)" : "var(--color-foreground-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-weight-semibold)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "color var(--transition-fast)",
                  fontFamily: "inherit",
                  position: "relative",
                  zIndex: 1,
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="originality-indicator"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "var(--color-brand-soft)",
                      border: "none",
                      borderRadius: "var(--radius-2xl)",
                      zIndex: -1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
