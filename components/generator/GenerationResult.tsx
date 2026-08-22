"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GeneratedContent } from "@/types/content";
import { RefreshCw, PenLine, Copy, Check, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import HashtagList from "./HashtagList";
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
  const [copiedAll, setCopiedAll] = useState(false);
  const tracker = getTracker();

  const handleSectionCopy = useCallback(() => {
    tracker.track("section_copied");
  }, [tracker]);

  const copyAll = useCallback(async () => {
    const fullContent = [
      content.title, "",
      content.hook, "",
      content.body, "",
      content.callToAction, "",
      content.hashtags.map((tag) => `#${tag}`).join(" "),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(fullContent);
      setCopiedAll(true);
      tracker.track("content_copied");
      setTimeout(() => setCopiedAll(false), 2500);
    } catch { /* silent */ }
  }, [content, tracker]);

  return (
    <motion.div
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
      <motion.div
        variants={itemVariants}
        style={{
          padding: "var(--space-3-5) var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Status pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-1)",
            padding: "var(--space-1-5) var(--space-3-5)",
            borderRadius: "var(--radius-full)",
            background: "var(--color-brand-surface)",
            border: "1px solid var(--color-brand-soft)",
          }}>
            <span style={{
              width: "5px", height: "5px", borderRadius: "var(--radius-circle)",
              background: "var(--color-brand-primary)",
              boxShadow: "var(--shadow-glow)",
              display: "block",
            }} />
            <span style={{
              fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-bold)", letterSpacing: "0.03em",
              color: "var(--color-brand-primary)",
            }}>
              {t("readyContent")}
            </span>
          </div>
        </div>

        {/* Actions right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", background: "var(--color-brand-surface)", borderRadius: "var(--radius-full)", padding: "var(--space-0-5)", border: "1px solid var(--color-border)" }}>
            <motion.button
              onClick={onPrevHistory}
              disabled={!hasPrevHistory}
              whileHover={hasPrevHistory ? { scale: 1.1 } : {}}
              whileTap={hasPrevHistory ? { scale: 0.9 } : {}}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "var(--space-6)", height: "var(--space-6)", borderRadius: "var(--radius-circle)", border: "none",
                background: "transparent",
                color: hasPrevHistory ? "var(--color-foreground)" : "var(--color-foreground-disabled)",
                cursor: hasPrevHistory ? "pointer" : "not-allowed",
                transition: "color var(--transition-fast)",
              }}
              aria-label="Previous"
            >
              {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </motion.button>

            <div style={{ width: "1px", height: "var(--space-3)", background: "var(--color-border)" }} />

            <motion.button
              onClick={onNextHistory}
              disabled={!hasNextHistory}
              whileHover={hasNextHistory ? { scale: 1.1 } : {}}
              whileTap={hasNextHistory ? { scale: 0.9 } : {}}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "var(--space-6)", height: "var(--space-6)", borderRadius: "var(--radius-circle)", border: "none",
                background: "transparent",
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
          <motion.button
            onClick={copyAll}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-1)",
              padding: "var(--space-1-5) var(--space-3-5)", borderRadius: "var(--radius-full)",
              background: copiedAll
                ? "var(--color-success-surface)"
                : "var(--color-brand-surface)",
              border: `1px solid ${copiedAll
                ? "var(--color-success-border)"
                : "var(--color-brand-soft)"}`,
              color: copiedAll ? "var(--color-success)" : "var(--color-brand-primary)",
              fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)", cursor: "pointer",
              transition: "var(--transition-normal)", fontFamily: "inherit",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copiedAll ? (
                <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: "flex" }}>
                  <Check size={12} />
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: "flex" }}>
                  <Copy size={12} />
                </motion.span>
              )}
            </AnimatePresence>
            {copiedAll ? t("copied") : t("copyAll")}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Content ── */}
      <div style={{ padding: "var(--space-6) var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-weight-black)", lineHeight: "var(--leading-tight)", margin: 0,
            color: "var(--color-foreground)",
            letterSpacing: "-0.02em",
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
            fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-extrabold)", margin: 0,
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
        style={{
          display: "flex", gap: "var(--space-2)",
          padding: "var(--space-4) var(--space-4)",
          borderTop: "1px solid var(--color-border)",
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: "var(--radius-xl)",
          background: "var(--color-brand-surface)",
          marginTop: "var(--space-0-5)",
        }}
      >
        {/* Regenerate */}
        {!isHistoryView && (
          <motion.button
            onClick={() => { tracker.track("regeneration_requested"); onRegenerate(); }}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02, boxShadow: "var(--shadow-brand)" } : undefined}
            whileTap={!loading ? { scale: 0.96 } : undefined}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-1-5)",
              borderRadius: "var(--radius-lg)", border: "none",
              background: "var(--gradient-brand)",
              color: "var(--color-foreground-inverse)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--text-sm)",
              padding: "var(--space-3) var(--space-4)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              boxShadow: "var(--shadow-brand)",
              transition: "var(--transition-normal)", fontFamily: "inherit",
            }}
          >
            <RefreshCw size={14} />
            {t("rewrite")}
          </motion.button>
        )}

        {/* Start over */}
        <motion.button
          onClick={onStartOver}
          disabled={loading}
          whileHover={!loading ? {
            scale: 1.02,
            background: "var(--color-brand-surface)",
            borderColor: "var(--color-brand-soft)",
          } : undefined}
          whileTap={!loading ? { scale: 0.96 } : undefined}
          style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-1-5)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-foreground-secondary)", fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-sm)",
            padding: "var(--space-3) var(--space-4)",
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
