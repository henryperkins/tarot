# Narrative Builder, Prompt Engineering, and Evaluation Overview

## Narrative Builder

- Core entrypoint `functions/lib/narrativeBuilder.js:1` just re-exports a modular stack:
  - Spread composers like `buildCelticCrossReading`, `buildThreeCardReading`, etc. in `functions/lib/narrative/spreads/*.js`.
  - Card-level helpers and style logic in `functions/lib/narrative/helpers.js:1` and `functions/lib/narrative/styleHelpers.js:1`.
  - Structural “spine” utilities in `functions/lib/narrativeSpine.js:1`.
- `spreadAnalysis` is the canonical analytic layer (`functions/lib/spreadAnalysis.js:1`):
  - Computes elemental dignities, suit/element counts, timing, and spread-specific relationships.
  - Feeds both the LLM prompts and the local deterministic composer so both see the same structure.
- The local spread builders (e.g. `buildCelticCrossReading` in `functions/lib/narrative/spreads/celticCross.js:1`) follow a consistent pattern:
  - Build sections (Nucleus, Timeline, Consciousness, Staff, Cross-checks, Synthesis, etc.).
  - For each section, call `buildPositionCardText` with position-aware templates + context lenses and then run `enhanceSection`:
    - `enhanceSection`/`buildFlowNarrative` in `functions/lib/narrativeSpine.js:120` enforce the “What / Why / What’s next” story spine, auto-inserting card headers, causal connectors, and guidance when missing.
  - Use `positionWeights` (`functions/lib/positionWeights.js`) to decide where to go deep vs summarize, so emphasis is stable across LLM vs local paths.
- Style and personalization are centralized:
  - Tone, spiritual frame, and “depth profile” come from `getToneStyle`/`getDepthProfile` and closings from `buildPersonalizedClosing` (`functions/lib/narrative/styleHelpers.js:1`).
  - Context (“love / career / self / spiritual / general”) lensed card text is handled in `helpers.buildContextualClause` (`functions/lib/narrative/helpers.js:1`), so the same card reads differently but predictably by context.

## Prompt Engineering

- High-level prompt builder is `buildEnhancedClaudePrompt` in `functions/lib/narrative/prompts.js:1`:
  - Normalizes context, merges themes, and decides whether to include ephemeris (astro) content via `shouldIncludeAstroInsights` (`prompts.js:16`).
  - Prepares a GraphRAG payload (knowledge-graph passages) using `retrievePassages` / `getPassageCountForSpread` (`functions/lib/graphRAG.js:1`) or uses a pre-scored payload when semantic scoring is enabled.
- It then builds:
  - A rich **system prompt** with:
    - Story-spine, ethics and safety rules (agency, no deterministic fate, no medical/financial/legal advice).
    - Spread-specific flow instructions (e.g. Celtic Cross section order, relationship flow).
    - Context and deck-style instructions, including Thoth/Marseille differences and visual-profile integration from Vision.
    - Length bands keyed to spread and depth profile, with recap behavior for deep dives.
  - A detailed **user prompt** that:
    - Encodes each position via `buildPositionCardText` and imagery hooks (`helpers.js` + `imageryHooks.js`).
    - Adds attention-weight notes and summaries for low-weight cards.
    - Injects GraphRAG “TRADITIONAL WISDOM” passages and optional ephemeris sections when enabled, following the “GraphRAG for archetype, Vision for visual texture” synthesis rule (`prompts.js:740`).
- Prompt budgeting and slimming:
  - Token budget and hard caps come from `getPromptBudgetForTarget` / `getHardCapBudget` (`prompts.js:220`).
  - A small pipeline of slimming steps progressively disables low-weight imagery, forecast, ephemeris, GraphRAG, deck context, and diagnostics if over budget (`prompts.js:296`), re-building prompts after each change.
  - Final truncation is done structurally, at paragraph boundaries, with a “[...prompt truncated…]” note (`prompts.js:180`).
- GraphRAG telemetry is explicitly surfaced:
  - After slimming, `promptMeta.graphRAG` records `semanticScoringRequested/Used/Fallback`, `passagesProvided`, `passagesUsedInPrompt`, `truncatedPassages`, and `includedInPrompt` (`prompts.js:520`).
  - This is what the AGENTS note refers to: the app can warn when GraphRAG was requested but dropped or trimmed for budget.
- Prompt privacy and analysis:
  - `functions/lib/promptEngineering.js:1` handles hashing, PII redaction, and structural feature extraction.
  - `buildPromptEngineeringPayload` generates hashes + redacted system/user/response, plus structural stats; storage is strictly opt-in via `PERSIST_PROMPTS` and `shouldPersistPrompts` (`promptEngineering.js:144`).
  - `scripts/viewPrompts.js:1` pulls these from KV for offline inspection and stats without exposing raw user text.

## Automated Evaluation & Gating

- Local narrative metrics (pre- and post-LLM) are based on the same spine and coverage logic:
  - `validateReadingNarrative` and `analyzeSpineCompleteness` in `functions/lib/narrativeSpine.js:120` detect whether each section contains “what / why / what’s next”.
  - `buildNarrativeMetrics` in `functions/api/tarot-reading.js:1680` combines spine metrics, card coverage (`analyzeCardCoverage`) and hallucinated card detection (`detectHallucinatedCards`) for a given reading.
- Online evaluation via Workers AI (`functions/lib/evaluation.js:1`):
  - `runEvaluation` builds a compact evaluation prompt around the actual reading + cards + question (`buildUserPrompt` in `evaluation.js:260`).
  - The eval system prompt (`evaluation.js:120`) scores personalization, tarot coherence, tone, safety, and overall on a 1–5 scale, and sets a `safety_flag` for harmful content (medical/financial advice, death predictions, hallucinated cards, etc.).
  - `sanitizeMetricsPayload` / `buildStoragePayload` ensure eval and metrics storage redact emails, phones, dates, names and strip down cards/question to non-PII fields.
  - `scheduleEvaluation` stores evals in `METRICS_DB` asynchronously (for dashboards), while `runSyncEvaluationGate` runs a synchronous gate when `EVAL_GATE_ENABLED=true`:
    - If eval fails or scores are incomplete, it falls back to heuristic scores from narrative metrics.
    - `checkEvalGate` blocks any reading with `safety_flag` or very low safety/tone scores, returning a safe generic fallback via `generateSafeFallbackReading`.
- Backend-selection gate in `tarot-reading` (`functions/api/tarot-reading.js:640`):
  - For each narrative backend (Azure GPT-5, Claude 4.5, local composer), `runNarrativeBackend` generates a reading and immediately runs `buildNarrativeMetrics` to enforce:
    - Max hallucinated cards (scaled to spread size).
    - Minimum card coverage (≥ ~50%).
    - Story spine completeness (no “sectionless” or unstructured responses).
  - Backends that fail this structural gate are discarded; the next backend is tried. Only a reading that passes these checks is returned (or the safe fallback if the eval gate later blocks it).

## Offline Evaluation, Human Review, and Improvement Loop

- Offline narrative regression tests (no LLM, pure composer):
  - `scripts/evaluation/runNarrativeSamples.js:1` builds a fixed set of representative spreads (single, three-card, five-card, relationship, Celtic) using the local composer only.
  - `scripts/evaluation/computeNarrativeMetrics.js:1` runs structural/tone heuristics:
    - Spine validity via `validateReadingNarrative`.
    - Card coverage and missing cards.
    - Hallucinated cards across all known names (with deck-aware canonicalization).
    - Deterministic language vs agency language.
    - Supportive vs harsh tone phrases.
    - Produces per-sample rubric scores for accuracy, coherence, agency, compassion and writes `data/evaluations/narrative-metrics.json`.
  - Flagged samples are queued into `data/evaluations/narrative-review-queue.csv` with machine-generated issues and notes for human review.
  - `scripts/evaluation/processNarrativeReviews.js:1` digests human verdicts from that CSV into a summary JSON for calibration.
- Narrative CI gate:
  - `scripts/evaluation/verifyNarrativeGate.js:1` reads aggregated metrics and enforces thresholds (configurable via env):
    - Min spine pass rate, min average card coverage.
    - Max counts for deterministic language, missing agency, hallucinations, harsh tone, missing supportive tone.
    - Min rubric scores (accuracy, coherence, agency, compassion).
  - `npm run gate:narrative` fails CI if these thresholds are not met; `npm run ci:narrative-check` regenerates samples, recomputes metrics, and runs the gate. This prevents regressions when you touch the narrative builder or prompts.
- Prompt + eval–aware training/export:
  - `scripts/training/exportReadings.js:1` merges journal entries, feedback, and reading metrics (including eval payloads when present) into a JSONL dataset for further model/prompt tuning.
  - `scripts/viewPrompts.js:1` lets you inspect how prompt structures and lengths relate to eval metrics and user outcomes.
  - Together, these tools make it easy to correlate “what we told the model” (prompts), “what it produced” (readings), and “how it scored” (eval + heuristic metrics) and then iterate on prompt text, narrative helpers, or model configuration.

## How This Achieves Consistent, High-Quality Readings

- Structural consistency is enforced twice: deterministically in the local composer (spine, positions, relationships) and as a constraint in LLM prompts, then re-checked via spine validation.
- Content fidelity is guarded via card-coverage and hallucination checks at both build time (`buildNarrativeMetrics`) and offline metrics.
- Tone and safety are encoded in:
  - Prompt ethics and trauma-informed language rules.
  - Heuristic pattern checks for deterministic/harsh language.
  - A second, independent safety model (Workers AI eval) with a hard gate and safe fallback.
- Prompt-level telemetry (budgets, slimming steps, GraphRAG meta) and persistent, redacted prompt engineering data allow you to see when context was lost (e.g., GraphRAG dropped for budget) and iterate.
- CI-style gates (`gate:narrative`, eval gates in production) ensure that any changes to spreads, helpers, or prompts must maintain or improve structural, tonal, and safety metrics before they ship, giving you stable, consistent readings over time even as you evolve the system.

