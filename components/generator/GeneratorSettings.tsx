"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "framer-motion";

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

import { ModeSwitcher } from "./ui/ModeSwitcher";
import { PlatformSelector } from "./ui/PlatformSelector";
import { DropdownPill } from "./ui/ContextPills";
import { CreatorCustomizer } from "./ui/CreatorCustomizer";

interface GeneratorSettingsProps {
  mode?: ContentMode;
  platform: Platform | PlatformV2 | string;
  format?: string;
  contentType?: ContentType | ContentTypeV2 | string;
  arabicStyle: ArabicStyle;
  marketingObjective?: string;
  persona?: PersonaConfig;
  styleConfig?: StyleConfig;
  intent?: CreatorIntent;
  originality?: OriginalityLevel;
  onModeChange?: (mode: ContentMode) => void;
  onPlatformChange: (platform: any) => void;
  onFormatChange?: (formatId: string) => void;
  onContentTypeChange?: (type: any) => void;
  onArabicStyleChange: (style: ArabicStyle) => void;
  onMarketingObjectiveChange?: (obj: string) => void;
  onPersonaChange?: (persona: PersonaConfig) => void;
  onStyleChange?: (style: StyleConfig) => void;
  onIntentChange?: (intent: CreatorIntent) => void;
  onOriginalityChange?: (orig: OriginalityLevel) => void;
  disabled?: boolean;
}

export default function GeneratorSettings({
  mode = "marketing",
  platform,
  format,
  arabicStyle,
  marketingObjective,
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
  onPersonaChange,
  onStyleChange,
  onIntentChange,
  onOriginalityChange,
  disabled,
}: GeneratorSettingsProps) {
  const t = useTranslations("GeneratorSettings");

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
      return t(path);
    } catch {
      return fallback;
    }
  };

  const isCreatorMode = mode === "creator" || mode === "personal_creator";

  return (
    <div style={{ display: "contents" }} dir="rtl">
      {/* 1. Mode Switcher (Order: 1) */}
      <div style={{ order: 1, marginBottom: "4px" }} dir="rtl">
        {onModeChange && (
          <ModeSwitcher mode={mode} onChange={onModeChange} disabled={disabled} />
        )}
      </div>

      {/* 2. Platform Selector (Order: 2) */}
      <div style={{ order: 2 }} dir="rtl">
        <PlatformSelector
          platforms={registeredPlatforms}
          selected={currentPlatform}
          onChange={handlePlatformSelect}
          disabled={disabled}
        />
      </div>

      {/* order 3 is reserved for GeneratorInput */}

      {/* 4. Quick Context Pills (Order: 4) */}
      <div style={{ order: 4, display: "flex", gap: "8px", flexWrap: "wrap" }} dir="rtl">
        <DropdownPill
          label={getTranslated("arabicStyleLabel", "اللهجة")}
          value={arabicStyle}
          onChange={(val) => onArabicStyleChange(val as ArabicStyle)}
          disabled={disabled}
          options={ARABIC_STYLES.map((s) => ({
            value: s,
            label: getTranslated(`arabicStyles.${s}`, s),
          }))}
        />

        <DropdownPill
          label={getTranslated("formatLabel", "صيغة المحتوى")}
          value={currentFormatEntry?.id || availableFormats[0]?.id || "post"}
          onChange={handleFormatSelect}
          disabled={disabled}
          options={availableFormats.map((f) => ({
            value: f.id,
            label: getTranslated(`formats.${f.id}`, f.label),
          }))}
        />

        {!isCreatorMode && onMarketingObjectiveChange && (
          <DropdownPill
            label={getTranslated("objectiveLabel", "الهدف")}
            value={marketingObjective || supportedObjectives[0] || "awareness"}
            onChange={onMarketingObjectiveChange}
            disabled={disabled}
            options={supportedObjectives.map((obj) => ({
              value: obj,
              label: getTranslated(`objectives.${obj}`, obj),
            }))}
          />
        )}
        
        {isCreatorMode && onIntentChange && (
          <DropdownPill
            label={getTranslated("intentLabel", "الهدف")}
            value={intent}
            onChange={(val) => onIntentChange(val as CreatorIntent)}
            disabled={disabled}
            options={CREATOR_INTENTS.map((it) => ({
              value: it,
              label: getTranslated(`intents.${it}`, it),
            }))}
          />
        )}
      </div>

      {/* 5. Creator Mode Deep Customization (Order: 5) */}
      <AnimatePresence>
        {isCreatorMode && onPersonaChange && onStyleChange && onOriginalityChange && (
          <div style={{ order: 5 }} dir="rtl">
            <CreatorCustomizer
              personas={availablePersonas.map((p) => ({ value: p.id, label: getTranslated(`personas.${p.id}`, p.name) }))}
              selectedPersona={persona?.id || availablePersonas[0]?.id || "developer"}
              onPersonaChange={(pId) => {
                const p = availablePersonas.find((per) => per.id === pId);
                if (p) onPersonaChange({ id: p.id, name: p.name, interests: p.interests, characteristics: p.characteristics });
              }}
              
              styles={availableStyles.map((s) => ({ value: s.id, label: getTranslated(`styles.${s.id}`, s.name) }))}
              selectedStyle={styleConfig?.id || availableStyles[0]?.id || "mystery"}
              onStyleChange={(sId) => {
                const s = availableStyles.find((st) => st.id === sId);
                if (s) onStyleChange({ id: s.id, name: s.name, characteristics: s.characteristics });
              }}

              originalityOptions={ORIGINALITY_LEVELS.map((o) => ({ value: o, label: getTranslated(`originality.${o}`, o) }))}
              selectedOriginality={originality}
              onOriginalityChange={(val) => onOriginalityChange(val as OriginalityLevel)}

              disabled={disabled}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
