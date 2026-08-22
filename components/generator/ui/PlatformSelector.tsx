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
        padding: "4px",
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
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive ? "rgba(139, 92, 246, 0.1)" : "rgba(255, 255, 255, 0.02)",
              border: isActive ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid rgba(255, 255, 255, 0.05)",
              boxShadow: isActive ? "0 0 15px rgba(139, 92, 246, 0.2)" : "none",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
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
