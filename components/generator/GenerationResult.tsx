"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GeneratedContent } from "@/types/content";
import { RefreshCw, PenLine, Copy, Check, Quote } from "lucide-react";
import HashtagList from "./HashtagList";
import { getTracker } from "@/lib/analytics/tracker";
import { useTranslations } from "next-intl";
import type { Variants } from "framer-motion";

interface GenerationResultProps {
  content: GeneratedContent;
  onRegenerate: () => void;
  onStartOver: () => void;
  loading: boolean;
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
}: GenerationResultProps) {
  const t = useTranslations("GenerationResult");
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
        border: "1px solid color-mix(in srgb, var(--color-border) 80%, transparent)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        boxShadow: "0 2px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* ── Header ── */}
      <motion.div
        variants={itemVariants}
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Status pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 14px",
            borderRadius: "999px",
            background: "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
          }}>
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "var(--color-brand-primary)",
              boxShadow: "0 0 6px var(--color-brand-primary)",
              display: "block",
            }} />
            <span style={{
              fontSize: "12px", fontWeight: 700, letterSpacing: "0.03em",
              color: "color-mix(in srgb, var(--color-brand-primary) 80%, var(--color-foreground))",
            }}>
              {t("readyContent")}
            </span>
          </div>
        </div>

        {/* Copy all button */}
        <motion.button
          onClick={copyAll}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "999px",
            background: copiedAll
              ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
              : "color-mix(in srgb, var(--color-foreground) 5%, transparent)",
            border: `1px solid ${copiedAll
              ? "color-mix(in srgb, var(--color-success) 30%, transparent)"
              : "color-mix(in srgb, var(--color-foreground) 12%, transparent)"}`,
            color: copiedAll ? "var(--color-success)" : "var(--color-foreground-secondary)",
            fontSize: "12px", fontWeight: 600, cursor: "pointer",
            transition: "all 0.2s ease", fontFamily: "inherit",
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
      </motion.div>

      {/* ── Content ── */}
      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          style={{
            fontSize: "clamp(1.3rem, 2.8vw, 1.9rem)",
            fontWeight: 900, lineHeight: 1.3, margin: 0,
            color: "var(--color-foreground)",
            letterSpacing: "-0.02em",
          }}
        >
          {content.title}
        </motion.h2>

        {/* Divider */}
        <motion.div variants={itemVariants} style={{
          height: "1px",
          background: "linear-gradient(to right, color-mix(in srgb, var(--color-brand-primary) 30%, transparent), transparent)",
          borderRadius: "1px",
          marginBlock: "-4px",
        }} />

        {/* Hook */}
        <motion.div
          variants={itemVariants}
          style={{
            borderRadius: "var(--radius-lg)",
            background: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
            borderInlineStart: "3px solid var(--color-brand-primary)",
            padding: "14px 16px",
            display: "flex", alignItems: "flex-start", gap: "10px",
          }}
        >
          <Quote size={16}
            color="color-mix(in srgb, var(--color-brand-primary) 70%, var(--color-foreground))"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <p style={{
            fontSize: "15px", fontWeight: 700, margin: 0, flex: 1,
            color: "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))",
            lineHeight: 1.6,
          }}>
            {content.hook}
          </p>
        </motion.div>

        {/* Body */}
        <motion.p
          variants={itemVariants}
          style={{
            color: "var(--color-foreground-secondary)",
            fontSize: "14px", lineHeight: 1.9,
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
            background: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
            border: "1px dashed color-mix(in srgb, var(--color-brand-primary) 30%, transparent)",
            padding: "20px 20px",
            textAlign: "center",
          }}
        >
          <p style={{
            fontSize: "18px", fontWeight: 800, margin: 0,
            color: "color-mix(in srgb, var(--color-brand-primary) 65%, var(--color-foreground))",
            lineHeight: 1.5,
          }}>
            {content.callToAction}
          </p>
        </motion.div>

        {/* Hashtags — title is rendered inside HashtagList */}
        <motion.div variants={itemVariants} style={{
          borderTop: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)",
          paddingTop: "16px",
        }}>
          <HashtagList hashtags={content.hashtags} onCopy={handleSectionCopy} />
        </motion.div>
      </div>

      {/* ── Actions ── */}
      <motion.div
        variants={itemVariants}
        style={{
          display: "flex", gap: "10px",
          padding: "16px 16px",
          borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          background: "color-mix(in srgb, var(--color-foreground) 3%, transparent)",
          marginTop: "2px",
        }}
      >
          {/* Regenerate */}
          <motion.button
            onClick={() => { tracker.track("regeneration_requested"); onRegenerate(); }}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02, boxShadow: "var(--shadow-brand)" } : undefined}
            whileTap={!loading ? { scale: 0.96 } : undefined}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
              borderRadius: "12px", border: "none",
              background: "var(--gradient-brand)",
              color: "white", fontWeight: 700, fontSize: "13px",
              padding: "12px 16px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              boxShadow: "var(--shadow-brand)",
              transition: "all 0.2s ease", fontFamily: "inherit",
            }}
          >
            <RefreshCw size={14} />
            {t("rewrite")}
          </motion.button>

          {/* Start over */}
          <motion.button
            onClick={onStartOver}
            disabled={loading}
            whileHover={!loading ? {
              scale: 1.02,
              background: "color-mix(in srgb, var(--color-foreground) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--color-foreground) 22%, transparent)",
            } : undefined}
            whileTap={!loading ? { scale: 0.96 } : undefined}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
              borderRadius: "12px",
              border: "1px solid color-mix(in srgb, var(--color-border) 80%, transparent)",
              background: "transparent",
              color: "var(--color-foreground-secondary)", fontWeight: 600, fontSize: "13px",
              padding: "12px 16px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "all 0.2s ease", fontFamily: "inherit",
            }}
          >
            <PenLine size={14} />
            {t("newContent")}
          </motion.button>
      </motion.div>
    </motion.div>
  );
}
