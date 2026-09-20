"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Star, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shadcn/button";
import AuthModal from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  CREDIT_PACKS,
  CURRENCY_SYMBOLS,
  getGeoPricing,
  type Currency,
  type CreditPack,
} from "@/config/pricing";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// Pricing — Phase 6: live credit-pack cards wired to /api/checkout.
// Currency is geo-detected on first render via navigator.language / Accept-Language
// then the server-side route resolves the authoritative currency from IP headers.
// UI shows all three packs; the "Growth" pack is highlighted as recommended.
// ---------------------------------------------------------------------------

export default function Pricing() {
  const t = useTranslations("Pricing");
  const { state, session, refreshCredits } = useAuth();
  const isLoggedIn = state === "authenticated";
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Client-side currency hint from browser locale (server will be authoritative)
  const [currency, setCurrency] = useState<Currency>("USD");
  const [packs, setPacks] = useState<CreditPack[]>(CREDIT_PACKS);

  useEffect(() => {
    // Best-effort: derive country hint from browser locale tag (e.g. "ar-EG", "ar-SA")
    const locale = typeof navigator !== "undefined" ? navigator.language : "";
    const tag = locale.split("-")[1]?.toUpperCase() ?? null;
    const { currency: resolved, packs: resolvedPacks } = getGeoPricing(tag);
    setCurrency(resolved);
    setPacks(resolvedPacks);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "mock_success") {
        setSuccessMsg(t("paymentSuccess"));
        refreshCredits();
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // Hide success message after 5 seconds
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    }
  }, [t, refreshCredits]);

  const handleBuy = async (packId: string) => {
    setError(null);

    if (!isLoggedIn || !session) {
      setIsAuthModalOpen(true);
      return;
    }

    setLoadingPackId(packId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packId }),
      });

      const data = (await res.json()) as { checkoutUrl?: string; error?: string };

      if (!res.ok || !data.checkoutUrl) {
        setError(t("checkoutError"));
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setError(t("checkoutError"));
    } finally {
      setLoadingPackId(null);
    }
  };

  const freeFeatures = (t.raw("freeFeatures") as string[]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto flex w-full max-w-4xl flex-col items-center"
    >
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-soft bg-brand-surface px-4 py-1.5">
        <Sparkles size={13} color="var(--color-brand-light)" />
        <span className="text-xs font-semibold tracking-[var(--tracking-caps)] text-brand-light">
          {t("badge")}
        </span>
      </div>
      <h2 className="text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight text-center">
        {t("title")}
      </h2>
      <p className="text-md text-foreground-secondary max-w-[480px] mx-auto leading-relaxed text-center mb-10">
        {t("subtitle")}
      </p>

      {/* ── Free card + 3 credit packs ───────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Free card */}
        <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm font-semibold text-foreground-secondary mb-3">
            {t("freeName")}
          </p>
          <div className="mb-6 flex min-h-[2.75rem] items-center gap-2">
            <span className="text-4xl font-extrabold text-foreground">
              {t("freePrice")}
            </span>
            <span className="text-sm text-foreground-tertiary">
              {t("freePeriod")}
            </span>
          </div>
          <ul className="flex flex-col gap-3 mb-8">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground-secondary">
                <Check size={15} color="var(--color-success)" className="shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isLoggedIn) scrollToId("generator");
              else setIsAuthModalOpen(true);
            }}
            className="mt-auto w-full rounded-xl font-bold active:scale-[0.98]"
          >
            {t("freeCta")}
          </Button>
        </div>

        {/* Credit packs */}
        {packs.map((pack) => {
          const isRecommended = pack.id === "growth";
          const isLoading = loadingPackId === pack.id;

          return (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-150 ${
                isRecommended
                  ? "border-brand-soft bg-surface hover:shadow-[var(--shadow-brand-glow)]"
                  : "border-border bg-surface"
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-soft bg-surface-elevated px-3 py-1.5 shadow-card">
                  <Star size={12} color="var(--color-brand-light)" />
                  <span className="text-xs font-bold text-brand-light">
                    {t("proBadge")}
                  </span>
                </div>
              )}

              <p className="text-sm font-semibold text-foreground-secondary mb-1">
                {t(`pack_${pack.id}_name`)}
              </p>
              <p className="text-xs text-foreground-tertiary mb-3">
                {pack.credits.toLocaleString()} {t("credits")}
              </p>
              <div className="mb-6 flex min-h-[2.75rem] items-baseline gap-1">
                <span className="text-3xl font-extrabold text-foreground">
                  {CURRENCY_SYMBOLS[currency]}{pack.prices[currency].toLocaleString()}
                </span>
                <span className="text-xs text-foreground-tertiary">{currency}</span>
              </div>

              <Button
                type="button"
                onClick={() => handleBuy(pack.id)}
                disabled={isLoading || loadingPackId !== null}
                className="mt-auto w-full rounded-xl font-extrabold active:scale-[0.98]"
                variant={isRecommended ? "default" : "outline"}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  t("buyCta")
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
      )}

      {/* Success banner */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success"
        >
          <Check size={16} />
          {successMsg}
        </motion.div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />
    </motion.div>
  );
}
