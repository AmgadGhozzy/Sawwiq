"use client";

import { motion } from "framer-motion";
import { Briefcase, UserCheck } from "lucide-react";
import { ContentMode } from "@/types/content";

interface ModeSwitcherProps {
  mode: ContentMode;
  onChange: (mode: ContentMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ mode, onChange, disabled }: ModeSwitcherProps) {
  const isMarketing = mode === "marketing";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        padding: "3px",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        gap: "4px",
        position: "relative",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("marketing")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "7px 10px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: isMarketing ? "var(--color-brand-primary)" : "transparent",
          color: isMarketing ? "white" : "var(--color-foreground-secondary)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          fontFamily: "inherit",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Briefcase size={13} />
        <span>تسويقي وإعلاني</span>
        {isMarketing && (
          <motion.div
            layoutId="mode-indicator"
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-brand-primary)",
              borderRadius: "var(--radius-sm)",
              zIndex: -1,
            }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          />
        )}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("creator")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "7px 10px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: !isMarketing ? "var(--color-brand-primary)" : "transparent",
          color: !isMarketing ? "white" : "var(--color-foreground-secondary)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          fontFamily: "inherit",
          position: "relative",
          zIndex: 1,
        }}
      >
        <UserCheck size={13} />
        <span>صانع محتوى وفكر</span>
        {!isMarketing && (
          <motion.div
            layoutId="mode-indicator"
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--color-brand-primary)",
              borderRadius: "var(--radius-sm)",
              zIndex: -1,
            }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          />
        )}
      </button>
    </div>
  );
}
