"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { GeneratedContent } from "@/types/content";
import { RefreshCw, PenLine, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import HashtagList from "./HashtagList";
import CopyButton from "@/components/ui/CopyButton";
import CtaButton from "@/components/ui/CtaButton";
import { getTracker } from "@/lib/analytics/tracker";
import { useTranslations, useLocale } from "next-intl";
import type { Variants } from "framer-motion";

interface GenerationResultProps {
  content: GeneratedContent;
  onRegenerate: () => void;
  onStartOver: () => void;
  loading: boolean;
  isHistoryView?: boolean;
  onNextHistory?: () => void;
  onPrevHistory?: () => void;
  hasNextHistory?: boolean;
  hasPrevHistory?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94], staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function GenerationResult({
  content, onRegenerate, onStartOver, loading,
  isHistoryView, onNextHistory, onPrevHistory, hasNextHistory, hasPrevHistory,
}: GenerationResultProps) {
  const t = useTranslations("GenerationResult");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const tracker = getTracker();

  const handleSectionCopy = useCallback(() => {
    tracker.track("section_copied");
  }, [tracker]);

  const fullContent = [
    content.title, "",
    content.hook, "",
    content.body, "",
    content.callToAction, "",
    content.hashtags.map((tag) => `#${tag}`).join(" "),
  ].join("\n");

  const handleCopyAll = useCallback(() => {
    tracker.track("content_copied");
  }, [tracker]);

  return (
    <motion.div
      className="opaque-result-container"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="gr-header">
        {/* Status pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "var(--space-1-5)",
          padding: "var(--space-1-5) var(--space-3)",
          borderRadius: "var(--radius-full)",
          background: "var(--color-brand-surface)",
          border: "1px solid var(--color-brand-soft)",
          flexShrink: 0,
        }}>
          <span
            className="gr-status-dot"
            style={{
              width: "var(--space-1)", height: "var(--space-1)", borderRadius: "var(--radius-circle)",
              background: "var(--color-brand-primary)",
              boxShadow: "var(--shadow-glow)",
              display: "block",
            }}
          />
          <span style={{
            fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-bold)",
            color: "var(--color-brand-primary)", whiteSpace: "nowrap",
          }}>
            {t("readyContent")}
          </span>
        </div>

        {/* Actions */}
        <div className="gr-actions">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-0-5)", background: "var(--color-brand-surface)", borderRadius: "var(--radius-full)", padding: "var(--space-1)", border: "1px solid var(--color-border)" }}>
            <motion.button
              onClick={onPrevHistory}
              disabled={!hasPrevHistory}
              whileHover={hasPrevHistory ? { scale: 1.08 } : {}}
              whileTap={hasPrevHistory ? { scale: 0.92 } : {}}
              className="gr-nav-btn"
              style={{
                color: hasPrevHistory ? "var(--color-foreground)" : "var(--color-foreground-disabled)",
                cursor: hasPrevHistory ? "pointer" : "not-allowed",
                transition: "color var(--transition-fast)",
              }}
              aria-label="Previous"
            >
              {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </motion.button>

            <div style={{ width: "1px", height: "var(--space-4)", background: "var(--color-border)" }} />

            <motion.button
              onClick={onNextHistory}
              disabled={!hasNextHistory}
              whileHover={hasNextHistory ? { scale: 1.08 } : {}}
              whileTap={hasNextHistory ? { scale: 0.92 } : {}}
              className="gr-nav-btn"
              style={{
                color: hasNextHistory ? "var(--color-foreground)" : "var(--color-foreground-disabled)",
                cursor: hasNextHistory ? "pointer" : "not-allowed",
                transition: "color var(--transition-fast)",
              }}
              aria-label="Next"
            >
              {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </motion.button>
          </div>

          {/* Copy all button */}
          <CopyButton
            variant="pill"
            getText={() => fullContent}
            label={t("copyAll")}
            copiedLabel={t("copied")}
            onCopied={handleCopyAll}
          />
        </div>
      </motion.div>

      {/* ── Content ── */}
      <div style={{ padding: "var(--space-6) var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-weight-bold)", lineHeight: "var(--leading-tight)", margin: 0,
            color: "var(--color-foreground)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {content.title}
        </motion.h2>

        {/* Divider */}
        <motion.div variants={itemVariants} style={{
          height: "1px",
          background: "var(--gradient-divider)",
          borderRadius: "var(--radius-xs)",
          marginBlock: "calc(var(--space-1) * -1)",
        }} />

        {/* Hook */}
        <motion.div
          variants={itemVariants}
          style={{
            borderRadius: "var(--radius-lg)",
            background: "var(--color-brand-surface)",
            borderInlineStart: "3px solid var(--color-brand-primary)",
            padding: "var(--space-3-5) var(--space-4)",
            display: "flex", alignItems: "flex-start", gap: "var(--space-2)",
          }}
        >
          <Quote size={16}
            color="var(--color-brand-primary)"
            style={{ flexShrink: 0, marginTop: "var(--space-0-5)" }}
          />
          <p style={{
            fontSize: "var(--text-base)", fontWeight: "var(--font-weight-bold)", margin: 0, flex: 1,
            color: "var(--color-brand-primary)",
            lineHeight: "var(--leading-normal)",
          }}>
            {content.hook}
          </p>
        </motion.div>

        {/* Body */}
        <motion.p
          variants={itemVariants}
          style={{
            color: "var(--color-foreground-secondary)",
            fontSize: "var(--text-base)", lineHeight: "var(--leading-loose)",
            whiteSpace: "pre-wrap", margin: 0,
          }}
        >
          {content.body}
        </motion.p>

        {/* CTA */}
        <motion.div
          variants={itemVariants}
          style={{
            borderRadius: "var(--radius-lg)",
            background: "var(--color-brand-surface)",
            border: "1px dashed var(--color-brand-soft)",
            padding: "var(--space-5) var(--space-5)",
            textAlign: "center",
          }}
        >
          <p style={{
            fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-bold)", margin: 0,
            color: "var(--color-brand-primary)",
            lineHeight: "var(--leading-snug)",
          }}>
            {content.callToAction}
          </p>
        </motion.div>

        {/* Hashtags — title is rendered inside HashtagList */}
        <motion.div variants={itemVariants} style={{
          borderTop: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)",
          paddingTop: "var(--space-4)",
        }}>
          <HashtagList hashtags={content.hashtags} onCopy={handleSectionCopy} />
        </motion.div>
      </div>

      {/* ── Actions ── */}
      <motion.div
        variants={itemVariants}
        className="gr-actions-footer"
        style={{
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: "var(--radius-xl)",
        }}
      >
        {/* Regenerate */}
        {!isHistoryView && (
          <CtaButton
            onClick={() => { tracker.track("regeneration_requested"); onRegenerate(); }}
            disabled={loading}
            style={{ flex: 1, opacity: loading ? 0.5 : 1 }}
          >
            <RefreshCw size={18} />
            {t("rewrite")}
          </CtaButton>
        )}

        {/* Start over */}
        <motion.button
          onClick={onStartOver}
          disabled={loading}
          whileHover={!loading ? { scale: 1.02 } : undefined}
          whileTap={!loading ? { scale: 0.96 } : undefined}
          style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-foreground-secondary)", fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-base)",
            padding: "var(--space-3) var(--space-6)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            transition: "var(--transition-normal)", fontFamily: "inherit",
          }}
        >
          <PenLine size={14} />
          {t("newContent")}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
