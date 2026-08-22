"use client";

import { useState, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Wand2, Zap, Lock, Sparkles } from "lucide-react";
import { generateInputSchema, type GenerateInputDTO } from "@/lib/validation/generation";
import type { GeneratedContent, GenerateResponse } from "@/types/content";
import { ERROR_CODES } from "@/types/content";
import { useTranslations } from "next-intl";
import { useHistoryContext } from "@/components/history/HistoryContext";
import { normalizePlatform, getFormatsForPlatform } from "@/lib/content/formats";

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
      platform: "instagram",
      format: "post",
      contentType: "interactive_post",
      arabicStyle: "egyptian_colloquial",
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
            <motion.button
              type="button"
              onClick={scrollToCTA}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                width: "100%", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-xl)", border: "none",
                background: "var(--gradient-brand)",
                color: "var(--color-foreground-inverse)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--text-base)",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "var(--shadow-brand)",
              }}
            >
              <Sparkles size={16} />
              {t("lockedButton")}
            </motion.button>
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
              className="generator-card"
              style={{
                ...DARK_CARD,
                maxHeight: isMobile ? "none" : "calc(100vh - 80px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
            >
              {/* Card Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                padding: "var(--space-4) var(--space-5)",
                flexShrink: 0,
                position: "relative"
              }}>
                {/* Fading Divider */}
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "1px",
                  background: "linear-gradient(90deg, transparent 0%, var(--color-border) 50%, transparent 100%)",
                  opacity: 0.8
                }} />
                <div style={{
                  width: "var(--space-8)", height: "var(--space-8)", borderRadius: "var(--radius-md)", flexShrink: 0,
                  background: "var(--gradient-brand)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--shadow-brand)",
                }}>
                  <Wand2 size={15} color="var(--color-foreground-inverse)" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-bold)", color: "var(--color-foreground)", margin: 0 }}>
                    {t("settingsTitle")}
                  </p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-disabled)", margin: 0, marginTop: "var(--space-0-5)" }}>
                    {t("settingsSubtitle")}
                  </p>
                </div>
                {/* Credits badge */}
                {remainingGenerations !== null && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                      padding: "var(--space-0-5) var(--space-2-5)", borderRadius: "var(--radius-full)",
                      background: remainingGenerations > 0 ? "var(--color-brand-surface)" : "var(--color-danger-surface)",
                      border: `1px solid ${remainingGenerations > 0 ? "var(--color-brand-soft)" : "var(--color-danger-border)"}`,
                      color: remainingGenerations > 0 ? "var(--color-brand-primary)" : "var(--color-danger)",
                      fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-bold)", whiteSpace: "nowrap" as const,
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
                    paddingTop: "var(--space-3)",
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    background: "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--color-surface-elevated) 92%, var(--color-background)) 35%)",
                    backdropFilter: "blur(8px)",
                    borderTop: "1px solid var(--color-border)",
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
                      <motion.button
                        type="button"
                        onClick={scrollToCTA}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2, boxShadow: "var(--shadow-brand)" }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                          width: "100%", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-lg)", border: "none",
                          background: "var(--gradient-brand)",
                          color: "var(--color-foreground-inverse)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--text-base)",
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
                  padding: "var(--space-12) var(--space-8)", textAlign: "center", gap: "var(--space-6)",
                  position: "relative", overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                  style={{
                    width: "var(--space-18)", height: "var(--space-18)", borderRadius: "var(--radius-circle)",
                    background: "color-mix(in srgb, var(--color-foreground) 3%, transparent)",
                    border: "1px solid var(--color-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 var(--space-3) var(--color-brand-surface), 0 var(--space-3) var(--space-10) var(--color-brand-soft)",
                  }}
                >
                  <Zap size={32} color="var(--color-brand-primary)" />
                </motion.div>

                <div style={{ maxWidth: "360px" }}>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-weight-extrabold)", color: "var(--color-foreground)", margin: "0 0 var(--space-2-5)" }}>
                    {isCreatorMode ? t("emptyStateTitleCreator") : t("emptyStateTitle")}
                  </h3>
                  <p style={{ color: "var(--color-foreground-disabled)", lineHeight: "var(--leading-relaxed)", fontSize: "var(--text-base)", margin: 0 }}>
                    {isCreatorMode ? t("emptyStateSubtitleCreator") : t("emptyStateSubtitle")}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
                  {(isCreatorMode
                    ? [t("emptyStateTagsCreator.insights"), t("emptyStateTagsCreator.storytelling"), t("emptyStateTagsCreator.voice"), t("emptyStateTagsCreator.discussion")]
                    : [t("emptyStateTags.impactfulTitles"), t("emptyStateTags.captivatingHooks"), t("emptyStateTags.smartHashtags"), t("emptyStateTags.effectiveCTAs")]
                  ).map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      style={{
                        padding: "var(--space-1-5) var(--space-3-5)", borderRadius: "var(--radius-full)",
                        background: "var(--color-brand-surface)", border: "1px solid var(--color-brand-soft)",
                        color: "var(--color-brand-primary)", fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)",
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
                style={{ ...DARK_CARD, padding: "28px", flex: 1, display: "flex", flexDirection: "column" }}
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
                style={{
                  minHeight: "520px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--color-brand-soft)",
                  background: "var(--gradient-surface)",
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
                    fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-extrabold)", margin: "0 0 var(--space-3)",
                    color: "var(--color-foreground)",
                  }}>
                    {t("lockedStateTitle")}
                  </h3>
                  <p style={{ color: "var(--color-foreground-tertiary)", lineHeight: 1.8, fontSize: "var(--text-base)", margin: 0 }}>
                    {t("lockedStateSubtitle")}
                  </p>
                </div>

                <motion.button
                  type="button"
                  onClick={scrollToCTA}
                  whileHover={{ y: -3, boxShadow: "var(--shadow-brand)" }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-2)",
                    padding: "var(--space-3-5) var(--space-7)", borderRadius: "var(--radius-lg)", border: "none",
                    background: "var(--gradient-brand)",
                    color: "var(--color-foreground-inverse)", fontWeight: "var(--font-weight-bold)", fontSize: "var(--text-base)",
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
