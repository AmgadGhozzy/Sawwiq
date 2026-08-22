"use client";

import { motion } from "framer-motion";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

interface PlatformSelectorProps {
  platforms: string[];
  selected: string;
  onChange: (platform: string) => void;
  disabled?: boolean;
}

export function PlatformSelector({ platforms, selected, onChange, disabled }: PlatformSelectorProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        padding: "4px 2px",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      {platforms.map((platform) => {
        const isActive = selected === platform;
        return (
          <motion.button
            key={platform}
            type="button"
            disabled={disabled}
            onClick={() => onChange(platform)}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            style={{
              flexShrink: 0,
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive ? "var(--color-brand-soft)" : "var(--color-surface)",
              border: isActive ? "1.5px solid var(--color-brand-primary)" : "1px solid var(--color-border)",
              boxShadow: isActive ? "0 0 12px var(--color-brand-surface)" : "var(--shadow-card)",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.4 : 1,
              transition: "all 0.2s ease",
            }}
          >
            <PlatformIcon platform={platform} />
          </motion.button>
        );
      })}
    </div>
  );
}
