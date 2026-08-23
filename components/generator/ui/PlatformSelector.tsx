"use client";

import { motion } from "framer-motion";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

interface PlatformSelectorProps {
  platforms: string[];
  selected: string;
  onChange: (platform: string) => void;
  disabled?: boolean;
}

// Maps platform → its brand color CSS variable
const PLATFORM_COLOR: Record<string, string> = {
  instagram: "var(--color-platform-instagram)",
  x:         "var(--color-platform-x-twitter)",
  x_twitter: "var(--color-platform-x-twitter)",
  linkedin:  "var(--color-platform-linkedin)",
  tiktok:    "var(--color-platform-tiktok)",
  facebook:  "var(--color-platform-facebook)",
  youtube:   "var(--color-platform-youtube)",
  whatsapp:  "var(--color-platform-whatsapp)",
  threads:   "var(--color-platform-threads)",
};

export function PlatformSelector({ platforms, selected, onChange, disabled }: PlatformSelectorProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        paddingTop: "var(--space-1)",
        paddingBottom: 0,
        paddingInline: "var(--space-2)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        overflowX: "auto",
        width: "fit-content",
        maxWidth: "100%",
        margin: "0 auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
        boxSizing: "border-box",
      }}
    >
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      {platforms.map((platform) => {
        const isActive = selected === platform;
        const brandColor = PLATFORM_COLOR[platform] ?? "var(--color-brand-primary)";
        const activeBg = `color-mix(in srgb, ${brandColor} 12%, transparent)`;

        return (
          <div
            key={platform}
            style={{
              position: "relative",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-0-5)",
            }}
          >
            <motion.button
              type="button"
              disabled={disabled}
              onClick={() => onChange(platform)}
              whileHover={!disabled ? { scale: 1.08 } : {}}
              whileTap={!disabled ? { scale: 0.92 } : {}}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-lg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? activeBg : "transparent",
                border: "none",
                color: isActive ? brandColor : "var(--color-foreground-disabled)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1,
                transition: "var(--transition-normal)",
              }}
            >
              <PlatformIcon platform={platform} size={isActive ? 24 : 22} />
            </motion.button>

            {/* Active indicator dot */}
            <motion.div
              initial={false}
              animate={{
                opacity: isActive ? 1 : 0,
                scaleX: isActive ? 1 : 0,
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                width: "18px",
                height: "2px",
                borderRadius: "var(--radius-full) var(--radius-full) 0 0",
                background: brandColor,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
