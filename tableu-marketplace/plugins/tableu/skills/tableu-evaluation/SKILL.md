---
name: Tableu Evaluation System
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
- `functions/lib/evaluation.js` - AI-powered scoring engine
- `functions/lib/readingQuality.js` - Narrative metrics computation
- `functions/lib/qualityAlerts.js` - Alert dispatch system
- `functions/lib/qualityAnalysis.js` - Regression detection

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

### Calibration Guidelines (v2.1.0)

- Default score is 3 (acceptable), not 4
- Score 4 requires clear evidence of above-average quality
- Score 5 is rare - fewer than 1 in 10 readings deserve it
- Structural metrics constrain scores (see Narrative Metrics)

## Narrative Metrics

Computed before AI evaluation via `buildNarrativeMetrics()`:

### Card Coverage

Percentage of drawn cards mentioned in the reading:
- Coverage ≥ 90%: No constraint
- Coverage 70-89%: `tarot_coherence` capped at 4
- Coverage < 70%: `tarot_coherence` capped at 3

### Hallucination Detection

Cards mentioned but not in the spread:
- 0 hallucinations: No constraint
- 1+ hallucinations: `tarot_coherence` ≤ 2, `safety_flag = true`

Detection uses sophisticated matching:
- Pre-compiled patterns for all 78 cards across deck styles
- Context-aware filtering (e.g., "Fool's Journey" ≠ The Fool reference)
- Title case required for ambiguous names (Justice, Strength, Death)

### Narrative Spine

Validates structural completeness of the reading:
- Checks required sections are present
- `spine.isValid` indicates structural integrity
- Incomplete spine caps `tarot_coherence` at 4

## Quality Gate

Optional synchronous gate that can block readings before sending to user.

**Enable via:** `EVAL_GATE_ENABLED=true`

**Block conditions:**
- `safety_flag = true` → BLOCK
- `safety_score < 2` → BLOCK
- `tone_score < 2` → BLOCK

When blocked, `generateSafeFallbackReading()` returns a reflective non-reading.

### Fallback Behavior

When AI evaluation is unavailable (timeout, error):
- Heuristic scoring uses narrative metrics
- Conservative scores default to 3
- `tarot_coherence` derived from card coverage

## Environment Configuration

Key variables in `wrangler.jsonc`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `EVAL_ENABLED` | `"false"` | Master evaluation switch |
| `EVAL_GATE_ENABLED` | `"false"` | Block readings on low scores |
| `EVAL_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI model |
| `EVAL_TIMEOUT_MS` | `"5000"` | Evaluation timeout |
| `METRICS_STORAGE_MODE` | `"redact"` | PII handling: full/redact/minimal |

## Data Storage

### eval_metrics Table (D1)

Primary storage for evaluation results:

```sql
request_id TEXT PRIMARY KEY,
spread_key, deck_style, provider TEXT,
eval_mode TEXT,  -- 'model', 'heuristic', 'error'
overall_score INTEGER,
safety_flag INTEGER,
card_coverage REAL,
blocked INTEGER,
reading_prompt_version TEXT,
payload JSON  -- Full eval + redacted reading
```

### Querying Metrics

```bash
# Local D1
wrangler d1 execute mystic-tarot-db --local --command "SELECT * FROM eval_metrics ORDER BY created_at DESC LIMIT 10"

# Production D1
wrangler d1 execute mystic-tarot-db --remote --command "SELECT * FROM eval_metrics WHERE safety_flag = 1"
```

## Quality Alerts

Automated alerts dispatch via `dispatchAlert()`:

| Alert Type | Trigger | Severity Levels |
|------------|---------|-----------------|
| `regression` | Score drop from baseline | warning (-0.3), critical (-0.5) |
| `safety_spike` | Safety flag rate increase | warning (2%), critical (5%) |
| `tone_spike` | Low tone rate increase | warning (10%), critical (20%) |
| `coverage_drop` | Card coverage decline | warning (-10%), critical (-20%) |

Alerts persist to `quality_alerts` table and optionally email via Resend.

## Common Troubleshooting

### Low tarot_coherence Scores

1. Check card coverage: `SELECT card_coverage FROM eval_metrics WHERE request_id = '...'`
2. Check for hallucinations: Look for `hallucinatedCards` in payload
3. Check spine validity: Look for `spine.isValid` in narrative metrics
4. Compare against thresholds in `references/thresholds.md`

### Safety Flags

1. Review the redacted reading in payload
2. Check for: medical advice, financial predictions, death/doom language
3. Verify no hallucinated cards (auto-triggers safety_flag)

### Heuristic Mode Activations

If `eval_mode = 'heuristic'`:
1. Check if Workers AI timed out
2. Review `EVAL_TIMEOUT_MS` setting
3. Check Workers AI dashboard for errors

## Evaluation Scripts

Located in `scripts/evaluation/`:

| Script | Purpose | Usage |
|--------|---------|-------|
| `exportEvalData.js` | Export eval records | `node scripts/evaluation/exportEvalData.js --days=7` |
| `calibrateEval.js` | Analyze distributions | `cat data.jsonl \| node scripts/evaluation/calibrateEval.js` |
| `computeNarrativeMetrics.js` | Compute metrics for samples | `node scripts/evaluation/computeNarrativeMetrics.js` |
| `verifyNarrativeGate.js` | Test gate logic | `node scripts/evaluation/verifyNarrativeGate.js` |

## Additional Resources

### Reference Files

For detailed information, consult:
- **`references/thresholds.md`** - Complete threshold values and spread-specific adjustments
- **`references/troubleshooting.md`** - Detailed debugging procedures
- **`references/prompt-rubric.md`** - Full AI evaluation prompt and rubric

### Scripts

Utility scripts in `scripts/`:
- **`scripts/check-environment.sh`** - Detect local vs production environment
