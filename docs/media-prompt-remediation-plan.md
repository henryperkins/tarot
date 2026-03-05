# Media Prompt Remediation Plan

## Scope

This plan remediates all findings from the media prompt review:

1. Prompt injection risk via unsanitized `card.name` / `card.position` / `position`.
2. Oversized image/video prompts with no outbound budget guard.
3. Weak API payload validation for prompt-critical fields.
4. Missing adversarial test coverage for media prompt paths.

## Goals

- Ensure no untrusted card metadata is interpolated into model prompts without sanitization.
- Enforce prompt size budgets before calling Azure/OpenAI media APIs.
- Reject malformed or oversized payloads early with explicit errors.
- Add regression tests that prove these protections hold.

## Implementation Plan

### Phase 0: Baseline and Safety Checks

1. Create a dedicated branch for this remediation.
2. Capture current behavior with targeted baseline tests:
   - `tests/promptBuilders.test.mjs`
   - `tests/mediaGeneration.test.mjs`
3. Add one temporary local script (or test fixture) that reproduces current injection behavior for `card.name` and `position` to verify the fix later.
4. Document current average prompt lengths in dev logs for:
   - Single-card image prompt
   - Triptych image prompt
   - Card video prompt
   - Keyframe prompt

### Phase 1: Centralize Media Input Sanitization (Fixes Finding 1)

1. Introduce a shared media sanitization helper module:
   - Suggested file: `functions/lib/mediaPromptSanitization.js`
2. Add explicit sanitizers for:
   - Card name (`max 80 chars`, markdown stripped, control chars stripped, instruction filtering on)
   - Position (`max 80 chars`, same filtering)
   - Meaning (`max 180 chars`, same filtering)
   - Question (`max 280 chars`, same filtering; keep existing default fallback behavior)
3. Reuse `sanitizeText` for normalization and add any missing wrapper behavior in one place.
4. Update `functions/lib/mediaPromptAlignment.js`:
   - Sanitize `position` in `normalizePosition` (currently only trimmed).
   - Keep using sanitized card name/meaning and safe question.
   - Return sanitized card fields as canonical data for downstream prompt builders.
5. Update prompt builders to consume sanitized values only:
   - `functions/lib/storyArtPrompts.js`
   - `functions/lib/videoPrompts.js`
   - Replace direct interpolation of raw `card.name`, `card.position`, and `position` with normalized fields from the reference object.
6. Add a strict rule in code comments: prompt builders must never interpolate unsanitized request payload fields directly.

### Phase 2: Add Prompt Budgeting and Slimming (Fixes Finding 2)

1. Define per-endpoint prompt char budgets (configurable via env with safe defaults):
   - Story art prompt budget
   - Card video prompt budget
   - Keyframe prompt budget
2. Add a helper to enforce prompt budgets:
   - Suggested file: `functions/lib/mediaPromptBudget.js`
3. Implement deterministic slimming order when over budget:
   1. Shorten narrative reflections block.
   2. Shorten alignment reference block (keep safety and non-deterministic-fate constraints).
   3. Shorten optional style/detail descriptors.
   4. Preserve required hard constraints (`No text`, `No modern objects`, etc.).
4. Add telemetry metadata for budget behavior:
   - Original length
   - Final length
   - Whether slimming occurred
   - Which sections were trimmed
5. Integrate budget enforcement before provider calls in:
   - `functions/api/generate-story-art.js`
   - `functions/api/generate-card-video.js`
6. Define explicit failure behavior if prompt cannot be slimmed under hard cap:
   - Return `400` with stable error code and actionable message.

### Phase 3: Harden API Payload Validation (Fixes Finding 3)

1. Strengthen `validatePayload` in `functions/api/generate-story-art.js`:
   - Validate each card object shape.
   - Require bounded string lengths for `name`, `position`, `meaning` when present.
   - Enforce max card count by format.
   - Reject empty/whitespace-only critical fields.
2. Strengthen `validatePayload` in `functions/api/generate-card-video.js`:
   - Validate card shape and field lengths.
   - Validate `position` length and character content.
   - Keep existing style/seconds validation.
3. Apply sanitization at ingress as well (not just in builders) so downstream code always receives normalized payload data.
4. Keep error responses consistent:
   - Stable error code per validation class.
   - Human-readable message.
   - No leaking internal implementation details.

### Phase 4: Expand Test Coverage (Fixes Finding 4)

1. Add targeted unit tests for media sanitization helper:
   - Filters instruction overrides from card fields.
   - Strips markdown/control chars.
   - Enforces max lengths and fallback defaults.
2. Extend `tests/promptBuilders.test.mjs`:
   - Add adversarial `card.name` and `position` fixtures.
   - Assert dangerous phrases are not present in generated prompts.
   - Assert required constraints remain present after sanitization and slimming.
3. Extend `tests/mediaGeneration.test.mjs`:
   - Validate API rejects malformed/oversized payloads.
   - Validate long inputs trigger slimming or explicit errors as designed.
   - Validate provider is not called on validation failure.
4. Add regression tests for prompt size controls:
   - Simulate maximal card/question/narrative payloads.
   - Assert final prompt length <= configured budgets.

### Phase 5: Observability and Diagnostics

1. Add structured telemetry fields for media prompt safety:
   - `sanitizationApplied` (boolean)
   - `sanitizedFields` (list)
   - `promptSlimmed` (boolean)
   - `slimmingSteps` (list)
2. Ensure prompt content logging remains redacted and only enabled in non-production modes.
3. Add one dashboard/query to monitor:
   - Validation rejection rate
   - Prompt slimming rate
   - Upstream provider 4xx due to prompt/input format

### Phase 6: Rollout and Risk Control

1. Ship behind feature flags:
   - `MEDIA_PROMPT_SANITIZATION_V2`
   - `MEDIA_PROMPT_BUDGET_GUARDS`
2. Enable in dev/staging first; run:
   - `npm test`
   - `node --test tests/promptBuilders.test.mjs`
   - `node --test tests/mediaGeneration.test.mjs`
3. Canary in production at low percentage or internal cohort.
4. Monitor metrics for 24-48h:
   - Error rate
   - Prompt rejection rate
   - Media generation completion rate
   - Latency changes
5. Full rollout when canary metrics are stable.

## File-Level Change Map

- `functions/lib/mediaPromptAlignment.js`
  - Sanitize position and ensure only normalized card fields are returned.
- `functions/lib/storyArtPrompts.js`
  - Stop raw interpolation from request objects; use sanitized fields.
- `functions/lib/videoPrompts.js`
  - Stop raw interpolation from request objects; use sanitized fields.
- `functions/api/generate-story-art.js`
  - Harden payload validation; apply ingress normalization; integrate prompt budget guard.
- `functions/api/generate-card-video.js`
  - Harden payload validation; apply ingress normalization; integrate prompt budget guard.
- `functions/lib/mediaPromptSanitization.js` (new)
  - Centralized sanitizer functions for media prompt inputs.
- `functions/lib/mediaPromptBudget.js` (new)
  - Prompt length enforcement and deterministic slimming.
- `tests/promptBuilders.test.mjs`
  - Add adversarial sanitization and budget tests.
- `tests/mediaGeneration.test.mjs`
  - Add API validation and prompt budget enforcement tests.

## Definition of Done

1. No raw `card`/`position` fields from request payload are directly interpolated into image/video prompts.
2. All media prompts are guaranteed to meet configured max length before provider calls.
3. Invalid payloads are rejected before provider calls with deterministic error responses.
4. New adversarial tests pass and prevent regression.
5. Telemetry confirms sanitization and slimming behavior in non-prod and canary environments.

## Rollback Plan

1. Disable `MEDIA_PROMPT_SANITIZATION_V2` and/or `MEDIA_PROMPT_BUDGET_GUARDS` if conversion or reliability degrades.
2. Revert to previous prompt assembly path while keeping tests and diagnostics for postmortem.
3. Investigate rejected payload samples and adjust thresholds/section priorities, then redeploy behind flags.
