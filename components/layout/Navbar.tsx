import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import AccountButton from "@/components/auth/AccountButton";

/**
 * Marketing Navbar — no HistoryProvider.
 * Used on the landing page where HistoryContextProvider is absent.
 */
export default function Navbar() {
  const tGlobal = useTranslations("Global");
  const locale = useLocale();

  return (
    <header
      className="sticky top-4 z-[var(--z-navbar)] mx-4 md:mx-auto max-w-5xl"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-full)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-5 sm:px-6">
        {/* Logo + Wordmark */}
        <Link
          href={`/${locale}`}
          className="flex min-w-0 items-center gap-2.5 shrink-0"
          aria-label={tGlobal("productName")}
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={28}
            height={28}
            className="shrink-0 object-contain"
            priority
          />
          <span
            className="font-outfit font-extrabold leading-none text-foreground"
            style={{
              fontSize: "var(--text-lg)",
              letterSpacing: "var(--ltr-tracking-snug)",
            }}
          >
            {tGlobal("productName")}
          </span>
        </Link>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}
