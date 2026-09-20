"use client";

import { useTranslations } from "next-intl";
import { MessageCircle, Layers, Zap, Globe, Sparkles } from "lucide-react";

// Platform logo pills — semantic colors using CSS vars
const PLATFORM_DOTS = [
  { label: "Instagram", color: "var(--color-instagram)" },
  { label: "TikTok", color: "var(--color-tiktok)" },
  { label: "LinkedIn", color: "var(--color-linkedin)" },
  { label: "X / Twitter", color: "var(--color-x-twitter)" },
  { label: "YouTube", color: "var(--color-youtube)" },
  { label: "WhatsApp", color: "var(--color-whatsapp)" },
];

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  /** Span the card 2 columns on md+ */
  wide?: boolean;
  /** Span the card 2 rows on md+ */
  tall?: boolean;
}

function BentoCard({ children, className = "", wide = false, tall = false }: BentoCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border p-6 flex flex-col gap-3
        transition-colors duration-150
        ${wide ? "md:col-span-2" : ""}
        ${tall ? "md:row-span-2" : ""}
        ${className}
      `}
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {children}
    </div>
  );
}

function CardIcon({ icon: Icon, color = "var(--color-brand-primary)" }: { icon: React.ElementType; color?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg mb-1"
      style={{
        width: "36px",
        height: "36px",
        background: "var(--color-brand-surface)",
        border: "1px solid var(--color-brand-soft)",
        color,
        flexShrink: 0,
      }}
    >
      <Icon size={16} />
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-semibold leading-snug"
      style={{ fontSize: "var(--text-base)", color: "var(--color-foreground)" }}
    >
      {children}
    </p>
  );
}

function CardSub({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="leading-relaxed"
      style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-secondary)" }}
    >
      {children}
    </p>
  );
}

export default function BentoGrid() {
  const t = useTranslations("HomePage");

  return (
    <section className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 mt-12 mb-20">
      {/* Section header */}
      <div className="text-center mb-12">
        <p
          className="font-bold mb-3"
          style={{ fontSize: "var(--text-3xl)", color: "var(--color-foreground)", letterSpacing: "var(--tracking-snug)" }}
        >
          {t("bentoHeadline")}
        </p>
        <p style={{ fontSize: "var(--text-base)", color: "var(--color-foreground-secondary)" }}>
          {t("bentoSub")}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-auto">

        {/* Card 1: Dialects — wide */}
        <BentoCard wide>
          <CardIcon icon={MessageCircle} />
          <CardTitle>{t("bentoDialects")}</CardTitle>
          <CardSub>{t("bentoDialectsSub")}</CardSub>
          {/* Dialect pill strip */}
          <div className="flex flex-wrap gap-2 mt-auto pt-3">
            {(t.raw("bentoDialectsList") as string[]).map((d) => (
              <span
                key={d}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "var(--color-fill-subtle)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground-secondary)",
                }}
              >
                {d}
              </span>
            ))}
          </div>
        </BentoCard>

        {/* Card 2: Speed */}
        <BentoCard>
          <CardIcon icon={Zap} />
          <CardTitle>{t("bentoSpeed")}</CardTitle>
          <CardSub>{t("bentoSpeedSub")}</CardSub>
          {/* Simple stat */}
          <div
            className="mt-auto pt-3 font-extrabold font-outfit"
            style={{ fontSize: "var(--text-5xl)", color: "var(--color-brand-light)", lineHeight: 1 }}
          >
            &lt;5s
          </div>
        </BentoCard>

        {/* Card 3: Platforms */}
        <BentoCard>
          <CardIcon icon={Globe} />
          <CardTitle>{t("bentoPlatforms")}</CardTitle>
          <CardSub>{t("bentoPlatformsSub")}</CardSub>
          <div className="flex flex-wrap gap-2 mt-auto pt-3">
            {PLATFORM_DOTS.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-foreground-secondary)",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Card 4: AI — wide */}
        <BentoCard wide>
          <CardIcon icon={Sparkles} />
          <CardTitle>{t("bentoAi")}</CardTitle>
          <CardSub>{t("bentoAiSub")}</CardSub>
          {/* Framework chips */}
          <div className="flex flex-wrap gap-2 mt-auto pt-3">
            {(t.raw("bentoAiFrameworksList") as string[]).map((f) => (
              <span
                key={f}
                className="rounded-md px-2 py-1"
                style={{
                  background: "var(--color-brand-surface)",
                  border: "1px solid var(--color-brand-soft)",
                  color: "var(--color-brand-light)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </BentoCard>

        {/* Card 5: Formats */}
        <BentoCard>
          <CardIcon icon={Layers} />
          <CardTitle>{t("bentoFormats")}</CardTitle>
          <CardSub>{t("bentoFormatsSub")}</CardSub>
        </BentoCard>

      </div>
    </section>
  );
}
