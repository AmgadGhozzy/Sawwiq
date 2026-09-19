"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { Globe } from "lucide-react";
import IconButton from "@/components/ui/IconButton";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = () => {
    const nextLocale = locale === "ar" ? "en" : "ar";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <IconButton
      onClick={handleSwitch}
      aria-label={locale === "ar" ? "English" : "العربية"}
      title={locale === "ar" ? "English" : "العربية"}
      size="lg"
      icon={<Globe size={18} />}
    />
  );
}