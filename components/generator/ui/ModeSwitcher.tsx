"use client";

import { motion } from "framer-motion";
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
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "99px",
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
          padding: "8px 16px",
          borderRadius: "99px",
          border: "none",
          background: "transparent",
          color: isMarketing ? "#fff" : "rgba(255,255,255,0.5)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          zIndex: 1,
          transition: "color 0.2s",
        }}
      >
        🎯 تسويقي وإعلاني
        {isMarketing && (
          <motion.div
            layoutId="mode-indicator"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(139, 92, 246, 0.15)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "99px",
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
          padding: "8px 16px",
          borderRadius: "99px",
          border: "none",
          background: "transparent",
          color: !isMarketing ? "#fff" : "rgba(255,255,255,0.5)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          zIndex: 1,
          transition: "color 0.2s",
        }}
      >
        🧠 صانع محتوى وفكر
        {!isMarketing && (
          <motion.div
            layoutId="mode-indicator"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(139, 92, 246, 0.15)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "99px",
              zIndex: -1,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        )}
      </button>
    </div>
  );
}
