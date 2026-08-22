"use client";

import { motion } from "framer-motion";

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

function ChipGrid({ options, selected, onChange, disabled }: { options: Option[], selected: string, onChange: (val: string) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              background: isActive ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 255, 255, 0.02)",
              border: isActive ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.05)",
              color: isActive ? "#a78bfa" : "rgba(255, 255, 255, 0.6)",
              fontSize: "12px",
              fontWeight: isActive ? 600 : 400,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CreatorCustomizer({
  personas, selectedPersona, onPersonaChange,
  styles, selectedStyle, onStyleChange,
  originalityOptions, selectedOriginality, onOriginalityChange,
  disabled
}: CreatorCustomizerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
        background: "rgba(255, 255, 255, 0.01)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        marginTop: "12px",
        overflow: "hidden"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>شخصية الكاتب</span>
        <ChipGrid options={personas} selected={selectedPersona} onChange={onPersonaChange} disabled={disabled} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>أسلوب الطرح</span>
        <ChipGrid options={styles} selected={selectedStyle} onChange={onStyleChange} disabled={disabled} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>مستوى الابتكار</span>
        <div style={{
          display: "flex",
          background: "rgba(255,255,255,0.02)",
          borderRadius: "8px",
          padding: "4px",
          border: "1px solid rgba(255,255,255,0.05)"
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
                  padding: "6px",
                  borderRadius: "6px",
                  background: isActive ? "rgba(139, 92, 246, 0.2)" : "transparent",
                  border: "none",
                  color: isActive ? "#fff" : "rgba(255, 255, 255, 0.5)",
                  fontSize: "11px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
