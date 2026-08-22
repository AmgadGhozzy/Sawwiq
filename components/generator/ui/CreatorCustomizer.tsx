"use client";

import { motion } from "framer-motion";
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
        gap: "12px",
        padding: "12px",
        background: "rgba(255, 255, 255, 0.01)",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        marginTop: "4px",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <DropdownPill 
          label="الشخصية" 
          options={personas} 
          value={selectedPersona} 
          onChange={onPersonaChange} 
          disabled={disabled} 
        />
        <DropdownPill 
          label="الأسلوب" 
          options={styles} 
          value={selectedStyle} 
          onChange={onStyleChange} 
          disabled={disabled} 
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
    </div>
  );
}
