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
          fontSize: "11px", fontWeight: 700, color: "#475569",
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
            color: copiedAll ? "#4ade80" : "#7c3aed",
            background: "none", border: "none", cursor: "pointer",
            padding: "3px 8px", borderRadius: "6px",
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
                ? "rgba(34,197,94,0.12)"
                : "rgba(124,58,237,0.12)",
              border: copiedIndex === index
                ? "1px solid rgba(34,197,94,0.25)"
                : "1px solid rgba(124,58,237,0.2)",
              color: copiedIndex === index ? "#4ade80" : "#a78bfa",
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
