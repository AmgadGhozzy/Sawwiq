export const ALLOWED_FAILURE_SCENARIOS = [
  "planner_429",
  "planner_malformed_json",
  "planner_forbidden_node",
  "renderer_malformed_json",
  "renderer_length_violation",
  "db_persistence_failure",
  "persistence_duplicate",
  "timeout",
  "kill_switch",
  "planner_empty_source_nodes",
  "planner_wrong_version",
  "planner_retry_success",
  "planner_retry_fail",
  "renderer_throws",
  "renderer_length_violation_retry_success",
  "planner_topology_violation",
  "UNKNOWN_INTERNAL_ERROR"
] as const;

export type FailureScenario = typeof ALLOWED_FAILURE_SCENARIOS[number];

/**
 * Checks if a failure injection is requested and permitted.
 * 
 * @param headerValue - The value of the X-Failure-Inject header.
 * @param isFeatureEnabled - True if PIPELINE_B_FAILURE_INJECTION is 'true'.
 * @returns The requested failure scenario, or null if injection is disabled or no header is present.
 * @throws Error if the feature is enabled but the scenario is invalid.
 */
export function getFailureInjection(
  headerValue: string | null,
  isFeatureEnabled: boolean
): FailureScenario | null {
  // Production security: If the feature flag is off, silently ignore the header.
  if (!isFeatureEnabled || !headerValue) {
    return null;
  }

  const scenario = headerValue.trim() as FailureScenario;

  if (!ALLOWED_FAILURE_SCENARIOS.includes(scenario)) {
    throw new Error(`FailureInjector: Unknown scenario '${scenario}'. Allowed: ${ALLOWED_FAILURE_SCENARIOS.join(", ")}`);
  }

  return scenario;
}
