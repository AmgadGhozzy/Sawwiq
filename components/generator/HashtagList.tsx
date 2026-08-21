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
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: "11px", fontWeight: 700, color: "var(--color-foreground-disabled)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {t("title")}
        </span>
        <button
          onClick={copyAll}
          aria-label={t("copyAllAria")}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            fontSize: "11px", fontWeight: 600,
            color: copiedAll ? "var(--color-success)" : "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))",
            background: "color-mix(in srgb, var(--color-foreground) 4%, transparent)", border: "1px solid var(--color-border)", cursor: "pointer",
            padding: "4px 10px", borderRadius: "999px",
            fontFamily: "inherit",
            transition: "color 0.2s ease",
          }}
        >
          {copiedAll && <Check size={11} />}
          {copiedAll ? t("copied") : t("copyAll")}
        </button>
      </div>

      {/* Pill tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
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
              padding: "5px 14px", borderRadius: "999px",
              background: copiedIndex === index
                ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                : "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
              border: copiedIndex === index
                ? "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)"
                : "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
              color: copiedIndex === index ? "var(--color-success)" : "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))",
              fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s ease",
            }}
          >
            {copiedIndex === index ? (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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
