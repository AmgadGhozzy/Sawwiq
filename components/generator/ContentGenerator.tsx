"use client";

import { useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Wand2, Zap, Lock, Sparkles } from "lucide-react";
import { generateInputSchema, type GenerateInputDTO } from "@/lib/validation/generation";
import type { GeneratedContent, GenerateResponse } from "@/types/content";
import { ERROR_CODES } from "@/types/content";
import { useTranslations } from "next-intl";

import GeneratorInput from "./GeneratorInput";
import GeneratorSettings from "./GeneratorSettings";
import GenerateButton from "./GenerateButton";
import GenerationSkeleton from "./GenerationSkeleton";
import GenerationResult from "./GenerationResult";

type ViewState = "empty" | "loading" | "result" | "locked";

const DARK_CARD: React.CSSProperties = {
  background: "var(--gradient-surface)",
  backdropFilter: "blur(50px) saturate(170%)",
  WebkitBackdropFilter: "blur(50px) saturate(170%)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-elevated)",
  borderRadius: "var(--radius-xl)",
};

const scrollToCTA = () => {
  const el = document.getElementById("waitlist-cta");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.transition = "box-shadow 0.3s ease";
  el.style.boxShadow = "0 0 0 3px var(--color-brand-primary), var(--shadow-glow)";
  setTimeout(() => { el.style.boxShadow = ""; }, 1800);
};

export default function ContentGenerator() {
  const t = useTranslations("ContentGenerator");
  const tErrors = useTranslations("Errors");
  const [viewState, setViewState] = useState<ViewState>("empty");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GenerateInputDTO | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm<GenerateInputDTO>({
    resolver: zodResolver(generateInputSchema),
    defaultValues: { platform: "facebook", contentType: "interactive_post", arabicStyle: "egyptian_colloquial", rawInput: "" },
    mode: "onChange",
  });

  const doGenerate = useCallback(async (data: GenerateInputDTO) => {
    setLastInput(data);
    setViewState("loading");
    setApiError(null);
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resultData = (await response.json()) as GenerateResponse;

      if (!resultData.success) {
        if (resultData.error.code === ERROR_CODES.RATE_LIMIT_REACHED) {
          setViewState("locked");
          setTimeout(scrollToCTA, 400);
          return;
        }
        const code = resultData.error.code || "GENERATION_FAILED";
        setApiError(tErrors(code));
        setViewState("empty");
        return;
      }

      setResult(resultData.data);
      setRemainingGenerations(resultData.remainingGenerations);
      setViewState("result");
    } catch (error) {
      setApiError(tErrors("INTERNAL_ERROR"));
      setViewState("empty");
      console.error("Submission error:", error);
    }
  }, [tErrors]);

  const handleRegenerate = useCallback(() => doGenerate(lastInput ?? getValues()), [doGenerate, lastInput, getValues]);

  const handleStartOver = useCallback(() => {
    setResult(null);
    setApiError(null);
    setViewState("empty");
    reset({ platform: "instagram", contentType: "sponsored_ad", arabicStyle: "white_arabic", rawInput: "" });
  }, [reset]);

  const isLocked = viewState === "locked";

  return (
    <>
      <div
        className="flex flex-col lg:flex-row items-stretch gap-5 lg:gap-7"
      >
        {/* ────────────────── Settings Panel ────────────────── */}
        <div className="w-full lg:w-[380px] shrink-0 relative z-50">
          <div className="lg:sticky lg:top-8">
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              style={DARK_CARD}
            >
              {/* Card Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "18px 22px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
                  background: "var(--gradient-brand)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--shadow-brand)",
                }}>
                  <Wand2 size={15} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-foreground)", margin: 0 }}>
                    {t("settingsTitle")}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--color-foreground-disabled)", margin: 0, marginTop: "2px" }}>
                    {t("settingsSubtitle")}
                  </p>
                </div>
                {/* Credits badge */}
                {remainingGenerations !== null && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                      padding: "3px 10px", borderRadius: "999px",
                      background: remainingGenerations > 0 ? "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)" : "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                      border: `1px solid ${remainingGenerations > 0 ? "color-mix(in srgb, var(--color-brand-primary) 25%, transparent)" : "color-mix(in srgb, var(--color-danger) 20%, transparent)"}`,
                      color: remainingGenerations > 0 ? "var(--color-brand-primary)" : "var(--color-danger)",
                      fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" as const,
                    }}
                  >
                    {remainingGenerations > 0 ? t("creditsRemaining", { count: remainingGenerations }) : t("zeroCredits")}
                  </motion.div>
                )}
              </div>

              {/* Form */}
              <div style={{ padding: "18px 22px 22px" }}>
                <form onSubmit={handleSubmit(doGenerate)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <Controller
                    name="rawInput"
                    control={control}
                    render={({ field }) => (
                      <GeneratorInput
                        value={field.value}
                        onChange={field.onChange}
                        ref={field.ref}
                        error={errors.rawInput?.message}
                        disabled={viewState === "loading" || isLocked}
                      />
                    )}
                  />

                  <Controller
                    name="platform"
                    control={control}
                    render={({ field: pf }) => (
                      <Controller
                        name="arabicStyle"
                        control={control}
                        render={({ field: sf }) => (
                          <Controller
                            name="contentType"
                            control={control}
                            render={({ field: tf }) => (
                              <GeneratorSettings
                                platform={pf.value}
                                arabicStyle={sf.value}
                                contentType={tf.value}
                                onPlatformChange={pf.onChange}
                                onArabicStyleChange={sf.onChange}
                                onContentTypeChange={tf.onChange}
                                disabled={viewState === "loading" || isLocked}
                              />
                            )}
                          />
                        )}
                      />
                    )}
                  />

                  {apiError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      style={{
                        padding: "10px 14px", borderRadius: "var(--radius-md)",
                        background: "color-mix(in srgb, var(--color-danger) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-danger) 15%, transparent)",
                        color: "var(--color-danger)", fontSize: "13px", fontWeight: 500,
                      }}
                      role="alert"
                    >
                      {apiError}
                    </motion.div>
                  )}

                  {isLocked ? (
                    <motion.button
                      type="button"
                      onClick={scrollToCTA}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -2, boxShadow: "var(--shadow-brand)" }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        width: "100%", padding: "13px", borderRadius: "var(--radius-lg)", border: "none",
                        background: "var(--gradient-brand)",
                        color: "white", fontWeight: 700, fontSize: "14px",
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "var(--shadow-brand)",
                      }}
                    >
                      <Sparkles size={15} />
                      {t("lockedButton")}
                    </motion.button>
                  ) : (
                    <GenerateButton
                      loading={viewState === "loading"}
                      disabled={!isValid || viewState === "loading"}
                    />
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ────────────────── Result Area ────────────────── */}
        <div className="flex-1 min-w-0 w-full flex flex-col">
          <AnimatePresence mode="wait">
            {/* ── Empty State ── */}
            {viewState === "empty" && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{
                  minHeight: "0",
                  flex: 1,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--color-border)",
                  background: "var(--gradient-surface)",
                  backdropFilter: "blur(50px) saturate(160%)",
                  WebkitBackdropFilter: "blur(50px) saturate(160%)",
                  boxShadow: "var(--shadow-elevated)",
                  padding: "48px 32px", textAlign: "center", gap: "24px",
                  position: "relative", overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                  style={{
                    width: "72px", height: "72px", borderRadius: "50%",
                    background: "color-mix(in srgb, var(--color-foreground) 3%, transparent)",
                    border: "1px solid var(--color-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 12px var(--color-brand-surface), 0 12px 40px var(--color-brand-soft)",
                  }}
                >
                  <Zap size={32} color="var(--color-brand-primary)" />
                </motion.div>

                <div style={{ maxWidth: "360px" }}>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-foreground)", margin: "0 0 10px" }}>
                    {t("emptyStateTitle")}
                  </h3>
                  <p style={{ color: "var(--color-foreground-disabled)", lineHeight: 1.75, fontSize: "14px", margin: 0 }}>
                    {t("emptyStateSubtitle")}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  {[t("emptyStateTags.impactfulTitles"), t("emptyStateTags.captivatingHooks"), t("emptyStateTags.smartHashtags"), t("emptyStateTags.effectiveCTAs")].map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      style={{
                        padding: "5px 14px", borderRadius: "999px",
                        background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-soft)",
                        color: "var(--color-brand-primary)", fontSize: "12px", fontWeight: 600,
                      }}
                    >
                      <span style={{
                        color: "color-mix(in srgb, var(--color-brand-primary) 60%, var(--color-foreground))"
                      }}>
                        {tag}
                      </span>
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Loading ── */}
            {viewState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                style={{ ...DARK_CARD, padding: "28px" }}
              >
                <GenerationSkeleton />
              </motion.div>
            )}

            {/* ── Result ── */}
            {viewState === "result" && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
              >
                <GenerationResult
                  content={result}
                  loading={false}
                  onRegenerate={handleRegenerate}
                  onStartOver={handleStartOver}
                />
              </motion.div>
            )}

            {/* ── Locked (rate limit reached) ── */}
            {viewState === "locked" && (
              <motion.div
                key="locked"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
                style={{
                  minHeight: "520px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 20%, transparent)",
                  background: "var(--gradient-surface)",
                  padding: "48px 32px", textAlign: "center", gap: "20px",
                }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  style={{
                    width: "76px", height: "76px", borderRadius: "50%",
                    background: "var(--color-brand-surface)",
                    border: "1px solid color-mix(in srgb, var(--color-brand-primary) 25%, transparent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 16px var(--color-brand-surface), var(--shadow-glow)",
                  }}
                >
                  <Lock size={30} color="var(--color-brand-primary)" />
                </motion.div>

                <div style={{ maxWidth: "380px" }}>
                  <h3 style={{
                    fontSize: "1.5rem", fontWeight: 800, margin: "0 0 12px",
                    color: "var(--color-foreground)",
                  }}>
                    {t("lockedStateTitle")}
                  </h3>
                  <p style={{ color: "var(--color-foreground-tertiary)", lineHeight: 1.8, fontSize: "14px", margin: 0 }}>
                    {t("lockedStateSubtitle")}
                  </p>
                </div>

                <motion.button
                  type="button"
                  onClick={scrollToCTA}
                  whileHover={{ y: -3, boxShadow: "var(--shadow-brand)" }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "14px 28px", borderRadius: "var(--radius-lg)", border: "none",
                    background: "var(--gradient-brand)",
                    color: "white", fontWeight: 700, fontSize: "15px",
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "var(--shadow-brand)",
                  }}
                >
                  <Sparkles size={16} />
                  {t("lockedStateButton")}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
