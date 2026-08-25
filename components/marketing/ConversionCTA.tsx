"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Mail, Loader2, Gift, Users, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFingerprint } from "@/hooks/useFingerprint";
import CtaButton from "@/components/ui/CtaButton";

export default function ConversionCTA() {
  const t = useTranslations("ConversionCTA");
  const tErrors = useTranslations("Errors");
  const fingerprint = useFingerprint();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState(t("successMessage"));
  const [hasBonus, setHasBonus] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...(fingerprint ? { fingerprint } : {}) }),
      });

      const data = (await res.json()) as
        | { success: true; bonus: boolean }
        | { success: false; error: { code: string } };

      if (!data.success) {
        const code = data.error?.code || "WAITLIST_ERROR";
        setError(tErrors(code));
        return;
      }

      setSuccessMessage(t("successMessage"));
      setHasBonus(data.bonus);
      setSubmitted(true);
    } catch {
      setError(t("errorMessage"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      id="waitlist-cta"
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="cta-card"
      style={{
        position: "relative",
        maxWidth: "600px",
        margin: "0 auto",
        borderRadius: "var(--radius-3xl)",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-6)",
        overflow: "hidden",
      }}
    >
      {/* Warm accent top bar */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: "var(--gradient-warm)",
      }} />

      {/* Subtle warm tint in top area */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", height: "120px",
        background: "radial-gradient(ellipse at top, var(--color-accent-warm-surface) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Social Proof ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 }}
        style={{
          position: "relative", zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--font-weight-medium)",
          color: "var(--color-foreground-tertiary)",
          marginTop: "var(--space-4)",
        }}
      >
        <Users size={13} />
        <span className="cta-social-pill-text">{t("socialProof")}</span>
      </motion.div>

      {/* ── Text ── */}
      <div style={{ maxWidth: "500px", position: "relative", zIndex: 1 }}>
        <h2 style={{
          fontSize: "var(--text-2xl)", fontWeight: "var(--font-weight-bold)", margin: "0 0 var(--space-3)",
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

      {/* ── Email form / Success state ── */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "500px" }}>
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "center" }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                padding: "var(--space-3-5) var(--space-5)", borderRadius: "var(--radius-xl)",
                background: "var(--color-success-surface)",
                border: "1px solid var(--color-success-border)",
                color: "var(--color-success)", fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", width: "100%",
              }}>
                <Check size={16} />
                {successMessage}
              </div>
              {hasBonus && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-1)",
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-accent-warm-surface)",
                    border: "1px solid var(--color-accent-warm-soft)",
                    color: "var(--color-accent-warm)", fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)",
                  }}
                >
                  <Gift size={13} />
                  {t("bonusMessage")}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <form onSubmit={handleSubmit} className="cta-form-layout">
                <div style={{ position: "relative", flex: 1 }}>
                  <Mail size={15} color="var(--color-foreground-secondary)" style={{
                    position: "absolute", marginInlineStart: "var(--space-3-5)", insetInlineStart: 0, top: "50%", transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={t("emailPlaceholder")}
                    required
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "var(--space-3-5) var(--space-10) var(--space-3-5) var(--space-3-5)",
                      paddingInlineStart: "var(--space-10)",
                      paddingInlineEnd: "var(--space-3-5)",
                      borderRadius: "var(--radius-lg)",
                      border: focused
                        ? "1.5px solid var(--color-accent-warm)"
                        : "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-foreground)",
                      fontSize: "var(--text-base)",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      boxShadow: focused
                        ? "0 0 0 3px var(--color-accent-warm-surface)"
                        : "none",
                      transition: "var(--transition-normal)",
                      opacity: loading ? 0.6 : 1,
                    }}
                  />
                </div>
                <CtaButton
                  type="submit"
                  disabled={loading}
                  style={{
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    ...(loading
                      ? { background: "color-mix(in srgb, var(--color-accent-warm) 40%, transparent)" }
                      : {}),
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <>{t("buttonText")}<ArrowLeft size={14} className="rtl-flip" /></>
                  )}
                </CtaButton>
              </form>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)",
                    color: "var(--color-danger)", fontWeight: "var(--font-weight-medium)", textAlign: "start",
                  }}
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <p style={{
                fontSize: "var(--text-2xs)",
                color: "var(--color-foreground-disabled)",
                margin: "var(--space-2) 0 0",
                textAlign: "center",
              }}>
                {t("privacyNote")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Trust indicators ── */}
      <div style={{
        display: "flex", gap: "var(--space-4)", justifyContent: "center", flexWrap: "wrap",
        position: "relative", zIndex: 1,
      }}>
        {[t("trustEarlyAccess"), t("trustFreeTemplates"), t("trustNoCommitment")].map((item) => (
          <span key={item} style={{
            display: "flex", alignItems: "center", gap: "var(--space-1-5)",
            fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)", color: "var(--color-foreground-disabled)",
          }}>
            <Zap size={10} color="var(--color-accent-warm)" />
            {item}
          </span>
        ))}
      </div>

    </motion.div>
  );
}
