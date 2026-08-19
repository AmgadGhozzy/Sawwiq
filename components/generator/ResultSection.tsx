"use client";

// ---------------------------------------------------------------------------
// ResultSection — individual section of the generation result with copy
// ---------------------------------------------------------------------------

import { useState, useCallback } from "react";
import { motion } from "framer-motion";

interface ResultSectionProps {
  label: string;
  content: string;
  onCopy?: () => void;
}

export default function ResultSection({ label, content, onCopy }: ResultSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content, onCopy]);

  return (
    <div className="group relative space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100
                     text-xs text-muted-foreground hover:text-foreground
                     transition-all duration-200 px-2 py-1 rounded-md
                     hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
          aria-label={`نسخ ${label}`}
        >
          {copied ? (
            <motion.span
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-green-500"
            >
              تم النسخ ✓
            </motion.span>
          ) : (
            "نسخ"
          )}
        </button>
      </div>
      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}
