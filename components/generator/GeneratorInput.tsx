"use client";

import { forwardRef, useState, useEffect, useCallback } from "react";
import { Trash2, ClipboardPaste } from "lucide-react";
import { useTranslations } from "next-intl";

interface GeneratorInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  mode?: "marketing" | "personal_creator" | "creator";
}

const GeneratorInput = forwardRef<HTMLTextAreaElement, GeneratorInputProps>(
  function GeneratorInput({ value, onChange, error, disabled, mode = "marketing" }, ref) {
    const t = useTranslations("GeneratorInput");

    const [placeholder, setPlaceholder] = useState("");

    useEffect(() => {
      const marketingExamples = t.raw("placeholders") as string[];
      const creatorExamples = (t.raw("creatorPlaceholders") as string[]) || marketingExamples;
      const PLACEHOLDER_EXAMPLES = (mode === "personal_creator" || mode === "creator") ? creatorExamples : marketingExamples;
      if (!PLACEHOLDER_EXAMPLES || PLACEHOLDER_EXAMPLES.length === 0) return;

      let currentIndex = 0;
      let currentText = "";
      let isDeleting = false;
      let typingSpeed = 70;
      let timeout: NodeJS.Timeout;

      const type = () => {
        const fullText = PLACEHOLDER_EXAMPLES[currentIndex];
        if (!fullText) return;

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

      setPlaceholder("");
      timeout = setTimeout(type, 300);

      return () => clearTimeout(timeout);
    }, [t, mode]);

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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", order: 3, marginTop: "var(--space-2)", marginBottom: "var(--space-2)" }}>
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
              borderRadius: "var(--radius-lg)",
              border: error
                ? "1.5px solid var(--color-danger)"
                : focused
                  ? "1.5px solid var(--color-brand-primary)"
                  : "1px solid var(--color-border)",
              background: "var(--color-surface)",
              padding: "var(--space-3) var(--space-4) var(--control-h-xl)",
              fontSize: "var(--text-base)",
              lineHeight: "var(--leading-relaxed)",
              color: "var(--color-foreground)",
              resize: "none",
              minHeight: "var(--textarea-min-h)",
              maxHeight: "var(--textarea-max-h)",
              outline: "none",
              boxShadow: focused ? "0 0 0 3px var(--color-brand-surface)" : "none",
              transition: "var(--transition-normal)",
              opacity: disabled ? 0.4 : 1,
              cursor: disabled ? "not-allowed" : "auto",
              fontFamily: "inherit",
              boxSizing: "border-box",
              caretColor: "var(--color-brand-primary)",
              scrollbarWidth: "none",
              overflowWrap: "break-word",
              wordBreak: "break-word",
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
                bottom: "var(--space-3)",
                insetInlineStart: "var(--space-2)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-full)",
                background: "var(--color-danger-surface)",
                border: "1px solid var(--color-danger-border)",
                color: "var(--color-danger)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-weight-semibold)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                transition: "var(--transition-normal)",
                fontFamily: "inherit",
                maxWidth: "calc(100% - var(--space-16) - var(--space-1-5))",
                overflow: "hidden",
              }}
            >
              <Trash2 size={12} />
              <span>{t("clearBtn")}</span>
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
                bottom: "var(--space-3)",
                insetInlineStart: "var(--space-2)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-full)",
                background: "var(--color-brand-surface)",
                border: "1px solid var(--color-brand-soft)",
                color: "var(--color-brand-primary)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-weight-semibold)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.3 : 1,
                transition: "var(--transition-normal)",
                fontFamily: "inherit",
                maxWidth: "calc(100% - var(--space-16) - var(--space-1-5))",
                overflow: "hidden",
              }}
            >
              <ClipboardPaste size={12} />
              <span>{t("pasteBtn")}</span>
            </button>
          )}

          {/* Character Counter */}
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-3)",
              insetInlineEnd: "var(--space-3)",
              fontSize: "var(--text-xs)",
              color: "var(--color-foreground-disabled)",
              fontWeight: "var(--font-weight-medium)",
              userSelect: "none",
            }}
          >
            {t("charCount", { count: value.length })}
          </div>
        </div>

        {error && (
          <p id="input-error" style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", fontWeight: "var(--font-weight-medium)", margin: 0 }} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

export default GeneratorInput;
