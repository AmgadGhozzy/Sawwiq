"use client";

// ---------------------------------------------------------------------------
// HashtagList — hashtag display with individual copy + copy all
// ---------------------------------------------------------------------------

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

interface HashtagListProps {
  hashtags: string[];
  onCopy?: () => void;
}

export default function HashtagList({ hashtags, onCopy }: HashtagListProps) {
  const t = useTranslations("HashtagList");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyTag = useCallback(
    async (tag: string, index: number) => {
      await navigator.clipboard.writeText(`#${tag}`);
      setCopiedIndex(index);
      onCopy?.();
      setTimeout(() => setCopiedIndex(null), 1500);
    },
    [onCopy]
  );

  const copyAll = useCallback(async () => {
    const text = hashtags.map((tag) => `#${tag}`).join(" ");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    onCopy?.();
    setTimeout(() => setCopiedAll(false), 2000);
  }, [hashtags, onCopy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground-disabled)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {t("title")}
        </span>
        <button
          onClick={copyAll}
          aria-label={t("copyAllAria")}
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-1)",
            fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)",
            color: copiedAll ? "var(--color-success)" : "var(--color-brand-primary)",
            background: "var(--color-brand-surface)", border: "1px solid var(--color-border)", cursor: "pointer",
            padding: "var(--space-1) var(--space-2-5)", borderRadius: "var(--radius-full)",
            fontFamily: "inherit",
            transition: "color var(--transition-fast)",
          }}
        >
          {copiedAll && <Check size={11} />}
          {copiedAll ? t("copied") : t("copyAll")}
        </button>
      </div>

      {/* Pill tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {hashtags.map((tag, index) => (
          <motion.button
            key={tag}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => copyTag(tag, index)}
            title={t("clickToCopy")}
            style={{
              display: "inline-flex", alignItems: "center",
              padding: "var(--space-1-5) var(--space-3-5)", borderRadius: "var(--radius-full)",
              background: copiedIndex === index
                ? "var(--color-success-surface)"
                : "var(--color-brand-surface)",
              border: copiedIndex === index
                ? "1px solid var(--color-success-border)"
                : "1px solid var(--color-brand-soft)",
              color: copiedIndex === index ? "var(--color-success)" : "var(--color-brand-primary)",
              fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)",
              cursor: "pointer", fontFamily: "inherit",
              transition: "var(--transition-normal)",
            }}
          >
            {copiedIndex === index ? (
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <Check size={11} />
                {t("copiedBadge")}
              </span>
            ) : (
              <span>#{tag}</span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
