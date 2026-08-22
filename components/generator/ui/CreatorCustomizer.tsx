"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { DropdownPill } from "./ContextPills";

interface Option {
  value: string;
  label: string;
}

interface CreatorCustomizerProps {
  personas: Option[];
  selectedPersona: string;
  onPersonaChange: (val: string) => void;
  
  styles: Option[];
  selectedStyle: string;
  onStyleChange: (val: string) => void;

  originalityOptions: Option[];
  selectedOriginality: string;
  onOriginalityChange: (val: string) => void;

  disabled?: boolean;
}

export function CreatorCustomizer({
  personas, selectedPersona, onPersonaChange,
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
        gap: "10px",
        padding: "12px",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        marginTop: "6px",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <DropdownPill 
          label={t("personaLabel")} 
          options={personas} 
          value={selectedPersona} 
          onChange={onPersonaChange} 
          disabled={disabled} 
        />
        <DropdownPill 
          label={t("styleLabel")} 
          options={styles} 
          value={selectedStyle} 
          onChange={onStyleChange} 
          disabled={disabled} 
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>
          {t("originalityLabel")}
        </span>
        <div style={{
          display: "inline-flex",
          width: "fit-content",
          maxWidth: "100%",
          background: "var(--color-surface)",
          borderRadius: "24px",
          padding: "3px",
          border: "1px solid var(--color-border)",
          position: "relative",
          gap: "2px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          {originalityOptions.map((opt) => {
            const isActive = selectedOriginality === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onOriginalityChange(opt.value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "5px 10px",
                  borderRadius: "20px",
                  border: "none",
                  background: "transparent",
                  color: isActive ? "#ffffff" : "var(--color-foreground-secondary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "color 0.15s ease",
                  fontFamily: "inherit",
                  position: "relative",
                  zIndex: 1,
                  whiteSpace: "nowrap",
                }}
              >
                <span>{opt.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="originality-indicator"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "color-mix(in srgb, var(--color-brand-primary) 32%, transparent)",
                      border: "none",
                      borderRadius: "20px",
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
