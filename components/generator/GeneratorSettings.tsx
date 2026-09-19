"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, ChevronDown } from "lucide-react";

import {
  ARABIC_STYLES,
  type ArabicStyle,
  type ContentMode,
  type ContentType,
  type ContentTypeV2,
  type Platform,
  type PlatformV2,
  type PersonaConfig,
  type StyleConfig,
  type CreatorIntent,
  type OriginalityLevel,
  CREATOR_INTENTS,
  ORIGINALITY_LEVELS,
} from "@/types/content";
import {
  getRegisteredPlatforms,
  getFormatsForPlatform,
  getFormat,
  normalizePlatform,
} from "@/lib/content/formats";
import { getAvailablePersonas } from "@/lib/content/personas";
import { getAvailableStyles } from "@/lib/content/styles";

import type { Control } from "react-hook-form";
import type { GeneratorFormValues } from "./ContentGenerator";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/shadcn/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Input } from "@/components/shadcn/input";
import { Button } from "@/components/shadcn/button";
import { ModeSwitcher } from "./ui/ModeSwitcher";
import { PlatformSelector } from "./ui/PlatformSelector";
import { CreatorCustomizer } from "./ui/CreatorCustomizer";
import { CollapsibleSettingsSection } from "./ui/CollapsibleSettingsSection";

type ContentLanguage = "ar" | "en" | "bilingual";

interface GeneratorSettingsProps {
  mode?: ContentMode;
  platform: Platform | PlatformV2 | string;
  format?: string;
  contentType?: ContentType | ContentTypeV2 | string;
  arabicStyle: string;
  marketingObjective?: string;
  tone?: string;
  language?: ContentLanguage;
  keyMessage?: string;
  persona?: { id: string; name: string };
  styleConfig?: { id: string; name: string; characteristics?: string[] };
  intent?: CreatorIntent;
  originality?: OriginalityLevel;
  onModeChange?: (mode: "marketing" | "creator" | "personal_creator") => void;
  onPlatformChange: (platform: string) => void;
  onFormatChange: (format: string) => void;
  onContentTypeChange?: (contentType: string) => void;
  onArabicStyleChange: (style: ArabicStyle) => void;
  onMarketingObjectiveChange?: (objective: string) => void;
  onToneChange?: (tone: string) => void;
  onLanguageChange?: (language: ContentLanguage) => void;
  onKeyMessageChange?: (value: string) => void;
  onPersonaChange?: (persona: { id: string; name: string }) => void;
  onStyleChange?: (style: StyleConfig) => void;
onIntentChange?: (intent: CreatorIntent) => void;
  onOriginalityChange?: (orig: OriginalityLevel) => void;
  control: Control<GeneratorFormValues>;
  disabled?: boolean;
}

export default function GeneratorSettings({
  mode = "marketing",
  platform,
  format,
  contentType,
  arabicStyle,
  marketingObjective,
  tone,
  language = "ar",
  keyMessage = "",
  persona,
  styleConfig,
  intent = "insight",
  originality = "balanced",
  onModeChange,
  onPlatformChange,
  onFormatChange,
  onContentTypeChange,
  onArabicStyleChange,
  onMarketingObjectiveChange,
  onToneChange,
  onLanguageChange,
  onKeyMessageChange,
  onPersonaChange,
  onStyleChange,
onIntentChange,
  onOriginalityChange,
  control,
  disabled,
}: GeneratorSettingsProps) {
  const t = useTranslations("GeneratorSettings");

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [marketingMoreOpen, setMarketingMoreOpen] = useState(false);

  const registeredPlatforms = useMemo(() => getRegisteredPlatforms(), []);
  const availablePersonas = useMemo(() => getAvailablePersonas(), []);
  const availableStyles = useMemo(() => getAvailableStyles(), []);

  const currentPlatform = normalizePlatform(platform);

  const availableFormats = useMemo(() => {
    return getFormatsForPlatform(currentPlatform);
  }, [currentPlatform]);

  const currentFormatEntry = useMemo(() => {
    if (format) {
      const found = availableFormats.find((f) => f.id === format);
      if (found) return found;
    }
    return availableFormats[0];
  }, [availableFormats, format]);

  const supportedObjectives = useMemo(() => {
    return currentFormatEntry?.supportedObjectives || [
      "awareness",
      "engagement",
      "sales",
      "traffic",
      "leads",
      "messages",
    ];
  }, [currentFormatEntry]);

  const handlePlatformSelect = (newPlatform: string) => {
    onPlatformChange(newPlatform);
    const newFormats = getFormatsForPlatform(newPlatform);
    if (newFormats.length > 0) {
      const defaultFormat = newFormats[0];
      if (onFormatChange) onFormatChange(defaultFormat.id);
      if (onContentTypeChange && defaultFormat.supportedContentTypes.length > 0) {
        onContentTypeChange(defaultFormat.supportedContentTypes[0]);
      }
      if (onMarketingObjectiveChange) {
        if (!defaultFormat.supportedObjectives.includes((marketingObjective as any) || "awareness")) {
          onMarketingObjectiveChange(defaultFormat.supportedObjectives[0] || "awareness");
        }
      }
    }
  };

  const handleFormatSelect = (newFormatId: string) => {
    if (onFormatChange) onFormatChange(newFormatId);
    const selectedFormat = getFormat(currentPlatform, newFormatId);
    if (selectedFormat) {
      if (onContentTypeChange && selectedFormat.supportedContentTypes.length > 0) {
        onContentTypeChange(selectedFormat.supportedContentTypes[0]);
      }
      if (onMarketingObjectiveChange) {
        if (!selectedFormat.supportedObjectives.includes((marketingObjective as any) || "awareness")) {
          onMarketingObjectiveChange(selectedFormat.supportedObjectives[0] || "awareness");
        }
      }
    }
  };

  const getTranslated = (path: string, fallback: string) => {
    try {
      if (t.has(path as any)) {
        return t(path as any);
      }
      return fallback;
    } catch {
      return fallback;
    }
  };

  const isCreatorMode = mode === "creator" || mode === "personal_creator";

  const LANGUAGE_OPTIONS: { value: ContentLanguage; label: string }[] = [
    { value: "ar", label: getTranslated("languages.ar", "عربي") },
    { value: "en", label: getTranslated("languages.en", "English") },
    { value: "bilingual", label: getTranslated("languages.bilingual", "ثنائي اللغة") },
  ];

  const TONE_OPTIONS = [
    { value: "premium", label: getTranslated("tones.premium", "راقٍ / فاخر") },
    { value: "friendly", label: getTranslated("tones.friendly", "ودود / قريب") },
    { value: "professional", label: getTranslated("tones.professional", "رسمي / احترافي") },
    { value: "energetic", label: getTranslated("tones.energetic", "حيوي / متحمس") },
    { value: "conversational", label: getTranslated("tones.conversational", "محادثاتي / مريح") },
    { value: "minimal", label: getTranslated("tones.minimal", "مكثف / مباشر") },
    { value: "bold", label: getTranslated("tones.bold", "جريء / قوي") },
{ value: "playful", label: getTranslated("tones.playful", "مرح / خفيف") },
  ];

  const fieldLabelClass = "text-xs font-bold uppercase tracking-[var(--tracking-caps)] text-foreground-secondary";

  return (
    <div style={{ display: "contents" }}>
      {/* 1. Mode Switcher (Order: 1) */}
      <div style={{ order: 1, display: "flex", flexDirection: "column", gap: "var(--space-1)", overflow: "hidden" }}>
        {onModeChange && (
          <ModeSwitcher mode={mode} onChange={onModeChange} disabled={disabled} />
        )}
      </div>

      {/* 2. Platform Selector (Order: 2) */}
      <div style={{ order: 2, display: "flex", flexDirection: "column", gap: "var(--space-1)", overflow: "hidden" }}>
        <PlatformSelector
          platforms={registeredPlatforms}
          selected={currentPlatform}
          onChange={handlePlatformSelect}
          disabled={disabled}
        />
      </div>

      {/* order 3 is reserved for GeneratorInput */}

      {/* 4. Quick Context Pills / Dropdowns (Order: 4) */}
      <div style={{ order: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", overflow: "hidden", minWidth: 0 }}>
<FormField
          control={control}
          name="arabicStyle"
          render={() => (
            <FormItem className="gap-1">
              <FormLabel className={fieldLabelClass}>
                {getTranslated("arabicStyleLabel", "اللهجة")}
              </FormLabel>
              <Select
                value={arabicStyle}
                onValueChange={(val) => onArabicStyleChange(val as ArabicStyle)}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger className="w-full bg-surface text-xs">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ARABIC_STYLES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {getTranslated(`arabicStyles.${s}`, s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

<FormField
          control={control}
          name="format"
          render={() => (
            <FormItem className="gap-1">
              <FormLabel className={fieldLabelClass}>
                {getTranslated("formatLabel", "نوع المنشور")}
              </FormLabel>
              <Select
                value={currentFormatEntry?.id || availableFormats[0]?.id || "post"}
                onValueChange={handleFormatSelect}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger className="w-full bg-surface text-xs">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableFormats.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {getTranslated(`formats.${f.id}`, f.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {/* Marketing Mode: Objective & Tone (span 1 each) */}
        {!isCreatorMode && (
          <>
{onMarketingObjectiveChange && (
              <FormField
                control={control}
                name="marketingObjective"
                render={() => (
                  <FormItem className="gap-1">
                    <FormLabel className={fieldLabelClass}>
                      {getTranslated("objectiveLabel", "هدف التسويق")}
                    </FormLabel>
                    <Select
                      value={marketingObjective || supportedObjectives[0] || "awareness"}
                      onValueChange={onMarketingObjectiveChange}
                      disabled={disabled}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full bg-surface text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {supportedObjectives.map((obj) => (
                          <SelectItem key={obj} value={obj} className="text-xs">
                            {getTranslated(`objectives.${obj}`, obj)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}
{onToneChange && (
              <FormField
                control={control}
                name="tone"
                render={() => (
                  <FormItem className="gap-1">
                    <FormLabel className={fieldLabelClass}>
                      {getTranslated("toneLabel", "نبرة الصوت")}
                    </FormLabel>
                    <Select
                      value={tone || "conversational"}
                      onValueChange={onToneChange}
                      disabled={disabled}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full bg-surface text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TONE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}
          </>
        )}

        {/* Creator Mode: Persona & Intent side-by-side */}
        {isCreatorMode && (
          <>
{onPersonaChange && (
              <FormField
                control={control}
                name="persona"
                render={() => (
                  <FormItem className="gap-1">
                    <FormLabel className={fieldLabelClass}>
                      {getTranslated("personaLabel", "شخصية المحتوى")}
                    </FormLabel>
                    <Select
                      value={persona?.id || availablePersonas.find((p) => p.id === "creative")?.id || availablePersonas[0]?.id || "creative"}
                      onValueChange={(pId) => {
                        const p = availablePersonas.find((per) => per.id === pId);
                        if (p) onPersonaChange({ id: p.id, name: p.name });
                      }}
                      disabled={disabled}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full bg-surface text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availablePersonas.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {getTranslated(`personas.${p.id}`, p.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

{onIntentChange && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <FormField
                  control={control}
                  name="intent"
                  render={() => (
                    <FormItem className="gap-1">
                      <FormLabel className={fieldLabelClass}>
                        {getTranslated("intentLabel", "الهدف من المحتوى")}
                      </FormLabel>
                      <Select
                        value={intent || "opinion"}
                        onValueChange={(val) => onIntentChange(val as CreatorIntent)}
                        disabled={disabled}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full bg-surface text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CREATOR_INTENTS.map((it) => (
                            <SelectItem key={it} value={it} className="text-xs">
                              {getTranslated(`intents.${it}`, it)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 5-Marketing. More Settings — keyMessage + language (Order: 5) */}
      {!isCreatorMode && onKeyMessageChange && onLanguageChange && (
        <div style={{ order: 5 }}>
          <CollapsibleSettingsSection
          title={getTranslated("advancedSettings", "إعدادات متقدمة")}
          isOpen={marketingMoreOpen}
          onToggle={() => setMarketingMoreOpen(!marketingMoreOpen)}
          badge={(
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "var(--text-2xs)",
                color: "var(--color-foreground-secondary)",
                background: "var(--color-brand-surface)",
                padding: "var(--space-0-5) var(--space-2)",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--color-brand-soft)",
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--color-foreground-secondary)", marginRight: "var(--space-1)" }}>الرسالة الأساسية</span>
              <span style={{ opacity: "var(--opacity-subtle)", margin: "0 var(--space-1)" }}>&bull;</span>
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--color-foreground-secondary)", marginRight: "var(--space-1)" }}>لغة المحتوى</span>
            </div>
          )}
        >
<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingTop: "var(--space-3)" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1-5)" }}>
<FormField
              control={control}
              name="keyMessage"
              render={() => (
                <FormItem className="gap-1.5">
                  <FormLabel
                    htmlFor="key-message-input"
                    className="text-xs font-medium text-foreground-secondary"
                  >
                    {getTranslated("keyMessageLabel", "الرسالة الأساسية")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="key-message-input"
                      type="text"
                      value={keyMessage}
                      onChange={(e) => onKeyMessageChange(e.target.value)}
                      disabled={disabled}
                      placeholder={getTranslated("keyMessagePlaceholder", "مثال: خصم 20% حتى الجمعة")}
                      className="bg-surface"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            </div>

<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1-5)" }}>
              <label
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--color-foreground-secondary)",
                }}
              >
                {getTranslated("languageLabel", "لغة المحتوى")}
              </label>
<div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <FormField
                  control={control}
                  name="language"
                  render={() => (
                    <FormItem className="contents">
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          size="sm"
                          variant={language === opt.value ? "default" : "outline"}
                          disabled={disabled}
                          onClick={() => onLanguageChange(opt.value)}
                          className="shrink-0 rounded-full"
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </FormItem>
                  )}
                />
              </div>
            </div>

          </div>
        </CollapsibleSettingsSection>
        </div>
      )}

      {/* 5-Creator. Creator Mode Deep Customization (Order: 5) */}
      {isCreatorMode && onStyleChange && onOriginalityChange && (
        <div style={{ order: 5 }}>
          <CollapsibleSettingsSection
            title={getTranslated("advancedSettings", "إعدادات متقدمة")}
            isOpen={advancedOpen}
            onToggle={() => setAdvancedOpen(!advancedOpen)}
            badge={(
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "var(--text-2xs)",
                  color: "var(--color-foreground-secondary)",
                  background: "var(--color-brand-surface)",
                  padding: "var(--space-0-5) var(--space-2)",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--color-brand-soft)",
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: "var(--text-2xs)", color: "var(--color-foreground-secondary)", marginRight: "var(--space-1)" }}>أسلوب الطرح</span>
                <span style={{ opacity: "var(--opacity-subtle)", margin: "0 var(--space-1)" }}>&bull;</span>
                <span style={{ fontSize: "var(--text-2xs)", color: "var(--color-foreground-secondary)", marginRight: "var(--space-1)" }}>مستوى الابتكار</span>
              </div>
            )}
          >
          <div style={{ paddingTop: "var(--space-3)" }}>
<CreatorCustomizer
              control={control}
              styles={availableStyles.map((s) => ({ value: s.id, label: getTranslated(`styles.${s.id}`, s.name) }))}
              selectedStyle={styleConfig?.id || availableStyles.find((s) => s.id === "storytelling")?.id || availableStyles[0]?.id || "storytelling"}
              onStyleChange={(sId) => {
                const s = availableStyles.find((st) => st.id === sId);
                if (s) onStyleChange({ id: s.id, name: s.name, characteristics: s.characteristics });
              }}
              originalityOptions={ORIGINALITY_LEVELS.map((o) => ({ value: o, label: getTranslated(`originalityLevels.${o}`, o) }))}
              selectedOriginality={originality}
              onOriginalityChange={(val) => onOriginalityChange(val as OriginalityLevel)}
              disabled={disabled}
            />
          </div>
        </CollapsibleSettingsSection>
        </div>
      )}
    </div>
  );
}
