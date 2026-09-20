# Pipeline B Contract v1

This document acts as the frozen contract for Pipeline B in the Sawwiq system. It defines the strict shape of requests, validation rules, Internal Representations (IR), and responses handled by the Edge Functions.

## 1. Request Contract

The client must send a request matching the `PlannerRequestSchema` to `/api/generate` which routes it to the `planner` Edge Function.

**Endpoint**: `supabase/functions/planner`

### Input Payload:
- `purpose` (string): `"thought"` or `"marketing"`. (Defaults to `"thought"`).
- `topic` (string): Min 10, Max 500 characters.
- `platform` (enum): Must be one of `PLATFORMS_V2` (e.g., `"linkedin"`, `"twitter"`).
- `objective` (enum): E.g., `"awareness"`, `"engagement"`, `"sales"`.
- `language` (enum): `"ar"`, `"en"`, `"bilingual"`.
- `copyFramework` (string, optional): E.g., `"benefit_led"`, `"pas"`. (Defaults to `"benefit_led"` for marketing).

## 2. Internal Representation (IR) Contract

The IR bridges the Planner LLM and the Renderer. The Renderer NEVER receives invalid IR.

### Marketing Topology (`benefit_led`):
The `benefit_led` topology defines the following nodes and edges:
- **Nodes**: `product_core`, `benefit`, `desire`, `proof`, `action`
- **Edges**: 
  - `product_core` -> `benefit` (`delivers`)
  - `benefit` -> `desire` (`evokes`)
  - `desire` -> `proof` (`validated_by`)
  - `proof` -> `action` (`enables`)

### Validation Rules (Contract Gate):
1. **Schema Check**: Output from the LLM must match `PlannerOutputSchema`.
2. **Version Check**: IR graph `version` must match `IR_SCHEMA_VERSION` (`1.0.0`).
3. **Topology Check**: The output nodes must precisely match the required nodes for the selected topology. No missing nodes, no forbidden nodes.
4. **Angles Validation** (Marketing only):
   - At least 1 angle is required.
   - Every angle must have `type`, `content`, and a valid `priority` (`high`, `medium`, `low`).
   - Every angle must have a `sourceNodes` array referencing valid IDs from the graph.

## 3. Error Handling and Retry Policy

The Pipeline operates on a strict classification of errors into "Hard" and "Soft" failures. The UI should NEVER see these internal error codes directly and must map them to user-friendly messages.

### Hard Failures
Immediate execution halt. Returns `500`. No retries.
- `PLANNER_PERSONA_MISMATCH`: The generated output doesn't match the persona constraints.
- `PLANNER_IR_VERSION_MISMATCH`: The structural version of the IR is incompatible.

### Soft Failures (Retryable)
The LLM produced salvageable output but failed strict invariants. Retries the Planner exactly **once** (MAX_RETRIES = 1) with an aggressive repair hint.
- `PLANNER_TOPOLOGY_VIOLATION`: Graph structure violates topology or angles are missing/invalid.
- `PLANNER_DUPLICATE_NODES` / `PLANNER_DUPLICATE_EDGES`
- `PLANNER_MISSING_NODES` / `PLANNER_FORBIDDEN_NODES`
- `PLANNER_EMPTY_NODE_CONTENT`
- `PLANNER_INVALID_CONFIDENCE`

### Retry Behavior
- **Retry Success**: If the retry passes validation, the pipeline continues to the Renderer.
- **Retry Failure**: If the retry still fails validation, the pipeline throws `IR_VALIDATION_FAILED_AFTER_RETRY` (`500`). The Renderer is never called.

## 4. Renderer Invariant

**The Renderer receives validated IR only.**
There is a hard execution gate between the validation step and the Renderer. If validation fails (or fails after retry), the Renderer is skipped entirely to prevent hallucination propagation or UI rendering errors.
