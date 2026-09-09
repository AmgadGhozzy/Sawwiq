import type { CopyFramework } from "@/types/content.ts";

export function resolveFramework(objective: string): CopyFramework {
  switch (objective) {
    case "sales":
      return "benefit_led";
    case "leads":
      return "pas";
    case "app_installs":
      return "feature_benefit";
    case "traffic":
    case "awareness":
      return "benefit_led";
    case "messages":
      return "pas";
    case "education":
      return "feature_benefit";
    case "community":
    case "engagement":
    case "retention":
    default:
      return "benefit_led";
  }
}
