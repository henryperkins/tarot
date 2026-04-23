# Spread Understanding Remediation Tracker (2026-02-25)

This is the working document for fixing narrative-builder and prompt-engineering issues that affect model understanding of the spread.

## Scope

This tracker covers all currently identified issues:

1. Context inference uses `userQuestion` only.
2. Global reflections are dropped when any per-card reflection exists.
3. Vision mismatches can still inject mood/tone cues.
4. GraphRAG behavior differs between LLM backends and local composer output.
5. Prompt-engineering redaction leaks for honorific/initial name forms.
6. Prompt slimming flags parse `true/false` but not `1/0` forms.
7. Prompt builder guard allows malformed card entries to fail deep.

## Status Legend

- `Not Started`
- `In Progress`
- `Blocked`
- `Done`

## Workstreams

## WS1: Source Contract And Precedence

**Goal:** Define and enforce source trust/precedence for spread understanding.

**Status:** `Done`

**Tasks**

- [x] Add explicit source precedence contract in code comments/docs:
  `spread/cards > validated matched vision > question/reflections/focusAreas > GraphRAG > ephemeris`.
- [x] Add guardrail note that enrichments never override drawn card identity/position.
- [x] Confirm contract is applied for both streaming and non-streaming paths.

**Primary files**

- `functions/api/tarot-reading.js`
- `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`
- `functions/lib/narrative/prompts/userPrompt.js`
- `docs/NARRATIVE_ARCHITECTURE.md` (or equivalent)

**Validation**

- [x] Unit tests pass.
- [x] Contract references present in prompt builder and API orchestrator code.

## WS2: Context Inference Inputs

**Goal:** Use all relevant user context, not just `userQuestion`, for context and GraphRAG routing.

**Status:** `Done`

**Tasks**

- [x] Build combined context text from:
  `userQuestion + reflectionsText + personalization.focusAreas`.
- [x] Pass combined text to `inferContext`.
- [x] Pass combined text to `inferGraphRAGContext`.
- [x] Cap and sanitize combined text before context inference to avoid noisy bias.

**Primary files**

- `functions/api/tarot-reading.js`
- `functions/lib/contextDetection.js`
- `functions/lib/spreadAnalysisOrchestrator.js`

**Validation**

- [x] Add tests proving context can shift based on reflections/focus areas.
- [x] Add tests proving GraphRAG context routing uses combined input.
- [x] Run targeted tests for context detection and spread analysis orchestration.

## WS3: Reflection Source Merging

**Goal:** Ensure both reflection sources are available to prompts when both exist.

**Status:** `Done`

**Tasks**

- [x] Refactor prompt assembly so per-card and global reflections are both included.
- [x] Add dedupe logic to avoid repeating identical reflection text.
- [x] Apply existing sanitization/injection filters to both reflection channels.
- [x] Keep reflection sections budget-aware under truncation.

**Primary files**

- `functions/lib/narrative/prompts/userPrompt.js`
- `functions/lib/narrative/prompts/cardBuilders.js`
- `functions/lib/narrative/prompts/truncation.js`

**Validation**

- [x] Add test for both reflection channels present together.
- [x] Add test for dedupe behavior.
- [x] Add test for safe truncation preserving required instruction section.

## WS4: Vision Mismatch Containment

**Goal:** Prevent mismatched vision uploads from biasing spread interpretation.

**Status:** `Done`

**Tasks**

- [x] Remove mismatched-entry visual profile cues from prompt content by default.
- [x] Keep mismatch diagnostics for telemetry but not generation guidance.
- [x] Add strict policy option to block on deck mismatch and/or high mismatch rate.
- [x] Ensure unverified entries do not leak off-spread card identity cues.

**Primary files**

- `functions/api/tarot-reading.js`
- `functions/lib/narrative/prompts/visionValidation.js`
- `functions/lib/readingQuality.js`

**Validation**

- [x] Add tests that mismatched vision entries emit no card-name or mood cues.
- [x] Add tests for strict mismatch policy behavior.
- [x] Run vision-related unit tests.

## WS5: GraphRAG Backend Semantics Parity

**Goal:** Keep GraphRAG semantics consistent across backends.

**Status:** `Done`

**Tasks**

- [x] Align local composer behavior with LLM backends:
  GraphRAG should be generation context, not appended user-visible postscript.
- [x] Standardize GraphRAG telemetry fields across backends.
- [x] Gate any debug-only GraphRAG output behind explicit env flag.

**Primary files**

- `functions/lib/narrativeBackends.js`
- `functions/lib/readingTelemetry.js`
- `functions/lib/telemetrySchema.js` (if needed)

**Validation**

- [x] Add tests comparing GraphRAG semantics/telemetry across backends.
- [x] Verify no backend appends raw GraphRAG passages to final output unless explicitly enabled.

## WS6: Prompt Engineering Redaction Correctness

**Goal:** Close PII redaction gaps and ensure robust name-hint handling.

**Status:** `Done`

**Tasks**

- [x] Expand name hint handling for honorific/initial forms
  (for example `Dr. Smith`, `J. Smith`).
- [x] Ensure full name phrase redaction rather than partial-token masking.
- [x] Add regression tests for possessive and punctuation variants.

**Primary files**

- `functions/lib/promptEngineering.js`
- `tests/promptEngineering.test.mjs`

**Validation**

- [x] Redaction tests cover honorific, initial, possessive, mixed case.
- [x] Confirm no raw name leaks in persisted `promptEngineering.redacted.*`.

## WS7: Prompt Flag Parsing And Guardrails

**Goal:** Improve prompt builder reliability under diverse env config and malformed input.

**Status:** `Done`

**Tasks**

- [x] Normalize boolean env parsing for slimming flags to accept
  `true/false/1/0/yes/no/on/off`.
- [x] Strengthen top-level `cardsInfo` object validation in prompt builder.
- [x] Ensure malformed card payload fails with explicit actionable error.

**Primary files**

- `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`
- `functions/lib/narrativeBuilder.js`
- `tests/narrativeBuilder.promptCompliance.test.mjs`

**Validation**

- [x] Add tests for `ENABLE_PROMPT_SLIMMING=1` and `DISABLE_PROMPT_SLIMMING=1`.
- [x] Add tests for malformed card object input error quality.

## Delivery Phases

## Phase 1 (Risk Reduction First)

- WS2, WS4, WS6, WS7.

## Phase 2 (Behavior Consistency)

- WS3, WS5.

## Phase 3 (Documentation And Lock-In)

- WS1 and final architecture updates.

## Test Matrix

- [ ] `npm test`
- [x] Targeted: `tests/promptEngineering.test.mjs`
- [x] Targeted: `tests/narrativeBuilder.promptCompliance.test.mjs`
- [x] Targeted: GraphRAG/telemetry suites (`tests/graphRAG*.test.mjs`, telemetry tests)
- [x] Targeted: vision-related tests (`tests/readingQuality.test.mjs` or equivalent)
- [ ] Targeted streaming path tests if touched (`tests/narrationStream.test.mjs`, `tests/streamingWrapper.test.mjs`)

## Rollout Checklist

- [ ] Merge Phase 1 behind safe defaults.
- [ ] Monitor logs for regression signatures:
  context fallback spikes, GraphRAG disabled/included shifts, prompt truncation errors.
- [ ] Merge Phase 2 parity changes.
- [ ] Validate production telemetry schema compatibility.
- [ ] Merge Phase 3 docs and close tracker.

## Change Log

| Date | Change | Author | Notes |
|---|---|---|---|
| 2026-02-25 | Created tracker with 7 workstreams and phased rollout plan | Codex | Initial working document |
| 2026-02-25 | Completed WS2, WS3, WS4, WS5, WS6, WS7 code + tests | Codex | Added context-input composition, reflection merge/dedupe, mismatch containment, local-composer GraphRAG parity, redaction fixes, and prompt guard hardening |
| 2026-02-25 | Completed WS1 contract docs/comments | Codex | Added explicit source precedence/guardrail notes in API + prompt builder + architecture docs |

## Open Questions

1. Should strict vision mismatch policy default to block, or remain opt-in?
2. Should local composer ever expose GraphRAG passages to end users outside debug mode?
3. Do we want context inference to weight reflections and focus areas equally, or prioritize explicit question text?
