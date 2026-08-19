"use client";

// ---------------------------------------------------------------------------
// GeneratorForm — Main orchestrator for the generator UI
//
// Handles form state (RHF), validation (Zod), and API communication.
// The form is always mounted (hidden when showing results) so regeneration
// can reuse the same form values without remounting.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { generateInputSchema, type GenerateInputDTO } from "@/lib/validation/generation";
import type { GeneratedContent, GenerateResponse } from "@/types/content";

import GeneratorInput from "./GeneratorInput";
import GeneratorSettings from "./GeneratorSettings";
import GenerateButton from "./GenerateButton";
import GenerationSkeleton from "./GenerationSkeleton";
import GenerationResult from "./GenerationResult";

type ViewState = "form" | "loading" | "result";

export default function GeneratorForm() {
  const [viewState, setViewState] = useState<ViewState>("form");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GenerateInputDTO | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm<GenerateInputDTO>({
    resolver: zodResolver(generateInputSchema),
    defaultValues: {
      platform: "instagram",
      contentType: "sponsored_ad",
      arabicStyle: "white_arabic",
      rawInput: "",
    },
    mode: "onChange",
  });

  const doGenerate = async (data: GenerateInputDTO) => {
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
        setApiError(resultData.error.message);
        setViewState("form");
        return;
      }

      setResult(resultData.data);
      setViewState("result");
    } catch (error) {
      setApiError("حدث خطأ غير متوقع. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.");
      setViewState("form");
      console.error("Submission error:", error);
    }
  };

  const handleRegenerate = () => {
    // Reuse the last input — fallback to current form values
    const data = lastInput ?? getValues();
    doGenerate(data);
  };

  const handleStartOver = () => {
    setResult(null);
    setApiError(null);
    setViewState("form");
    reset({ platform: "instagram", contentType: "sponsored_ad", arabicStyle: "white_arabic", rawInput: "" });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <AnimatePresence mode="wait">
        {viewState === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <form onSubmit={handleSubmit(doGenerate)} className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
                <Controller
                  name="rawInput"
                  control={control}
                  render={({ field }) => (
                    <GeneratorInput
                      value={field.value}
                      onChange={field.onChange}
                      ref={field.ref}
                      error={errors.rawInput?.message}
                      disabled={false}
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
                      render={({ field: styleField }) => (
                        <Controller
                          name="contentType"
                          control={control}
                          render={({ field: typeField }) => (
                            <GeneratorSettings
                              platform={pf.value}
                              arabicStyle={styleField.value}
                              contentType={typeField.value}
                              onPlatformChange={pf.onChange}
                              onArabicStyleChange={styleField.onChange}
                              onContentTypeChange={typeField.onChange}
                              disabled={false}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />

                {apiError && (
                  <div
                    className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium"
                    role="alert"
                  >
                    {apiError}
                  </div>
                )}
              </div>

              <GenerateButton
                loading={false}
                disabled={!isValid}
              />
            </form>
          </motion.div>
        )}

        {viewState === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <GenerationSkeleton />
          </motion.div>
        )}

        {viewState === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <GenerationResult
              content={result}
              loading={false}
              onRegenerate={handleRegenerate}
              onStartOver={handleStartOver}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
