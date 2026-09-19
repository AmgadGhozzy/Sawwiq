"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Clock, Sparkles } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useHistoryContext } from "./HistoryContext";
import HistoryCard from "./HistoryCard";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn/sheet";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { Skeleton } from "@/components/shadcn/skeleton";

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

  const { items, setSelectedHistoryIndex, refreshHistory } = useHistoryContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // ── Fetch history when drawer opens (Radix owns overlay/ESC/scroll-lock/focus) ──
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    const ok = await refreshHistory();
    if (!ok) setError(true);
    setLoading(false);
    setHasFetched(true);
  }, [refreshHistory]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side={isRTL ? "left" : "right"}
        showCloseButton={false}
        aria-label={t("title")}
        className="w-[min(var(--drawer-w),90vw)] border-s border-l-0 border-r-0 border-border bg-background p-0 shadow-elevated sm:max-w-none gap-0"
      >
        {/* Screen-reader title for Radix (visual header below is unchanged) */}
        <SheetTitle className="sr-only">{t("title")}</SheetTitle>
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "var(--space-4-5) var(--space-5) var(--space-3-5)",
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
                {!error && items.length > 0 && (
                  <span
                    style={{
                      padding: "var(--space-0-5) var(--space-2)", borderRadius: "var(--radius-full)",
                      background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                      color: "var(--color-brand-primary)",
                      fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-bold)",
                    }}
                  >
                    {items.length}
                  </span>
                )}

                <IconButton
                  onClick={onClose}
                  aria-label={t("close")}
                  variant="brandSoft"
                  size="sm"
                  icon={<X size={15} />}
                />
              </div>
            </div>

              <ScrollArea className="flex-1 min-h-0">
              <div style={{ padding: "var(--space-5) var(--space-4) var(--space-8)" }}>
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              )}

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
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-tertiary)", margin: 0, lineHeight: "var(--leading-normal)" }}>
                    {t("errorSubtitle")}
                  </p>
                  <Button
                    onClick={fetchHistory}
                    variant="brandSoft"
                    size="sm"
                    style={{ marginTop: "var(--space-1)", paddingInline: "var(--space-4-5)", paddingBlock: "var(--space-2)" }}
                  >
                    {t("retry")}
                  </Button>
                </div>
              )}

              {!loading && !error && hasFetched && items.length === 0 && (
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: "300px", gap: "var(--space-5)",
                    textAlign: "center", padding: "var(--space-8) var(--space-6)",
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
                    <h4 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground)", margin: "0 0 var(--space-2)" }}>
                      {t("emptyTitle")}
                    </h4>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-disabled)", lineHeight: "var(--leading-relaxed)", margin: 0 }}>
                      {t("emptySubtitle")}
                    </p>
                  </div>
                </div>
              )}

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
            </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
