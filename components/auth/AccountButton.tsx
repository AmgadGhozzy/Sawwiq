"use client";

import { useState } from "react";
import { UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "./AuthProvider";
import { AccountDropdown } from "./AccountDropdown";
import AuthModal from "./AuthModal";
import IconButton from "@/components/ui/IconButton";

export default function AccountButton() {
  const { state, user, credits } = useAuth();
  const t = useTranslations("AccountDropdown");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (state === "loading") {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-surface-elevated" />;
  }

  if (state === "unauthenticated") {
    return (
      <>
        <IconButton
          onClick={() => setIsAuthModalOpen(true)}
          aria-label={t("signInLabel")}
          size="lg"
          icon={<UserCircle size={18} />}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-expanded={isDropdownOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated py-1 pe-3 ps-1 transition-colors hover:border-brand-soft hover:bg-surface-hover"
      >
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-foreground-inverse [background-image:var(--gradient-brand)]">
          {!imageError && avatarUrl ? (
            <img
              src={avatarUrl}
              alt={t("avatarLabel")}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            initial
          )}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {credits ?? 0}
        </span>
      </button>

      <AccountDropdown
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
      />
    </div>
  );
}
