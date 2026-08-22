"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface DropdownPillProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (val: string) => void;
  disabled?: boolean;
  renderIcon?: (val: string) => React.ReactNode;
}

export function DropdownPill({ label, value, options, onChange, disabled, renderIcon }: DropdownPillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If space below is less than 230px, open upwards
      setOpenUpward(spaceBelow < 230);
    }
    setIsOpen(!isOpen);
  };

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (options.length > 0 && !options.find((o) => o.value === value)) {
      onChange(options[0].value);
    }
  }, [value, options, onChange]);

  if (!selectedOption) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
        position: "relative",
        zIndex: isOpen ? 70 : 1,
      }}
      ref={dropdownRef}
    >
      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          style={{
            width: "100%",
            borderRadius: "var(--radius-md)",
            border: isOpen ? "1.5px solid var(--color-brand-primary)" : "1.5px solid var(--color-border)",
            background: "var(--color-surface)",
            padding: "9px 12px",
            paddingInlineEnd: "36px",
            fontSize: "13px",
            color: "var(--color-foreground)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            boxShadow: isOpen ? "0 0 0 3px var(--color-brand-surface)" : "var(--shadow-card)",
            transition: "all 0.2s ease",
            fontFamily: "inherit",
            boxSizing: "border-box",
            textAlign: "start",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
            {renderIcon && renderIcon(selectedOption.value)}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedOption.label}
            </span>
          </div>
          <ChevronDown
            size={14}
            color="var(--color-brand-primary)"
            style={{
              position: "absolute",
              insetInlineEnd: "12px",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: openUpward ? 5 : -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: openUpward ? 5 : -5, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: "absolute",
                ...(openUpward ? { bottom: "100%", marginBottom: "6px" } : { top: "100%", marginTop: "6px" }),
                right: 0,
                left: 0,
                background: "color-mix(in srgb, var(--color-background) 96%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "6px",
                zIndex: 80,
                boxShadow: "var(--shadow-elevated)",
                maxHeight: "220px",
                overflowY: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
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
                    width: "100%",
                    textAlign: "start",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: value === opt.value ? "var(--color-brand-soft)" : "transparent",
                    color: value === opt.value ? "var(--color-brand-primary)" : "var(--color-foreground-secondary)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: "inherit",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (value !== opt.value) e.currentTarget.style.background = "var(--color-brand-surface)";
                  }}
                  onMouseLeave={(e) => {
                    if (value !== opt.value) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {renderIcon && renderIcon(opt.value)}
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
