"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function HeroCTA() {
  const tHome = useTranslations("HomePage");
  const locale = useLocale();

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Button
        asChild
        size="lg"
        className="rounded-xl px-8 font-extrabold active:scale-[0.98]"
      >
        <Link href={`/${locale}/generate`}>{tHome("ctaPrimary")}</Link>
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        onClick={() => scrollToId("how-it-works")}
        className="rounded-xl px-8 font-bold active:scale-[0.98]"
      >
        {tHome("ctaSecondary")}
      </Button>
    </div>
  );
}
