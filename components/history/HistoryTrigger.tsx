"use client";

import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHistoryContext } from "./HistoryContext";
import IconButton from "@/components/ui/IconButton";

interface HistoryTriggerProps {
  onClick: () => void;
}

export default function HistoryTrigger({ onClick }: HistoryTriggerProps) {
  const t = useTranslations("History");
  const { items } = useHistoryContext();

  return (
    <IconButton
      onClick={onClick}
      aria-label={t("title")}
      title={t("title")}
      size="lg"
      icon={<History size={18} />}
      badge={items.length > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-2px",
            insetInlineEnd: "-2px",
            minWidth: "var(--space-4-5)",
            height: "var(--space-4-5)",
            borderRadius: "var(--radius-full)",
            background: "var(--color-brand-primary)",
            color: "var(--color-foreground-inverse)",
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
    />
  );
}