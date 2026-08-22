"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
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
  const t = useTranslations("History");
  const tLabel = useTranslations("Labels");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { platform, contentType, arabicStyle, prompt, aiResponse, createdAt } = item;

  const contentTypeLabel = tLabel.has(`contentTypes.${contentType}`)
    ? tLabel(`contentTypes.${contentType}`)
    : contentType.replace(/_/g, " ");
  const arabicStyleLabel = tLabel.has(`arabicStyles.${arabicStyle}`)
    ? tLabel(`arabicStyles.${arabicStyle}`)
    : arabicStyle.replace(/_/g, " ");

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <div style={{ marginBottom: isLast ? "0" : "var(--space-3)" }}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setExpanded((v) => !v)}
        style={{
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
          cursor: "pointer",
          transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
        }}
      >
        <div style={{ padding: "var(--space-4)" }}>
          {/* Header tags */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexWrap: "wrap" }}>
              {/* Platform icon only */}
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "var(--space-6)", height: "var(--space-6)", borderRadius: "var(--radius-sm)",
                background: "var(--color-brand-surface)",
                border: "1px solid var(--color-border)",
              }}>
                <PlatformIcon platform={platform} />
              </span>

              {/* Content type */}
              <span style={{
                padding: "var(--space-0-5) var(--space-2)", borderRadius: "var(--radius-sm)",
                background: "var(--color-brand-surface)",
                border: "1px solid var(--color-brand-soft)",
                fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)",
                color: "var(--color-brand-primary)",
              }}>
                {contentTypeLabel}
              </span>

              {/* Dialect */}
              <span style={{
                padding: "var(--space-0-5) var(--space-2)", borderRadius: "var(--radius-sm)",
                background: "var(--color-brand-surface)",
                border: "1px solid var(--color-border)",
                fontSize: "var(--text-xs)", color: "var(--color-foreground-secondary)",
              }}>
                {arabicStyleLabel}
              </span>
            </div>

            {/* Date */}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-disabled)", whiteSpace: "nowrap" }}>
              {formatDate(createdAt)}
            </span>
          </div>

          {/* Title */}
          <h4 style={{
            fontSize: "var(--text-base)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground)",
            margin: "0 0 var(--space-2)", lineHeight: "var(--leading-normal)",
          }}>
            {aiResponse.title}
          </h4>

          {/* Hook preview */}
          <p style={{
            fontSize: "var(--text-sm)", color: "var(--color-foreground-secondary)",
            margin: "0 0 var(--space-3)", lineHeight: "var(--leading-relaxed)",
            display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
            borderInlineStart: "2px solid var(--color-brand-primary)",
            paddingInlineStart: "var(--space-2-5)",
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
                    padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)",
                    background: "var(--color-brand-surface)",
                    border: "1px solid var(--color-border)",
                    marginBottom: "var(--space-3)",
                  }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-disabled)", display: "block", marginBottom: "var(--space-0-5)" }}>
                      {locale === "en" ? "Prompt:" : "المدخلات:"}
                    </span>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-secondary)", margin: 0 }}>
                      {prompt}
                    </p>
                  </div>
                )}

                {/* Body */}
                <div style={{
                  fontSize: "var(--text-sm)", color: "var(--color-foreground)",
                  lineHeight: "var(--leading-relaxed)", marginBottom: "var(--space-3)",
                  whiteSpace: "pre-line",
                }}>
                  {aiResponse.body}
                </div>

                {/* CTA */}
                <div style={{
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-brand-surface)",
                  border: "1px solid var(--color-brand-soft)",
                  padding: "var(--space-2-5) var(--space-3)",
                  textAlign: "center",
                  marginBottom: "var(--space-3)",
                }}>
                  <p style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-brand-primary)", margin: 0 }}>
                    {aiResponse.callToAction}
                  </p>
                </div>

                {/* Hashtags */}
                {aiResponse.hashtags && aiResponse.hashtags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginBottom: "var(--space-3)" }}>
                    {aiResponse.hashtags.map((tag: string) => (
                      <span key={tag} style={{
                        padding: "var(--space-0-5) var(--space-2-5)", borderRadius: "var(--radius-sm)",
                        background: "var(--color-brand-surface)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-brand-primary)",
                        fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)",
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
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--color-border)",
            gap: "var(--space-2)",
          }}>
            {/* Primary Action: Open in Generator */}
            {onOpen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "var(--space-1-5) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-brand-soft)",
                  border: "1px solid var(--color-brand-soft)",
                  color: "var(--color-foreground)",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--font-weight-semibold)",
                  cursor: "pointer",
                  transition: "var(--transition-fast)",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--color-brand-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--color-brand-soft)";
                }}
              >
                <ExternalLink size={13} color="var(--color-brand-primary)" />
                <span>{t("openInGenerator")}</span>
              </button>
            )}

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1-5)",
                padding: "var(--space-1-5) var(--space-2-5)",
                borderRadius: "var(--radius-md)",
                background: copied ? "var(--color-success-surface)" : "transparent",
                border: "1px solid var(--color-border)",
                color: copied ? "var(--color-success)" : "var(--color-foreground-secondary)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-weight-medium)",
                cursor: "pointer",
                transition: "var(--transition-fast)",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!copied) e.currentTarget.style.background = "var(--color-surface-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!copied) e.currentTarget.style.background = "transparent";
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? t("copied") : t("copyContent")}</span>
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
