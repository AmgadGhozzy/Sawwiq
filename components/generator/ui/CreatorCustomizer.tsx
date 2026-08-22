"use client";

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
          label="شخصية الكاتب" 
          options={personas} 
          value={selectedPersona} 
          onChange={onPersonaChange} 
          disabled={disabled} 
        />
        <DropdownPill 
          label="أسلوب الطرح" 
          options={styles} 
          value={selectedStyle} 
          onChange={onStyleChange} 
          disabled={disabled} 
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          مستوى الابتكار
        </span>
        <div style={{
          display: "flex",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          padding: "3px",
          border: "1px solid var(--color-border)",
          gap: "4px",
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
                  padding: "6px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--color-brand-primary)" : "transparent",
                  border: "none",
                  color: isActive ? "white" : "var(--color-foreground-secondary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "inherit",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
