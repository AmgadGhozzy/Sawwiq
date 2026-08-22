"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Sparkles } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useHistoryContext } from "./HistoryContext";
import HistoryCard from "./HistoryCard";

// ---------------------------------------------------------------------------
// HistoryDrawer - slides in from the inline-end side
// ---------------------------------------------------------------------------

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const t = useTranslations("History");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const { items, setItems, setSelectedHistoryIndex } = useHistoryContext();
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
              position: "fixed", inset: 0, zIndex: "var(--z-backdrop)",
              background: "var(--color-overlay)",
              backdropFilter: "blur(var(--blur-sm))",
              WebkitBackdropFilter: "blur(var(--blur-sm))",
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
              width: "min(var(--drawer-w), 90vw)",
              zIndex: "var(--z-modal)",
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
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <div
                  style={{
                    width: "var(--space-9)", height: "var(--space-9)", borderRadius: "var(--radius-md)",
                    background: "var(--color-brand-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Clock size={18} color="var(--color-brand-primary)" />
                </div>
                <div>
                  <p style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground)", margin: 0 }}>
                    {t("title")}
                  </p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-disabled)", margin: 0, marginTop: "var(--space-0-5)" }}>
                    {t("subtitle")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                {/* Count badge */}
                {!error && items.length > 0 && (
                  <span
                    style={{
                      padding: "2px 8px", borderRadius: "var(--radius-full)",
                      background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                      color: "var(--color-brand-primary)",
                      fontSize: "var(--text-xs)", fontWeight: 700,
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
                    width: "var(--space-8)", height: "var(--space-8)", borderRadius: "var(--radius-md)",
                    background: "var(--color-brand-surface)",
                    border: "1px solid var(--color-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "var(--color-foreground-secondary)",
                    transition: "var(--transition-normal)", fontFamily: "inherit",
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
                    justifyContent: "center", minHeight: "300px", gap: "var(--space-4)",
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    style={{
                      width: "var(--space-9)", height: "var(--space-9)", borderRadius: "var(--radius-circle)",
                      border: "2px solid var(--color-brand-soft)",
                      borderTopColor: "var(--color-brand-primary)",
                    }}
                  />
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-tertiary)", margin: 0 }}>
                    {t("loading")}
                  </p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: "300px", gap: "var(--space-4)",
                    textAlign: "center", padding: "var(--space-6)",
                  }}
                >
                  <div
                    style={{
                      width: "calc(var(--space-12) + var(--space-1))", height: "calc(var(--space-12) + var(--space-1))", borderRadius: "var(--radius-circle)",
                      background: "var(--color-danger-surface)",
                      border: "1px solid var(--color-danger-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X size={22} color="var(--color-danger)" />
                  </div>
                  <p style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-bold)", color: "var(--color-danger)", margin: 0 }}>
                    {t("errorTitle")}
                  </p>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-tertiary)", margin: 0, lineHeight: 1.6 }}>
                    {t("errorSubtitle")}
                  </p>
                  <button
                    onClick={fetchHistory}
                    style={{
                      padding: "8px 18px", borderRadius: "var(--radius-md)",
                      background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                      color: "var(--color-brand-primary)",
                      fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", marginTop: "var(--space-1)",
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
                    justifyContent: "center", minHeight: "300px", gap: "var(--space-5)",
                    textAlign: "center", padding: "32px 24px",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
                    style={{
                      width: "var(--space-16)", height: "var(--space-16)", borderRadius: "var(--radius-circle)",
                      background: "var(--color-brand-surface)",
                      border: "1px solid var(--color-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 0 var(--space-2-5) var(--color-brand-surface), 0 0 0 var(--space-5) var(--color-brand-surface)",
                    }}
                  >
                    <Sparkles size={26} color="var(--color-brand-primary)" />
                  </motion.div>

                  <div>
                    <h4 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-extrabold)", color: "var(--color-foreground)", margin: "0 0 var(--space-2)" }}>
                      {t("emptyTitle")}
                    </h4>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-disabled)", lineHeight: 1.7, margin: 0 }}>
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
                      onOpen={() => {
                        setSelectedHistoryIndex(i);
                        onClose();
                      }}
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
