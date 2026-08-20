"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  ARABIC_STYLES,
  CONTENT_TYPES,
  PLATFORMS,
  type ArabicStyle, type ContentType, type Platform,
} from "@/types/content";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

interface GeneratorSettingsProps {
  platform: Platform;
  arabicStyle: ArabicStyle;
  contentType: ContentType;
  onPlatformChange: (platform: Platform) => void;
  onArabicStyleChange: (style: ArabicStyle) => void;
  onContentTypeChange: (type: ContentType) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Custom Dropdown Component
// ---------------------------------------------------------------------------

function CustomDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  renderIcon,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  renderIcon?: (val: T) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    // If the provided value isn't valid, automatically select the first valid option
    if (!options.find((o) => o.value === value) && options.length > 0) {
      onChange(options[0].value);
    }
  }, [value, options, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} ref={dropdownRef}>
      <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          style={{
            width: "100%", borderRadius: "10px",
            border: isOpen ? "1.5px solid rgba(124,58,237,0.6)" : "1.5px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            padding: "9px 12px 9px 36px",
            fontSize: "13px", color: "#e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            boxShadow: isOpen ? "0 0 0 3px rgba(124,58,237,0.15)" : "none",
            transition: "all 0.2s ease",
            fontFamily: "inherit", boxSizing: "border-box", textAlign: "right", // Note: textAlign might need logical prop
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {renderIcon && renderIcon(selectedOption.value)}
            <span>{selectedOption.label}</span>
          </div>
          <ChevronDown size={14} color="#7c3aed" style={{ position: "absolute", left: "12px", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "absolute", top: "100%", right: 0, left: 0, marginTop: "6px",
                background: "rgba(15,18,30,0.95)",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "6px", zIndex: 50,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                maxHeight: "220px", overflowY: "auto",
                scrollbarWidth: "none", msOverflowStyle: "none"
              }}
            >
              <style>{`div::-webkit-scrollbar { display: none; }`}</style>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    width: "100%", textAlign: "right",
                    padding: "8px 10px", borderRadius: "8px",
                    background: value === opt.value ? "rgba(124,58,237,0.15)" : "transparent",
                    color: value === opt.value ? "#c4b5fd" : "#e2e8f0",
                    border: "none", cursor: "pointer",
                    fontSize: "13px", display: "flex", alignItems: "center", gap: "8px",
                    fontFamily: "inherit", transition: "background 0.1s"
                  }}
                  onMouseEnter={(e) => {
                    if (value !== opt.value) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (value !== opt.value) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {renderIcon && renderIcon(opt.value)}
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}



export default function GeneratorSettings({
  platform, arabicStyle, contentType, onPlatformChange, onArabicStyleChange, onContentTypeChange, disabled,
}: GeneratorSettingsProps) {
  const t = useTranslations("GeneratorSettings");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <CustomDropdown
        label={t("platformLabel")}
        value={platform} onChange={onPlatformChange} disabled={disabled}
        options={PLATFORMS.map((p) => ({ value: p, label: t(`platforms.${p}`) }))}
        renderIcon={(val: string) => <PlatformIcon platform={val as Platform} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <CustomDropdown
          label={t("contentTypeLabel")}
          value={contentType} onChange={onContentTypeChange} disabled={disabled}
          options={CONTENT_TYPES.map((type) => ({ value: type, label: t(`contentTypes.${type}`) }))}
        />
        <CustomDropdown
          label={t("arabicStyleLabel")}
          value={arabicStyle} onChange={onArabicStyleChange} disabled={disabled}
          options={ARABIC_STYLES.map((s) => ({ value: s, label: t(`arabicStyles.${s}`) }))}
        />
      </div>
    </div>
  );
}
