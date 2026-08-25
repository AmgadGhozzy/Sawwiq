"use client";

import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRef } from "react";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function HowItWorks() {
  const t = useTranslations("HowItWorks");
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 85%", "center center"],
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const steps = [
    {
      number: t("step1.number"),
      title: t("step1.title"),
      description: t("step1.description"),
      mockup: <Step1Mockup />,
    },
    {
      number: t("step2.number"),
      title: t("step2.title"),
      description: t("step2.description"),
      mockup: <Step2Mockup />,
    },
    {
      number: t("step3.number"),
      title: t("step3.title"),
      description: t("step3.description"),
      mockup: <Step3Mockup />,
    },
  ];

  return (
    <section ref={sectionRef} style={{ padding: "var(--space-16) 0", position: "relative" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: "var(--space-16)" }}
      >
        <h2 style={{
          fontSize: "var(--text-3xl)",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--color-foreground)",
          marginBottom: "var(--space-4)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: "var(--leading-tight)",
        }}>
          {t("title")}
        </h2>
        <p style={{
          fontSize: "var(--text-lg)",
          color: "var(--color-foreground-secondary)",
          maxWidth: "500px",
          margin: "0 auto",
          lineHeight: "var(--leading-relaxed)",
        }}>
          {t("subtitle")}
        </p>
      </motion.div>

      {/* Steps + Connector */}
      <div style={{ position: "relative" }}>
        {/* Desktop connector line — sits between the row of cards */}
        <div
          aria-hidden="true"
          style={{
            display: "none",
            position: "absolute",
            top: "84px",          /* vertically center on the step number badge */
            insetInlineStart: "calc(16.66% + 20px)",
            insetInlineEnd: "calc(16.66% + 20px)",
            height: "2px",
            zIndex: 0,
          }}
          className="md-connector"
        >
          {/* Track */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "repeating-linear-gradient(90deg, var(--color-border) 0, var(--color-border) 6px, transparent 6px, transparent 14px)",
          }} />
          {/* Glowing progress */}
          <svg width="100%" height="2" style={{ position: "absolute", inset: 0 }} preserveAspectRatio="none">
            <motion.line
              x1="0" y1="1" x2="100%" y2="1"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              style={{
                pathLength,
                filter: "drop-shadow(0 0 5px var(--color-brand-primary))",
              }}
            />
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                <stop offset="0%" stopColor="var(--color-brand-primary)" />
                <stop offset="100%" stopColor="var(--color-brand-hover)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-5)",
            position: "relative",
            zIndex: 1,
            alignItems: "stretch",
          }}
          className="how-it-works-grid"
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              custom={i}
              variants={fadeUpVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              style={{ display: "flex" }}
            >
              <StepCard {...step} index={i} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Responsive styles injected inline */}
    </section>
  );
}

function StepCard({
  number,
  title,
  description,
  mockup,
  index,
}: {
  number: string;
  title: string;
  description: string;
  mockup: React.ReactNode;
  index: number;
}) {
  const isMiddle = index === 1;
  return (
    <div style={{
      background: isMiddle
        ? "linear-gradient(160deg, color-mix(in srgb, var(--color-brand-primary) 7%, transparent) 0%, rgba(15,15,25,0.5) 100%)"
        : "var(--color-fill-faint)",
      border: `1px solid ${isMiddle ? "color-mix(in srgb, var(--color-brand-primary) 20%, transparent)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-2xl)",
      padding: "var(--space-8)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: "var(--space-4)",
      width: "100%",
      transition: "border-color 0.25s ease, box-shadow 0.25s ease",
    }}>
      {/* Subtle top shimmer for middle card */}
      {isMiddle && (
        <div style={{
          position: "absolute",
          top: 0,
          insetInlineStart: "20%",
          insetInlineEnd: "20%",
          height: "1px",
          background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-brand-light) 50%, transparent), transparent)",
        }} />
      )}

      {/* Step number badge */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "var(--control-h-lg)",
        height: "var(--control-h-lg)",
        borderRadius: "var(--radius-md)",
        background: isMiddle ? "color-mix(in srgb, var(--color-brand-primary) 20%, transparent)" : "var(--color-fill-subtle)",
        border: `1px solid ${isMiddle ? "color-mix(in srgb, var(--color-brand-primary) 35%, transparent)" : "var(--color-border)"}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: "var(--text-sm)",
          fontWeight: "var(--font-weight-bold)",
          color: isMiddle ? "var(--color-brand-light)" : "var(--color-foreground-tertiary)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {number}
        </span>
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <h3 style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--font-weight-bold)",
          color: "var(--color-foreground)",
          marginBottom: "var(--space-2)",
          lineHeight: "var(--leading-snug)",
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-foreground-secondary)",
          lineHeight: "var(--leading-relaxed)",
        }}>
          {description}
        </p>
      </div>

      {/* Micro-mockup */}
      <div style={{
        borderRadius: "var(--radius-lg)",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid var(--color-border-subtle)",
        padding: "var(--space-4)",
        height: "90px",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: "auto",
      }}>
        {mockup}
      </div>
    </div>
  );
}

/* ─── Micro-mockups ─────────────────────────────────────────── */

function Step1Mockup() {
  const t = useTranslations("HowItWorks");
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
      {[
        { label: "TikTok", active: true },
        { label: t("mockup.dialect"), active: false },
        { label: t("mockup.persona"), active: false },
      ].map(({ label, active }) => (
        <div
          key={label}
          style={{
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-full)",
            background: active ? "var(--color-brand-surface)" : "var(--color-fill-subtle)",
            border: `1px solid ${active ? "var(--color-brand-soft)" : "var(--color-border)"}`,
            fontSize: "var(--text-xs)",
            color: active ? "var(--color-brand-light)" : "var(--color-foreground-tertiary)",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function Step2Mockup() {
  const t = useTranslations("HowItWorks");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: "100%" }}>
      {/* Source node */}
      <div style={{
        padding: "var(--space-1-5) var(--space-4)",
        borderRadius: "var(--radius-full)",
        background: "color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-brand-primary) 30%, transparent)",
        fontSize: "var(--text-xs)",
        color: "var(--color-brand-light)",
      }}>
        {t("mockup.oneIdea")}
      </div>
      {/* Branches */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", paddingTop: "var(--space-1)" }}>
        {[t("mockup.branch1"), t("mockup.branch2"), t("mockup.branch3")].map((label, i) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
            <div style={{ width: "1px", height: "12px", background: i === 1 ? "color-mix(in srgb, var(--color-brand-primary) 50%, transparent)" : "var(--color-fill-strong)" }} />
            <div style={{
              padding: "var(--space-1-5) var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: i === 1 ? "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)" : "var(--color-fill-subtle)",
              border: `1px solid ${i === 1 ? "color-mix(in srgb, var(--color-brand-primary) 25%, transparent)" : "var(--color-border)"}`,
              fontSize: "var(--text-2xs)",
              color: i === 1 ? "var(--color-brand-light)" : "var(--color-foreground-disabled)",
              textAlign: "center",
              lineHeight: "1.4",
              whiteSpace: "nowrap",
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3Mockup() {
  const t = useTranslations("HowItWorks");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%" }}>
      {/* Title block */}
      <div style={{ width: "65%", height: "10px", background: "var(--color-fill-strong)", borderRadius: "var(--radius-xs)" }} />
      {/* Body lines */}
      <div style={{ width: "100%", height: "7px", background: "var(--color-border)", borderRadius: "var(--radius-xs)" }} />
      <div style={{ width: "85%", height: "7px", background: "var(--color-border)", borderRadius: "var(--radius-xs)" }} />
      {/* Hashtag pills */}
      <div style={{ display: "flex", gap: "var(--space-1-5)", marginTop: "var(--space-1)" }}>
        {[t("mockup.tag1"), t("mockup.tag2")].map((tag) => (
          <div key={tag} style={{
            padding: "var(--space-0-5) var(--space-2)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-brand-surface)",
            border: "1px solid var(--color-brand-soft)",
            fontSize: "var(--text-2xs)",
            color: "var(--color-brand-light)",
          }}>
            #{tag}
          </div>
        ))}
      </div>
    </div>
  );
}
