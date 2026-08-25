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

    const isCreator = mode === "personal_creator" || mode === "creator";
    const quickList = (isCreator
      ? (t.raw("quickCreatorPrompts") as Array<{ label: string; text: string }>)
      : (t.raw("quickPrompts") as Array<{ label: string; text: string }>)) || [];

    const [placeholder, setPlaceholder] = useState("");
    const [pasteError, setPasteError] = useState(false);
    const [focused, setFocused] = useState(false);

    const showQuickChips = !value && !focused && !disabled && quickList.length > 0;

    useEffect(() => {
      if (showQuickChips) return;

      const marketingExamples = t.raw("placeholders") as string[];
      const creatorExamples = (t.raw("creatorPlaceholders") as string[]) || marketingExamples;
      const PLACEHOLDER_EXAMPLES = isCreator ? creatorExamples : marketingExamples;
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
    }, [t, mode, showQuickChips]);

    const handleClear = useCallback(() => {
      onChange("");
    }, [onChange]);

    const handlePaste = useCallback(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) onChange(value + text);
      } catch (err) {
        console.error("Failed to read clipboard:", err);
        setPasteError(true);
        setTimeout(() => setPasteError(false), 3000);
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
              fontSize: "var(--text-sm)",
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
                bottom: "var(--space-4)",
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
                bottom: "var(--space-4)",
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

          {/* Quick Inspiration Chips — floating inside the textarea when empty */}
          {showQuickChips && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              padding: "var(--space-7) var(--space-4) var(--space-1)",
              pointerEvents: "none",
              zIndex: 1,
            }}>
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--color-foreground-disabled)", fontWeight: "var(--font-weight-medium)" }}>
                {t("quickPromptLabel")}
              </span>
              <div style={{ display: "flex", gap: "var(--space-1-5)", flexWrap: "wrap", justifyContent: "center" }}>
                {quickList.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onChange(item.text)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "var(--space-1) var(--space-2-5)",
                      borderRadius: "var(--radius-full)",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-foreground-secondary)",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-weight-medium)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all var(--transition-fast)",
                      fontFamily: "inherit",
                      pointerEvents: "auto",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-brand-soft)";
                      e.currentTarget.style.color = "var(--color-brand-primary)";
                      e.currentTarget.style.background = "var(--color-brand-surface)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-border)";
                      e.currentTarget.style.color = "var(--color-foreground-secondary)";
                      e.currentTarget.style.background = "var(--color-surface)";
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Character Counter */}
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-4)",
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

        {pasteError && !error && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", fontWeight: "var(--font-weight-medium)", margin: 0 }} role="alert">
            {t("pasteFailed")}
          </p>
        )}
      </div>
    );
  }
);

export default GeneratorInput;
