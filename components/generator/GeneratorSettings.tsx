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

  const [advancedOpen, setAdvancedOpen] = useState(false);

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
          <div style={{ gridColumn: "span 2" }}>
            <DropdownPill
              label={getTranslated("objectiveLabel", "الهدف التسويقي")}
              value={marketingObjective || supportedObjectives[0] || "awareness"}
              onChange={onMarketingObjectiveChange}
              disabled={disabled}
              options={supportedObjectives.map((obj) => ({
                value: obj,
                label: getTranslated(`objectives.${obj}`, obj),
              }))}
            />
          </div>
        )}

        {isCreatorMode && onIntentChange && (
          <div style={{ gridColumn: "span 2" }}>
            <DropdownPill
              label={getTranslated("intentLabel", "الهدف من المنشور")}
              value={intent}
              onChange={(val) => onIntentChange(val as CreatorIntent)}
              disabled={disabled}
              options={CREATOR_INTENTS.map((it) => ({
                value: it,
                label: getTranslated(`intents.${it}`, it),
              }))}
            />
          </div>
        )}
      </div>

      {/* 5. Creator Mode Deep Customization (Order: 5) */}
      {isCreatorMode && onPersonaChange && onStyleChange && onOriginalityChange && (
        <div style={{ order: 5, marginTop: "var(--space-0-5)" }}>
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-2) var(--space-2-5)",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-foreground)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-weight-semibold)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <Settings2 size={14} color="var(--color-brand-primary)" />
              <span>{getTranslated("advancedSettings", "إعدادات متقدمة")}</span>
            </div>
            <ChevronDown
              size={14}
              color="var(--color-foreground-secondary)"
              style={{ transform: advancedOpen ? "rotate(180deg)" : "none", transition: "var(--transition-normal)" }}
            />
          </button>

          <AnimatePresence>
            {advancedOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
                exit={{ height: 0, opacity: 0, overflow: "hidden" }}
              >
                <CreatorCustomizer
                  personas={availablePersonas.map((p) => ({ value: p.id, label: getTranslated(`personas.${p.id}`, p.name) }))}
                  selectedPersona={persona?.id || availablePersonas[0]?.id || "developer"}
                  onPersonaChange={(pId) => {
                    const p = availablePersonas.find((per) => per.id === pId);
                    if (p) onPersonaChange({ id: p.id, name: p.name });
                  }}

                  styles={availableStyles.map((s) => ({ value: s.id, label: getTranslated(`styles.${s.id}`, s.name) }))}
                  selectedStyle={styleConfig?.id || availableStyles[0]?.id || "mystery"}
                  onStyleChange={(sId) => {
                    const s = availableStyles.find((st) => st.id === sId);
                    if (s) onStyleChange({ id: s.id, name: s.name, characteristics: s.characteristics });
                  }}

                  originalityOptions={ORIGINALITY_LEVELS.map((o) => ({ value: o, label: getTranslated(`originalityLevels.${o}`, o) }))}
                  selectedOriginality={originality}
                  onOriginalityChange={(val) => onOriginalityChange(val as OriginalityLevel)}

                  disabled={disabled}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
