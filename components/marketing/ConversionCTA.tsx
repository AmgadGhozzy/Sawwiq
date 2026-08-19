"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ArrowLeft, Check, Mail, Loader2, Gift } from "lucide-react";

export default function ConversionCTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("تم التسجيل بنجاح! سنتواصل معك قريباً.");
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
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as
        | { success: true; message: string; bonus: boolean }
        | { success: false; error: string };

      if (!data.success) {
        setError(data.error);
        return;
      }

      setSuccessMessage(data.message);
      setHasBonus(data.bonus);
      setSubmitted(true);
    } catch {
      setError("حدث خطأ في الاتصال. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      id="waitlist-cta"
      dir="rtl"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{
        position: "relative",
        maxWidth: "900px",
        margin: "0 auto",
        borderRadius: "24px",
        background: "rgba(12,14,24,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(124,58,237,0.12)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(124,58,237,0.06)",
        padding: "52px 44px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        overflow: "hidden",
        transition: "box-shadow 0.3s ease",
      }}
    >
      {/* Subtle glow behind the card */}
      <div aria-hidden="true" style={{
        position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)",
        width: "400px", height: "200px", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)",
        filter: "blur(60px)", pointerEvents: "none",
      }} />

      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        style={{
          position: "relative", zIndex: 1,
          width: "52px", height: "52px", borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.15))",
          border: "1px solid rgba(124,58,237,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 30px rgba(124,58,237,0.15)",
        }}
      >
        <Rocket size={22} color="#a78bfa" />
      </motion.div>

      {/* Text */}
      <div style={{ maxWidth: "480px", position: "relative", zIndex: 1 }}>
        <h3 style={{
          fontSize: "1.5rem", fontWeight: 800, margin: "0 0 12px",
          background: "linear-gradient(135deg, #e0e7ff, #c4b5fd)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          ارتقِ باستراتيجيتك التسويقية
        </h3>
        <p style={{ color: "#64748b", lineHeight: 1.8, fontSize: "14px", margin: 0 }}>
          المنصة الكاملة قيد التطوير. انضم لقائمة الانتظار الآن للحصول على وصول مبكر
          وقوالب حصرية مجانية.
        </p>
      </div>

      {/* Email form / Success state */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px", marginTop: "4px" }}>
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
                padding: "14px 20px", borderRadius: "14px",
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                color: "#4ade80", fontSize: "14px", fontWeight: 600, width: "100%",
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
                    padding: "8px 16px", borderRadius: "10px",
                    background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)",
                    color: "#a78bfa", fontSize: "12px", fontWeight: 600,
                  }}
                >
                  <Gift size={13} />
                  توليد مجاني إضافي أُضيف لجلستك!
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", width: "100%" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Mail size={15} color="#475569" style={{
                    position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="أدخل بريدك الإلكتروني"
                    required
                    disabled={loading}
                    dir="rtl"
                    style={{
                      width: "100%",
                      padding: "13px 40px 13px 14px",
                      borderRadius: "12px",
                      border: focused
                        ? "1px solid rgba(124,58,237,0.5)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#e2e8f0",
                      fontSize: "14px",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      boxShadow: focused ? "0 0 0 3px rgba(124,58,237,0.1)" : "none",
                      transition: "all 0.2s ease",
                      opacity: loading ? 0.6 : 1,
                    }}
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={loading ? {} : { y: -2, boxShadow: "0 8px 25px rgba(124,58,237,0.5)" }}
                  whileTap={loading ? {} : { scale: 0.97 }}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "13px 22px",
                    borderRadius: "12px",
                    border: "none",
                    background: loading
                      ? "rgba(124,58,237,0.4)"
                      : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.01em",
                    boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "all 0.2s ease",
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <>انضم لقائمة النخبة<ArrowLeft size={14} /></>
                  )}
                </motion.button>
              </form>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    margin: "8px 0 0", fontSize: "12px",
                    color: "#f87171", fontWeight: 500, textAlign: "right",
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

      {/* Trust indicators */}
      <div style={{
        display: "flex", gap: "20px", justifyContent: "center",
        position: "relative", zIndex: 1, marginTop: "4px",
      }}>
        {["وصول مبكر", "قوالب مجانية", "بدون التزام"].map((item) => (
          <span key={item} style={{
            display: "flex", alignItems: "center", gap: "5px",
            fontSize: "11px", fontWeight: 600, color: "#475569",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            }} />
            {item}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
}
