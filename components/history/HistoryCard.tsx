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
  instagram: { label: "Instagram", color: "var(--color-instagram)", bg: "color-mix(in srgb, var(--color-instagram) 10%, transparent)", border: "color-mix(in srgb, var(--color-instagram) 20%, transparent)" },
  tiktok: { label: "TikTok", color: "var(--color-tiktok)", bg: "color-mix(in srgb, var(--color-tiktok) 8%, transparent)", border: "color-mix(in srgb, var(--color-tiktok) 18%, transparent)" },
  linkedin: { label: "LinkedIn", color: "var(--color-linkedin)", bg: "color-mix(in srgb, var(--color-linkedin) 10%, transparent)", border: "color-mix(in srgb, var(--color-linkedin) 20%, transparent)" },
  x_twitter: { label: "X", color: "var(--color-x-twitter)", bg: "color-mix(in srgb, var(--color-x-twitter) 8%, transparent)", border: "color-mix(in srgb, var(--color-x-twitter) 18%, transparent)" },
  facebook: { label: "Facebook", color: "var(--color-facebook)", bg: "color-mix(in srgb, var(--color-facebook) 10%, transparent)", border: "color-mix(in srgb, var(--color-facebook) 20%, transparent)" },
};

// ---------------------------------------------------------------------------
// Relative time
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
      // silent
    }
  }, [aiResponse]);

  const platformInfo = PLATFORM_CONFIG[item.platform] ?? {
    label: item.platform,
    color: "var(--color-brand-primary)",
    bg: "var(--color-brand-surface)",
    border: "color-mix(in srgb, var(--color-brand-primary) 18%, transparent)",
  };

  let contentTypeLabel: string;
  try { contentTypeLabel = tSettings(`contentTypes.${item.contentType}`); } 
  catch { contentTypeLabel = item.contentType; }

  let arabicStyleLabel: string;
  try { arabicStyleLabel = tSettings(`arabicStyles.${item.arabicStyle}`); } 
  catch { arabicStyleLabel = item.arabicStyle; }

  const relativeTime = formatRelativeTime(item.createdAt, locale);

  return (
    <div style={{ display: "flex", gap: "14px", position: "relative" }}>
      {/* ── Timeline connector ── */}
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          flexShrink: 0, width: "16px", paddingTop: "8px",
        }}
      >
        <div
          style={{
            width: "12px", height: "12px", borderRadius: "50%",
            background: "var(--color-brand-primary)",
            boxShadow: "0 0 0 4px var(--color-brand-surface)",
            flexShrink: 0,
          }}
        />
        {!isLast && (
          <div
            style={{
              flex: 1, width: "2px", marginTop: "6px",
              background: "color-mix(in srgb, var(--color-border) 80%, transparent)",
              borderRadius: "1px",
            }}
          />
        )}
      </div>

      {/* ── Card ── */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          flex: 1, marginBottom: isLast ? 0 : "24px",
          borderRadius: "var(--radius-xl)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
        whileHover={{
          borderColor: "color-mix(in srgb, var(--color-brand-primary) 30%, transparent)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        <div style={{ padding: "18px 20px" }}>
          
          {/* Top Row: Badges & Time */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  padding: "4px 10px", borderRadius: "999px",
                  fontSize: "10px", fontWeight: 700,
                  color: platformInfo.color, background: platformInfo.bg,
                  border: `1px solid ${platformInfo.border}`,
                }}
              >
                <PlatformIcon platform={item.platform as Platform} size={12} />
                {platformInfo.label}
              </span>
              <span
                style={{
                  padding: "4px 10px", borderRadius: "999px",
                  fontSize: "10px", fontWeight: 600,
                  color: "color-mix(in srgb, var(--color-brand-primary) 80%, var(--color-foreground))", 
                  background: "var(--color-brand-surface)",
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
                }}
              >
                {contentTypeLabel}
              </span>
              <span
                style={{
                  padding: "4px 10px", borderRadius: "999px",
                  fontSize: "10px", fontWeight: 600,
                  color: "var(--color-foreground-secondary)",
                  background: "color-mix(in srgb, var(--color-foreground-secondary) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-foreground-secondary) 12%, transparent)",
                }}
              >
                {arabicStyleLabel}
              </span>
            </div>
            
            <span style={{ fontSize: "11px", color: "var(--color-foreground-disabled)", fontWeight: 500, paddingTop: "4px" }}>
              {relativeTime}
            </span>
          </div>

          {/* Title */}
          <h4 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 12px", color: "var(--color-foreground)", lineHeight: 1.4 }}>
            {aiResponse.title}
          </h4>

          {/* Hook preview with accent line */}
          <div style={{ 
            borderInlineStart: "2px solid var(--color-brand-primary)", 
            paddingInlineStart: "12px", 
            marginBottom: expanded ? "16px" : "18px" 
          }}>
            <p style={{
                fontSize: "14px", color: "var(--color-foreground-secondary)", lineHeight: 1.6, margin: 0,
                ...(!expanded ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
              }}
            >
              {aiResponse.hook}
            </p>
          </div>

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
                <div style={{ 
                  paddingTop: "12px", borderTop: "1px solid var(--color-border)",
                  marginBottom: "16px"
                }}>
                  <p style={{ fontSize: "14px", color: "var(--color-foreground)", lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>
                    {aiResponse.body}
                  </p>
                </div>

                {/* CTA */}
                <div style={{
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-brand-surface)",
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
                  padding: "14px",
                  textAlign: "center",
                  marginBottom: "16px",
                }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "color-mix(in srgb, var(--color-brand-primary) 70%, var(--color-foreground))", margin: 0 }}>
                    {aiResponse.callToAction}
                  </p>
                </div>

                {/* Hashtags */}
                {aiResponse.hashtags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                    {aiResponse.hashtags.map((tag) => (
                      <span key={tag} style={{
                        padding: "4px 12px", borderRadius: "999px",
                        background: "color-mix(in srgb, var(--color-foreground) 4%, transparent)",
                        border: "1px solid var(--color-border)",
                        color: "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))",
                        fontSize: "12px", fontWeight: 600,
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Actions */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            {/* Copy button */}
            <button
              onClick={handleCopy}
              aria-label={t("copyContent")}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "999px",
                background: copied ? "color-mix(in srgb, var(--color-success) 10%, transparent)" : "color-mix(in srgb, var(--color-foreground) 4%, transparent)",
                border: copied ? "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)" : "1px solid var(--color-border)",
                color: copied ? "var(--color-success)" : "var(--color-foreground-secondary)",
                fontSize: "12px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s ease", fontFamily: "inherit",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t("copied") : t("copyContent")}
            </button>

            {/* Expand/collapse */}
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? t("collapse") : t("expand")}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "999px",
                background: "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
                color: "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))",
                fontSize: "12px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s ease", fontFamily: "inherit",
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? t("collapse") : t("expand")}
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
