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
      if (!res.ok) {
        setError(true);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, fetchHistory]);

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

  // ── Focus trap: focus the drawer when it opens ──
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [open]);

  // Slide direction: always from the end (right for both RTL and LTR)
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
              position: "fixed",
              inset: 0,
              zIndex: 998,
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
              position: "fixed",
              top: 0,
              bottom: 0,
              [isRTL ? "left" : "right"]: 0,
              width: "min(420px, 90vw)",
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
              background:
                "linear-gradient(180deg, rgba(9,9,11,0.98) 0%, rgba(12,10,24,0.98) 100%)",
              borderInlineStart: "1px solid rgba(255,255,255,0.06)",
              boxShadow:
                "-20px 0 60px rgba(0,0,0,0.5), 0 0 100px rgba(124,58,237,0.04)",
              outline: "none",
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "9px",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                    flexShrink: 0,
                  }}
                >
                  <Clock size={14} color="#fff" />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#f1f5f9",
                      margin: 0,
                    }}
                  >
                    {t("title")}
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      margin: 0,
                      marginTop: "1px",
                    }}
                  >
                    {t("subtitle")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Count badge */}
                {hasFetched && !error && items.length > 0 && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: "rgba(124,58,237,0.12)",
                      border: "1px solid rgba(124,58,237,0.25)",
                      color: "#a78bfa",
                      fontSize: "11px",
                      fontWeight: 700,
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
                    width: "32px",
                    height: "32px",
                    borderRadius: "9px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#94a3b8",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Content area (scrollable) ── */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                padding: "20px 16px 32px",
              }}
            >
              {/* Loading */}
              {loading && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "300px",
                    gap: "16px",
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "2px solid rgba(124,58,237,0.15)",
                      borderTopColor: "#7c3aed",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#64748b",
                      margin: 0,
                    }}
                  >
                    {t("loading")}
                  </p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "300px",
                    gap: "16px",
                    textAlign: "center",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={22} color="#f87171" />
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#f87171",
                      margin: 0,
                    }}
                  >
                    {t("errorTitle")}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {t("errorSubtitle")}
                  </p>
                  <button
                    onClick={fetchHistory}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "10px",
                      background: "rgba(124,58,237,0.12)",
                      border: "1px solid rgba(124,58,237,0.25)",
                      color: "#a78bfa",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      marginTop: "4px",
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
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "300px",
                    gap: "20px",
                    textAlign: "center",
                    padding: "32px 24px",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.15,
                    }}
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow:
                        "0 0 0 10px rgba(124,58,237,0.05), 0 0 0 20px rgba(124,58,237,0.02), 0 10px 30px rgba(124,58,237,0.12)",
                    }}
                  >
                    <Sparkles size={26} color="#a78bfa" />
                  </motion.div>

                  <div>
                    <h4
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#e2e8f0",
                        margin: "0 0 8px",
                      }}
                    >
                      {t("emptyTitle")}
                    </h4>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
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
