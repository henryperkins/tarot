---
description: Review safety-flagged or low-scoring readings
argument-hint: [filter: safety|low-score|blocked|all]
allowed-tools: Bash, Read, AskUserQuestion
---

Interactive review of flagged or low-scoring tarot readings.

## Filter Selection

If no filter argument provided ($ARGUMENTS is empty), ask the user what to review:
- **safety**: Readings with safety_flag = true
- **low-score**: Readings with overall_score < 3
- **blocked**: Readings blocked by the quality gate
- **all**: All flagged readings (combines above)

If argument provided, use: $ARGUMENTS

## Environment Detection

```bash
lsof -i :8787 >/dev/null 2>&1 && echo "ENV=local" || echo "ENV=production"
```

Use appropriate D1 flag based on environment.

## Fetch Flagged Readings

### Safety Flags Query
```sql
SELECT
  request_id,
  spread_key,
  overall_score,
  card_coverage,
  json_extract(payload, '$.narrativeMetrics.hallucinatedCards') as hallucinations,
  json_extract(payload, '$.evalResult.safety') as safety_score,
  json_extract(payload, '$.evalResult.notes') as notes,
  json_extract(payload, '$.redactedReading') as reading_preview,
  created_at
FROM eval_metrics
WHERE safety_flag = 1
ORDER BY created_at DESC
LIMIT 20
```

### Low Score Query
```sql
SELECT
  request_id,
  spread_key,
  overall_score,
  card_coverage,
  eval_mode,
  json_extract(payload, '$.evalResult.weaknesses_found') as weaknesses,
  json_extract(payload, '$.evalResult.notes') as notes,
  created_at
FROM eval_metrics
WHERE overall_score < 3
ORDER BY created_at DESC
LIMIT 20
```

### Blocked Query
```sql
SELECT
  request_id,
  spread_key,
  block_reason,
  card_coverage,
  json_extract(payload, '$.evalResult') as eval_result,
  created_at
FROM eval_metrics
WHERE blocked = 1
ORDER BY created_at DESC
LIMIT 20
```

## Review Workflow

For each flagged reading, present:

```
╔══════════════════════════════════════════════════════════════════╗
║ FLAGGED READING REVIEW                                           ║
╠══════════════════════════════════════════════════════════════════╣
║ Request ID:   {request_id}                                       ║
║ Created:      {timestamp}                                        ║
║ Spread:       {spread_key}                                       ║
║ Flag Reason:  {reason}                                           ║
╠══════════════════════════════════════════════════════════════════╣
║ SCORES                                                           ║
║ ────────────────────────────────────────────────────────────────║
║ Overall: {score}/5  Safety: {safety}/5  Tone: {tone}/5           ║
║ Personalization: {pers}/5  Tarot Coherence: {tarot}/5            ║
║ Card Coverage: {coverage}%                                       ║
╠══════════════════════════════════════════════════════════════════╣
║ ISSUES IDENTIFIED                                                ║
║ ────────────────────────────────────────────────────────────────║
║ • {weakness_1}                                                   ║
║ • {weakness_2}                                                   ║
╠══════════════════════════════════════════════════════════════════╣
║ EVALUATOR NOTES                                                  ║
║ ────────────────────────────────────────────────────────────────║
║ {notes}                                                          ║
╠══════════════════════════════════════════════════════════════════╣
║ READING PREVIEW (first 500 chars)                                ║
║ ────────────────────────────────────────────────────────────────║
║ {reading_preview}...                                             ║
╚══════════════════════════════════════════════════════════════════╝
```

## Analysis

After reviewing flagged readings, provide analysis:

### Pattern Detection
- Group flags by reason (hallucination, safety content, low scores)
- Identify common spread types with issues
- Check if flags cluster around specific time periods

### Root Cause Analysis
- If hallucinations: Check card detection patterns in `functions/lib/readingQuality.js`
- If safety content: Review reading prompt in `functions/lib/narrative/prompts.js`
- If low scores: Compare against calibration rubric

### Recommendations
Based on patterns found:
1. Specific code changes to investigate
2. Prompt adjustments to consider
3. Threshold tuning suggestions

## Actions

Offer the user next steps:
- "View full payload for a specific reading?"
- "Export flagged readings for manual review?"
- "Run calibration analysis on these readings?"
- "Investigate specific pattern (hallucinations, tone, etc.)?"
