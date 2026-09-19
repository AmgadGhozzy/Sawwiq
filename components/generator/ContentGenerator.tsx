"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useForm, useFormContext, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Wand2, Zap, Lock, Sparkles, ArrowLeft } from "lucide-react";
import { generateInputSchema, type GenerateInputDTO } from "@/lib/validation/generation";
import type { GeneratedContent, GenerateResponse, CreatorIntent, OriginalityLevel } from "@/types/content";
import { ERROR_CODES } from "@/types/content";
import { useTranslations, useLocale } from "next-intl";
import { useHistoryContext } from "@/components/history/HistoryContext";
import { normalizePlatform, getFormatsForPlatform } from "@/lib/content/formats";
import { getTracker } from "@/lib/analytics/tracker";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/shadcn/form";
import Button from "@/components/ui/Button";

import GeneratorInput from "./GeneratorInput";
import GeneratorSettings from "./GeneratorSettings";
import GenerateButton from "./GenerateButton";
import GenerationSkeleton from "./GenerationSkeleton";
import GenerationResult from "./GenerationResult";
import AuthModal from "@/components/auth/AuthModal";
import { getSupabaseClient } from "@/lib/supabase/client";

type ViewState = "empty" | "loading" | "result" | "locked";

// Flat union of every GenerateInputDTO branch: the UI freely mixes marketing
// and creator fields; the zod schema narrows to one branch on submit.
export type GeneratorFormValues = {
  mode: "marketing" | "creator" | "personal_creator";
  platform: GenerateInputDTO["platform"];
  contentType: GenerateInputDTO["contentType"];
  arabicStyle: GenerateInputDTO["arabicStyle"];
  format?: string;
  marketingObjective?: string;
  metadata?: unknown;
  constraints?: GenerateInputDTO["constraints"];
  rawInput: string;
  tone?: string;
  copyFramework?: string;
  keyMessage?: string;
  intent?: string;
  originality?: string;
  persona?: any;
  style?: any;
  language?: "ar" | "en" | "bilingual";
};

const formResolver = zodResolver(generateInputSchema) as unknown as Resolver<GeneratorFormValues>;

export default function ContentGenerator() {
  const locale = useLocale();
  const t = useTranslations("ContentGenerator");
  const tErrors = useTranslations("Errors");

  const { items, selectedHistoryIndex, setSelectedHistoryIndex, refreshHistory } = useHistoryContext();

  const [viewState, setViewState] = useState<ViewState>("empty");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GeneratorFormValues | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Double-submit guard: viewState→disabled lands on the next render, so two
  // clicks in the same tick would fire two requests with two requestIds
  // (double charge). The ref blocks the second synchronously.
  const isSubmittingRef = useRef(false);

  const methods = useForm<GeneratorFormValues>({
    resolver: formResolver,
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
      keyMessage: "",
      language: "ar",
      rawInput: "",
      tone: "conversational",
    },
    mode: "onChange",
  });
  const {
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { isValid },
  } = methods;

  const selectedMode = watch("mode");
  const isCreatorMode = selectedMode === "creator" || selectedMode === "personal_creator";

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
        tone: (historyItem as any).tone || "conversational",
        persona: historyItem.persona || {
          id: "developer",
          name: "المبرمج والتقني",
        },
        style: historyItem.style || {
          id: "mystery",
          name: "الغموض والمفارقة",
        },
        keyMessage: historyItem.keyMessage || "",
        language: (historyItem as any).language || "ar",
        rawInput: historyItem.prompt || "",
      });
      setViewState("result");
    }
  }, [selectedHistoryIndex, items, reset]);

  const doGenerateInner = useCallback(async (data: GeneratorFormValues) => {
    setLastInput(data);
    setViewState("loading");
    setSelectedHistoryIndex(null); // Clear history selection when generating new
    setApiError(null);
    setResult(null);

    const tracker = getTracker();
    tracker.track("generation_started", {
      platform: data.platform,
      mode: data.mode,
      is_first: items.length === 0,
    });

    try {
      // Attach Authorization header if user is logged in so the API can
      // deduct from their account instead of treating them as anonymous.
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        authHeaders["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(data),
      });

      const resultData = (await response.json()) as GenerateResponse;

      if (!resultData.success) {
        if (resultData.error.code === ERROR_CODES.RATE_LIMIT_REACHED) {
          tracker.track("rate_limit_reached");
          if (session?.access_token) {
            // Authenticated user ran out of credits — show error, NOT AuthModal
            setApiError(tErrors("RATE_LIMIT_REACHED"));
            setRemainingGenerations(0);
            setViewState("empty");
          } else {
            // Anonymous user — prompt sign-up
            tracker.track("auth_modal_shown");
            setViewState("locked");
            setShowAuthModal(true);
          }
          return;
        }
        const code = resultData.error.code || "GENERATION_FAILED";
        setApiError(tErrors(code));
        setViewState("empty");
        return;
      }

      // Reconcile with server truth: the new row (instant user_id + complete
      // metadata) lands on top; selecting it restores full-fidelity settings.
      await refreshHistory();
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
  }, [items, refreshHistory, setSelectedHistoryIndex, tErrors]);

  const doGenerate = useCallback(async (data: GeneratorFormValues) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await doGenerateInner(data);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [doGenerateInner]);

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
      keyMessage: "",
      language: "ar",
      rawInput: "",
      tone: "conversational",
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
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          setViewState("empty");
          setRemainingGenerations(null);
        }}
      />
      {/* ── Mobile Sticky Generate Bar ── */}
      <div className="sticky-generate-bar md:hidden">
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
            <Button type="button" onClick={() => setShowAuthModal(true)} fullWidth>
              <Sparkles size={16} />
              {t("lockedStateButton")}
            </Button>
          ) : (
            <form onSubmit={handleSubmit(doGenerate)} style={{ margin: 0 }}>
              <GenerateButton
                loading={viewState === "loading"}
                disabled={!isValid || viewState === "loading"}
                hasResult={Boolean(result)}
              />
            </form>
          )}
        </div>

      <div className="flex flex-col lg:flex-row items-stretch gap-5 lg:gap-7 pb-12 md:pb-0">
        {/* ────────────────── Settings Panel ────────────────── */}
        <div className="w-full lg:w-[380px] shrink-0 relative z-50">
          <div className="lg:sticky lg:top-8">
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="generator-card glass-card md:max-h-[calc(100vh-80px)]"
              style={{
                borderRadius: "var(--radius-xl)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
>
              {/* Card Header */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "var(--space-4)",
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
                    <p style={{
                      fontSize: "var(--text-base)",
                      fontWeight: "var(--font-weight-bold)",
                      color: "var(--color-foreground)",
                      margin: 0,
                      letterSpacing: "var(--tracking-snug)",
                    }}>
                      {t("settingsTitle")}
                    </p>

                    {/* Credits badge */}
                    {remainingGenerations !== null && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{
                          padding: "var(--space-0-5) var(--space-2)",
                          borderRadius: "var(--radius-full)",
                          background: remainingGenerations > 0 ? "var(--color-brand-surface)" : "var(--color-danger-surface)",
                          border: `1px solid ${remainingGenerations > 0 ? "var(--color-brand-soft)" : "var(--color-danger-border)"}`,
                          color: remainingGenerations > 0 ? "var(--color-brand-light)" : "var(--color-danger)",
                          fontSize: "var(--text-2xs)",
                          fontWeight: "var(--font-weight-bold)",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {remainingGenerations > 0 ? t("creditsRemaining", { count: remainingGenerations }) : t("zeroCredits")}
                      </motion.div>
                    )}
                  </div>
                  
                  <p style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-foreground-tertiary)",
                    margin: 0,
                    marginTop: "var(--space-1)",
                  }}>
                    {t("settingsSubtitle")}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(doGenerate)} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
                <Form {...methods}>
                <div className="p-3 pb-4 md:pb-24" style={{
                  overflowY: "auto",
                  overflowX: "hidden",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  flex: 1,
                  minHeight: 0
                }}>
                  <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <RawInputField disabled={viewState === "loading" || isLocked} />
                    <SettingsFields disabled={viewState === "loading" || isLocked} />
                  </div>
                </div>

                {/* Desktop: Floating Generate Button Container */}
                <div className="hidden md:flex md:flex-col" style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "var(--space-4)",
                    zIndex: 20,
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
                      <Button type="button" onClick={() => setShowAuthModal(true)} fullWidth>
                        <Sparkles size={15} />
                        {t("lockedStateButton")}
                      </Button>
                    ) : (
                      <GenerateButton
                        loading={viewState === "loading"}
                        disabled={!isValid || viewState === "loading"}
                        hasResult={Boolean(result)}
                      />
                    )}
                  </div>
              </Form>
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

                {/* Icon stack: static dashed ring + inner solid ring + icon */}
                <div style={{ position: "relative", width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* Static dashed outer ring */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--radius-circle)",
                    border: "1.5px dashed var(--color-brand-soft)",
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
                    }}
                  >
                    <Zap size={22} color="var(--color-foreground-inverse)" />
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
                      lineHeight: "var(--leading-tight)",
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
                <div
                  style={{
                    width: "var(--space-20)", height: "var(--space-20)", borderRadius: "var(--radius-circle)",
                    background: "var(--color-brand-surface)",
                    border: "1px solid var(--color-brand-soft)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 0 var(--space-4) var(--color-brand-surface), var(--shadow-glow)",
                  }}
                >
                  <Lock size={30} color="var(--color-brand-primary)" />
                </div>

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

                <Button type="button" onClick={() => setShowAuthModal(true)}>
                  <Sparkles size={16} />
                  {t("lockedStateButton")}
                </Button>
                <div style={{ marginTop: "var(--space-2)" }}>
                  <button 
                    onClick={() => setShowAuthModal(true)}
                    type="button"
                    style={{ background: "none", border: "none", color: "var(--color-brand-primary)", fontSize: "var(--text-sm)", cursor: "pointer", fontWeight: "var(--font-weight-medium)" }}
                  >
                    {t("alreadyHaveAccount")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function RawInputField({ disabled }: { disabled: boolean }) {
  const { watch, control } = useFormContext<GeneratorFormValues>();

  return (
    <FormField
      control={control}
      name="rawInput"
      render={({ field, fieldState }) => (
        <FormItem className="contents">
          <FormControl>
            <GeneratorInput
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
              mode={watch("mode")}
              invalid={!!fieldState.error}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage role="alert" className="order-4 font-medium" />
        </FormItem>
      )}
    />
  );
}

function SettingsFields({ disabled }: { disabled: boolean }) {
  const { watch, setValue, control } = useFormContext<GeneratorFormValues>();

  return (
    <GeneratorSettings
      control={control}
      mode={watch("mode")}
      platform={watch("platform")}
      format={watch("format")}
      contentType={watch("contentType")}
      arabicStyle={watch("arabicStyle") ?? "egyptian_colloquial"}
      marketingObjective={watch("marketingObjective")}
      tone={watch("tone")}
      language={watch("language")}
      keyMessage={watch("keyMessage")}
      persona={watch("persona")}
      styleConfig={watch("style")}
      intent={watch("intent") as CreatorIntent}
      originality={watch("originality") as OriginalityLevel}
      onModeChange={(mode) => setValue("mode", mode)}
      onPlatformChange={(p) => setValue("platform", p as GenerateInputDTO["platform"])}
      onFormatChange={(f) => setValue("format", f)}
      onContentTypeChange={(c) => setValue("contentType", c as GenerateInputDTO["contentType"])}
      onArabicStyleChange={(s) => setValue("arabicStyle", s)}
      onMarketingObjectiveChange={(o) => setValue("marketingObjective", o)}
      onToneChange={(t) => setValue("tone", t)}
      onPersonaChange={(p) => setValue("persona", p)}
      onStyleChange={(s) => setValue("style", s)}
      onIntentChange={(i) => setValue("intent", i)}
      onOriginalityChange={(o) => setValue("originality", o)}
      onKeyMessageChange={(km) => setValue("keyMessage", km)}
      onLanguageChange={(l) => setValue("language", l)}
      disabled={disabled}
    />
  );
}





