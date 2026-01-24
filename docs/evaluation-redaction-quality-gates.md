# Evaluation, Redaction, Quality, and Gating Review

This document captures findings and key behaviors for evaluation, redaction,
quality checks, and gating mechanisms in the Tarot codebase. It complements
`docs/evaluation-system.md` with cross-cutting review notes.

## Scope
- Evaluation (model + heuristic), async storage, and sync gating.
- Narrative quality gates (coverage, hallucinations, spine, high-weight positions).
- Safety gates (crisis detection, streaming safety scan, follow-up safety checks).
- Redaction/sanitization and data minimization across prompts, metrics, and memory.

## Evaluation System (Runtime + Storage)
- Core evaluation module: `functions/lib/evaluation.js`.
- Async evaluation:
  - `scheduleEvaluation()` runs after responses via `waitUntil()` to avoid blocking.
  - Uses Workers AI (`EVAL_MODEL`, default Qwen) with JSON output enforcement where supported.
  - Stores results in D1 `eval_metrics` with `eval_mode` (model/heuristic/error).
- Sync evaluation gate:
  - `runSyncEvaluationGate()` runs before responding when `EVAL_GATE_ENABLED=true`.
  - Failure mode defaults to `open` in non-prod and `closed` in prod; set via `EVAL_GATE_FAILURE_MODE`.
  - On block, a safe fallback reading is returned (`generateSafeFallbackReading()`).
- Heuristic fallback:
  - `buildHeuristicScores()` derives safety/tone flags from content patterns and structural metrics.
  - Used when model eval fails or returns incomplete scores.

## Narrative Quality Gate
- Implemented in `functions/api/tarot-reading.js` via `evaluateQualityGate()`.
- Inputs: `buildNarrativeMetrics()` from `functions/lib/readingQuality.js`:
  - Card coverage, missing cards, hallucinations.
  - Narrative spine completeness (`functions/lib/narrativeSpine.js`).
- Thresholds: `getQualityGateThresholds()` in `functions/lib/readingQuality.js`.
  - Spread-aware minimum coverage and hallucination allowances.
  - Checks for missing high-weight positions (position weighting logic in `tarot-reading.js`).
  - Enforces a minimum narrative spine completion ratio (50% of card sections).
- Applied:
  - Streaming path: buffered stream is gated before SSE is emitted.
  - Non-streaming path: each backend attempt must pass the quality gate before acceptance.

## Safety and Gating Mechanisms
- Crisis gate (early):
  - `detectCrisisSignals()` in `functions/lib/safetyChecks.js`.
  - If matched, returns a safety response and logs minimal metrics (`provider: safety-gate`).
- Eval gate:
  - `checkEvalGate()` blocks on `safety_flag`, safety score < 2, or tone score < 2.
- Streaming safety scan (when eval gate is disabled):
  - Uses heuristic scores on buffered output before streaming.
  - Controlled by `STREAMING_SAFETY_SCAN_ENABLED` (default true).
- Streaming quality buffer:
  - Controlled by `STREAMING_QUALITY_GATE_ENABLED` (default true).
  - Can run with or without eval gate.
- Follow-up safety check:
  - `checkFollowUpSafety()` in `functions/lib/evaluation.js` scans follow-up text.
  - Returns a safe fallback (`generateSafeFollowUpFallback()`).

## Redaction, Sanitization, and Data Minimization
- Prompt persistence:
  - `buildPromptEngineeringPayload()` in `functions/lib/promptEngineering.js`.
  - Layered protection: strip user content, then PII pattern redaction.
  - Controlled by `PERSIST_PROMPTS`; `SKIP_PII_REDACTION` bypasses redaction.
- Prompt logging:
  - `functions/lib/readingTelemetry.js` redacts prompts before logging.
  - Disabled in production (`shouldLogLLMPrompts()`).
  - Response previews in narrative backends are redacted (`functions/lib/narrativeBackends.js`).
- Evaluation metrics storage:
  - `sanitizeMetricsPayload()` + `buildStoragePayload()` in `functions/lib/evaluation.js`.
  - Modes: `full`, `redact` (default), `minimal`.
  - Redacts user question/reading text; strips user-added card notes; removes location coordinates.
- Input sanitization:
  - `sanitizeText()` in `functions/lib/utils.js` strips markdown/control chars and filters instruction patterns.
  - `sanitizePromptValue()` in `functions/lib/narrative/helpers.js` removes template syntax and injection tokens.
  - `sanitizeDisplayName()` in `functions/lib/narrative/styleHelpers.js` strips markdown/control chars.
- Memory storage:
  - `functions/lib/userMemory.js` rejects PII and instruction-like content.
- Vision proof:
  - `functions/api/vision-proof.js` clamps and sanitizes vision evidence fields.
  - `functions/lib/visionLabels.js` normalizes labels and strips unsafe characters.
- Client identifiers:
  - IPs are hashed before storage (`functions/lib/clientId.js`).

## Findings (Issues and Risks)
### High
- Eval payload can reintroduce PII even in redacted storage:
  - `eval.notes`, `weaknesses_found`, and `rawResponseSnippet` may contain quoted user text
    from the evaluator output. These are stored verbatim in `buildStoragePayload()`.
  - Files: `functions/lib/evaluation.js`, `tests/evaluation.test.mjs`.

### Medium
- Heuristic fallback inflates coherence scoring:
  - `buildHeuristicScores()` assigns `tarot_coherence=5` when coverage >= 0.9, even without model eval.
  - This can skew calibration and A/B analysis unless `eval_mode` is filtered.
  - Files: `functions/lib/evaluation.js`.

### Low
- Boolean env parsing is whitespace-sensitive:
  - `normalizeBooleanFlag()` in `functions/lib/evaluation.js` treats `"true "` as false.
  - Risk: eval/gate flags silently disabled if config has trailing spaces.
  - Files: `functions/lib/evaluation.js`.
- Redaction tests miss eval text fields:
  - Tests cover redaction of user question/reading, but not evaluator notes or raw snippets.
  - Files: `tests/evaluation.test.mjs`.

## Test Coverage (Relevant)
- Evaluation + gate logic: `tests/evaluation.test.mjs`, `functions/__tests__/evaluationHeuristics.test.mjs`.
- Prompt redaction: `tests/promptEngineering.test.mjs`.
- Quality gate storage redaction: `tests/readingQuality.test.mjs`.
- Prompt safety and sanitization: `tests/narrativePromptSafety.test.mjs`, `tests/securityGates.test.mjs`.

## Recommendations
- Redact or drop evaluator free-text fields (`notes`, `weaknesses_found`, `rawResponseSnippet`)
  in `redact` and `minimal` storage modes.
- Cap heuristic `tarot_coherence` to <= 3 (or null) when AI eval is unavailable to avoid inflated metrics.
- Trim whitespace before boolean env comparisons in `functions/lib/evaluation.js`.
- Add regression tests asserting eval payload redaction for textual fields.

## Related Docs
- `docs/evaluation-system.md` (system architecture and operational flow)
- `docs/automated-prompt-eval.md` (archived plan)
