"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { GeneratedContent } from "@/types/content";
import { Target, RefreshCw, PenLine, Copy, Check } from "lucide-react";
import HashtagList from "./HashtagList";
import { getTracker } from "@/lib/analytics/tracker";

interface GenerationResultProps {
  content: GeneratedContent;
  onRegenerate: () => void;
  onStartOver: () => void;
  loading: boolean;
}

const DARK_CARD: React.CSSProperties = {
  background: "rgba(12,14,24,0.8)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.05)",
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset, 0 0 40px rgba(124,58,237,0.04)",
  borderRadius: "20px",
  overflow: "hidden",
};

import type { Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
      staggerChildren: 0.15,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function GenerationResult({
  content, onRegenerate, onStartOver, loading,
}: GenerationResultProps) {
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
      style={DARK_CARD}
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(124,58,237,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8" }}>المحتوى الجاهز</span>
        </div>
        <button
          onClick={copyAll}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "8px",
            background: copiedAll ? "rgba(34,197,94,0.12)" : "rgba(124,58,237,0.12)",
            border: copiedAll ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(124,58,237,0.25)",
            color: copiedAll ? "#4ade80" : "#a78bfa",
            fontSize: "12px", fontWeight: 600, cursor: "pointer",
            transition: "all 0.2s ease",
            fontFamily: "inherit",
          }}
        >
          {copiedAll ? <Check size={13} /> : <Copy size={13} />}
          {copiedAll ? "تم النسخ" : "نسخ الكل"}
        </button>
      </motion.div>

      {/* ── Content ── */}
      <div style={{ padding: "28px 28px 24px", display: "flex", flexDirection: "column", gap: "24px" }} dir="rtl">

        {/* Title */}
        <motion.h2 variants={itemVariants} style={{
          fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 900, lineHeight: 1.25, margin: 0,
          background: "linear-gradient(to left, #a78bfa, #c7d2fe)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          textShadow: "0 2px 10px rgba(167, 139, 250, 0.2)"
        }}>
          {content.title}
        </motion.h2>

        {/* Hook */}
        <motion.div variants={itemVariants} style={{
          position: "relative", borderRadius: "14px", overflow: "hidden",
          background: "rgba(49, 46, 129, 0.2)", border: "1px solid rgba(99, 102, 241, 0.3)",
          padding: "16px 20px 16px 18px",
        }}>
          <div style={{
            position: "absolute", top: 0, right: 0, width: "3px", height: "100%",
            background: "linear-gradient(180deg, #7c3aed, #4f46e5)",
          }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", paddingRight: "8px" }}>
            <Target size={16} color="#a5b4fc" style={{ flexShrink: 0, marginTop: "3px" }} />
            <p style={{ fontSize: "15px", fontWeight: 500, fontStyle: "italic", color: "#e0e7ff", lineHeight: 1.7, margin: 0 }}>
              {content.hook}
            </p>
          </div>
        </motion.div>

        {/* Body */}
        <motion.p variants={itemVariants} style={{ color: "#e2e8f0", fontSize: "14px", lineHeight: 1.85, whiteSpace: "pre-wrap", margin: 0 }}>
          {content.body}
        </motion.p>

        {/* CTA */}
        <motion.div variants={itemVariants} style={{
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))",
          border: "1px solid rgba(124,58,237,0.3)",
          padding: "18px 20px",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(124,58,237,0.1)",
        }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "#e0e7ff", margin: 0 }}>
            {content.callToAction}
          </p>
        </motion.div>

        {/* Hashtags */}
        <motion.div variants={itemVariants} style={{ paddingTop: "4px" }}>
          <HashtagList hashtags={content.hashtags} onCopy={handleSectionCopy} />
        </motion.div>
      </div>

      {/* ── Actions ── */}
      <motion.div variants={itemVariants} style={{
        display: "flex", gap: "12px", flexWrap: "wrap",
        padding: "16px 24px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.2)",
      }}>
        <motion.button
          onClick={() => { tracker.track("regeneration_requested"); onRegenerate(); }}
          disabled={loading}
          whileHover={!loading ? { y: -2, boxShadow: "0 8px 25px rgba(124,58,237,0.5)" } : undefined}
          whileTap={!loading ? { scale: 0.97 } : undefined}
          style={{
            flex: 1, minWidth: "140px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            borderRadius: "10px", border: "none",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            color: "#fff", fontWeight: 700, fontSize: "13px",
            padding: "11px 16px", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
            transition: "all 0.2s ease", fontFamily: "inherit",
          }}
        >
          <RefreshCw size={14} />
          إعادة الكتابة
        </motion.button>
        <motion.button
          onClick={onStartOver}
          disabled={loading}
          whileHover={!loading ? { y: -2, boxShadow: "0 6px 20px rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.08)" } : undefined}
          whileTap={!loading ? { scale: 0.97 } : undefined}
          style={{
            flex: 1, minWidth: "140px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "#e2e8f0", fontWeight: 600, fontSize: "13px",
            padding: "11px 16px", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            transition: "all 0.2s ease", fontFamily: "inherit",
          }}
        >
          <PenLine size={14} />
          محتوى جديد
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
