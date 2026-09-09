import type { TopologyDefinition } from "@/lib/content/personas/topologyDefinitions.ts";

export const MARKETING_TOPOLOGIES: Record<string, TopologyDefinition> = {
  benefit_led: {
    nodes: ["product_core", "benefit", "desire", "proof", "action"],
    edges: [
      { from: "product_core", to: "benefit", rel: "delivers" },
      { from: "benefit", to: "desire", rel: "evokes" },
      { from: "desire", to: "proof", rel: "validated_by" },
      { from: "proof", to: "action", rel: "enables" },
    ],
  },
  pas: {
    nodes: ["problem", "agitation", "solution", "proof", "action"],
    edges: [
      { from: "problem", to: "agitation", rel: "intensifies" },
      { from: "agitation", to: "solution", rel: "resolved_by" },
      { from: "solution", to: "proof", rel: "validated_by" },
      { from: "proof", to: "action", rel: "enables" },
    ],
  },
  feature_benefit: {
    nodes: ["feature", "benefit", "use_case", "proof", "action"],
    edges: [
      { from: "feature", to: "benefit", rel: "delivers" },
      { from: "benefit", to: "use_case", rel: "applied_in" },
      { from: "use_case", to: "proof", rel: "validated_by" },
      { from: "proof", to: "action", rel: "enables" },
    ],
  },
};
