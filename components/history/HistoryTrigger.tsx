"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface HistoryTriggerProps {
  onClick: () => void;
}

export default function HistoryTrigger({ onClick }: HistoryTriggerProps) {
  const t = useTranslations("History");

  return (
    <button
      onClick={onClick}
      aria-label={t("title")}
      title={t("title")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        cursor: "pointer",
        color: "var(--color-foreground-secondary)",
        transition: "all 0.2s ease",
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
    </button>
  );
}
