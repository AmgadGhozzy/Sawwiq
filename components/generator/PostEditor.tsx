"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";

interface PostEditorProps {
  isOpen: boolean;
  initialText: string;
  onClose: () => void;
  onSave: (text: string) => void;
  onSaveAndCopy: (text: string) => void;
  platform?: string; // Optional platform to determine char limit
}

function getPlatformCharacterLimit(platform: string | undefined): number | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes("twitter") || p.includes("x")) return 280;
  if (p.includes("linkedin")) return 3000;
  if (p.includes("instagram")) return 2200;
  // Facebook, etc. are practically unlimited or very high.
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

  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkSize = () => setIsDesktop(window.innerWidth >= 768);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  // Sync initial text when opening
  useEffect(() => {
    if (isOpen) {
      setLocalText(initialText);
      setShowConfirmDiscard(false);
      // Auto-focus after animation
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
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

  const handleDiscard = () => {
    setShowConfirmDiscard(false);
    onClose();
  };

  const handleSave = () => {
    onSave(localText);
  };

  const handleSaveAndCopy = () => {
    onSaveAndCopy(localText);
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        if (!showConfirmDiscard) {
          requestClose();
        } else {
          // If confirm is open, escape cancels the confirm
          setShowConfirmDiscard(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasUnsavedChanges, showConfirmDiscard]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={requestClose}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Wrapper to handle positioning: Bottom on mobile, Center on desktop */}
          <div 
            style={{ 
              position: "fixed", inset: 0, zIndex: 9999, 
              display: "flex", 
              justifyContent: "center", 
              alignItems: isDesktop ? "center" : "flex-end",
              padding: isDesktop ? "var(--space-4)" : 0,
              pointerEvents: "none" 
            }}
          >
            <motion.div
              className="flex flex-col bg-surface border-border shadow-2xl pointer-events-auto"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
                              style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-card)",
                  width: isDesktop ? "600px" : "100%",
                  height: "70vh", // Prevents the card from collapsing to 2 lines
                  maxHeight: "90vh",
                  borderTopLeftRadius: "var(--radius-2xl)",
                  borderTopRightRadius: "var(--radius-2xl)",
                  borderBottomLeftRadius: isDesktop ? "var(--radius-2xl)" : 0,
                  borderBottomRightRadius: isDesktop ? "var(--radius-2xl)" : 0,
                  overflow: "hidden", // Prevent parent from scrolling
                  zIndex: "var(--z-modal)",
                }}
            >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-4)",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-bold)" }}>
                {t("edit")}
              </span>
              <button 
                onClick={requestClose}
                style={{ 
                  background: "transparent", border: "none", color: "var(--color-foreground-secondary)",
                  cursor: "pointer", padding: "var(--space-1)", borderRadius: "var(--radius-full)"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Editor Area */}
            <div style={{ 
              flex: 1, 
              padding: "var(--space-4)", 
              display: "flex", 
              flexDirection: "column",
              overflow: "hidden", // Hide container scrollbar, let textarea scroll
            }}>
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
                  // Hide scrollbar but allow scrolling
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              />
              
              {/* Character Limit Indicator */}
              {characterLimit && (
                <div style={{ 
                  textAlign: "end", 
                  marginTop: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  color: isOverLimit ? "var(--color-danger)" : "var(--color-foreground-secondary)",
                  fontWeight: isOverLimit ? "var(--font-weight-bold)" : "normal",
                  flexShrink: 0,
                }}>
                  {currentLength} / {characterLimit}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: "var(--space-4)",
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              gap: "var(--space-3)",
              background: "var(--color-surface)",
              flexShrink: 0,
              position: "sticky",
              bottom: 0,
              zIndex: "var(--z-modal)",
            }}>
              <Button
                onClick={requestClose}
                variant="ghost"
                size="lg"
                style={{ flex: 1 }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSave}
                variant="brandSoft"
                size="lg"
                style={{ flex: 1 }}
              >
                {t("save")}
              </Button>
              <Button
                onClick={handleSaveAndCopy}
                variant="primary"
                size="lg"
                style={{ flex: 1 }}
              >
                {t("saveAndCopy")}
              </Button>
            </div>
            
            {/* Optional Unsaved Changes Guard Overlay */}
            <AnimatePresence>
              {showConfirmDiscard && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
                    backdropFilter: "blur(var(--blur-sm))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "var(--space-6)",
                    zIndex: "var(--z-modal)",
                  }}
                >
                  <div style={{
                    background: "var(--color-surface)",
                    padding: "var(--space-6)",
                    borderRadius: "var(--radius-xl)",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-elevated)",
                    width: "100%",
                    maxWidth: "320px",
                    textAlign: "center",
                  }}>
                    <p style={{ 
                      fontSize: "var(--text-lg)", 
                      fontWeight: "var(--font-weight-bold)",
                      marginBottom: "var(--space-6)"
                    }}>
                      {t("discardChanges")}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      <Button
                        onClick={() => setShowConfirmDiscard(false)}
                        variant="primary"
                        size="lg"
                      >
                        {t("continueEditing")}
                      </Button>
                      <Button
                        onClick={handleDiscard}
                        variant="danger"
                        size="lg"
                      >
                        {t("discard")}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
