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

---

## Failure Modes & Where They're Caught (by Layer)

This section documents specific failure modes and the exact code paths that detect and handle them.

### Layer 1: Deterministic Composer (spreads/helpers/spine)

**Failure modes:**
- Missing WHAT/WHY/NEXT elements in narrative sections
- Weak or missing causal connectors between sections
- Card headers absent from sections
- Position emphasis inconsistencies

**Where caught:**

| File | Function | What It Catches |
|------|----------|-----------------|
| [`functions/lib/narrativeSpine.js:120`](../functions/lib/narrativeSpine.js:120) | `enhanceSection()` | Auto-injects missing WHAT/WHY/NEXT elements, card headers, and flow connectors |
| [`functions/lib/narrativeSpine.js:210`](../functions/lib/narrativeSpine.js:210) | `buildFlowNarrative()` | Enforces causal connectors via `SPINE_TEMPLATES.FLOW_CONNECTORS` |
| [`functions/lib/narrativeSpine.js:280`](../functions/lib/narrativeSpine.js:280) | `validateReadingNarrative()` | Returns `isValid: false` when sections are incomplete |
| [`functions/lib/positionWeights.js`](../functions/lib/positionWeights.js) | `getPositionWeight()` | Controls emphasis depth per position (high/medium/low) |
| [`functions/lib/narrative/helpers.js:75`](../functions/lib/narrative/helpers.js:75) | `buildPositionCardText()` | Ensures position-appropriate card descriptions with context lenses |

**Detection signals:**
- `spine.completeSections < spine.totalSections` indicates incomplete sections
- `validation.enhanced === true` means auto-enhancement was required
- `validation.enhancements[]` array shows which elements were injected

---

### Layer 2: Prompt Budget/Grounding

**Failure modes:**
- Missing spread structure from prompt
- Missing deck style instructions
- Vision hooks omitted
- Astro/ephemeris lenses dropped
- GraphRAG requested but dropped or truncated
- Structural truncation breaking prompt coherence

**Where caught:**

| File | Function | What It Catches |
|------|----------|-----------------|
| [`functions/lib/narrative/prompts.js:296`](../functions/lib/narrative/prompts.js:296) | `slimPromptForBudget()` | Progressive slimming: disables imagery → forecast → ephemeris → GraphRAG → deck context |
| [`functions/lib/narrative/prompts.js:220`](../functions/lib/narrative/prompts.js:220) | `getPromptBudgetForTarget()` | Calculates token budgets per model target (azure/claude) |
| [`functions/lib/narrative/prompts.js:180`](../functions/lib/narrative/prompts.js:180) | `truncateAtParagraphBoundary()` | Structural truncation with `"[...prompt truncated…]"` marker |
| [`functions/lib/narrative/prompts.js:520`](../functions/lib/narrative/prompts.js:520) | `buildPromptMeta()` | Records GraphRAG telemetry: `semanticScoringRequested/Used/Fallback`, `passagesProvided`, `truncatedPassages`, `includedInPrompt` |

**Detection signals via `promptMeta.graphRAG`:**
```javascript
{
  semanticScoringRequested: true,    // Did we ask for semantic scoring?
  semanticScoringUsed: false,        // Was it actually used?
  semanticScoringFallback: true,     // Did we fall back to keyword scoring?
  passagesProvided: 8,               // How many passages retrieved?
  passagesUsedInPrompt: 3,           // How many made it into final prompt?
  truncatedPassages: 5,              // How many were cut?
  includedInPrompt: false            // Was GraphRAG block included at all?
}
```

**Slimming steps recorded in `promptMeta.slimmingSteps[]`:**
- `"disable-low-weight-imagery"` — imagery hooks for non-essential positions removed
- `"disable-forecast"` — ephemeris forecast section dropped
- `"disable-ephemeris"` — all astro context removed
- `"disable-graphrag"` — knowledge graph passages dropped
- `"disable-deck-context"` — deck-specific instructions removed
- `"structural-truncation"` — hard truncation at paragraph boundary

---

### Layer 3: Runtime Eval + Backend Selection

**Failure modes:**
- Hallucinated cards (cards mentioned that weren't drawn)
- Low card coverage (less than 50% of cards mentioned)
- Spine gaps (no narrative sections detected)
- Weak rubric scores (safety, tone, coherence)

**Where caught:**

| File | Function | What It Catches |
|------|----------|-----------------|
| [`functions/api/tarot-reading.js:586`](../functions/api/tarot-reading.js:586) | Backend quality gate | Runs `buildNarrativeMetrics()` immediately after each backend returns |
| [`functions/api/tarot-reading.js:2049`](../functions/api/tarot-reading.js:2049) | `buildNarrativeMetrics()` | Computes spine validity, card coverage, hallucinated cards |
| [`functions/api/tarot-reading.js:2103`](../functions/api/tarot-reading.js:2103) | `detectHallucinatedCards()` | Compares mentioned card names against drawn cards |
| [`functions/lib/evaluation.js:388`](../functions/lib/evaluation.js:388) | `runEvaluation()` | Workers AI model scores personalization, coherence, tone, safety (1-5) |
| [`functions/lib/evaluation.js:636`](../functions/lib/evaluation.js:636) | `checkEvalGate()` | Blocks on `safety_flag: true` or `safety < 2` or `tone < 2` |
| [`functions/lib/evaluation.js:667`](../functions/lib/evaluation.js:667) | `runSyncEvaluationGate()` | Synchronous gate when `EVAL_GATE_ENABLED=true` |
| [`functions/lib/evaluation.js:746`](../functions/lib/evaluation.js:746) | `generateSafeFallbackReading()` | Returns generic safe reading when gate blocks |
| [`functions/lib/evaluation.js:787`](../functions/lib/evaluation.js:787) | `buildHeuristicScores()` | Fallback scoring when AI eval fails (coverage → coherence, hallucinations → safety_flag) |

**Backend selection flow:**
1. Try `azure-gpt5` → run `buildNarrativeMetrics()` → check thresholds
2. If quality gate fails, try `claude-sonnet45` → repeat
3. If quality gate fails, try `local-composer` → repeat
4. If all backends fail, return 503

**Quality gate thresholds (in `tarot-reading.js:590-617`):**
- Max hallucinated cards: `max(2, floor(cardCount / 2))`
- Min card coverage: `0.5` (50%)
- Spine must be valid if sections detected

---

### Layer 4: Prompt Privacy/Metrics

**Failure modes:**
- Raw PII persistence (email, phone, SSN, dates, names)
- Unredacted prompt storage leaking user data

**Where caught:**

| File | Function | What It Catches |
|------|----------|-----------------|
| [`functions/lib/promptEngineering.js:68`](../functions/lib/promptEngineering.js:68) | `redactPII()` | Redacts email, phone, SSN, credit card, dates, URLs, IPs, display names |
| [`functions/lib/promptEngineering.js:297`](../functions/lib/promptEngineering.js:297) | `stripUserContent()` | Strips user questions/reflections from prompts before storage |
| [`functions/lib/promptEngineering.js:271`](../functions/lib/promptEngineering.js:271) | `shouldPersistPrompts()` | Opt-in only via `PERSIST_PROMPTS=true` (defaults to FALSE) |
| [`functions/lib/promptEngineering.js:178`](../functions/lib/promptEngineering.js:178) | `buildPromptEngineeringPayload()` | Two-layer protection: strip user content first, then redact PII patterns |
| [`functions/lib/evaluation.js:32`](../functions/lib/evaluation.js:32) | `redactUserQuestion()` | Redacts PII from questions before eval storage |
| [`functions/lib/evaluation.js:70`](../functions/lib/evaluation.js:70) | `redactReadingText()` | Redacts mirrored PII from reading output |
| [`functions/lib/evaluation.js:99`](../functions/lib/evaluation.js:99) | `sanitizeCardsInfo()` | Strips user notes, keeps only position/card/orientation |
| [`functions/lib/evaluation.js:110`](../functions/lib/evaluation.js:110) | `sanitizeMetricsPayload()` | Modes: `full` (dev only), `redact` (default), `minimal` (max privacy) |
| [`scripts/viewPrompts.js`](../scripts/viewPrompts.js) | CLI tool | Displays redacted prompts from KV for offline analysis |

**PII patterns detected:**
- Email: `[EMAIL]`
- Phone (with extensions): `[PHONE]`
- SSN: `[SSN]`
- Credit cards: `[CARD]`
- Dates (ISO and slash formats): `[DATE]`
- URLs: `[URL]`
- IP addresses: `[IP]`
- Display names: `[NAME]`

**Storage mode selection (`METRICS_STORAGE_MODE`):**
- `full` — WARNING: dev only, stores raw PII
- `redact` — default: stores redacted versions
- `minimal` — max privacy: only aggregate stats, no user content

---

### Layer 5: Offline CI/Human Review

**Failure modes:**
- Regressions in spine completeness
- Card coverage degradation
- Tone/agency issues introduced by changes
- Hallucinations in local composer output

**Where caught:**

| File | Function | What It Catches |
|------|----------|-----------------|
| [`scripts/evaluation/runNarrativeSamples.js`](../scripts/evaluation/runNarrativeSamples.js) | Sample generator | Creates 5 fixed test spreads via local composer |
| [`scripts/evaluation/computeNarrativeMetrics.js`](../scripts/evaluation/computeNarrativeMetrics.js) | Metrics computer | Runs all heuristic checks, writes `narrative-metrics.json` + `narrative-review-queue.csv` |
| [`scripts/evaluation/verifyNarrativeGate.js`](../scripts/evaluation/verifyNarrativeGate.js) | CI gate | Fails if metrics below thresholds |
| [`scripts/evaluation/processNarrativeReviews.js`](../scripts/evaluation/processNarrativeReviews.js) | Review processor | Digests human verdicts from CSV into summary JSON |

**Metrics computed per sample:**
- `spine.isValid`, `spine.totalSections`, `spine.completeSections`
- `cardCoverage`, `missingCards[]`
- `hallucinatedCards[]`
- `deterministicLanguage` (fated/guaranteed phrases)
- `hasAgencyLanguage` (choice/agency phrases)
- `hasSupportiveTone` / `hasHarshTone`
- Rubric scores: `accuracy`, `coherence`, `agency`, `compassion`

**Gate thresholds (configurable via env):**
| Threshold | Default | Env Variable |
|-----------|---------|--------------|
| Min spine pass rate | 90% | `NARRATIVE_MIN_SPINE_PASS_RATE` |
| Min card coverage | 90% | `NARRATIVE_MIN_CARD_COVERAGE` |
| Max deterministic issues | 0 | `NARRATIVE_MAX_DETERMINISTIC_ISSUES` |
| Max missing agency | 0 | `NARRATIVE_MAX_MISSING_AGENCY` |
| Max hallucinations | 0 | `NARRATIVE_MAX_HALLUCINATIONS` |
| Max harsh tone | 0 | `NARRATIVE_MAX_HARSH_TONE` |
| Max missing supportive | 0 | `NARRATIVE_MAX_MISSING_SUPPORTIVE` |
| Max flagged samples | 0 | `NARRATIVE_MAX_FLAGGED_SAMPLES` |
| Min rubric accuracy | 85% | `NARRATIVE_MIN_RUBRIC_ACCURACY` |
| Min rubric coherence | 85% | `NARRATIVE_MIN_RUBRIC_COHERENCE` |
| Min rubric agency | 80% | `NARRATIVE_MIN_RUBRIC_AGENCY` |
| Min rubric compassion | 85% | `NARRATIVE_MIN_RUBRIC_COMPASSION` |

**Workflow:**
1. `npm run eval:narrative` — generates samples + computes metrics
2. `npm run gate:narrative` — verifies thresholds, fails CI if not met
3. Human review via `narrative-review-queue.csv` → `processNarrativeReviews.js`

---

## Suggested Improvements

Based on this analysis, the following enhancements could strengthen the system:

### 1. Spread-Specific Eval Heuristics
Currently eval is spread-agnostic. Add spread-aware scoring that checks:
- Celtic Cross: Nucleus-Staff relationship coherence
- Relationship: Both-parties balance
- Decision: Path-outcome logical flow

### 2. Stricter Health-Context Gates
Add explicit pattern detection for:
- Mental health crisis language
- Self-harm indicators
- Medical symptom descriptions

### 3. GraphRAG Telemetry Alerts
Add warning logs/alerts when:
- `promptMeta.graphRAG.includedInPrompt === false`
- `promptMeta.graphRAG.truncatedPassages > passagesUsedInPrompt`
- `promptMeta.graphRAG.semanticScoringFallback === true` with patterns detected

### 4. TimeoutOverflowWarning Mitigation
Clamp long timeouts in eval to avoid Node.js `TimeoutOverflowWarning`:
```javascript
const MAX_SAFE_TIMEOUT = 2147483647; // Max 32-bit signed int
const timeoutMs = Math.min(configuredTimeout, MAX_SAFE_TIMEOUT);
```

---

## Implementation Status (as of 2025-12-07)

> **All 4 suggested improvements above remain UNIMPLEMENTED.** This section documents findings from a deep codebase investigation and provides specific fix guidance.

### ❌ 1. Spread-Specific Eval Heuristics — NOT IMPLEMENTED

**Evidence:**
- [`functions/lib/evaluation.js:787-829`](../functions/lib/evaluation.js:787) — `buildHeuristicScores()` is completely spread-agnostic
- The function only checks `cardCoverage` and `hallucinatedCards` with no spread-specific logic
- [`EVAL_USER_TEMPLATE`](../functions/lib/evaluation.js:252) uses a generic rubric with no spread-aware checks

**Fix guidance:**
1. Add `spreadKey` parameter to `buildHeuristicScores(narrativeMetrics, spreadKey)`
2. Add spread-specific validation logic:
   ```javascript
   // In buildHeuristicScores()
   if (spreadKey === 'celtic') {
     // Check nucleus↔staff relationship coherence
     // Verify positions 0-1 (nucleus) relate to positions 6-9 (staff)
   } else if (spreadKey === 'relationship') {
     // Check both-parties balance (you vs them card coverage)
     // Ensure positions 0 and 1 have roughly equal treatment
   } else if (spreadKey === 'decision') {
     // Check path-outcome logical flow
     // Verify paths A and B (positions 1-2) connect to clarifier/free will
   }
   ```
3. Extend `checkEvalGate()` with spread-keyed thresholds
4. Add tests: `tests/evaluation.spread-specific.test.mjs`

---

### ❌ 2. Stricter Health-Context Gates — NOT IMPLEMENTED

**Evidence:**
- [`functions/lib/contextDetection.js:53-75`](../functions/lib/contextDetection.js:53) only has generic "self" context keywords like "mental health", "therapy"
- No crisis detection patterns exist for self-harm, suicidal ideation, or acute medical symptoms
- [`evaluation.js:247-249`](../functions/lib/evaluation.js:247) mentions "death predictions" but only in LLM prompt text — not as active code detection

**Fix guidance:**
1. Create a new function in `contextDetection.js` or a dedicated `crisisDetection.js`:
   ```javascript
   const CRISIS_PATTERNS = {
     selfHarm: [
       /\b(hurt|harm|cut|kill)\s*(my)?self\b/i,
       /\bsuicid(e|al|ing)\b/i,
       /\bwant(ing)?\s*to\s*die\b/i,
       /\bend\s*(my|it\s*all)\b/i
     ],
     acuteMedical: [
       /\bchest\s*pain\b/i,
       /\bcan'?t\s*breathe\b/i,
       /\bstroke\s*symptoms?\b/i,
       /\bseizure\b/i
     ]
   };

   export function detectCrisisPatterns(text) {
     const triggered = [];
     for (const [category, patterns] of Object.entries(CRISIS_PATTERNS)) {
       if (patterns.some(p => p.test(text))) {
         triggered.push(category);
       }
     }
     return { hasCrisis: triggered.length > 0, categories: triggered };
   }
   ```
2. Call early in `runSyncEvaluationGate()` or before backend selection in `tarot-reading.js`
3. If triggered, short-circuit to `generateSafeFallbackReading()` with reason `'crisis_detected'`
4. Add tests: `tests/crisisDetection.test.mjs`

---

### ❌ 3. GraphRAG Telemetry Alerts — NOT IMPLEMENTED

**Evidence:**
- [`functions/lib/narrative/prompts.js:545-594`](../functions/lib/narrative/prompts.js:545) captures GraphRAG telemetry in `promptMeta.graphRAG`:
  - `includedInPrompt`, `passagesUsedInPrompt`, `truncatedPassages`, `semanticScoringFallback`
- **However**, there are NO warning logs or alerts when these conditions are problematic
- Telemetry is captured for metrics storage but not actively surfaced for observability

**Fix guidance:**
Add warning logs after prompt build (around line 594 in `prompts.js`):
```javascript
// After building promptMeta.graphRAG
if (promptMeta.graphRAG) {
  const g = promptMeta.graphRAG;
  if (g.includedInPrompt === false && g.passagesProvided > 0) {
    console.warn('[GraphRAG Alert] GraphRAG block dropped from prompt despite having passages');
  }
  if (g.truncatedPassages > g.passagesUsedInPrompt) {
    console.warn(`[GraphRAG Alert] Heavy truncation: ${g.truncatedPassages} passages dropped, only ${g.passagesUsedInPrompt} used`);
  }
  if (g.semanticScoringFallback && g.passagesProvided > 0) {
    console.warn('[GraphRAG Alert] Semantic scoring unavailable, fell back to keyword ranking');
  }
}
```

Optionally increment counters for observability dashboards if metrics system supports it.

---

### ❌ 4. TimeoutOverflowWarning Mitigation — NOT IMPLEMENTED

**Evidence:**
- [`functions/lib/evaluation.js:403`](../functions/lib/evaluation.js:403): `const timeoutMs = parseInt(env.EVAL_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;`
- [`functions/lib/evaluation.js:418`](../functions/lib/evaluation.js:418): `setTimeout(() => controller.abort(), timeoutMs);`
- **No clamping** to `MAX_SAFE_TIMEOUT_MS` — very large env values can cause Node.js `TimeoutOverflowWarning`

**Fix guidance:**
```javascript
// At top of evaluation.js (around line 10)
const MAX_SAFE_TIMEOUT_MS = 2147483647; // Max 32-bit signed int

// In runEvaluation() - replace line 403
const rawTimeout = parseInt(env.EVAL_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;
const timeoutMs = Math.min(rawTimeout, MAX_SAFE_TIMEOUT_MS);
```

Add test in `tests/evaluation.test.mjs`:
```javascript
test('timeoutMs clamps to MAX_SAFE_TIMEOUT_MS', () => {
  const result = runEvaluation({ EVAL_TIMEOUT_MS: '9999999999999' }, ...);
  // Should not throw TimeoutOverflowWarning
});
```

