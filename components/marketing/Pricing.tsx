"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shadcn/button";
import AuthModal from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// Pricing — 2-card hook section (UI only, no Stripe yet).
// Free converts to signup today; Pro captures launch interest via the CTA
// section below (id="waitlist-cta"). Buttons rewire to Checkout in Phase 6.
// ---------------------------------------------------------------------------

export default function Pricing() {
  const t = useTranslations("Pricing");
  const { state } = useAuth();
  const isLoggedIn = state === "authenticated";
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const freeFeatures = (t.raw("freeFeatures") as string[]) || [];
  const proFeatures = (t.raw("proFeatures") as string[]) || [];

  const handleFreeCta = () => {
    if (isLoggedIn) scrollToId("generator");
    else setIsAuthModalOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto flex w-full max-w-3xl flex-col items-center"
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

      <div className="grid w-full grid-cols-1 gap-8 pt-6 md:grid-cols-2 md:gap-5">
        <div className="flex flex-col rounded-2xl border border-border bg-surface p-8">
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
            onClick={handleFreeCta}
            className="mt-auto w-full rounded-xl font-bold active:scale-[0.98]"
          >
            {t("freeCta")}
          </Button>
        </div>

        <div className="relative flex flex-col rounded-2xl border border-brand-soft bg-surface p-8 transition-all duration-150 hover:shadow-[var(--shadow-brand-glow)]">
          <div className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-soft bg-surface-elevated px-3 py-1.5 shadow-card">
            <Star size={12} color="var(--color-brand-light)" />
            <span className="text-xs font-bold text-brand-light">
              {t("proBadge")}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground-secondary mb-3">
            {t("proName")}
          </p>
          <div className="mb-6 flex min-h-[2.75rem] items-center gap-2">
            <span className="text-2xl font-extrabold text-foreground">
              {t("proPrice")}
            </span>
          </div>
          <ul className="flex flex-col gap-3 mb-8">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground-secondary">
                <Check size={15} color="var(--color-brand-light)" className="shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            onClick={() => scrollToId("waitlist-cta")}
            className="mt-auto w-full rounded-xl font-extrabold active:scale-[0.98]"
          >
            {t("proCta")}
          </Button>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />
    </motion.div>
  );
}
