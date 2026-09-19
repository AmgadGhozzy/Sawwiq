import Image from "next/image";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import HistoryProvider from "@/components/history/HistoryProvider";
import AccountButton from "@/components/auth/AccountButton";

export default function Navbar() {
  const tGlobal = useTranslations("Global");

  return (
    <div className="sticky top-3 sm:top-4 z-[var(--z-navbar)] px-4">
      <header className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 rounded-full border border-border bg-[color-mix(in_srgb,var(--color-surface-elevated)_60%,transparent)] px-4 shadow-elevated backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="shrink-0 object-contain"
          />
          <span className="truncate font-outfit text-xl font-extrabold leading-none tracking-[var(--ltr-tracking-snug)] text-foreground">
            {tGlobal("productName")}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <HistoryProvider />
          <AccountButton />
        </div>
      </header>
    </div>
  );
}
