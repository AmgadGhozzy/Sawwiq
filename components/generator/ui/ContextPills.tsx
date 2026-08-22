"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
}

export function DropdownPill({ label, value, options, onChange, disabled }: DropdownPillProps) {
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

  if (!selectedOption) return null;

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "99px",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "rgba(255, 255, 255, 0.8)",
          fontSize: "12px",
          fontWeight: 500,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "all 0.2s",
        }}
      >
        <span>{label}:</span>
        <span style={{ color: "#fff" }}>{selectedOption.label}</span>
        <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.6 }}>▾</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: "4px",
              background: "rgba(9, 9, 11, 0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "4px",
              zIndex: 50,
              minWidth: "160px",
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)",
              maxHeight: "200px",
              overflowY: "auto",
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
                  textAlign: "right",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: value === opt.value ? "rgba(139, 92, 246, 0.15)" : "transparent",
                  color: value === opt.value ? "#a78bfa" : "rgba(255, 255, 255, 0.8)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: value === opt.value ? 600 : 400,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (value !== opt.value) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (value !== opt.value) e.currentTarget.style.background = "transparent";
                }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
