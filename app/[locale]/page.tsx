import ContentGenerator from "@/components/generator/ContentGenerator";
import ConversionCTA from "@/components/marketing/ConversionCTA";
import OutputShowcase from "@/components/marketing/OutputShowcase";
import HowItWorks from "@/components/marketing/HowItWorks";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import HistoryProvider from "@/components/history/HistoryProvider";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { HistoryContextProvider } from "@/components/history/HistoryContext";
import Footer from "@/components/contact/Footer";

export default function Home() {
  const tGlobal = useTranslations("Global");
  const tHome = useTranslations("HomePage");

  return (
    <HistoryContextProvider>
      <main
        className="relative min-h-screen overflow-x-hidden pb-24"
        style={{
          background: "var(--color-background)",
        }}
      >
      {/* ── Navbar ── */}
      <div style={{ position: "absolute", top: "var(--space-5)", left: "var(--space-5)", zIndex: "var(--z-navbar)" }}>
        <LanguageSwitcher />
      </div>
      <div style={{ position: "absolute", top: "var(--space-5)", right: "var(--space-5)", zIndex: "var(--z-navbar)" }}>
        <HistoryProvider />
      </div>

      {/* ── Hero Header ── */}
      <header className="relative z-10 pt-8 pb-6 px-4 text-center">
        {/* Logo + Brand */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "var(--space-3)", marginBottom: "var(--space-7)",
        }}>
          {/* Logo */}
          <div style={{
            width: "38px", height: "38px",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Image src="/logo.png" alt="Logo" width={38} height={38} className="object-contain" priority />
          </div>
          {/* Brand name */}
          <span style={{
            fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground)",
            letterSpacing: "var(--tracking-snug)",
          }}>
            {tGlobal("productName")}
          </span>
        </div>

        {/* Main Headline — gradient text */}
        <h1 style={{
          fontSize: "var(--text-display)", fontWeight: "var(--font-weight-bold)", letterSpacing: "var(--tracking-tight)",
          background: "var(--gradient-headline)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text", lineHeight: 1.35, margin: "0 0 var(--space-4)",
          paddingBottom: "var(--space-3)",
        }}>
          {tHome("headline")}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: "var(--text-lg)", color: "var(--color-foreground-secondary)", fontWeight: "var(--font-weight-normal)",
          maxWidth: "var(--container-md)", margin: "0 auto", lineHeight: 1.8,
        }}>
          {tGlobal("productTagline")}
        </p>

        {/* Sparkle badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
          marginTop: "var(--space-3)", padding: "var(--space-1-5) var(--space-4)",
          borderRadius: "var(--radius-full)",
          background: "var(--color-brand-surface)",
          border: "1px solid var(--color-brand-soft)",
        }}>
          <Sparkles size={14} color="var(--color-brand-light)" />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-brand-light)" }}>
            {tHome("aiBadge")}
          </span>
        </div>
      </header>

      {/* ── Main App ── */}
      <section className="relative z-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <ContentGenerator />
      </section>

      {/* ── Output Showcase ── */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-20 mb-20">
        <OutputShowcase />
      </section>

      {/* ── How It Works ── */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-20 mb-20">
        <HowItWorks />
      </section>

      {/* ── CTA Section ── */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-20 mb-20">
        <ConversionCTA />
      </section>

      {/*  Footer  */}
      <Footer />
    </main>
    </HistoryContextProvider>
  );
}
