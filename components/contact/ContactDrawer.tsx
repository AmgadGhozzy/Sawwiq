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
              zIndex: "var(--z-backdrop)",
              background: "var(--color-overlay)",
              backdropFilter: "blur(var(--blur-sm))",
              WebkitBackdropFilter: "blur(var(--blur-sm))",
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
            className="contact-drawer-panel glass-card"
            style={{
              position: "fixed",
              bottom: "var(--space-6)",
              left: "50%",
              width: "min(var(--drawer-max-w), calc(100vw - var(--space-8)))",
              zIndex: "var(--z-modal)",
              borderRadius: "var(--radius-2xl)",
              background: "color-mix(in srgb, var(--color-background) 85%, transparent)",
              backdropFilter: "blur(var(--blur-2xl)) saturate(180%)",
              WebkitBackdropFilter: "blur(var(--blur-2xl)) saturate(180%)",
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
                width: "550px",
                height: "200px",
                borderRadius: "var(--radius-circle)",
                background: "radial-gradient(ellipse, rgba(109,40,217,0.05) 0%, transparent 70%)",
                filter: "blur(var(--blur-lg))",
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
                background: "var(--gradient-divider)",
                pointerEvents: "none",
              }}
            />

            {/* ── Close button ── */}
            <button
              onClick={onClose}
              aria-label={t("close")}
              style={{
                position: "absolute",
                top: "var(--space-4)",
                [isRTL ? "left" : "right"]: "var(--space-4)",
                width: "var(--space-8)",
                height: "var(--space-8)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-brand-surface)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--color-foreground-secondary)",
                transition: "var(--transition-normal)",
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
                padding: "var(--space-9) var(--space-8) var(--space-7)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-5)",
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
                    width: "var(--space-14)",
                    height: "var(--space-14)",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--color-brand-surface)",
                    backdropFilter: "blur(var(--blur-md))",
                    WebkitBackdropFilter: "blur(var(--blur-md))",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto var(--space-4)",
                    boxShadow: "var(--shadow-brand-glow)",
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
                    fontSize: "var(--text-lg)",
                    fontWeight: "var(--font-weight-bold)",
                    margin: "0 0 var(--space-1-5)",
                    color: "var(--color-foreground)",
                  }}
                >
                  {t("drawerGreeting")}
                </h3>

                <p
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: "var(--color-foreground-secondary)",
                    margin: "0 0 var(--space-2-5)",
                  }}
                >
                  {t("drawerIntro", { name: founderName })}
                </p>

                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-foreground-tertiary)",
                    lineHeight: "var(--leading-relaxed)",
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {/* WhatsApp — Primary CTA */}
                <motion.a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -2, boxShadow: "var(--shadow-whatsapp)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3-5) var(--space-4-5)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-whatsapp-surface)",
                    border: "1px solid var(--color-whatsapp-border)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "var(--transition-normal)",
                  }}
                >
                  <div
                    style={{
                      width: "var(--control-h-md)",
                      height: "var(--control-h-md)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--gradient-whatsapp)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "var(--shadow-whatsapp)",
                    }}
                  >
                    <MessageCircle size={18} color="white" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "var(--text-base)",
                        fontWeight: "var(--font-weight-bold)",
                        color: "var(--color-foreground)",
                        margin: 0,
                      }}
                    >
                      {t("whatsappLabel")}
                    </p>
                    <p
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-foreground-tertiary)",
                        margin: "var(--space-0-5) 0 0",
                      }}
                    >
                      {t("whatsappDesc")}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    color="var(--color-whatsapp)"
                    style={{ flexShrink: 0, opacity: 0.7 }}
                  />
                </motion.a>

                {/* Email — Secondary CTA */}
                <motion.a
                  href={`mailto:${EMAIL}`}
                  whileHover={{ y: -2, boxShadow: "var(--shadow-brand)" }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3-5) var(--space-4-5)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-brand-surface)",
                    border: "1px solid var(--color-brand-soft)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "var(--transition-normal)",
                  }}
                >
                  <div
                    style={{
                      width: "var(--control-h-md)",
                      height: "var(--control-h-md)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--gradient-brand)",
                      boxShadow: "var(--shadow-brand)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Mail size={18} color="white" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "var(--text-base)",
                        fontWeight: "var(--font-weight-bold)",
                        color: "var(--color-foreground)",
                        margin: 0,
                      }}
                    >
                      {t("emailLabel")}
                    </p>
                    <p
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-foreground-tertiary)",
                        margin: "var(--space-0-5) 0 0",
                      }}
                    >
                      {t("emailDesc")}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    color="var(--color-brand-primary)"
                    style={{ flexShrink: 0, opacity: 0.7 }}
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
