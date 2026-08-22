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
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        overflowX: "auto",
        padding: "var(--space-3) var(--space-2)",
        width: "100%",
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
              width: "var(--control-h-xl)",
              height: "var(--control-h-xl)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive 
                ? "var(--color-brand-soft)" 
                : "var(--color-surface)",
              border: isActive 
                ? "none" 
                : "1px solid var(--color-border)",
              boxShadow: isActive 
                ? "var(--shadow-glow)" 
                : "var(--shadow-card)",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.4 : 1,
              transition: "var(--transition-normal)",
            }}
          >
            <PlatformIcon platform={platform} />
          </motion.button>
        );
      })}
    </div>
  );
}
