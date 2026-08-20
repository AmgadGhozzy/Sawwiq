"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";

// ---------------------------------------------------------------------------
// ContactDrawer — glassmorphism bottom-sheet / centered floating panel
// ---------------------------------------------------------------------------

const FOUNDER_NAME_AR = "أمجد غزي";
const FOUNDER_NAME_EN = "Amgad Ghozzy";
const WHATSAPP_URL = "https://wa.me/201033552012";
const EMAIL = "AmgadGhozzy@gmail.com";

interface ContactDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactDrawer({ open, onClose }: ContactDrawerProps) {
  const t = useTranslations("Contact");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const panelRef = useRef<HTMLDivElement>(null);
  const founderName = isRTL ? FOUNDER_NAME_AR : FOUNDER_NAME_EN;

  // ── Keyboard: ESC to close ──
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // ── Lock body scroll ──
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ── Focus panel when opened ──
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 998,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />

          {/* ── Floating Panel ── */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("drawerGreeting")}
            initial={{ x: "-50%", opacity: 0, y: 60, scale: 0.96 }}
            animate={{ x: "-50%", opacity: 1, y: 0, scale: 1 }}
            exit={{ x: "-50%", opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="contact-drawer-panel"
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              width: "min(520px, calc(100vw - 32px))",
              zIndex: 999,
              borderRadius: "24px",
              background:
                "linear-gradient(165deg, rgba(15,15,25,0.92) 0%, rgba(10,10,20,0.95) 50%, rgba(20,12,40,0.92) 100%)",
              backdropFilter: "blur(60px) saturate(180%)",
              WebkitBackdropFilter: "blur(60px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 24px 80px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(255,255,255,0.03), 0 0 120px rgba(124,58,237,0.08)",
              outline: "none",
              overflow: "hidden",
            }}
          >
            {/* Top glow orb */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "-60px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "400px",
                height: "200px",
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, rgba(79,70,229,0.05) 40%, transparent 70%)",
                filter: "blur(60px)",
                pointerEvents: "none",
              }}
            />

            {/* Glass inner highlight line */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: "10%",
                right: "10%",
                height: "1px",
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                pointerEvents: "none",
              }}
            />

            {/* ── Close button ── */}
            <button
              onClick={onClose}
              aria-label={t("close")}
              style={{
                position: "absolute",
                top: "16px",
                [isRTL ? "left" : "right"]: "16px",
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#94a3b8",
                transition: "all 0.2s ease",
                fontFamily: "inherit",
                zIndex: 2,
              }}
            >
              <X size={15} />
            </button>

            {/* ── Content ── */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                padding: "36px 32px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Greeting + Intro */}
              <div style={{ textAlign: "center" }}>
                {/* Name initial avatar */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.12))",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(124,58,237,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    boxShadow:
                      "0 0 40px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Image
                    src="/founder.png"
                    alt={founderName}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </motion.div>

                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    margin: "0 0 6px",
                    background: "linear-gradient(135deg, #f1f5f9, #c4b5fd)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {t("drawerGreeting")}
                </h3>

                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#cbd5e1",
                    margin: "0 0 10px",
                  }}
                >
                  {t("drawerIntro", { name: founderName })}
                </p>

                <p
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    lineHeight: 1.8,
                    margin: 0,
                    maxWidth: "380px",
                    marginInline: "auto",
                    whiteSpace: "pre-line",
                  }}
                >
                  {t("drawerBody")}
                </p>
              </div>

              {/* ── Contact Buttons ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* WhatsApp — Primary CTA */}
                <motion.a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -2, boxShadow: "0 12px 35px rgba(37,211,102,0.25)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, rgba(37,211,102,0.12), rgba(37,211,102,0.06))",
                    border: "1px solid rgba(37,211,102,0.2)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #25d366, #128c7e)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 14px rgba(37,211,102,0.3)",
                    }}
                  >
                    <MessageCircle size={18} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#e2e8f0",
                        margin: 0,
                      }}
                    >
                      {t("whatsappLabel")}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        margin: "2px 0 0",
                      }}
                    >
                      {t("whatsappDesc")}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    color="#25d366"
                    style={{ flexShrink: 0, opacity: 0.7 }}
                  />
                </motion.a>

                {/* Email — Secondary CTA */}
                <motion.a
                  href={`mailto:${EMAIL}`}
                  whileHover={{ y: -2, boxShadow: "0 12px 35px rgba(124,58,237,0.15)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.12))",
                      border: "1px solid rgba(124,58,237,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Mail size={16} color="#a78bfa" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#e2e8f0",
                        margin: 0,
                      }}
                    >
                      {t("emailLabel")}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        margin: "2px 0 0",
                      }}
                    >
                      {t("emailDesc")}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    color="#64748b"
                    style={{ flexShrink: 0, opacity: 0.5 }}
                  />
                </motion.a>
              </div>
            </div>

            <style>{`
              @media (max-width: 640px) {
                .contact-drawer-panel {
                  bottom: 0 !important;
                  border-bottom-left-radius: 0 !important;
                  border-bottom-right-radius: 0 !important;
                  width: 100vw !important;
                }
              }
            `}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
