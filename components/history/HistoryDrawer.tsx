"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Sparkles } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { GenerationHistoryItem } from "@/types/history";
import HistoryCard from "./HistoryCard";

// ---------------------------------------------------------------------------
// HistoryDrawer — slides in from the inline-end side
// ---------------------------------------------------------------------------

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const t = useTranslations("History");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [items, setItems] = useState<GenerationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // ── Fetch history when drawer opens ──
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/history?limit=20");
      if (!res.ok) { setError(true); return; }
      const json = await res.json();
      if (json.success) { setItems(json.data); } else { setError(true); }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  // ── Keyboard: ESC to close ──
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // ── Lock body scroll ──
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Focus trap ──
  useEffect(() => {
    if (open && drawerRef.current) drawerRef.current.focus();
  }, [open]);

  const slideFrom = isRTL ? { x: "-100%" } : { x: "100%" };
  const slideTo = { x: "0%" };

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
              position: "fixed", inset: 0, zIndex: 998,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          />

          {/* ── Drawer ── */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            initial={{ ...slideFrom, opacity: 0.8 }}
            animate={{ ...slideTo, opacity: 1 }}
            exit={{ ...slideFrom, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            style={{
              position: "fixed", top: 0, bottom: 0,
              [isRTL ? "left" : "right"]: 0,
              width: "min(420px, 90vw)",
              zIndex: 999,
              display: "flex", flexDirection: "column",
              background: "var(--color-background)",
              borderInlineStart: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-elevated)",
              outline: "none",
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "18px 20px 14px",
                borderBottom: "1px solid var(--color-border)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: "var(--color-brand-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Clock size={18} color="color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))" />
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-foreground)", margin: 0 }}>
                    {t("title")}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--color-foreground-disabled)", margin: 0, marginTop: "1px" }}>
                    {t("subtitle")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Count badge */}
                {hasFetched && !error && items.length > 0 && (
                  <span
                    style={{
                      padding: "2px 8px", borderRadius: "999px",
                      background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                      color: "var(--color-brand-primary)",
                      fontSize: "11px", fontWeight: 700,
                    }}
                  >
                    {items.length}
                  </span>
                )}

                {/* Close button */}
                <button
                  onClick={onClose}
                  aria-label={t("close")}
                  style={{
                    width: "32px", height: "32px", borderRadius: "9px",
                    background: "color-mix(in srgb, var(--color-foreground) 4%, transparent)",
                    border: "1px solid var(--color-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "var(--color-foreground-secondary)",
                    transition: "all 0.2s ease", fontFamily: "inherit",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Content area (scrollable) ── */}
            <div
              style={{
                flex: 1, overflowY: "auto", overflowX: "hidden",
                padding: "20px 16px 32px",
              }}
            >
              {/* Loading */}
              {loading && (
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: "300px", gap: "16px",
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      border: "2px solid color-mix(in srgb, var(--color-brand-primary) 15%, transparent)",
                      borderTopColor: "var(--color-brand-primary)",
                    }}
                  />
                  <p style={{ fontSize: "13px", color: "var(--color-foreground-tertiary)", margin: 0 }}>
                    {t("loading")}
                  </p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: "300px", gap: "16px",
                    textAlign: "center", padding: "24px",
                  }}
                >
                  <div
                    style={{
                      width: "52px", height: "52px", borderRadius: "50%",
                      background: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X size={22} color="var(--color-danger)" />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-danger)", margin: 0 }}>
                    {t("errorTitle")}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--color-foreground-tertiary)", margin: 0, lineHeight: 1.6 }}>
                    {t("errorSubtitle")}
                  </p>
                  <button
                    onClick={fetchHistory}
                    style={{
                      padding: "8px 18px", borderRadius: "10px",
                      background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                      color: "var(--color-brand-primary)",
                      fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", marginTop: "4px",
                    }}
                  >
                    {t("retry")}
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && hasFetched && items.length === 0 && (
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: "300px", gap: "20px",
                    textAlign: "center", padding: "32px 24px",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
                    style={{
                      width: "64px", height: "64px", borderRadius: "50%",
                      background: "color-mix(in srgb, var(--color-foreground) 3%, transparent)",
                      border: "1px solid var(--color-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 0 10px color-mix(in srgb, var(--color-brand-surface) 50%, transparent), 0 0 0 20px color-mix(in srgb, var(--color-brand-surface) 20%, transparent)",
                    }}
                  >
                    <Sparkles size={26} color="var(--color-brand-primary)" />
                  </motion.div>

                  <div>
                    <h4 style={{ fontSize: "16px", fontWeight: 800, color: "var(--color-foreground)", margin: "0 0 8px" }}>
                      {t("emptyTitle")}
                    </h4>
                    <p style={{ fontSize: "13px", color: "var(--color-foreground-disabled)", lineHeight: 1.7, margin: 0 }}>
                      {t("emptySubtitle")}
                    </p>
                  </div>
                </div>
              )}

              {/* Timeline items */}
              {!loading && !error && items.length > 0 && (
                <div>
                  {items.map((item, i) => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      isLast={i === items.length - 1}
                      locale={locale}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
