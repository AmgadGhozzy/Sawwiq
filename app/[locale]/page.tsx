import ConversionCTA from "@/components/marketing/ConversionCTA";
import Pricing from "@/components/marketing/Pricing";
import OutputShowcase from "@/components/marketing/OutputShowcase";
import HowItWorks from "@/components/marketing/HowItWorks";
import BentoGrid from "@/components/marketing/BentoGrid";
import Navbar from "@/components/layout/Navbar";
import Section from "@/components/layout/Section";
import HeroCTA from "@/components/layout/HeroCTA";
import Footer from "@/components/contact/Footer";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Home() {
  const tGlobal = useTranslations("Global");
  const tHome = useTranslations("HomePage");

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-x-hidden bg-background">
        {/* ── Single hero spotlight ── */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[200px] left-1/2 h-[var(--orb-size-lg)] w-[var(--orb-size-lg)] -translate-x-1/2 rounded-circle blur-3xl [background:var(--gradient-hero-spotlight)]" />
        </div>

        {/* ── Hero ── */}
        <header className="relative z-10 px-4 pt-20 pb-10 text-center sm:pt-24">
          {/* Eyebrow badge */}
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand-soft bg-brand-surface px-4 py-1.5">
            <Sparkles size={13} color="var(--color-brand-light)" />
            <span
              className="font-semibold text-brand-light"
              style={{ fontSize: "var(--text-xs)" }}
            >
              {tHome("aiBadge")}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-bold leading-[1.6] mb-4 pb-4 bg-clip-text text-transparent [background-image:var(--gradient-headline)]"
            style={{
              fontSize: "var(--text-display)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            {tHome("headline")}
          </h1>

          {/* Tagline */}
          <p
            className="mx-auto leading-relaxed font-normal text-foreground-secondary"
            style={{ maxWidth: "var(--container-md)", fontSize: "var(--text-lg)" }}
          >
            {tGlobal("productTagline")}
          </p>

          <HeroCTA />
        </header>

        {/* ── Bento Grid ── */}
        <BentoGrid />

        {/* ── Output Showcase ── */}
        <Section>
          <OutputShowcase />
        </Section>

        {/* ── How It Works ── */}
        <Section id="how-it-works">
          <HowItWorks />
        </Section>

        {/* ── Pricing ── */}
        <Section>
          <Pricing />
        </Section>

        {/* ── CTA Section ── */}
        <Section id="waitlist-cta">
          <ConversionCTA />
        </Section>

        <Footer />
      </main>
    </>
  );
}
