"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Loader2, Check } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import CtaButton from "@/components/ui/CtaButton";
import { getTracker } from "@/lib/analytics/tracker";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckEmail, setShowCheckEmail] = useState(false);
  const supabase = getSupabaseClient();
  const tracker = getTracker();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      if (tab === "signup") {
        tracker.track("signup_started");
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          // redirectTo points to our PKCE callback that handles merge + bonus automatically
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });

        if (signUpErr) {
          setError(signUpErr.message);
          tracker.track("signup_failed", { error: signUpErr.message });
        } else {
          // Signup accepted → user must confirm email → callback handles merge
          tracker.track("signup_verification_required", { email });
          setShowCheckEmail(true);
        }
      } else {
        tracker.track("login_started");
        const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInErr || !session) {
          setError(signInErr?.message || "Login failed");
          tracker.track("login_failed", { error: signInErr?.message ?? "no_session" });
        } else {
          // Login path: merge anonymous session and award bonus (idempotent)
          const mergeRes = await fetch("/api/auth/merge-session", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          const mergeData = (await mergeRes.json()) as { success: boolean; balance?: number; error?: string };
          if (mergeData.success) {
            tracker.track("login_completed", { balance: mergeData.balance });
            window.dispatchEvent(new Event("refresh_credits"));
            onSuccess();
          } else {
            setError(mergeData.error || "Failed to sync account");
            tracker.track("login_failed", { error: mergeData.error ?? "merge_failed" });
          }
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: "var(--z-modal)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "var(--space-4)",
    }}>
      <div 
        style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)" }} 
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="glass-card"
        style={{
          position: "relative",
          width: "100%", maxWidth: "400px",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-2xl)",
          display: "flex", flexDirection: "column", gap: "var(--space-4)",
        }}
      >
        <button 
          onClick={onClose}
          style={{ position: "absolute", top: "var(--space-4)", right: "var(--space-4)", background: "transparent", border: "none", cursor: "pointer", color: "var(--color-foreground-secondary)" }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "var(--space-2)" }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", margin: "0 0 var(--space-2)" }}>
            {tab === "signup" ? "أنشئ حسابًا مجانيًا" : "تسجيل الدخول"}
          </h2>
          <p style={{ color: "var(--color-foreground-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
            {tab === "signup" ? "للحصول على رصيد إضافي وحفظ شغلك." : "أهلاً بك مجددًا."}
          </p>
        </div>

        {showCheckEmail ? (
          <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
            <div style={{ display: "inline-flex", background: "var(--color-success-surface)", color: "var(--color-success)", padding: "var(--space-3)", borderRadius: "var(--radius-full)", marginBottom: "var(--space-4)" }}>
              <Check size={24} />
            </div>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-semibold)", margin: "0 0 var(--space-2)" }}>تحقق من بريدك الإلكتروني</h3>
            <p style={{ color: "var(--color-foreground-secondary)", fontSize: "var(--text-sm)" }}>
              أرسلنا رابط التفعيل إلى {email}. اضغط عليه لتفعيل حسابك.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {error && (
              <div style={{ color: "var(--color-danger)", background: "var(--color-danger-surface)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
                {error}
              </div>
            )}
            
            <div style={{ position: "relative" }}>
              <Mail size={16} color="var(--color-foreground-secondary)" style={{ position: "absolute", right: "var(--space-3)", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="البريد الإلكتروني"
                required
                style={{
                  width: "100%", padding: "var(--space-2-5) var(--space-3) var(--space-2-5) var(--space-8)",
                  background: "var(--color-background)", border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)", color: "var(--color-foreground)", fontSize: "var(--text-sm)"
                }}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Lock size={16} color="var(--color-foreground-secondary)" style={{ position: "absolute", right: "var(--space-3)", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                required
                minLength={6}
                style={{
                  width: "100%", padding: "var(--space-2-5) var(--space-3) var(--space-2-5) var(--space-8)",
                  background: "var(--color-background)", border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)", color: "var(--color-foreground)", fontSize: "var(--text-sm)"
                }}
              />
            </div>

            <CtaButton type="submit" disabled={loading} fullWidth>
              {loading ? <Loader2 size={16} className="animate-spin" /> : (tab === "signup" ? "إنشاء حساب مجاني" : "دخول")}
            </CtaButton>
          </form>
        )}

        {!showCheckEmail && (
          <div style={{ textAlign: "center", marginTop: "var(--space-2)" }}>
            <button 
              onClick={() => setTab(tab === "signup" ? "login" : "signup")}
              type="button"
              style={{ background: "none", border: "none", color: "var(--color-brand-primary)", fontSize: "var(--text-sm)", cursor: "pointer", fontWeight: "var(--font-weight-medium)" }}
            >
              {tab === "signup" ? "لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب مجاني"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
