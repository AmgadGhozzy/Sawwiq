"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ArrowLeft, Check, Mail, Loader2, Gift } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFingerprint } from "@/hooks/useFingerprint";

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="cta-glass-card"
      style={{
        position: "relative",
        maxWidth: "900px",
        margin: "0 auto",
        borderRadius: "28px",
        background: "var(--gradient-surface)",
        backdropFilter: "blur(60px) saturate(180%)",
        WebkitBackdropFilter: "blur(60px) saturate(180%)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-elevated)",
        padding: "56px 48px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        overflow: "hidden",
        transition: "box-shadow 0.4s ease, border-color 0.4s ease",
      }}
    >
      {/* Top glow orb */}
      <div aria-hidden="true" style={{
        position: "absolute", top: "-80px", left: "50%", transform: "translateX(-50%)",
        width: "500px", height: "280px", borderRadius: "50%",
        background: "radial-gradient(ellipse, color-mix(in srgb, var(--color-brand-primary) 15%, transparent) 0%, color-mix(in srgb, var(--color-brand-primary) 6%, transparent) 40%, transparent 70%)",
        filter: "blur(80px)", pointerEvents: "none",
      }} />

      {/* Bottom-right ambient glow */}
      <div aria-hidden="true" style={{
        position: "absolute", bottom: "-60px", right: "-40px",
        width: "350px", height: "250px", borderRadius: "50%",
        background: "radial-gradient(ellipse, color-mix(in srgb, var(--color-brand-primary) 10%, transparent) 0%, transparent 70%)",
        filter: "blur(70px)", pointerEvents: "none",
      }} />

      {/* Glass inner highlight line */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
        pointerEvents: "none",
      }} />

      {/* ── Icon ── */}
      <motion.div
        initial={{ scale: 0.8 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        style={{
          position: "relative", zIndex: 1,
          width: "56px", height: "56px", borderRadius: "18px",
          background: "color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px color-mix(in srgb, var(--color-brand-primary) 20%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-foreground) 10%, transparent)",
        }}
      >
        <Rocket size={24} color="var(--color-brand-primary)" />
      </motion.div>

      {/* ── Text ── */}
      <div style={{ maxWidth: "500px", position: "relative", zIndex: 1 }}>
        <h3 style={{
          fontSize: "1.6rem", fontWeight: 800, margin: "0 0 14px",
          color: "var(--color-foreground)",
        }}>
          {t("title")}
        </h3>
        <p style={{ color: "var(--color-foreground-secondary)", lineHeight: 1.85, fontSize: "14.5px", margin: 0 }}>
          {t("subtitle")}
        </p>
      </div>

      {/* ── Email form / Success state ── */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "440px", marginTop: "4px" }}>
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                padding: "14px 20px", borderRadius: "16px",
                background: "color-mix(in srgb, var(--color-success) 8%, transparent)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)",
                color: "var(--color-success)", fontSize: "14px", fontWeight: 600, width: "100%",
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
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 16px", borderRadius: "12px",
                    background: "var(--color-brand-surface)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
                    color: "var(--color-brand-primary)", fontSize: "12px", fontWeight: 600,
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
                    position: "absolute", marginInlineStart: "14px", insetInlineStart: 0, top: "50%", transform: "translateY(-50%)",
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
                      padding: "14px 42px 14px 14px",
                      paddingInlineStart: "42px",
                      paddingInlineEnd: "14px",
                      borderRadius: "14px",
                      border: focused
                        ? "1.5px solid var(--color-brand-primary)"
                        : "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      color: "var(--color-foreground)",
                      fontSize: "14px",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      boxShadow: focused
                        ? "0 0 0 3px var(--color-brand-surface)"
                        : "none",
                      transition: "all 0.25s ease",
                      opacity: loading ? 0.6 : 1,
                    }}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? {} : { y: -2, boxShadow: "var(--shadow-brand)" }}
                  whileTap={loading ? {} : { scale: 0.97 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                    padding: "14px 24px",
                    borderRadius: "14px",
                    border: "none",
                    background: loading
                      ? "color-mix(in srgb, var(--color-brand-primary) 40%, transparent)"
                      : "var(--gradient-brand)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.01em",
                    boxShadow: "var(--shadow-brand)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "all 0.25s ease",
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <>{t("buttonText")}<ArrowLeft size={14} className="rtl-flip" /></>
                  )}
                </motion.button>
              </form>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    margin: "8px 0 0", fontSize: "12px",
                    color: "var(--color-danger)", fontWeight: 500, textAlign: "right", // Note: textAlign might need logical prop
                  }}
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Trust indicators ── */}
      <div style={{
        display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap",
        position: "relative", zIndex: 1, marginTop: "4px",
      }}>
        {[t("trustEarlyAccess"), t("trustFreeTemplates"), t("trustNoCommitment")].map((item) => (
          <span key={item} style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "11px", fontWeight: 600, color: "var(--color-foreground-secondary)",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "var(--color-foreground-secondary)",
              opacity: 0.7,
            }} />
            {item}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .cta-glass-card:hover {
          border-color: color-mix(in srgb, var(--color-brand-primary) 25%, transparent) !important;
          box-shadow:
            0 24px 80px -12px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 color-mix(in srgb, var(--color-foreground) 18%, transparent),
            0 0 160px color-mix(in srgb, var(--color-brand-primary) 10%, transparent) !important;
        }

        .cta-form-layout {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        html[dir='ltr'] .rtl-flip {
           transform: rotate(180deg);
        }

        /* Mobile: stack form vertically, badges wrap naturally */
        @media (max-width: 640px) {
          .cta-form-layout {
            flex-direction: column;
          }

          .cta-badges-row {
            gap: 8px !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
