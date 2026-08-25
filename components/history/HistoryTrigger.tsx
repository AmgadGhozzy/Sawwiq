"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHistoryContext } from "./HistoryContext";

interface HistoryTriggerProps {
  onClick: () => void;
}

export default function HistoryTrigger({ onClick }: HistoryTriggerProps) {
  const t = useTranslations("History");
  const { items } = useHistoryContext();

  return (
    <button
      onClick={onClick}
      aria-label={t("title")}
      title={t("title")}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "var(--control-h-lg)",
        height: "var(--control-h-lg)",
        borderRadius: "var(--radius-circle)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        cursor: "pointer",
        color: "var(--color-foreground-secondary)",
        transition: "var(--transition-normal)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-surface-elevated)";
        e.currentTarget.style.color = "var(--color-foreground)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
        e.currentTarget.style.color = "var(--color-foreground-secondary)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <Clock size={18} />
      {items.length > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-2px",
            insetInlineEnd: "-2px",
            minWidth: "var(--space-4-5)",
            height: "var(--space-4-5)",
            borderRadius: "var(--radius-full)",
            background: "var(--color-brand-primary)",
            color: "white",
            fontSize: "var(--text-2xs)",
            fontWeight: "var(--font-weight-bold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 var(--space-1)",
            boxShadow: "0 0 0 2px var(--color-background)",
          }}
        >
          {items.length}
        </span>
      )}
    </button>
  );
}
