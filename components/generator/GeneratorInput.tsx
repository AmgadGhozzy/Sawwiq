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
    
    const [placeholder, setPlaceholder] = useState("");
    
    useEffect(() => {
      const PLACEHOLDER_EXAMPLES = t.raw("placeholders") as string[];
      if (!PLACEHOLDER_EXAMPLES || PLACEHOLDER_EXAMPLES.length === 0) return;
      
      let currentIndex = 0;
      let currentText = "";
      let isDeleting = false;
      let typingSpeed = 70;
      let timeout: NodeJS.Timeout;
      
      const type = () => {
        const fullText = PLACEHOLDER_EXAMPLES[currentIndex];
        
        if (isDeleting) {
          currentText = fullText.substring(0, currentText.length - 1);
          typingSpeed = 25;
        } else {
          currentText = fullText.substring(0, currentText.length + 1);
          typingSpeed = 60 + Math.random() * 40;
        }
        
        setPlaceholder(currentText);
        
        if (!isDeleting && currentText === fullText) {
          typingSpeed = 3000;
          isDeleting = true;
        } else if (isDeleting && currentText === "") {
          isDeleting = false;
          currentIndex = (currentIndex + 1) % PLACEHOLDER_EXAMPLES.length;
          typingSpeed = 600;
        }
        
        timeout = setTimeout(type, typingSpeed);
      };
      
      timeout = setTimeout(type, 800);
      
      return () => clearTimeout(timeout);
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
          style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-foreground-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}
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
                ? "1.5px solid color-mix(in srgb, var(--color-danger) 50%, transparent)"
                : focused
                  ? "1.5px solid var(--color-brand-primary)"
                  : "1px solid var(--color-border)",
              background: "var(--color-surface)",
              padding: "12px 14px 44px 14px",
              fontSize: "14px", lineHeight: 1.7,
              color: "var(--color-foreground)",
              resize: "none", minHeight: "140px", maxHeight: "400px",
              outline: "none",
              boxShadow: focused ? "0 0 0 3px var(--color-brand-surface)" : "none",
              transition: "all 0.2s ease",
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? "not-allowed" : "auto",
              fontFamily: "inherit", boxSizing: "border-box",
              caretColor: "var(--color-brand-primary)",
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
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 16px",
                borderRadius: "999px",
                background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)",
                color: "color-mix(in srgb, var(--color-danger) 80%, var(--color-foreground))",
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
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 16px",
                borderRadius: "999px",
                background: "var(--color-brand-surface)",
                border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
                color: "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))",
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
          <p id="input-error" style={{ fontSize: "12px", color: "var(--color-danger)", fontWeight: 500, margin: 0 }} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

export default GeneratorInput;
