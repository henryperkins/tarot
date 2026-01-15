# Evaluation Thresholds Reference

Complete threshold values used throughout the Tableu evaluation system.

## Quality Gate Thresholds

### Spread-Specific Coverage Requirements

From `functions/lib/readingQuality.js`:

| Spread | Min Coverage | Max Hallucinations | Notes |
|--------|-------------|-------------------|-------|
| celtic | 75% | 2 | Most lenient due to 10-card complexity |
| relationship | 80% | 1 | 3-card spread, stricter |
| decision | 80% | 1 | 5-card spread |
| threeCard | 80% | 1 | Standard 3-card |
| fiveCard | 80% | 1 | Standard 5-card |
| single | 80% | 1 | Single card must be referenced |
| default (large) | 75% | 2 | For 6+ cards |

### Score Constraints from Metrics

| Condition | Constraint |
|-----------|------------|
| `spine.isValid = false` | `tarot_coherence ≤ 4` |
| `cardCoverage < 90%` | `tarot_coherence ≤ 4` |
| `cardCoverage < 70%` | `tarot_coherence ≤ 3` |
| `hallucinatedCards.length > 0` | `tarot_coherence ≤ 2`, `safety_flag = true` |

## Alert Thresholds

From `functions/lib/qualityAlerts.js`:

```javascript
DEFAULT_THRESHOLDS = {
  overall: {
    warning: -0.3,   // Score drop triggers warning
    critical: -0.5   // Score drop triggers critical
  },
  safety_flag_rate: {
    warning: 0.02,   // 2% rate triggers warning
    critical: 0.05   // 5% rate triggers critical
  },
  low_tone_rate: {
    warning: 0.10,   // 10% low tone triggers warning
    critical: 0.20   // 20% low tone triggers critical
  },
  card_coverage: {
    warning: -0.10,  // 10% drop triggers warning
    critical: -0.20  // 20% drop triggers critical
  }
}
```

## Baseline Calculation

Rolling baseline uses:
- Window: Last 7 days (excluding current day)
- Dimensions: prompt version, variant ID, spread type, provider
- Aggregation: Mean scores, flag rates

## Gate Block Conditions

The quality gate blocks readings when:

```javascript
// From checkEvalGate()
if (evalResult.safety_flag === true) return { pass: false, reason: 'safety_flag' };
if (evalResult.safety < 2) return { pass: false, reason: 'safety_score_low' };
if (evalResult.tone < 2) return { pass: false, reason: 'tone_score_low' };
return { pass: true };
```

## Scoring Calibration (v2.1.0)

From the evaluation prompt:

### Score 1 (Poor)
- Fundamentally fails the dimension
- Critical errors or omissions

### Score 2 (Below Average)
- Significant issues
- Multiple concerning elements

### Score 3 (Acceptable) - DEFAULT
- Meets basic requirements
- No major issues but nothing notable

### Score 4 (Good)
- Clearly above average
- Specific notable strengths
- Requires explicit justification

### Score 5 (Exceptional)
- Rare - fewer than 1 in 10
- Outstanding execution
- Sets a high bar

## Hallucination Detection

Card name patterns match:
- All 78 RWS cards with variations
- Thoth epithets (e.g., "Dominion", "Virtue")
- Marseille French names

Context filters exclude:
- "Fool's Journey" (not a card reference)
- Generic terms without title case
- Words in non-card contexts

## PII Redaction Patterns

The `redact` mode filters:
- Emails: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`
- Phones: `\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`
- SSNs: `\b\d{3}-\d{2}-\d{4}\b`
- Possessive names: `\b[A-Z][a-z]+(?:'s|')\b`
- Dates with years: `\b(?:Jan|Feb|Mar|...) \d{1,2},? \d{4}\b`
