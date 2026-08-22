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
      <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: "8px", order: 3, marginTop: "8px", marginBottom: "8px" }}>
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
              width: "100%", 
              borderRadius: "16px",
              border: error
                ? "1.5px solid rgba(239, 68, 68, 0.5)"
                : focused
                  ? "1.5px solid rgba(139, 92, 246, 0.8)"
                  : "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "16px 16px 48px 16px",
              fontSize: "14px", 
              lineHeight: 1.8,
              color: "#fff",
              resize: "none", 
              minHeight: "150px", 
              maxHeight: "400px",
              outline: "none",
              boxShadow: focused ? "0 0 20px rgba(139, 92, 246, 0.15)" : "none",
              transition: "all 0.2s ease",
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? "not-allowed" : "auto",
              fontFamily: "inherit", 
              boxSizing: "border-box",
              caretColor: "#8b5cf6",
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
                bottom: "12px",
                insetInlineStart: "12px",
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px",
                borderRadius: "99px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#f87171",
                fontSize: "11px", fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                transition: "all 0.2s ease",
              }}
            >
              <Trash2 size={14} />
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
                bottom: "12px",
                insetInlineStart: "12px",
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px",
                borderRadius: "99px",
                background: "rgba(139, 92, 246, 0.1)",
                border: "1px solid rgba(139, 92, 246, 0.2)",
                color: "#a78bfa",
                fontSize: "11px", fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                transition: "all 0.2s ease",
              }}
            >
              <ClipboardPaste size={14} />
              {t("pasteBtn")}
            </button>
          )}
          {/* Character Counter */}
          <div style={{
            position: "absolute",
            bottom: "12px",
            insetInlineEnd: "16px",
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.4)",
            fontWeight: 500
          }}>
            {value.length} حرف
          </div>
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
