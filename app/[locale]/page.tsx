import ContentGenerator from "@/components/generator/ContentGenerator";
import ConversionCTA from "@/components/marketing/ConversionCTA";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import HistoryProvider from "@/components/history/HistoryProvider";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

export default function Home() {
  const tGlobal = useTranslations("Global");
  const tHome = useTranslations("HomePage");

  return (
    <main
      className="relative min-h-screen overflow-x-hidden pb-24"
      style={{
        background: "#09090b",
      }}
    >
      <style>{`
        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(1.08); }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(0.92); }
        }
        @keyframes orb-float-3 {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translate(-50%, -30px) scale(1.04); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ── Decorative background orbs ── */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {/* Top-right violet orb */}
        <div style={{
          position: "absolute", top: "-180px", right: "-80px",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, rgba(79,70,229,0.08) 40%, transparent 70%)",
          filter: "blur(80px)",
          animation: "orb-float-1 18s ease-in-out infinite",
        }} />
        {/* Bottom-left indigo orb */}
        <div style={{
          position: "absolute", bottom: "-60px", left: "-140px",
          width: "550px", height: "550px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)",
          filter: "blur(90px)",
          animation: "orb-float-2 22s ease-in-out infinite",
        }} />
        {/* Center subtle glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
          width: "900px", height: "350px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(109,40,217,0.05) 0%, transparent 70%)",
          filter: "blur(100px)",
          animation: "orb-float-3 25s ease-in-out infinite",
        }} />
        {/* Top-center spotlight */}
        <div style={{
          position: "absolute", top: "-200px", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "600px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 60%)",
          filter: "blur(60px)",
        }} />
      </div>

      {/* ── Navbar ── */}
      <div style={{ position: "absolute", top: "20px", left: "20px", zIndex: 50 }}>
        <LanguageSwitcher />
      </div>
      <div style={{ position: "absolute", top: "20px", right: "20px", zIndex: 50 }}>
        <HistoryProvider />
      </div>

      {/* ── Hero Header ── */}
      <header className="relative z-10 pt-8 pb-6 px-4 text-center">
        {/* Logo + Brand */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "14px", marginBottom: "28px",
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
            fontSize: "1.8rem", fontWeight: 800, color: "#e2e8f0",
            letterSpacing: "-0.02em",
          }}>
            {tGlobal("productName")}
          </span>
        </div>

        {/* Main Headline — gradient text */}
        <h1 style={{
          fontSize: "clamp(2rem, 5.5vw, 3.4rem)", fontWeight: 900, letterSpacing: "-1px",
          background: "linear-gradient(135deg, #e0e7ff 0%, #c4b5fd 40%, #a78bfa 70%, #818cf8 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text", lineHeight: 1.35, margin: "0 0 16px",
          paddingBottom: "10px",
        }}>
          {tHome("headline")}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: "1.05rem", color: "#64748b", fontWeight: 400,
          maxWidth: "520px", margin: "0 auto", lineHeight: 1.8,
        }}>
          {tGlobal("productTagline")}
        </p>

        {/* Sparkle badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          marginTop: "12px", padding: "6px 16px",
          borderRadius: "999px",
          background: "rgba(124,58,237,0.08)",
          border: "1px solid rgba(124,58,237,0.15)",
        }}>
          <Sparkles size={14} color="#a78bfa" />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#a78bfa" }}>
            {tHome("aiBadge")}
          </span>
        </div>
      </header>

      {/* ── Main App ── */}
      <section className="relative z-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <ContentGenerator />
      </section>

      {/* ── CTA Section ── */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-20">
        <ConversionCTA />
      </section>
    </main>
  );
}
