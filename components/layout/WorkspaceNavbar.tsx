import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import AccountButton from "@/components/auth/AccountButton";
import HistoryProvider from "@/components/history/HistoryProvider";

/**
 * Workspace Navbar — glass capsule twin of the home Navbar (same recipe:
 * translucent elevated surface, blur, subtle border, elevated shadow).
 * Wider (5xl) to suit the app workspace; logo links back home.
 * Must be rendered inside a HistoryContextProvider tree
 * (provided by /generate/layout.tsx).
 */
export default function WorkspaceNavbar() {
  const tGlobal = useTranslations("Global");
  const locale = useLocale();

  return (
    <div className="sticky top-3 sm:top-4 z-[var(--z-navbar)] px-4 mb-2">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-border bg-[color-mix(in_srgb,var(--color-surface-elevated)_60%,transparent)] px-4 shadow-elevated backdrop-blur-xl">
        {/* Logo + Wordmark */}
        <Link
          href={`/${locale}`}
          className="flex min-w-0 shrink-0 items-center gap-2.5"
          aria-label={tGlobal("productName")}
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="shrink-0 object-contain"
            priority
          />
          <span className="truncate font-outfit text-xl font-extrabold leading-none tracking-[var(--ltr-tracking-snug)] text-foreground">
            {tGlobal("productName")}
          </span>
        </Link>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <HistoryProvider />
          <AccountButton />
        </div>
      </header>
    </div>
  );
}
