"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
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

export default function OutputShowcase() {
  const t = useTranslations("Showcase");
  const samples = t.raw("samples") as ShowcaseSample[];
  const [active, setActive] = useState(0);
  const sample = samples[active];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      aria-label={t("title")}
      style={{
        position: "relative",
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-6)",
      }}
    >
      {/* Heading */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-1-5) var(--space-4)", borderRadius: "var(--radius-full)",
            background: "var(--color-brand-surface)",
            border: "1px solid var(--color-brand-soft)",
            marginBottom: "var(--space-4)",
          }}
        >
          <Sparkles size={14} color="var(--color-brand-light)" />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-brand-light)" }}>
            {t("badge")}
          </span>
        </div>
        <h2 style={{
          fontSize: "var(--text-2xl)", fontWeight: "var(--font-weight-black)",
          color: "var(--color-foreground)", letterSpacing: "-0.5px", margin: "0 0 var(--space-3)",
        }}>
          {t("title")}
        </h2>
        <p style={{
          fontSize: "var(--text-base)", color: "var(--color-foreground-secondary)",
          maxWidth: "var(--container-md)", margin: "0 auto", lineHeight: 1.8,
        }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Platform tabs */}
      <div role="tablist" style={{
        display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center",
      }}>
        {samples.map((s, i) => (
          <button
            key={s.platform}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-4-5)", borderRadius: "var(--radius-full)",
              border: i === active
                ? "1px solid var(--color-brand-soft)"
                : "1px solid var(--color-border)",
              background: i === active ? "var(--color-brand-surface)" : "transparent",
              color: i === active ? "var(--color-brand-primary)" : "var(--color-foreground-disabled)",
              fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)",
              cursor: "pointer", transition: "var(--transition-normal)",
            }}
          >
            <PlatformIcon platform={s.platform} size={15} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Sample card */}
      <AnimatePresence mode="wait">
        <motion.article
          key={sample.platform}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{
            width: "100%",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border)",
            background: "var(--gradient-surface)",
            backdropFilter: "blur(50px) saturate(160%)",
            WebkitBackdropFilter: "blur(50px) saturate(160%)",
            boxShadow: "var(--shadow-elevated)",
            padding: "var(--space-8) var(--space-7)",
            display: "flex", flexDirection: "column", gap: "var(--space-4)",
          }}
        >
          <span style={{
            alignSelf: "flex-start",
            padding: "var(--space-0-5) var(--space-2-5)", borderRadius: "var(--radius-sm)",
            background: "var(--color-brand-surface)",
            border: "1px solid var(--color-brand-soft)",
            fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)",
            color: "var(--color-brand-primary)",
          }}>
            {sample.contentType}
          </span>

          <div>
            <h3 style={{
              fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-extrabold)", color: "var(--color-foreground)",
              margin: "0 0 var(--space-2)", lineHeight: 1.4,
            }}>
              {sample.title}
            </h3>
            <p style={{
              fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)",
              color: "var(--color-brand-primary)", margin: 0, lineHeight: 1.7,
            }}>
              {sample.hook}
            </p>
          </div>

          <p style={{
            fontSize: "var(--text-base)", color: "var(--color-foreground-secondary)",
            lineHeight: "var(--leading-loose)", margin: 0, whiteSpace: "pre-line",
          }}>
            {sample.body}
          </p>

          <p style={{
            fontSize: "var(--text-base)", color: "var(--color-foreground-disabled)",
            fontWeight: "var(--font-weight-semibold)", margin: 0,
          }}>
            {sample.cta}
          </p>

          <div style={{
            display: "flex", gap: "var(--space-2)", flexWrap: "wrap",
            paddingTop: "var(--space-2)",
            borderTop: "1px solid var(--color-border)",
          }}>
            {sample.hashtags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-full)",
                  background: "var(--color-brand-surface)",
                  border: "1px solid var(--color-brand-soft)",
                  color: "var(--color-brand-primary)", fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </motion.article>
      </AnimatePresence>
    </motion.section>
  );
}
