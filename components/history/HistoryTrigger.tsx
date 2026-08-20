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
        gap: "6px",
        padding: "8px 12px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "#cbd5e1",
        fontSize: "13px",
        fontWeight: 600,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.color = "#cbd5e1";
      }}
    >
      <Clock size={14} />
      <span
        style={{ display: "none" }}
        className="sm:inline-block"
      >
        {t("triggerLabel")}
      </span>
    </button>
  );
}
