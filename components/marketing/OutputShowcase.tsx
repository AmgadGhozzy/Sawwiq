"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import CopyButton from "@/components/ui/CopyButton";

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
  const sample = samples[active];
  const platformColor = PLATFORM_COLOR_VAR[sample.platform] ?? "var(--color-brand-primary)";
  // Opacity helpers using CSS color-mix (no raw hex needed)
  const platformAlpha12 = `color-mix(in srgb, ${platformColor} 12%, transparent)`;
  const platformAlpha30 = `color-mix(in srgb, ${platformColor} 30%, transparent)`;

  // Roving tabindex refs for arrow-key tab navigation (direction-aware)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusTab = (i: number) => {
    const n = (i + samples.length) % samples.length;
    setActive(n);
    tabRefs.current[n]?.focus();
  };
  const onTabKeyDown = (e: React.KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === "ArrowRight") { e.preventDefault(); focusTab(i + (rtl ? -1 : 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusTab(i + (rtl ? 1 : -1)); }
    else if (e.key === "Home") { e.preventDefault(); focusTab(0); }
    else if (e.key === "End") { e.preventDefault(); focusTab(samples.length - 1); }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
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
      <div style={{ textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
          padding: "var(--space-1-5) var(--space-4)", borderRadius: "var(--radius-full)",
          background: "var(--color-brand-surface)",
          border: "1px solid var(--color-brand-soft)",
          marginBottom: "var(--space-5)",
        }}>
          <Sparkles size={13} color="var(--color-brand-light)" />
          <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-brand-light)", letterSpacing: "var(--tracking-caps)" }}>
            {t("badge")}
          </span>
        </div>
        <h2 style={{
          fontSize: "var(--text-4xl)", fontWeight: "var(--font-weight-bold)",
          color: "var(--color-foreground)", letterSpacing: "var(--tracking-tight)",
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

      <div style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        borderRadius: "var(--radius-2xl)",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "220px 1fr",
      }}
      className="showcase-panel glass-card"
      >
        {/* Left sidebar — platform list */}
        <div style={{
          borderInlineEnd: "1px solid var(--color-border)",
          padding: "var(--space-6) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          background: "color-mix(in srgb, var(--color-background) 45%, transparent)",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}>
          <p className="platform-label" style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-foreground-disabled)",
            fontWeight: "var(--font-weight-semibold)",
            letterSpacing: "var(--tracking-caps)",
            marginBottom: "var(--space-2)",
            paddingInlineStart: "var(--space-3)",
          }}>
            {t("platformTabLabel")}
          </p>
          <div role="tablist" aria-label={t("platformTabLabel")} className="platforms-list" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0, maxWidth: "100%" }}>
            {samples.map((s, i) => {
            const sColor = PLATFORM_COLOR_VAR[s.platform] ?? "var(--color-brand-primary)";
            const sAlpha18 = `color-mix(in srgb, ${sColor} 18%, transparent)`;
            return (
              <button
                key={s.platform}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                aria-selected={i === active}
                aria-controls="showcase-tabpanel"
                tabIndex={i === active ? 0 : -1}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                onClick={() => { setActive(i); }}
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
                  width: "auto",
                  position: "relative",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
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
        </div>

        {/* Right content pane */}
        <div style={{ position: "relative", minHeight: "380px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
          <div className="showcase-topbar" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            padding: "var(--space-4) var(--space-7)",
            borderBottom: "1px solid var(--color-border)",
            boxSizing: "border-box",
            maxWidth: "100%",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0, flex: "1 1 auto" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "var(--radius-circle)",
                background: platformColor,
                boxShadow: `0 0 8px ${platformAlpha30}`,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-foreground-secondary)",
                fontWeight: "var(--font-weight-medium)",
                minWidth: 0,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}>
                {sample.contentType}
              </span>
            </div>
            <CopyButton
              variant="ghost"
              getText={() => [sample.title, sample.hook, sample.body, sample.cta, sample.hashtags.map(h => `#${h}`).join(" ")].join("\n\n")}
              label={t("copy")}
              copiedLabel={t("copied")}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.article
              key={sample.platform}
              id="showcase-tabpanel"
              role="tabpanel"
              className="showcase-article"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                padding: "var(--space-7)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-5)",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0, maxWidth: "100%" }}>
                <h3 style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-foreground)",
                  margin: 0,
                  lineHeight: "var(--leading-snug)",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}>
                  {sample.title}
                </h3>
                <p style={{
                  fontSize: "var(--text-base)",
                  fontWeight: "var(--font-weight-semibold)",
                  color: platformColor,
                  margin: 0,
                  lineHeight: "var(--leading-normal)",
                  opacity: "var(--opacity-faint)",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}>
                  {sample.hook}
                </p>
              </div>

              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-secondary)",
                lineHeight: "var(--leading-loose)",
                margin: 0,
                whiteSpace: "pre-line",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                maxWidth: "100%",
              }}>
                {sample.body}
              </p>

              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-foreground-disabled)",
                fontWeight: "var(--font-weight-semibold)",
                margin: 0,
                paddingTop: "var(--space-2)",
                borderTop: "1px dashed var(--color-border)",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                maxWidth: "100%",
              }}>
                {sample.cta}
              </p>

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {sample.hashtags.map((tag) => (
                  <span key={tag} style={{
                    padding: "var(--space-1) var(--space-2-5)",
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
            grid-template-columns: minmax(0, 1fr) !important;
            max-width: 100%;
          }
          .showcase-panel > div {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .platform-label {
            display: none !important;
          }
          .showcase-panel > div:first-child {
            border-inline-end: none !important;
            border-bottom: 1px solid var(--color-border) !important;
            padding: var(--space-4) !important;
          }
          .platforms-list::-webkit-scrollbar {
            display: none;
          }
          .platforms-list {
            flex-direction: row !important;
            overflow-x: auto;
            overflow-y: hidden;
            max-width: 100%;
            scrollbar-width: none;
            -ms-overflow-style: none;
            gap: var(--space-2) !important;
            padding-bottom: var(--space-1);
          }
          .showcase-topbar {
            padding: var(--space-3) var(--space-4) !important;
          }
          .showcase-article {
            padding: var(--space-5) var(--space-4) !important;
            gap: var(--space-4) !important;
          }
        }
      `}</style>
    </motion.section>
  );
}
