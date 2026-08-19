"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOADING_MESSAGES = [
  "جارٍ ضبط الصياغة...",
  "نضفي لمسة طبيعية على المحتوى...",
  "نضيف اللمسة التسويقية...",
  "لحظات وننتهي...",
  "نراجع المحتوى النهائي...",
];

function Pulse({ width, delay = 0 }: { width: string; delay?: number }) {
  return (
    <div style={{
      height: "10px", width, borderRadius: "6px",
      background: "rgba(255,255,255,0.06)",
      animation: `pulse 1.8s ease-in-out ${delay}ms infinite`,
    }} />
  );
}

export default function GenerationSkeleton() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx((p) => (p + 1) % LOADING_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        style={{ display: "flex", flexDirection: "column", gap: "24px" }}
        dir="rtl"
      >
        {/* Rotating status message */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "8px 0" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
            style={{
              width: "18px", height: "18px", borderRadius: "50%",
              border: "2px solid rgba(124,58,237,0.25)",
              borderTopColor: "#7c3aed",
            }}
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIdx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: "13px", fontWeight: 600, color: "#475569", margin: 0 }}
            >
              {LOADING_MESSAGES[msgIdx]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Title skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Pulse width="60%" />
          <Pulse width="40%" delay={120} />
        </div>

        {/* Hook skeleton */}
        <div style={{
          borderRadius: "14px", background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.1)", padding: "16px",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <Pulse width="100%" delay={80} />
          <Pulse width="80%" delay={160} />
        </div>

        {/* Body skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[100, 92, 96, 78, 70].map((w, i) => (
            <Pulse key={i} width={`${w}%`} delay={i * 60} />
          ))}
        </div>

        {/* CTA skeleton */}
        <div style={{
          borderRadius: "14px", background: "rgba(124,58,237,0.06)",
          border: "1px solid rgba(124,58,237,0.1)", padding: "18px",
          display: "flex", justifyContent: "center",
        }}>
          <Pulse width="50%" delay={200} />
        </div>

        {/* Hashtag pills skeleton */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[72, 88, 64, 96, 56].map((w, i) => (
            <div key={i} style={{
              height: "28px", width: `${w}px`, borderRadius: "999px",
              background: "rgba(255,255,255,0.05)",
              animation: `pulse 1.8s ease-in-out ${i * 80}ms infinite`,
            }} />
          ))}
        </div>
      </motion.div>
    </>
  );
}
