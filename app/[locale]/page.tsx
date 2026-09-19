import ContentGenerator from "@/components/generator/ContentGenerator";
import ConversionCTA from "@/components/marketing/ConversionCTA";
import Pricing from "@/components/marketing/Pricing";
import OutputShowcase from "@/components/marketing/OutputShowcase";
import HowItWorks from "@/components/marketing/HowItWorks";
import Navbar from "@/components/layout/Navbar";
import Section from "@/components/layout/Section";
import HeroCTA from "@/components/layout/HeroCTA";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { HistoryContextProvider } from "@/components/history/HistoryContext";
import Footer from "@/components/contact/Footer";

export default function Home() {
  const tGlobal = useTranslations("Global");
  const tHome = useTranslations("HomePage");

  return (
    <HistoryContextProvider>
      <Navbar />
      <main className="relative min-h-screen overflow-x-hidden bg-background pb-24">
        {/* ── Single hero spotlight (the only ambient effect on the page) ── */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[200px] left-1/2 h-[var(--orb-size-lg)] w-[var(--orb-size-lg)] -translate-x-1/2 rounded-circle blur-3xl [background:var(--gradient-hero-spotlight)]" />
        </div>

        <header className="relative z-10 px-4 pt-16 pb-10 text-center sm:pt-20">
          <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-brand-soft bg-brand-surface px-4 py-1.5">
            <Sparkles size={14} color="var(--color-brand-light)" />
            <span className="text-sm font-semibold text-brand-light">
              {tHome("aiBadge")}
            </span>
          </div>

          <h1 className="text-display font-bold tracking-tight leading-[1.35] mb-4 pb-3 bg-clip-text text-transparent [background-image:var(--gradient-headline)]">
            {tHome("headline")}
          </h1>

          <p className="mx-auto max-w-[var(--container-md)] text-lg leading-[1.8] font-normal text-foreground-secondary">
            {tGlobal("productTagline")}
          </p>

          <HeroCTA />
        </header>

        {/* ── Main App ── */}
        <Section elevated id="generator">
          <ContentGenerator />
        </Section>

        <Section>
          <OutputShowcase />
        </Section>

        <Section id="how-it-works">
          <HowItWorks />
        </Section>

        {/* ── Pricing (hook for Phase 6 billing) ── */}
        <Section>
          <Pricing />
        </Section>

        <Section id="waitlist-cta">
          <ConversionCTA />
        </Section>

        {/*  Footer  */}
        <Footer />
      </main>
    </HistoryContextProvider>
  );
}
