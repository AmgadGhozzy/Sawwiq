"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import AuthModal from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ConversionCTA() {
  const t = useTranslations("ConversionCTA");
  const { state } = useAuth();
  const isLoggedIn = state === "authenticated";
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <motion.div
      id="waitlist-cta"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="cta-glass-card glass-card cta-card"
      style={{
        position: "relative",
          zIndex: 10,
        maxWidth: "600px",
        margin: "0 auto",
        borderRadius: "var(--radius-3xl)",
        backdropFilter: "blur(var(--blur-2xl)) saturate(180%)",
        WebkitBackdropFilter: "blur(var(--blur-2xl)) saturate(180%)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-6)",
        overflow: "hidden",
        transition: "box-shadow var(--transition-normal), border-color var(--transition-normal)",
      }}
    >
      {/* Glass inner highlight line */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
        background: "var(--gradient-divider)",
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.06 }}
        style={{
          position: "relative", zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-1-5) var(--space-4)",
          borderRadius: "var(--radius-full)",
          background: "var(--color-brand-surface)",
          border: "1px solid var(--color-brand-soft)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--color-brand-light)",
        }}
      >
        <Users size={13} color="var(--color-brand-light)" />
        <span className="cta-social-pill-text">{t("socialProof")}</span>
      </motion.div>

      <div style={{ maxWidth: "580px", position: "relative", zIndex: 1 }}>
        <h2 style={{
          fontSize: "var(--text-2xl)", fontWeight: "var(--font-weight-bold)", margin: "0 0 var(--space-3-5)",
          color: "var(--color-foreground)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: "var(--leading-snug)",
        }}>
          {t("title")}
        </h2>
        <p style={{ color: "var(--color-foreground-secondary)", lineHeight: "var(--leading-relaxed)", fontSize: "var(--text-base)", margin: 0 }}>
          {t("subtitle")}
        </p>
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "300px" }}>
        {isLoggedIn ? (
          // Already logged in — show confirmation instead of button
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-5)",
            borderRadius: "var(--radius-xl)",
            background: "var(--color-success-surface)",
            border: "1px solid var(--color-success-border)",
            color: "var(--color-success)",
            fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)",
          }}>
            <Check size={15} />
            {t("alreadyLoggedIn")}
          </div>
        ) : state === "loading" ? null : (
          <>
            <Button
              onClick={() => setIsAuthModalOpen(true)}
              style={{ width: "100%", whiteSpace: "nowrap" }}
            >
              {t("buttonText")}
            </Button>
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => setIsAuthModalOpen(false)}
              onSuccess={() => setIsAuthModalOpen(false)}
            />
          </>
        )}
      </div>

      <div style={{
        display: "flex", gap: "var(--space-5)", justifyContent: "center", flexWrap: "wrap",
        position: "relative", zIndex: 1, marginTop: "var(--space-1)",
      }}>
        {[t("trustEarlyAccess"), t("trustFreeTemplates"), t("trustNoCommitment")].map((item) => (
          <span key={item} style={{
            display: "flex", alignItems: "center", gap: "var(--space-1)",
            fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground-secondary)",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "var(--radius-circle)",
              background: "var(--color-foreground-secondary)",
              opacity: "var(--opacity-muted)",
            }} />
            {item}
          </span>
        ))}
      </div>

      <style>{`
        .cta-glass-card:hover {
          border-color: var(--color-brand-soft);
          box-shadow: var(--shadow-brand-glow);
        }

        html[dir='ltr'] .rtl-flip {
          transform: rotate(180deg);
        }
      `}</style>
    </motion.div>
  );
}
