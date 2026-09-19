"use client";

import { forwardRef, useState, useCallback } from "react";
import { Trash2, ClipboardPaste } from "lucide-react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/shadcn/textarea";

interface GeneratorInputProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  mode?: "marketing" | "personal_creator" | "creator";
}

const GeneratorInput = forwardRef<HTMLTextAreaElement, GeneratorInputProps>(
  function GeneratorInput({ value, onChange, invalid, disabled, mode = "marketing" }, ref) {
    const t = useTranslations("GeneratorInput");

    const isCreator = mode === "personal_creator" || mode === "creator";
    const quickList = (isCreator
      ? (t.raw("quickCreatorPrompts") as Array<{ label: string; text: string }>)
      : (t.raw("quickPrompts") as Array<{ label: string; text: string }>)) || [];

    const [pasteError, setPasteError] = useState(false);
    const [focused, setFocused] = useState(false);

    const showQuickChips = !value && !focused && !disabled && quickList.length > 0;

    const marketingPlaceholders = t.raw("placeholders") as string[];
    const creatorPlaceholders = (t.raw("creatorPlaceholders") as string[]) || marketingPlaceholders;
    const staticPlaceholder = (isCreator ? creatorPlaceholders : marketingPlaceholders)?.[0] ?? "";

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
          <Textarea
            ref={ref}
            id="raw-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            placeholder={showQuickChips ? "" : staticPlaceholder}
            rows={5}
            aria-invalid={invalid}
            className="raw-input max-h-[var(--textarea-max-h)] min-h-[var(--textarea-min-h)] resize-none rounded-2xl bg-surface-elevated px-4 pt-3 pb-[var(--control-h-xl)] text-sm leading-[var(--leading-relaxed)] shadow-none placeholder:text-[var(--color-foreground-tertiary)] disabled:opacity-[0.4]"
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

          {/* Quick Inspiration Chips - floating inside the textarea when empty */}
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
                    className="inline-flex items-center rounded-full border border-border bg-surface text-foreground-secondary hover:border-brand-soft hover:bg-brand-surface hover:text-brand-primary transition-colors"
                    style={{
                      padding: "var(--space-1) var(--space-2-5)",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-weight-medium)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontFamily: "inherit",
                      pointerEvents: "auto",
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

        {pasteError && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", fontWeight: "var(--font-weight-medium)", margin: 0 }} role="alert">
            {t("pasteFailed")}
          </p>
        )}
      </div>
    );
  }
);

export default GeneratorInput;
