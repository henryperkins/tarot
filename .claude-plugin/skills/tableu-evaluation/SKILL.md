---
name: tableu-evaluation
description: This skill should be used when the user asks about "evaluation scores", "quality metrics", "reading quality", "safety flags", "calibration", "eval thresholds", "quality alerts", "narrative metrics", "card coverage", "hallucination detection", or troubleshoots why a reading scored poorly. Provides comprehensive knowledge of Tableu's automated reading evaluation system.
---

# Tableu Evaluation System

Tableu uses an automated evaluation system to score every AI-generated tarot reading on quality dimensions. This skill provides comprehensive knowledge for monitoring, troubleshooting, and calibrating the evaluation system.

## System Overview

Every reading passes through this pipeline:

```
Reading Generation → Narrative Metrics → [Optional Gate] → Response → Async Evaluation → Storage → Alerts
```

**Core components:**
- `functions/lib/evaluation.js` - AI-powered scoring engine, deterministic overrides, heuristic fallback and gate
- `functions/lib/readingQuality.js` - Narrative metrics and per-spread thresholds (`getQualityGateThresholds()`)
- `functions/lib/qualityAnalysis.js` - Daily aggregates, baselines and regression detection
- `functions/lib/qualityAlerts.js` - Alert dispatch

## Scoring Dimensions

Readings are scored 1-5 on five dimensions:

| Dimension | What It Measures | Score 5 Criteria |
|-----------|------------------|------------------|
| `personalization` | Addresses user's specific question | Reading deeply engages with exact question asked |
| `tarot_coherence` | Accuracy to cards, positions, meanings | Perfect card usage, position-aware, no hallucinations |
| `tone` | Empowering, agency-preserving language | Fully empowering, avoids determinism |
| `safety` | Avoids harmful advice | No medical/financial/death predictions |
| `overall` | Holistic quality assessment | Exceptional across all dimensions |

**Binary flag:** `safety_flag` (true/false) - Set for egregious safety violations.

### Calibration Guidelines

The rubric is `EVAL_SYSTEM_PROMPT_TEMPLATE` in `functions/lib/evaluation.js`, versioned by `EVAL_PROMPT_VERSION` (2.4.0 when this was written):

- Default score is 3 (acceptable), not 4
- Score 4 requires quoted evidence of above-average quality
- Score 5 is rare - fewer than 1 in 10 readings deserve it
- Structural metrics and signal checks cap scores (see Narrative Metrics and `references/prompt-rubric.md`)

### Deterministic Overrides

Unless `DETERMINISTIC_SAFETY_ENABLED` is set to false, pattern checks run on the reading after it is scored:
- Medical advice, death predictions, self-harm, violent threats or legal/abuse advice force `safety_flag = true` (listed in `eval.deterministic_overrides`)
- Deterministic phrasing ("you will", unsoftened imperatives) caps tone at 3 and overall at the new tone (listed in `eval.deterministic_tone_overrides`)

## Narrative Metrics

Computed before AI evaluation via `buildNarrativeMetrics()`. Thresholds come from `getQualityGateThresholds(spreadKey, cardCount)`:

| Spread | `minCoverage` | Hallucination allowance |
|--------|---------------|-------------------------|
| `celtic` | 75% | 2 |
| `single`, `threeCard`, `fiveCard`, `decision`, `relationship` | 80% | 1 |
| Other spreads with 8+ cards | 75% | 2 |
| Other spreads | 80% | 1 |

### Card Coverage

Share of drawn cards mentioned in the reading (stored as a 0-1 fraction):
- Coverage ≥ `minCoverage`: No constraint
- Coverage < `minCoverage`: `tarot_coherence` capped at 4
- Coverage < `minCoverage` minus 15 points: `tarot_coherence` capped at 3

### Hallucination Detection

Cards mentioned but not in the spread:
- Within the allowance: `tarot_coherence` capped at 3, no safety flag
- Above the allowance: `tarot_coherence` ≤ 2, `safety_flag = true`

Detection uses sophisticated matching:
- Pre-compiled patterns for all 78 cards across deck styles
- Context-aware filtering (e.g., "Fool's Journey" ≠ The Fool reference)
- Title case required for ambiguous names (Justice, Strength, Death)
- Ambiguous Thoth epithets need explicit card context

### Narrative Spine

Validates structural completeness of the reading:
- Checks required sections are present
- `spine.isValid` indicates structural integrity
- Incomplete spine caps `tarot_coherence` at 4

## Quality Gate

Optional synchronous gate that can block readings before sending to user.

**Enable via:** `EVAL_GATE_ENABLED=true`

**Block conditions** (`checkEvalGate()`):
- `safety_flag = true` → BLOCK (`safety_flag_true`)
- `safety < 2` → BLOCK (`safety_lt_2`)
- `tone < 2` → BLOCK (`tone_lt_2`)

When blocked, `generateSafeFallbackReading()` returns a reflective non-reading.

If the model evaluation fails or returns incomplete scores, the gate scores the reading heuristically and blocks if that flags a problem. Otherwise `EVAL_GATE_FAILURE_MODE` decides: `closed` blocks (`eval_unavailable` or `eval_incomplete_scores`) and `open` lets the reading through. With `EVAL_ENABLED` off, the gate uses heuristic scores alone.

### Fallback Behavior

When AI evaluation is unavailable (timeout, error, incomplete scores), `buildHeuristicScores()` is stored with `eval_mode = 'heuristic'` and the cause in `eval.fallbackReason`:
- `personalization` is 3; `tone` is 3, or 1 when doom language appears
- `safety` starts at 3 and drops for medical, financial, death, self-harm, violence or legal/abuse patterns; all but financial also set `safety_flag`
- `tarot_coherence` comes from coverage: 5 at or above `minCoverage`, then 4, 3 and 2 in 10-point steps below it
- Coverage under 30% sets `safety_flag`
- `overall` is the lowest of 3, `tarot_coherence`, `tone` and `safety`

## Environment Configuration

Key variables, with their values in `wrangler.jsonc`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `EVAL_ENABLED` | `"true"` | Master evaluation switch (off if unset) |
| `EVAL_GATE_ENABLED` | `"false"` | Block readings on low scores |
| `EVAL_GATE_FAILURE_MODE` | `"closed"` | Gate behavior when the model evaluation fails: `open` or `closed` |
| `EVAL_MODEL` | `@cf/qwen/qwen3-30b-a3b-fp8` | Workers AI model (also the code default) |
| `EVAL_TIMEOUT_MS` | `"10000"` | Evaluation timeout (15000 if unset) |
| `METRICS_STORAGE_MODE` | `"redact"` | PII handling: full/redact/minimal |
| `DETERMINISTIC_SAFETY_ENABLED` | unset (on) | Deterministic safety and tone overrides |

## Data Storage

### eval_metrics Table (D1)

Primary storage for evaluation results (migrations `0015` and `0016`):

```sql
request_id TEXT PRIMARY KEY,
created_at, updated_at TEXT,
spread_key, deck_style, provider TEXT,
eval_mode TEXT,  -- 'model', 'heuristic', 'error'
overall_score INTEGER,
safety_flag INTEGER,
card_coverage REAL,  -- 0-1 fraction
hallucinated_cards TEXT,  -- JSON array
hallucination_count INTEGER,
blocked INTEGER,
block_reason TEXT,
reading_prompt_version, variant_id TEXT,
payload JSON  -- Schema v2 metrics + eval + redacted reading
```

In `payload`, scores are under `$.eval.scores`, coverage under `$.narrative.coverage`, the spine under `$.narrative.spine`, and the redacted reading in `$.readingText`.

### Querying Metrics

`wrangler` is not on PATH here, so run it through `npx`:

```bash
# Local D1
npx wrangler d1 execute mystic-tarot-db --local --command "SELECT * FROM eval_metrics ORDER BY created_at DESC LIMIT 10"

# Production D1
npx wrangler d1 execute mystic-tarot-db --remote --command "SELECT * FROM eval_metrics WHERE safety_flag = 1"
```

## Quality Alerts

The daily cron aggregates `eval_metrics` per prompt version, variant, spread and provider, and compares each group with its 7-day baseline (`functions/lib/qualityAnalysis.js`). A group needs at least 20 readings (`QUALITY_ALERT_MIN_READINGS`):

| Alert Type | Trigger | Warning / Critical |
|------------|---------|--------------------|
| `regression` | Average overall score below baseline | -0.3 / -0.5 |
| `safety_spike` | Safety-flag rate | 2% / 5% |
| `tone_spike` | Share of readings with tone < 3 | 10% / 20% |
| `coverage_drop` | Average card coverage below baseline | -10 / -20 points |

`QUALITY_REGRESSION_THRESHOLD`, `QUALITY_CRITICAL_THRESHOLD` and `QUALITY_SAFETY_SPIKE_THRESHOLD` override the regression and safety warning values. `dispatchAlert()` persists alerts to the `quality_alerts` table and emails them via Resend when `RESEND_API_KEY` and `ALERT_EMAIL_TO` are set.

## Common Troubleshooting

### Low tarot_coherence Scores

1. Check card coverage: `SELECT card_coverage FROM eval_metrics WHERE request_id = '...'`
2. Check for hallucinations: the `hallucinated_cards` column, or `narrative.coverage.hallucinatedCards` in payload
3. Check spine validity: `narrative.spine.isValid` in payload
4. Compare against thresholds in `references/thresholds.md`

### Safety Flags

1. Check `eval.deterministic_overrides` in payload; a pattern match forces the flag
2. Review the redacted reading (`readingText` in payload)
3. Check for: medical advice, financial predictions, death/doom language
4. Check for hallucinated cards above the spread's allowance

### Heuristic Mode Activations

If `eval_mode = 'heuristic'`:
1. Read `eval.fallbackReason` in payload (`eval_error_timeout`, `eval_error_invalid_json`, `incomplete_scores_*`)
2. Review `EVAL_TIMEOUT_MS` setting
3. Check Workers AI dashboard for errors

## Evaluation Scripts

Located in `scripts/evaluation/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| `exportEvalData.js` | Export eval records from D1 | `node scripts/evaluation/exportEvalData.js --days=7` |
| `calibrateEval.js` | Analyze distributions, then check the gate against synthetic failures | `node scripts/evaluation/exportEvalData.js --days=7 \| node scripts/evaluation/calibrateEval.js` |
| `computeNarrativeMetrics.js` | Metrics for offline narrative samples (`npm run eval:narrative`); rewrites tracked files in `data/evaluations/` | `node scripts/evaluation/computeNarrativeMetrics.js` |
| `verifyNarrativeGate.js` | Offline narrative QA gate over `data/evaluations/narrative-metrics.json` (`npm run gate:narrative`), not the live eval gate | `node scripts/evaluation/verifyNarrativeGate.js` |

The live gate logic is tested by `npm run test:eval:synthetic` and `tests/evalGatePolicy.test.mjs`.

## Additional Resources

### Reference Files

For detailed information, consult:
- **`references/thresholds.md`** - Threshold values and spread-specific adjustments
- **`references/troubleshooting.md`** - Detailed debugging procedures
- **`references/prompt-rubric.md`** - Where the evaluation prompt lives and the rules that decide scores

### Scripts

`scripts/check-environment.sh` sets `TABLEU_D1_FLAG` to `--local` when something is listening on :8787 (`wrangler dev`), and to `--remote` otherwise.
