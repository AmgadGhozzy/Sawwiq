import { GenerationConfig } from "@/types/content";
import { getFormat, isFormatSupported } from "./formats";

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateGenerationConfig(config: GenerationConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const addError = (field: string, code: string, message: string) => {
    result.valid = false;
    result.errors.push({ field, code, message });
  };

  const addWarning = (field: string, code: string, message: string) => {
    result.warnings.push({ field, code, message });
  };

  // 1. Platform & Format Validation
  if (!isFormatSupported(config.platform, config.format)) {
    addError("format", "UNSUPPORTED_FORMAT", `Format '${config.format}' is not supported on platform '${config.platform}'`);
    return result; // Stop further validation if format doesn't exist
  }

  const registryFormat = getFormat(config.platform, config.format)!;

  // 2. Content Type Validation
  if (!registryFormat.supportedContentTypes.includes(config.content.type)) {
    addError(
      "content.type",
      "UNSUPPORTED_CONTENT_TYPE",
      `Content type '${config.content.type}' is not supported for ${registryFormat.label}`
    );
  }

  // 3. Objective Validation
  if (!registryFormat.supportedObjectives.includes(config.objective)) {
    addError(
      "objective",
      "UNSUPPORTED_OBJECTIVE",
      `Objective '${config.objective}' is not supported for ${registryFormat.label}`
    );
  }

  // 4. Constraints Validation against Capabilities
  const { capabilities } = registryFormat;

  if (config.constraints?.hashtags?.enabled) {
    if (!capabilities.hashtags.supported) {
      addError("constraints.hashtags", "HASHTAGS_NOT_SUPPORTED", `Hashtags are not supported for ${registryFormat.label}`);
    } else {
      const count = config.constraints.hashtags.count;
      if (count !== undefined) {
        if (capabilities.hashtags.max && count > capabilities.hashtags.max) {
          addWarning("constraints.hashtags", "HIGH_HASHTAG_COUNT", `Hashtag count ${count} exceeds recommended max ${capabilities.hashtags.max}`);
        }
        if (capabilities.hashtags.min && count < capabilities.hashtags.min) {
          addWarning("constraints.hashtags", "LOW_HASHTAG_COUNT", `Hashtag count ${count} is below recommended min ${capabilities.hashtags.min}`);
        }
      }
    }
  }

  if (config.constraints?.cta && !capabilities.cta) {
    addError("constraints.cta", "CTA_NOT_SUPPORTED", `Call to action is not supported for ${registryFormat.label}`);
  }

  // 5. Video Config Validation
  if (config.video) {
    if (!capabilities.video) {
      addError("video", "VIDEO_NOT_SUPPORTED", `Video configuration provided but ${registryFormat.label} does not support video`);
    } else {
       // Future: Validate video config against registry constraints
       if (registryFormat.validationProfile?.maxVideoDuration && config.video.duration) {
         if (config.video.duration > registryFormat.validationProfile.maxVideoDuration) {
           addError("video.duration", "DURATION_EXCEEDED", `Video duration exceeds max allowed for this format`);
         }
       }
    }
  }

  return result;
}
