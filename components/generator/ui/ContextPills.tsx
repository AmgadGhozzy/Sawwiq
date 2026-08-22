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
        gap: "var(--space-1)",
        width: "100%",
        position: "relative",
        zIndex: isOpen ? "var(--z-dropdown)" : "var(--z-base)",
      }}
      ref={dropdownRef}
    >
      <label style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            padding: "var(--space-2) var(--space-3)",
            paddingInlineEnd: "var(--space-8)",
            fontSize: "var(--text-sm)",
            color: "var(--color-foreground)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            boxShadow: isOpen ? "0 0 0 3px var(--color-brand-surface)" : "var(--shadow-card)",
            transition: "var(--transition-normal)",
            fontFamily: "inherit",
            boxSizing: "border-box",
            textAlign: "start",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", overflow: "hidden", flex: 1, minWidth: 0 }}>
            {renderIcon && renderIcon(selectedOption.value)}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
              {selectedOption.label}
            </span>
          </div>
          <ChevronDown
            size={14}
            color="var(--color-foreground-secondary)"
            style={{
              position: "absolute",
              insetInlineEnd: "var(--space-3)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "var(--transition-normal)",
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
                ...(openUpward ? { bottom: "100%", marginBottom: "var(--space-1)" } : { top: "100%", marginTop: "var(--space-1)" }),
                right: 0,
                left: 0,
                background: "color-mix(in srgb, var(--color-background) 96%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-1)",
                zIndex: "var(--z-dropdown)",
                boxShadow: "var(--shadow-elevated)",
                maxHeight: "var(--dropdown-max-h)",
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
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    background: value === opt.value ? "var(--color-brand-soft)" : "transparent",
                    color: value === opt.value ? "var(--color-brand-primary)" : "var(--color-foreground-secondary)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontFamily: "inherit",
                    transition: "background var(--transition-fast)",
                    overflow: "hidden",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={(e) => {
                    if (value !== opt.value) e.currentTarget.style.background = "var(--color-brand-surface)";
                  }}
                  onMouseLeave={(e) => {
                    if (value !== opt.value) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {renderIcon && renderIcon(opt.value)}
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
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
