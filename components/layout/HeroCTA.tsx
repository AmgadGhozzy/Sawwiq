"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/shadcn/button";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function HeroCTA() {
  const tHome = useTranslations("HomePage");

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Button
        type="button"
        size="lg"
        onClick={() => scrollToId("generator")}
        className="rounded-xl px-8 font-extrabold active:scale-[0.98]"
      >
        {tHome("ctaPrimary")}
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
