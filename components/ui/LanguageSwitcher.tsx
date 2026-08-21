"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Globe } from "lucide-react";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = () => {
    const nextLocale = locale === "ar" ? "en" : "ar";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={handleSwitch}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        cursor: "pointer",
        color: "var(--color-foreground-secondary)",
        transition: "all 0.2s ease",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-surface-elevated)";
        e.currentTarget.style.color = "var(--color-foreground)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
        e.currentTarget.style.color = "var(--color-foreground-secondary)";
        e.currentTarget.style.transform = "scale(1)";
      }}
      title={locale === "ar" ? "English" : "العربية"}
      aria-label={locale === "ar" ? "English" : "العربية"}
    >
      <Globe size={18} />
    </button>
  );
}
