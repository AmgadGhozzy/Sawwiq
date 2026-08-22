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
        display: "flex",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "24px",
        padding: "4px",
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
          gap: "8px",
          padding: "8px 16px",
          borderRadius: "20px",
          border: "none",
          background: "transparent",
          color: isMarketing ? "#ffffff" : "var(--color-foreground-secondary)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          zIndex: 1,
          transition: "color 0.2s",
          fontFamily: "inherit",
        }}
      >
        <Briefcase size={14} />
        <span>تسويقي وإعلاني</span>
        {isMarketing && (
          <motion.div
            layoutId="mode-indicator"
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

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("creator")}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "8px 16px",
          borderRadius: "20px",
          border: "none",
          background: "transparent",
          color: !isMarketing ? "#ffffff" : "var(--color-foreground-secondary)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          zIndex: 1,
          transition: "color 0.2s",
          fontFamily: "inherit",
        }}
      >
        <UserCheck size={14} />
        <span>صانع محتوى وفكر</span>
        {!isMarketing && (
          <motion.div
            layoutId="mode-indicator"
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
    </div>
  );
}
