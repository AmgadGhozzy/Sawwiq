"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import type { GenerationHistoryItem } from "@/types/history";

interface HistoryCardProps {
  item: GenerationHistoryItem;
  isLast?: boolean;
  locale?: string;
  onOpen?: () => void;
}

export default function HistoryCard({ item, isLast, locale, onOpen }: HistoryCardProps) {
  const t = useTranslations("HistoryDrawer");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { platform, contentType, arabicStyle, prompt, aiResponse, createdAt } = item;

  const handleCopy = async () => {
    const textToCopy = [
      aiResponse.title,
      "",
      aiResponse.hook,
      "",
      aiResponse.body,
      "",
      aiResponse.callToAction,
      "",
      (aiResponse.hashtags || []).map((h: string) => `#${h}`).join(" "),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = textToCopy;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return locale === "en" ? "Just now" : "الآن";
      if (diffMins < 60) return locale === "en" ? `${diffMins}m ago` : `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return locale === "en" ? `${diffHours}h ago` : `منذ ${diffHours} ساعة`;
      if (diffDays < 7) return locale === "en" ? `${diffDays}d ago` : `منذ ${diffDays} يوم`;
      return date.toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div style={{ marginBottom: isLast ? "0" : "12px" }}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <div style={{ padding: "16px" }}>
          {/* Header tags */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {/* Platform badge */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "3px 8px", borderRadius: "6px",
                background: "color-mix(in srgb, var(--color-foreground) 4%, transparent)",
                border: "1px solid var(--color-border)",
                fontSize: "11px", fontWeight: 600, color: "var(--color-foreground)",
              }}>
                <PlatformIcon platform={platform} />
                <span style={{ textTransform: "capitalize" }}>{platform.replace("_", " ")}</span>
              </span>

              {/* Content type */}
              <span style={{
                padding: "3px 8px", borderRadius: "6px",
                background: "var(--color-brand-surface)",
                border: "1px solid color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
                fontSize: "11px", fontWeight: 600,
                color: "var(--color-brand-primary)",
              }}>
                {contentType.replace(/_/g, " ")}
              </span>

              {/* Dialect */}
              <span style={{
                padding: "3px 8px", borderRadius: "6px",
                background: "color-mix(in srgb, var(--color-foreground) 3%, transparent)",
                border: "1px solid var(--color-border)",
                fontSize: "11px", color: "var(--color-foreground-secondary)",
              }}>
                {arabicStyle.replace(/_/g, " ")}
              </span>
            </div>

            {/* Date */}
            <span style={{ fontSize: "11px", color: "var(--color-foreground-disabled)", whiteSpace: "nowrap" }}>
              {formatDate(createdAt)}
            </span>
          </div>

          {/* Title */}
          <h4 style={{
            fontSize: "14px", fontWeight: 700, color: "var(--color-foreground)",
            margin: "0 0 8px", lineHeight: 1.5,
          }}>
            {aiResponse.title}
          </h4>

          {/* Hook preview */}
          <p style={{
            fontSize: "13px", color: "var(--color-foreground-secondary)",
            margin: "0 0 12px", lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
            borderInlineStart: "2px solid var(--color-brand-primary)",
            paddingInlineStart: "10px",
          }}>
            {aiResponse.hook}
          </p>

          {/* Expanded full content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                {/* Prompt */}
                {prompt && (
                  <div style={{
                    padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    background: "color-mix(in srgb, var(--color-foreground) 2%, transparent)",
                    border: "1px solid var(--color-border)",
                    marginBottom: "12px",
                  }}>
                    <span style={{ fontSize: "11px", color: "var(--color-foreground-disabled)", display: "block", marginBottom: "2px" }}>
                      {locale === "en" ? "Prompt:" : "المدخلات:"}
                    </span>
                    <p style={{ fontSize: "12px", color: "var(--color-foreground-secondary)", margin: 0 }}>
                      {prompt}
                    </p>
                  </div>
                )}

                {/* Body */}
                <div style={{
                  fontSize: "13px", color: "var(--color-foreground)",
                  lineHeight: 1.7, marginBottom: "12px",
                  whiteSpace: "pre-line",
                }}>
                  {aiResponse.body}
                </div>

                {/* CTA */}
                <div style={{
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-brand-surface)",
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
                  padding: "10px 12px",
                  textAlign: "center",
                  marginBottom: "12px",
                }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-brand-primary)", margin: 0 }}>
                    {aiResponse.callToAction}
                  </p>
                </div>

                {/* Hashtags */}
                {aiResponse.hashtags && aiResponse.hashtags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                    {aiResponse.hashtags.map((tag: string) => (
                      <span key={tag} style={{
                        padding: "3px 10px", borderRadius: "6px",
                        background: "color-mix(in srgb, var(--color-foreground) 4%, transparent)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-brand-primary)",
                        fontSize: "11px", fontWeight: 500,
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Actions — Sleek Linear/Raycast Style */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "12px",
            borderTop: "1px solid var(--color-border)",
            gap: "8px",
          }}>
            {/* Primary Action: Open in Generator */}
            {onOpen && (
              <button
                type="button"
                onClick={onOpen}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-brand-soft)",
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 30%, transparent)",
                  color: "var(--color-foreground)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "color-mix(in srgb, var(--color-brand-primary) 25%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--color-brand-soft)";
                }}
              >
                <ExternalLink size={13} color="var(--color-brand-primary)" />
                <span>{t("openInGenerator")}</span>
              </button>
            )}

            {/* Secondary Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-md)",
                  background: copied ? "color-mix(in srgb, var(--color-success) 12%, transparent)" : "transparent",
                  border: "1px solid var(--color-border)",
                  color: copied ? "var(--color-success)" : "var(--color-foreground-secondary)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!copied) e.currentTarget.style.background = "color-mix(in srgb, var(--color-foreground) 4%, transparent)";
                }}
                onMouseLeave={(e) => {
                  if (!copied) e.currentTarget.style.background = "transparent";
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? t("copied") : t("copyContent")}</span>
              </button>

              {/* Expand/collapse button */}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground-secondary)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "color-mix(in srgb, var(--color-foreground) 4%, transparent)";
                }}
                onMouseLeave={(e) => {
                  if (!copied) e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{expanded ? t("collapse") : t("expand")}</span>
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
