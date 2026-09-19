"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "./AuthProvider";
import { useEffect, useRef } from "react";

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountDropdown({ isOpen, onClose }: AccountDropdownProps) {
  const { user, credits, signOut } = useAuth();
  const t = useTranslations("AccountDropdown");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          role="menu"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute end-0 top-[calc(100%+var(--space-2))] z-[var(--z-dropdown)] flex w-60 flex-col gap-3 rounded-xl border border-border bg-surface-elevated p-3 shadow-elevated"
        >
          {/* User Email — truncated LTR with full text on hover */}
          <div className="px-2">
            <div
              dir="ltr"
              title={user?.email ?? ""}
              className="truncate text-start text-sm font-medium text-foreground"
            >
              {user?.email}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between rounded-lg border border-brand-soft bg-brand-surface px-3 py-2">
            <div className="flex items-center gap-2 font-bold text-brand-primary">
              <Zap size={16} />
              <span className="tabular-nums">{credits ?? 0}</span>
            </div>
            <span className="text-xs text-brand-primary opacity-70">{t("creditsRemaining")}</span>
          </div>

          <div className="h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              signOut();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-md p-2 text-sm font-medium text-danger transition-colors hover:bg-danger-surface"
          >
            <LogOut size={16} />
            {t("signOut")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
