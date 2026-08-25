"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [openUpward, setOpenUpward] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => setIsOpen(false);
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < 240;
      setOpenUpward(goUp);
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(goUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    }
    setIsOpen((prev) => !prev);
  };

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (options.length > 0 && !options.find((o) => o.value === value)) {
      onChange(options[0].value);
    }
  }, [value, options, onChange]);

  if (!selectedOption) return null;

  const menu = isOpen && mounted ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={menuRef}
          key="dropdown-menu"
          initial={{ opacity: 0, y: openUpward ? 5 : -5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: openUpward ? 5 : -5, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            ...menuStyle,
            background: "color-mix(in srgb, var(--color-background) 96%, transparent)",
            backdropFilter: "blur(var(--blur-lg))",
            WebkitBackdropFilter: "blur(var(--blur-lg))",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-1)",
            boxShadow: "var(--shadow-elevated)",
            maxHeight: "var(--dropdown-max-h)",
            overflowY: "auto",
            scrollbarWidth: "none",
          }}
        >
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
                fontSize: "var(--text-xs)",
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
      </AnimatePresence>,
      document.body
    )
  ) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        width: "100%",
        position: "relative",
      }}
    >
      <label style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <button
          ref={triggerRef}
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
            fontSize: "var(--text-xs)",
            color: "var(--color-foreground)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            boxShadow: isOpen ? "var(--focus-ring)" : "var(--shadow-card)",
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
              flexShrink: 0,
            }}
          />
        </button>
        {menu}
      </div>
    </div>
  );
}
