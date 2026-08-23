"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

type ShowcaseSample = {
  platform: string;
  label: string;
  contentType: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
};

// Maps platform key → CSS variable name (from design system tokens in globals.css)
const PLATFORM_COLOR_VAR: Record<string, string> = {
  instagram: "var(--color-instagram)",
  x:         "var(--color-x-twitter)",
  linkedin:  "var(--color-linkedin)",
  tiktok:    "var(--color-tiktok)",
  facebook:  "var(--color-facebook)",
};

export default function OutputShowcase() {
  const t = useTranslations("Showcase");
  const samples = t.raw("samples") as ShowcaseSample[];
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const sample = samples[active];
  const platformColor = PLATFORM_COLOR_VAR[sample.platform] ?? "var(--color-brand-primary)";
  // Opacity helpers using CSS color-mix (no raw hex needed)
  const platformAlpha12 = `color-mix(in srgb, ${platformColor} 12%, transparent)`;
  const platformAlpha18 = `color-mix(in srgb, ${platformColor} 18%, transparent)`;
  const platformAlpha30 = `color-mix(in srgb, ${platformColor} 30%, transparent)`;

  function handleCopy() {
    const text = [sample.title, sample.hook, sample.body, sample.cta, sample.hashtags.map(h => `#${h}`).join(" ")].join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      aria-label={t("title")}
      style={{
        position: "relative",
        maxWidth: "980px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-10)",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
          padding: "var(--space-1-5) var(--space-4)", borderRadius: "var(--radius-full)",
          background: "var(--color-brand-surface)",
          border: "1px solid var(--color-brand-soft)",
          marginBottom: "var(--space-5)",
        }}>
          <Sparkles size={13} color="var(--color-brand-light)" />
          <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-brand-light)", letterSpacing: "0.04em" }}>
            {t("badge")}
          </span>
        </div>
        <h2 style={{
          fontSize: "var(--text-4xl)", fontWeight: "var(--font-weight-black)",
          color: "var(--color-foreground)", letterSpacing: "-0.03em",
          margin: "0 0 var(--space-4)", lineHeight: "var(--leading-tight)",
        }}>
          {t("title")}
        </h2>
        <p style={{
          fontSize: "var(--text-md)", color: "var(--color-foreground-secondary)",
          maxWidth: "480px", margin: "0 auto", lineHeight: "var(--leading-relaxed)",
        }}>
          {t("subtitle")}
        </p>
      </div>

      {/* ── Main showcase panel ── */}
      <div style={{
        width: "100%",
        borderRadius: "var(--radius-2xl)",
        border: "1px solid var(--color-border)",
        background: "var(--gradient-surface)",
        backdropFilter: "blur(40px) saturate(160%)",
        WebkitBackdropFilter: "blur(40px) saturate(160%)",
        boxShadow: "var(--shadow-elevated)",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "220px 1fr",
      }}
      className="showcase-panel"
      >
        {/* Left sidebar — platform list */}
        <div style={{
          borderInlineEnd: "1px solid var(--color-border)",
          padding: "var(--space-6) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          background: "rgba(0,0,0,0.15)",
        }}>
          <p style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-foreground-disabled)",
            fontWeight: "var(--font-weight-semibold)",
            letterSpacing: "0.07em",
            marginBottom: "var(--space-2)",
            paddingInlineStart: "var(--space-3)",
          }}>
            المنصة
          </p>
          {samples.map((s, i) => {
            const sColor = PLATFORM_COLOR_VAR[s.platform] ?? "var(--color-brand-primary)";
            const sAlpha18 = `color-mix(in srgb, ${sColor} 18%, transparent)`;
            return (
              <button
                key={s.platform}
                role="tab"
                aria-selected={i === active}
                onClick={() => { setActive(i); setCopied(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2-5) var(--space-3)",
                  borderRadius: "var(--radius-lg)",
                  border: "none",
                  background: i === active ? sAlpha18 : "transparent",
                  color: i === active ? "var(--color-foreground)" : "var(--color-foreground-tertiary)",
                  fontSize: "var(--text-sm)",
                  fontWeight: i === active ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
                  cursor: "pointer",
                  transition: "var(--transition-normal)",
                  textAlign: "start",
                  width: "100%",
                  position: "relative",
                }}
              >
                {i === active && (
                  <div style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    top: "20%",
                    bottom: "20%",
                    width: "3px",
                    borderRadius: "var(--radius-full)",
                    background: sColor,
                    boxShadow: `0 0 8px ${sAlpha18}`,
                  }} />
                )}
                <PlatformIcon platform={s.platform} size={16} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Right content pane */}
        <div style={{ position: "relative", minHeight: "380px" }}>
          {/* Top bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-4) var(--space-7)",
            borderBottom: "1px solid var(--color-border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: platformColor,
                boxShadow: `0 0 8px ${platformAlpha30}`,
              }} />
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-foreground-secondary)",
                fontWeight: "var(--font-weight-medium)",
              }}>
                {sample.contentType}
              </span>
            </div>
            <button
              onClick={handleCopy}
              style={{
                display: "inline-flex", alignItems: "center", gap: "var(--space-1-5)",
                padding: "var(--space-1-5) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: copied ? "var(--color-success-surface)" : "rgba(255,255,255,0.03)",
                color: copied ? "var(--color-success)" : "var(--color-foreground-tertiary)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-weight-medium)",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "تم النسخ" : "نسخ"}
            </button>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.article
              key={sample.platform}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                padding: "var(--space-7)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-5)",
              }}
            >
              {/* Title + Hook */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <h3 style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: "var(--font-weight-extrabold)",
                  color: "var(--color-foreground)",
                  margin: 0,
                  lineHeight: "var(--leading-snug)",
                }}>
                  {sample.title}
                </h3>
                <p style={{
                  fontSize: "var(--text-base)",
                  fontWeight: "var(--font-weight-semibold)",
                  color: platformColor,
                  margin: 0,
                  lineHeight: "var(--leading-normal)",
                  opacity: 0.9,
                }}>
                  {sample.hook}
                </p>
              </div>

              {/* Body */}
              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-secondary)",
                lineHeight: "var(--leading-loose)",
                margin: 0,
                whiteSpace: "pre-line",
              }}>
                {sample.body}
              </p>

              {/* CTA */}
              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-disabled)",
                fontWeight: "var(--font-weight-semibold)",
                margin: 0,
                paddingTop: "var(--space-2)",
                borderTop: "1px dashed var(--color-border)",
              }}>
                {sample.cta}
              </p>

              {/* Hashtags */}
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {sample.hashtags.map((tag) => (
                  <span key={tag} style={{
                    padding: "3px 10px",
                    borderRadius: "var(--radius-full)",
                    background: platformAlpha12,
                    border: `1px solid ${platformAlpha30}`,
                    color: platformColor,
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-weight-semibold)",
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>

      {/* Responsive override */}
      <style>{`
        @media (max-width: 640px) {
          .showcase-panel {
            grid-template-columns: 1fr !important;
          }
          .showcase-panel > div:first-child {
            flex-direction: row !important;
            overflow-x: auto;
            border-inline-end: none !important;
            border-bottom: 1px solid var(--color-border) !important;
            padding: var(--space-3) var(--space-4) !important;
          }
        }
      `}</style>
    </motion.section>
  );
}
