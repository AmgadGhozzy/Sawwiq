"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/shadcn/dialog";
import { Dialog as DialogPrimitive } from "radix-ui";

interface PostEditorProps {
  isOpen: boolean;
  initialText: string;
  onClose: () => void;
  onSave: (text: string) => void;
  onSaveAndCopy: (text: string) => void;
  platform?: string;
}

function getPlatformCharacterLimit(platform: string | undefined): number | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes("twitter") || p.includes("x")) return 280;
  if (p.includes("linkedin")) return 3000;
  if (p.includes("instagram")) return 2200;
  return null;
}

export default function PostEditor({
  isOpen,
  initialText,
  onClose,
  onSave,
  onSaveAndCopy,
  platform,
}: PostEditorProps) {
  const t = useTranslations("GenerationResult");

  const [localText, setLocalText] = useState(initialText);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial text when opening
  useEffect(() => {
    if (isOpen) {
      setLocalText(initialText);
      setShowConfirmDiscard(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialText]);

  const hasUnsavedChanges = localText !== initialText;
  const characterLimit = getPlatformCharacterLimit(platform);
  const currentLength = localText.length;
  const isOverLimit = characterLimit ? currentLength > characterLimit : false;

  const requestClose = () => {
    if (hasUnsavedChanges) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) requestClose();
  };

  const handleDiscard = () => {
    setShowConfirmDiscard(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay
          style={{ background: "var(--color-overlay)" }}
          className="fixed inset-0 z-[var(--z-modal)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Custom content — bypasses DialogContent to control positioning */}
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
          aria-label={t("edit")}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: "var(--z-modal)",
            background: "var(--color-surface-flyout)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-elevated)",
            height: "70dvh",
            maxHeight: "90dvh",
            borderTopLeftRadius: "var(--radius-2xl)",
            borderTopRightRadius: "var(--radius-2xl)",
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            outline: "none",
          }}
          className="
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom
            md:bottom-auto md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%]
            md:w-[600px] md:max-w-[calc(100vw-2rem)]
            md:rounded-2xl
            duration-150
          "
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-4) var(--space-5)",
              flexShrink: 0,
            }}
          >
            <DialogPrimitive.Title
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-weight-bold)",
                margin: 0,
              }}
            >
              {t("edit")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              onClick={requestClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-foreground-secondary)",
                cursor: "pointer",
                padding: "var(--space-1)",
                borderRadius: "var(--radius-full)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={t("cancel")}
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>

          {/* Editor Area */}
          <div
            style={{
              flex: 1,
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <textarea
              ref={textareaRef}
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              dir="auto"
              style={{
                width: "100%",
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "var(--text-base)",
                lineHeight: "var(--leading-loose)",
                color: "var(--color-foreground)",
                fontFamily: "inherit",
                scrollbarWidth: "none",
              }}
            />

            {characterLimit && (
              <div
                style={{
                  textAlign: "end",
                  marginTop: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  color: isOverLimit
                    ? "var(--color-danger)"
                    : "var(--color-foreground-secondary)",
                  fontWeight: isOverLimit
                    ? "var(--font-weight-bold)"
                    : "normal",
                  flexShrink: 0,
                }}
              >
                {currentLength} / {characterLimit}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "var(--space-4) var(--space-5)",
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              gap: "var(--space-3)",
              background: "var(--color-surface-flyout)",
              flexShrink: 0,
            }}
          >
            <Button
              onClick={requestClose}
              variant="ghost"
              size="lg"
              style={{ flex: 1 }}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => onSave(localText)}
              variant="brandSoft"
              size="lg"
              style={{ flex: 1 }}
            >
              {t("save")}
            </Button>
            <Button
              onClick={() => onSaveAndCopy(localText)}
              variant="primary"
              size="lg"
              style={{ flex: 1 }}
            >
              {t("saveAndCopy")}
            </Button>
          </div>

          {/* Unsaved Changes Guard — rendered inside the dialog for focus containment */}
          {showConfirmDiscard && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--color-surface-translucent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-6)",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  background: "var(--color-surface)",
                  padding: "var(--space-6)",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-elevated)",
                  width: "100%",
                  maxWidth: "320px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-lg)",
                    fontWeight: "var(--font-weight-bold)",
                    marginBottom: "var(--space-6)",
                  }}
                >
                  {t("discardChanges")}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  <Button
                    onClick={() => setShowConfirmDiscard(false)}
                    variant="primary"
                    size="lg"
                  >
                    {t("continueEditing")}
                  </Button>
                  <Button onClick={handleDiscard} variant="danger" size="lg">
                    {t("discard")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
