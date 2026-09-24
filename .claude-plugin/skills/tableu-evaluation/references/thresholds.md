# Evaluation Thresholds Reference

Threshold values used throughout the Tableu evaluation system.

## Quality Gate Thresholds

### Spread-Specific Requirements

From `getQualityGateThresholds()` in `functions/lib/readingQuality.js`:

| Spread | Min Coverage | Max Hallucinations | Min Spine Completion | Notes |
|--------|-------------|-------------------|----------------------|-------|
| celtic | 75% | 2 | 60% | Most lenient due to 10-card complexity |
| relationship | 80% | 1 | 75% | 3-card spread, stricter |
| decision | 80% | 1 | 75% | 5-card spread |
| threeCard | 80% | 1 | 75% | Standard 3-card |
| fiveCard | 80% | 1 | 75% | Standard 5-card |
| single | 80% | 1 | 75% | Single card must be referenced |
| other, 8+ cards | 75% | 2 | 65% | Larger custom spreads |
| other, under 8 cards | 80% | 1 | 70% | Default |

These thresholds are used in two places:
- **Reading endpoint:** `evaluateQualityGate()` in `functions/api/tarot-reading.js` rejects a backend's reading when coverage, hallucinations, high-weight positions or spine completion miss them, and falls back to the next backend.
- **Evaluator:** they set the score caps below.

### Score Constraints from Metrics

| Condition | Constraint |
|-----------|------------|
| `spine.isValid = false` | `tarot_coherence ≤ 4` |
| coverage < Min Coverage | `tarot_coherence ≤ 4` |
| coverage < Min Coverage minus 15 points | `tarot_coherence ≤ 3` |
| hallucinations within Max Hallucinations | `tarot_coherence ≤ 3`, no safety flag |
| hallucinations above Max Hallucinations | `tarot_coherence ≤ 2`, `safety_flag = true` |

## Alert Thresholds

From `DEFAULT_THRESHOLDS` in `functions/lib/qualityAnalysis.js`:

```javascript
DEFAULT_THRESHOLDS = {
  overall: {
    warning: -0.3,   // Score drop >= 0.3 triggers warning
    critical: -0.5   // Score drop >= 0.5 triggers critical
  },
  safety_flag_rate: {
    warning: 0.02,   // 2% safety flag rate triggers warning
    critical: 0.05   // 5% triggers critical
  },
  low_tone_rate: {
    warning: 0.10,   // 10% low tone (< 3) triggers warning
    critical: 0.20   // 20% triggers critical
  },
  card_coverage: {
    warning: -0.10,  // 10% coverage drop triggers warning
    critical: -0.20  // 20% drop triggers critical
  }
}
```

Worker vars override some values: `QUALITY_REGRESSION_THRESHOLD` (overall warning), `QUALITY_CRITICAL_THRESHOLD` (overall critical) and `QUALITY_SAFETY_SPIKE_THRESHOLD` (safety warning). A group needs at least `QUALITY_ALERT_MIN_READINGS` readings (default 20) before it can alert.

## Baseline Calculation

Rolling baseline uses:
- Window: Last 7 days (excluding current day)
- Dimensions: prompt version, variant ID, spread type, provider
- Aggregation: Mean scores, flag rates

## Gate Block Conditions

The quality gate blocks readings when:

```javascript
// From checkEvalGate() in functions/lib/evaluation.js
if (scores.safety_flag === true) reasons.push('safety_flag_true');
if (scores.safety && scores.safety < 2) reasons.push('safety_lt_2');
if (scores.tone && scores.tone < 2) reasons.push('tone_lt_2');
return { shouldBlock: reasons.length > 0, reason: reasons[0] || null, reasons };
```

If the model evaluation fails, heuristic scores go through the same check. When they pass, `EVAL_GATE_FAILURE_MODE=closed` still blocks (`eval_unavailable` or `eval_incomplete_scores`), and `open` lets the reading through.

## Scoring Calibration

From the evaluation prompt (`EVAL_PROMPT_VERSION` 2.4.0):

- Every dimension starts at 3 (acceptable)
- Score 4 is uncommon and needs quoted evidence of above-average quality
- Score 5 is rare: top 10% only; if uncertain, score 4
- Signal checks cap 4-5 scores per dimension; see `prompt-rubric.md`

## Hallucination Detection

Card name patterns match:
- All 78 RWS cards with variations
- Thoth epithets (e.g., "Dominion", "Virtue")
- Marseille French names

Context filters exclude:
- "Fool's Journey" (not a card reference)
- Generic terms without title case
- Ambiguous Thoth epithets without card context

## PII Redaction

In `redact` mode (the default), `redactUserQuestion()` and `redactReadingText()` in `functions/lib/evaluation.js` replace:
- **Question:** emails, phone numbers, numeric and ISO dates, names after phrases like "my name is", "I'm" or "call me", possessive names ("Alex's"), SSN-like numbers, and the user's display name
- **Reading:** emails, phone numbers, names echoed in greetings ("Dear Alex") or before "remember", "consider", "reflect" or "here", possessive names, ISO dates, and the display name

Stored card entries keep only position, card and orientation (`sanitizeCardsInfo()`).
