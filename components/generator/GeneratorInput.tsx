"use client";

import { forwardRef, useState, useEffect, useCallback } from "react";
import { Trash2, ClipboardPaste } from "lucide-react";
import { useTranslations } from "next-intl";

interface GeneratorInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const GeneratorInput = forwardRef<HTMLTextAreaElement, GeneratorInputProps>(
  function GeneratorInput({ value, onChange, error, disabled }, ref) {
    const t = useTranslations("GeneratorInput");
    
    // Empty on server, random on client after mount — avoids SSR hydration mismatch
    const [placeholder, setPlaceholder] = useState("");
    
    useEffect(() => {
      // Get array of placeholders from translations. Assuming it returns an array of strings.
      // With next-intl we can use raw() for arrays or objects.
      const PLACEHOLDER_EXAMPLES = t.raw("placeholders") as string[];
      setPlaceholder(PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)]);
    }, [t]);
    
    const [focused, setFocused] = useState(false);

    const handleClear = useCallback(() => {
      onChange("");
    }, [onChange]);

    const handlePaste = useCallback(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) onChange(value + text);
      } catch (err) {
        console.error("Failed to read clipboard:", err);
      }
    }, [onChange, value]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          htmlFor="raw-input"
          style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {t("label")}
        </label>
        <div style={{ position: "relative" }}>
          <textarea
            ref={ref}
            id="raw-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            rows={5}
            style={{
              width: "100%", borderRadius: "12px",
              border: error
                ? "1.5px solid rgba(239,68,68,0.5)"
                : focused
                  ? "1.5px solid rgba(124,58,237,0.7)"
                  : "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
              padding: "12px 14px 44px 14px",
              fontSize: "14px", lineHeight: 1.7,
              color: "#f1f5f9",
              resize: "none", minHeight: "140px", maxHeight: "400px",
              outline: "none",
              boxShadow: focused ? "0 0 0 3px rgba(124,58,237,0.12)" : "none",
              transition: "all 0.2s ease",
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? "not-allowed" : "auto",
              fontFamily: "inherit", boxSizing: "border-box",
              caretColor: "#a78bfa",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "input-error" : undefined}
          />
          {/* Action Button: Clear if has text, Paste if empty */}
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              title={t("clearTitle")}
              aria-label={t("clearTitle")}
              style={{
                position: "absolute",
                bottom: "16px",
                insetInlineStart: "10px",
                display: "flex", alignItems: "center", gap: "5px",
                padding: "5px 12px",
                borderRadius: "8px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
                fontSize: "11px", fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                transition: "all 0.2s ease",
                fontFamily: "inherit",
              }}
            >
              <Trash2 size={12} />
              {t("clearBtn")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePaste}
              disabled={disabled}
              title={t("pasteTitle")}
              aria-label={t("pasteTitle")}
              style={{
                position: "absolute",
                bottom: "16px",
                insetInlineStart: "10px",
                display: "flex", alignItems: "center", gap: "5px",
                padding: "5px 12px",
                borderRadius: "8px",
                background: "rgba(124,58,237,0.1)",
                border: "1px solid rgba(124,58,237,0.2)",
                color: "#c4b5fd",
                fontSize: "11px", fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                transition: "all 0.2s ease",
                fontFamily: "inherit",
              }}
            >
              <ClipboardPaste size={12} />
              {t("pasteBtn")}
            </button>
          )}
        </div>
        {error && (
          <p id="input-error" style={{ fontSize: "12px", color: "#f87171", fontWeight: 500, margin: 0 }} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

export default GeneratorInput;
