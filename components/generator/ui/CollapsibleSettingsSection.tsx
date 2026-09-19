"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, ChevronDown } from "lucide-react";

interface CollapsibleSettingsSectionProps {
  title: string;
  badge?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CollapsibleSettingsSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
}: CollapsibleSettingsSectionProps) {
  return (
    <div style={{ marginTop: "var(--space-0-5)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-2) var(--space-2-5)",
          background: "transparent",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-foreground)",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--font-weight-semibold)",
          cursor: "pointer",
          transition: "var(--transition-normal)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1, minWidth: 0, overflow: "hidden", marginInlineEnd: "var(--space-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
            <Settings2 size={14} color="var(--color-brand-primary)" />
            <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
              {title}
            </span>
          </div>
          {badge}
        </div>
        <ChevronDown
          size={14}
          color="var(--color-foreground-secondary)"
          style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "var(--transition-normal)", flexShrink: 0 }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
