"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { GenerationHistoryItem } from "@/types/history";
import type { Platform } from "@/types/content";
import { useTranslations } from "next-intl";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

// ---------------------------------------------------------------------------
// Platform badge config
// ---------------------------------------------------------------------------
const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  instagram: { label: "Instagram", color: "#E1306C", bg: "rgba(225,48,108,0.10)", border: "rgba(225,48,108,0.20)" },
  tiktok: { label: "TikTok", color: "#00f2ea", bg: "rgba(0,242,234,0.08)", border: "rgba(0,242,234,0.18)" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", bg: "rgba(10,102,194,0.10)", border: "rgba(10,102,194,0.20)" },
  x_twitter: { label: "X", color: "#a3a3a3", bg: "rgba(163,163,163,0.08)", border: "rgba(163,163,163,0.18)" },
  facebook: { label: "Facebook", color: "#1877F2", bg: "rgba(24,119,242,0.10)", border: "rgba(24,119,242,0.20)" },
};

// ---------------------------------------------------------------------------
// Relative time using Intl.RelativeTimeFormat
// ---------------------------------------------------------------------------
function formatRelativeTime(dateStr: string, locale: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return rtf.format(-diffMonth, "month");
  return rtf.format(-Math.floor(diffMonth / 12), "year");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface HistoryCardProps {
  item: GenerationHistoryItem;
  isLast: boolean;
  locale: string;
}

export default function HistoryCard({ item, isLast, locale }: HistoryCardProps) {
  const t = useTranslations("History");
  const tSettings = useTranslations("GeneratorSettings");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { aiResponse } = item;

  const handleCopy = useCallback(async () => {
    const text = [
      aiResponse.title,
      "",
      aiResponse.hook,
      "",
      aiResponse.body,
      "",
      aiResponse.callToAction,
      "",
      aiResponse.hashtags.map((h) => `#${h}`).join(" "),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* silent */
    }
  }, [aiResponse]);

  // Resolve translated labels with safe fallback
  const platformInfo = PLATFORM_CONFIG[item.platform] ?? {
    label: item.platform,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.18)",
  };

  let contentTypeLabel: string;
  try {
    contentTypeLabel = tSettings(`contentTypes.${item.contentType}`);
  } catch {
    contentTypeLabel = item.contentType;
  }

  let arabicStyleLabel: string;
  try {
    arabicStyleLabel = tSettings(`arabicStyles.${item.arabicStyle}`);
  } catch {
    arabicStyleLabel = item.arabicStyle;
  }

  const relativeTime = formatRelativeTime(item.createdAt, locale);

  return (
    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
      {/* ── Timeline connector ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          width: "20px",
          paddingTop: "6px",
        }}
      >
        {/* Glowing dot */}
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            boxShadow: "0 0 0 4px rgba(124,58,237,0.15), 0 0 12px rgba(124,58,237,0.3)",
            flexShrink: 0,
          }}
        />
        {/* Vertical line */}
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: "2px",
              marginTop: "4px",
              background: "linear-gradient(180deg, rgba(124,58,237,0.3), rgba(79,70,229,0.08))",
              borderRadius: "1px",
            }}
          />
        )}
      </div>

      {/* ── Card ── */}
      <motion.div
        layout
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          flex: 1,
          marginBottom: isLast ? 0 : "16px",
          borderRadius: "16px",
          background:
            "linear-gradient(165deg, rgba(15,15,25,0.85) 0%, rgba(10,10,20,0.9) 50%, rgba(20,12,40,0.85) 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow:
            "0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Card content */}
        <div style={{ padding: "16px 18px" }}>
          {/* Title */}
          <h4
            style={{
              fontSize: "15px",
              fontWeight: 800,
              margin: "0 0 8px",
              lineHeight: 1.4,
              background: "linear-gradient(to left, #a78bfa, #c7d2fe)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {aiResponse.title}
          </h4>

          {/* Hook preview (max 2 lines when collapsed) */}
          <p
            style={{
              fontSize: "13px",
              color: "#94a3b8",
              lineHeight: 1.7,
              margin: "0 0 12px",
              fontStyle: "italic",
              ...(!expanded
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }
                : {}),
            }}
          >
            {aiResponse.hook}
          </p>

          {/* Expanded content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                {/* Body */}
                <p
                  style={{
                    fontSize: "13px",
                    color: "#cbd5e1",
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                    margin: "0 0 12px",
                    paddingTop: "4px",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {aiResponse.body}
                </p>

                {/* CTA */}
                <div
                  style={{
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.10))",
                    border: "1px solid rgba(124,58,237,0.2)",
                    padding: "12px 14px",
                    textAlign: "center",
                    marginBottom: "12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#e0e7ff",
                      margin: 0,
                    }}
                  >
                    {aiResponse.callToAction}
                  </p>
                </div>

                {/* Hashtags */}
                {aiResponse.hashtags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginBottom: "8px",
                    }}
                  >
                    {aiResponse.hashtags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "3px 10px",
                          borderRadius: "999px",
                          background: "rgba(124,58,237,0.08)",
                          border: "1px solid rgba(124,58,237,0.15)",
                          color: "#a78bfa",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            {/* Platform */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 700,
                color: platformInfo.color,
                background: platformInfo.bg,
                border: `1px solid ${platformInfo.border}`,
              }}
            >
              <PlatformIcon platform={item.platform as Platform} size={12} />
              {platformInfo.label}
            </span>

            {/* Content type */}
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 600,
                color: "#818cf8",
                background: "rgba(129,140,248,0.08)",
                border: "1px solid rgba(129,140,248,0.15)",
              }}
            >
              {contentTypeLabel}
            </span>

            {/* Arabic style */}
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 600,
                color: "#64748b",
                background: "rgba(100,116,139,0.08)",
                border: "1px solid rgba(100,116,139,0.12)",
              }}
            >
              {arabicStyleLabel}
            </span>
          </div>

          {/* Footer: time + actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "#475569",
                fontWeight: 500,
              }}
            >
              {relativeTime}
            </span>

            <div style={{ display: "flex", gap: "6px" }}>
              {/* Copy button */}
              <button
                onClick={handleCopy}
                aria-label={t("copyContent")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "7px",
                  background: copied
                    ? "rgba(34,197,94,0.10)"
                    : "rgba(124,58,237,0.08)",
                  border: copied
                    ? "1px solid rgba(34,197,94,0.20)"
                    : "1px solid rgba(124,58,237,0.15)",
                  color: copied ? "#4ade80" : "#a78bfa",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? t("copied") : t("copyContent")}
              </button>

              {/* Expand/collapse */}
              <button
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? t("collapse") : t("expand")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "7px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                }}
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {expanded ? t("collapse") : t("expand")}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
