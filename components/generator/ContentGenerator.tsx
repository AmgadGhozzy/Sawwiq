"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Wand2, Zap, Lock, Sparkles, ArrowLeft } from "lucide-react";
import { generateInputSchema, type GenerateInputDTO } from "@/lib/validation/generation";
import type { GeneratedContent, GenerateResponse } from "@/types/content";
import { ERROR_CODES } from "@/types/content";
import { useTranslations, useLocale } from "next-intl";
import { useHistoryContext } from "@/components/history/HistoryContext";
import { normalizePlatform, getFormatsForPlatform } from "@/lib/content/formats";
import CtaButton from "@/components/ui/CtaButton";

import GeneratorInput from "./GeneratorInput";
import GeneratorSettings from "./GeneratorSettings";
import GenerateButton from "./GenerateButton";
import GenerationSkeleton from "./GenerationSkeleton";
import GenerationResult from "./GenerationResult";

type ViewState = "empty" | "loading" | "result" | "locked";

const scrollToCTA = () => {
  const el = document.getElementById("waitlist-cta");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.transition = "box-shadow 0.3s ease";
  el.style.boxShadow = "0 0 0 3px var(--color-brand-primary), var(--shadow-glow)";
  setTimeout(() => { el.style.boxShadow = ""; }, 1800);
};

export default function ContentGenerator() {
  const locale = useLocale();
  const t = useTranslations("ContentGenerator");
  const tErrors = useTranslations("Errors");

  const { items, setItems, selectedHistoryIndex, setSelectedHistoryIndex } = useHistoryContext();

  const [viewState, setViewState] = useState<ViewState>("empty");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GenerateInputDTO | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { errors, isValid },
  } = useForm<GenerateInputDTO>({
    resolver: zodResolver(generateInputSchema),
    defaultValues: {
      mode: "marketing",
      platform: "facebook",
      format: "post",
      contentType: "interactive_post",
      arabicStyle: "egyptian_colloquial",
      marketingObjective: "engagement",
      intent: "opinion",
      originality: "balanced",
      persona: {
        id: "creative",
        name: "السارد الإبداعي",
      },
      style: {
        id: "storytelling",
        name: "السرد القصصي المشوق",
      },
      rawInput: "",
    },
    mode: "onChange",
  });

  const selectedMode = watch("mode");
  const isCreatorMode = selectedMode === "creator" || selectedMode === "personal_creator";

  // Detect mobile for sticky button
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Watch for history selection
  useEffect(() => {
    if (selectedHistoryIndex !== null && items[selectedHistoryIndex]) {
      const historyItem = items[selectedHistoryIndex];
      setResult({
        title: historyItem.aiResponse.title,
        hook: historyItem.aiResponse.hook,
        body: historyItem.aiResponse.body,
        callToAction: historyItem.aiResponse.callToAction,
        hashtags: historyItem.aiResponse.hashtags,
      });

      // Normalize platform (e.g. x_twitter -> x)
      const normPlatform = normalizePlatform(historyItem.platform);

      // Determine the format: either stored in history, or inferred from contentType & platform
      let format = historyItem.format;
      if (!format) {
        const platformFormats = getFormatsForPlatform(normPlatform);
        const matchingFormat = platformFormats.find((f) =>
          f.supportedContentTypes.includes(historyItem.contentType as any)
        );
        format = matchingFormat ? matchingFormat.id : platformFormats[0]?.id || "post";
      }

      // Update form values to match the history item
      reset({
        mode: (historyItem.mode as any) || "marketing",
        platform: normPlatform as any,
        format: format,
        contentType: historyItem.contentType as any,
        arabicStyle: historyItem.arabicStyle as any,
        marketingObjective: historyItem.marketingObjective || "awareness",
        persona: historyItem.persona || {
          id: "developer",
          name: "المبرمج والتقني",
        },
        style: historyItem.style || {
          id: "mystery",
          name: "الغموض والمفارقة",
        },
        rawInput: historyItem.prompt || "",
      });
      setViewState("result");
    }
  }, [selectedHistoryIndex, items, reset]);

  const doGenerate = useCallback(async (data: GenerateInputDTO) => {
    setLastInput(data);
    setViewState("loading");
    setSelectedHistoryIndex(null); // Clear history selection when generating new
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

      const newItem = {
        id: (resultData as any).meta?.requestId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        platform: data.platform as any,
        contentType: data.contentType as any,
        arabicStyle: data.arabicStyle as any,
        prompt: data.rawInput,
        format: data.format,
        mode: data.mode as any,
        marketingObjective: data.marketingObjective,
        persona: data.persona,
        style: data.style,
        intent: data.intent as any,
        originality: data.originality as any,
        aiResponse: resultData.data,
        createdAt: new Date().toISOString(),
      };

      setItems([newItem, ...items.filter((i) => i.id !== newItem.id)]);
      setSelectedHistoryIndex(0);
      setResult(resultData.data);
      setRemainingGenerations(resultData.remainingGenerations);
      setViewState("result");
      setTimeout(() => {
        document.getElementById("result-area")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      setApiError(tErrors("INTERNAL_ERROR"));
      setViewState("empty");
      console.error("Submission error:", error);
    }
  }, [items, setItems, setSelectedHistoryIndex, tErrors]);

  const handleRegenerate = useCallback(() => doGenerate(lastInput ?? getValues()), [doGenerate, lastInput, getValues]);

  const handleStartOver = useCallback(() => {
    setResult(null);
    setApiError(null);
    setViewState("empty");
    setSelectedHistoryIndex(null);
    reset({
      mode: "marketing",
      platform: "instagram",
      format: "post",
      contentType: "interactive_post",
      arabicStyle: "white_arabic",
      marketingObjective: "awareness",
      intent: "insight",
      originality: "balanced",
      persona: {
        id: "developer",
        name: "المبرمج والتقني",
      },
      style: {
        id: "mystery",
        name: "الغموض والمفارقة",
      },
      rawInput: "",
    });
  }, [reset, setSelectedHistoryIndex]);

  const handleNextHistory = useCallback(() => {
    const currentIndex = selectedHistoryIndex !== null ? selectedHistoryIndex : 0;
    if (currentIndex < items.length - 1) {
      setSelectedHistoryIndex(currentIndex + 1);
    }
  }, [selectedHistoryIndex, items.length, setSelectedHistoryIndex]);

  const handlePrevHistory = useCallback(() => {
    const currentIndex = selectedHistoryIndex !== null ? selectedHistoryIndex : 0;
    if (currentIndex > 0) {
      setSelectedHistoryIndex(currentIndex - 1);
    }
  }, [selectedHistoryIndex, setSelectedHistoryIndex]);

  const isLocked = viewState === "locked";

  return (
    <>
      <style>{`
        @keyframes cg-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cg-icon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--color-brand-soft), var(--shadow-brand); }
          50%       { box-shadow: 0 0 0 10px transparent, var(--shadow-brand); }
        }
        @keyframes cg-card-glow {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.9; }
        }
      `}</style>
      {/* ── Mobile Sticky Generate Bar ── */}
      {isMobile && (
        <div className="sticky-generate-bar">
          {apiError && (
            <div
              style={{
                marginBottom: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-danger-surface)",
                border: "1px solid var(--color-danger-border)",
                color: "var(--color-danger)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-weight-medium)",
              }}
              role="alert"
            >
              {apiError}
            </div>
          )}
          {isLocked ? (
            <CtaButton type="button" onClick={scrollToCTA} fullWidth>
              <Sparkles size={16} />
              {t("lockedButton")}
            </CtaButton>
          ) : (
            <form onSubmit={handleSubmit(doGenerate)} style={{ margin: 0 }}>
              <GenerateButton
                loading={viewState === "loading"}
                disabled={!isValid || viewState === "loading"}
              />
            </form>
          )}
        </div>
      )}

      <div
        className="flex flex-col lg:flex-row items-stretch gap-5 lg:gap-7"
        style={{ paddingBottom: isMobile ? "calc(var(--space-8) + var(--space-4))" : undefined }}
      >
        {/* ────────────────── Settings Panel ────────────────── */}
        <div className="w-full lg:w-[380px] shrink-0 relative z-50">
          <div className="lg:sticky lg:top-8">
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="generator-card glass-card"
              style={{
                borderRadius: "var(--radius-xl)",
                maxHeight: isMobile ? "none" : "calc(100vh - 80px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Top accent glow line */}
              <div style={{
                position: "absolute",
                top: 0,
                left: "20%",
                right: "20%",
                height: "2px",
                background: "linear-gradient(90deg, transparent, var(--color-brand-primary), transparent)",
                borderRadius: "var(--radius-full)",
                animation: "cg-card-glow 3.5s ease-in-out infinite",
                pointerEvents: "none",
                zIndex: 1,
              }} />
              {/* Card Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                padding: "var(--space-4) var(--space-5)",
                flexShrink: 0,
                position: "relative",
              }}>
                {/* Fading Divider */}
                <div style={{
                  position: "absolute",
                  bottom: 0, left: 0, right: 0,
                  height: "1px",
                  background: "linear-gradient(90deg, transparent 0%, var(--color-border) 50%, transparent 100%)",
                }} />

                {/* Icon */}
                <div style={{
                  width: "var(--space-9)", height: "var(--space-9)",
                  borderRadius: "var(--radius-lg)", flexShrink: 0,
                  background: "var(--gradient-brand)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--shadow-brand), var(--highlight-inset)",
                }}>
                  <Wand2 size={16} color="var(--color-foreground-inverse)" />
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--font-weight-bold)",
                    color: "var(--color-foreground)",
                    margin: 0,
                    letterSpacing: "var(--tracking-snug)",
                  }}>
                    {t("settingsTitle")}
                  </p>
                  <p style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-foreground-tertiary)",
                    margin: 0,
                    marginTop: "var(--space-0-5)",
                  }}>
                    {t("settingsSubtitle")}
                  </p>
                </div>

                {/* Credits badge */}
                {remainingGenerations !== null && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                      padding: "var(--space-1) var(--space-3)",
                      borderRadius: "var(--radius-full)",
                      background: remainingGenerations > 0 ? "var(--color-brand-surface)" : "var(--color-danger-surface)",
                      border: `1px solid ${remainingGenerations > 0 ? "var(--color-brand-soft)" : "var(--color-danger-border)"}`,
                      color: remainingGenerations > 0 ? "var(--color-brand-light)" : "var(--color-danger)",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-weight-bold)",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {remainingGenerations > 0 ? t("creditsRemaining", { count: remainingGenerations }) : t("zeroCredits")}
                  </motion.div>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(doGenerate)} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
                <div style={{
                  padding: "var(--space-3)",
                  paddingBottom: isMobile ? "var(--space-4)" : "calc(var(--space-24) + var(--space-6))",
                  overflowY: "auto",
                  overflowX: "hidden",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  flex: 1,
                  minHeight: 0
                }}>
                  <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <Controller
                      name="rawInput"
                      control={control}
                      render={({ field }) => (
                        <GeneratorInput
                          value={field.value}
                          onChange={field.onChange}
                          ref={field.ref}
                          mode={watch("mode")}
                          error={errors.rawInput?.message}
                          disabled={viewState === "loading" || isLocked}
                        />
                      )}
                    />

                    <Controller
                      name="mode"
                      control={control}
                      render={({ field: mf }) => (
                        <Controller
                          name="platform"
                          control={control}
                          render={({ field: pf }) => (
                            <Controller
                              name="format"
                              control={control}
                              render={({ field: ff }) => (
                                <Controller
                                  name="contentType"
                                  control={control}
                                  render={({ field: cf }) => (
                                    <Controller
                                      name="arabicStyle"
                                      control={control}
                                      render={({ field: sf }) => (
                                        <Controller
                                          name="marketingObjective"
                                          control={control}
                                          render={({ field: of }) => (
                                            <Controller
                                              name="persona"
                                              control={control}
                                              render={({ field: perf }) => (
                                                <Controller
                                                  name="style"
                                                  control={control}
                                                  render={({ field: stf }) => (
                                                    <Controller
                                                      name="intent"
                                                      control={control}
                                                      render={({ field: itf }) => (
                                                        <Controller
                                                          name="originality"
                                                          control={control}
                                                          render={({ field: ogf }) => (
                                                            <GeneratorSettings
                                                              mode={mf.value}
                                                              platform={pf.value}
                                                              format={ff.value}
                                                              contentType={cf.value}
                                                              arabicStyle={sf.value}
                                                              marketingObjective={of.value}
                                                              persona={perf.value}
                                                              styleConfig={stf.value}
                                                              intent={itf.value as any}
                                                              originality={ogf.value as any}
                                                              onModeChange={mf.onChange}
                                                              onPlatformChange={pf.onChange}
                                                              onFormatChange={ff.onChange}
                                                              onContentTypeChange={cf.onChange}
                                                              onArabicStyleChange={sf.onChange}
                                                              onMarketingObjectiveChange={of.onChange}
                                                              onPersonaChange={perf.onChange}
                                                              onStyleChange={stf.onChange}
                                                              onIntentChange={itf.onChange}
                                                              onOriginalityChange={ogf.onChange}
                                                              disabled={viewState === "loading" || isLocked}
                                                            />
                                                          )}
                                                        />
                                                      )}
                                                    />
                                                  )}
                                                />
                                              )}
                                            />
                                          )}
                                        />
                                      )}
                                    />
                                  )}
                                />
                              )}
                            />
                          )}
                        />
                      )}
                    />
                  </div>
                </div>

                {/* Desktop: Floating Generate Button Container (hidden on mobile) */}
                {!isMobile && (
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "var(--space-4)",
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    background: "var(--color-surface-elevated)",
                    borderRadius: "var(--radius-3xl) var(--radius-3xl) 0 0",
                  }}>

                    {apiError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        style={{
                          padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)",
                          background: "var(--color-danger-surface)", border: "1px solid var(--color-danger-border)",
                          color: "var(--color-danger)", fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-medium)",
                        }}
                        role="alert"
                      >
                        {apiError}
                      </motion.div>
                    )}

                    {isLocked ? (
                      <CtaButton type="button" onClick={scrollToCTA} fullWidth>
                        <Sparkles size={15} />
                        {t("lockedButton")}
                      </CtaButton>
                    ) : (
                      <GenerateButton
                        loading={viewState === "loading"}
                        disabled={!isValid || viewState === "loading"}
                      />
                    )}
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        </div>

        {/* ────────────────── Result Area ────────────────── */}
        <div id="result-area" className="flex-1 min-w-0 w-full flex flex-col">
          <AnimatePresence mode="wait">
            {/* ── Empty State ── */}
            {viewState === "empty" && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="glass-card"
                style={{
                  minHeight: "480px",
                  flex: 1,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  borderRadius: "var(--radius-xl)",
                  padding: "var(--space-12) var(--space-8)",
                  textAlign: "center",
                  gap: "var(--space-7)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Background radial glow */}
                <div style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -55%)",
                  width: "340px", height: "340px",
                  borderRadius: "var(--radius-circle)",
                  background: "radial-gradient(circle, var(--color-brand-surface) 0%, transparent 68%)",
                  pointerEvents: "none",
                }} />

                {/* Icon stack: outer spinning dashed ring + inner solid ring + icon */}
                <div style={{ position: "relative", width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* Spinning dashed outer ring */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--radius-circle)",
                    border: "1.5px dashed var(--color-brand-soft)",
                    animation: "cg-ring-spin 14s linear infinite",
                  }} />
                  {/* Static mid ring */}
                  <div style={{
                    position: "absolute",
                    inset: "12px",
                    borderRadius: "var(--radius-circle)",
                    border: "1px solid var(--color-border)",
                  }} />
                  {/* Icon circle */}
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 14 }}
                    style={{
                      width: "52px", height: "52px",
                      borderRadius: "var(--radius-circle)",
                      background: "var(--gradient-brand)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "var(--shadow-brand), var(--highlight-inset)",
                      animation: "cg-icon-pulse 3.5s ease-in-out infinite",
                    }}
                  >
                    <Zap size={22} color="white" />
                  </motion.div>
                </div>

                {/* Text */}
                <div style={{ maxWidth: "380px", position: "relative" }}>
                  <motion.h3
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    style={{
                      fontSize: "var(--text-xl)",
                      fontWeight: "var(--font-weight-bold)",
                      color: "var(--color-foreground)",
                      margin: "0 0 var(--space-3)",
                      letterSpacing: "var(--tracking-snug)",
                      lineHeight: 1.3,
                    }}
                  >
                    {isCreatorMode ? t("emptyStateTitleCreator") : t("emptyStateTitle")}
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32 }}
                    style={{
                      color: "var(--color-foreground-tertiary)",
                      lineHeight: "var(--leading-relaxed)",
                      fontSize: "var(--text-base)",
                      margin: 0,
                    }}
                  >
                    {isCreatorMode ? t("emptyStateSubtitleCreator") : t("emptyStateSubtitle")}
                  </motion.p>
                </div>

                {/* Feature tags with dot indicator */}
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center", maxWidth: "420px" }}>
                  {(isCreatorMode
                    ? [t("emptyStateTagsCreator.insights"), t("emptyStateTagsCreator.storytelling"), t("emptyStateTagsCreator.voice"), t("emptyStateTagsCreator.discussion")]
                    : [t("emptyStateTags.impactfulTitles"), t("emptyStateTags.captivatingHooks"), t("emptyStateTags.smartHashtags"), t("emptyStateTags.effectiveCTAs")]
                  ).map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, y: 12, scale: 0.88 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.38 + i * 0.09, type: "spring", stiffness: 220 }}
                      style={{
                        padding: "var(--space-1-5) var(--space-4)",
                        borderRadius: "var(--radius-full)",
                        background: "var(--color-brand-surface)",
                        border: "1px solid var(--color-brand-soft)",
                        color: "var(--color-brand-light)",
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--font-weight-semibold)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-1-5)",
                      }}
                    >
                      <span style={{
                        width: "5px", height: "5px",
                        borderRadius: "var(--radius-circle)",
                        background: "var(--color-brand-primary)",
                        flexShrink: 0,
                        display: "inline-block",
                      }} />
                      {tag}
                    </motion.span>
                  ))}
                </div>

                {/* Hint text */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.72 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1-5)",
                    color: "var(--color-foreground-disabled)",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-weight-medium)",
                  }}
                >
                  <ArrowLeft size={12} style={{ flexShrink: 0, transform: locale === "ar" ? "scaleX(-1)" : undefined }} />
                  <span>{isCreatorMode ? t("emptyStateHintCreator") : t("emptyStateHint")}</span>
                </motion.div>
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
                className="glass-card"
                style={{ borderRadius: "var(--radius-xl)", padding: "var(--space-7)", flex: 1, display: "flex", flexDirection: "column" }}
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
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <GenerationResult
                  content={result}
                  loading={false}
                  onRegenerate={handleRegenerate}
                  onStartOver={handleStartOver}
                  isHistoryView={selectedHistoryIndex !== null && selectedHistoryIndex > 0}
                  onNextHistory={handleNextHistory}
                  onPrevHistory={handlePrevHistory}
                  hasNextHistory={
                    (selectedHistoryIndex !== null ? selectedHistoryIndex : 0) < items.length - 1
                  }
                  hasPrevHistory={
                    (selectedHistoryIndex !== null ? selectedHistoryIndex : 0) > 0
                  }
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
                className="glass-card"
                style={{
                  minHeight: "520px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--color-brand-soft)",
                  padding: "var(--space-12) var(--space-8)", textAlign: "center", gap: "var(--space-5)",
                }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  style={{
                    width: "var(--space-20)", height: "var(--space-20)", borderRadius: "var(--radius-circle)",
                    background: "var(--color-brand-surface)",
                    border: "1px solid var(--color-brand-soft)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 var(--space-4) var(--color-brand-surface), var(--shadow-glow)",
                  }}
                >
                  <Lock size={30} color="var(--color-brand-primary)" />
                </motion.div>

                <div style={{ maxWidth: "380px" }}>
                  <h3 style={{
                    fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", margin: "0 0 var(--space-3)",
                    color: "var(--color-foreground)",
                  }}>
                    {t("lockedStateTitle")}
                  </h3>
                  <p style={{ color: "var(--color-foreground-tertiary)", lineHeight: "var(--leading-relaxed)", fontSize: "var(--text-base)", margin: 0 }}>
                    {t("lockedStateSubtitle")}
                  </p>
                </div>

                <CtaButton type="button" onClick={scrollToCTA}>
                  <Sparkles size={16} />
                  {t("lockedStateButton")}
                </CtaButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
