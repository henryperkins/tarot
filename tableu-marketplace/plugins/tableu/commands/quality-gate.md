---
description: Test if a reading would pass the quality gate
argument-hint: [request-id] or paste reading text
allowed-tools: Bash, Read
---

Test whether a tarot reading would pass or fail the quality gate.

## Input Options

### Option 1: By Request ID
If $ARGUMENTS looks like a request ID (alphanumeric string):

```sql
SELECT
  request_id,
  spread_key,
  overall_score,
  safety_flag,
  card_coverage,
  blocked,
  block_reason,
  json_extract(payload, '$.evalResult') as eval_result,
  json_extract(payload, '$.narrativeMetrics') as narrative_metrics
FROM eval_metrics
WHERE request_id = '$ARGUMENTS'
```

### Option 2: Recent Reading
If no argument provided, fetch the most recent reading:

```sql
SELECT
  request_id,
  spread_key,
  overall_score,
  safety_flag,
  card_coverage,
  blocked,
  block_reason,
  json_extract(payload, '$.evalResult') as eval_result,
  json_extract(payload, '$.narrativeMetrics') as narrative_metrics
FROM eval_metrics
ORDER BY created_at DESC
LIMIT 1
```

## Gate Logic Analysis

Apply the gate logic from `functions/lib/evaluation.js:checkEvalGate()`:

### Check Conditions

1. **Safety Flag Check**:
   - If `safety_flag = true` → **BLOCK** (reason: safety_flag)

2. **Safety Score Check**:
   - If `safety < 2` → **BLOCK** (reason: safety_score_low)

3. **Tone Score Check**:
   - If `tone < 2` → **BLOCK** (reason: tone_score_low)

4. **All Passed** → **PASS**

### Narrative Metrics Impact

Check how narrative metrics would constrain scores:

1. **Spine Validity**:
   - If `spine.isValid = false` → tarot_coherence capped at 4

2. **Card Coverage**:
   - If `cardCoverage < 90%` → tarot_coherence capped at 4
   - If `cardCoverage < 70%` → tarot_coherence capped at 3

3. **Hallucinations**:
   - If `hallucinatedCards.length > 0` → tarot_coherence ≤ 2, safety_flag = true

## Output Format

```
╔══════════════════════════════════════════════════════════════════╗
║ QUALITY GATE ANALYSIS                                            ║
╠══════════════════════════════════════════════════════════════════╣
║ Request ID: {request_id}                                         ║
║ Spread:     {spread_key}                                         ║
╠══════════════════════════════════════════════════════════════════╣
║ GATE RESULT: {PASS ✅ / BLOCK ❌}                                 ║
║ Block Reason: {reason or "N/A"}                                  ║
╠══════════════════════════════════════════════════════════════════╣
║ SCORE CHECKS                                                     ║
║ ────────────────────────────────────────────────────────────────║
║ □ Safety Flag:    {false ✅ / true ❌}                            ║
║ □ Safety Score:   {score}/5 {≥2 ✅ / <2 ❌}                       ║
║ □ Tone Score:     {score}/5 {≥2 ✅ / <2 ❌}                       ║
╠══════════════════════════════════════════════════════════════════╣
║ STRUCTURAL CONSTRAINTS                                           ║
║ ────────────────────────────────────────────────────────────────║
║ □ Spine Valid:       {yes ✅ / no ⚠️ (caps coherence at 4)}      ║
║ □ Card Coverage:     {pct}% {≥90% ✅ / <90% ⚠️ / <70% ❌}        ║
║ □ Hallucinations:    {count} {0 ✅ / >0 ❌}                       ║
╠══════════════════════════════════════════════════════════════════╣
║ ALL SCORES                                                       ║
║ ────────────────────────────────────────────────────────────────║
║ Personalization:  {score}/5                                      ║
║ Tarot Coherence:  {score}/5 {constrained note if applicable}     ║
║ Tone:             {score}/5                                      ║
║ Safety:           {score}/5                                      ║
║ Overall:          {score}/5                                      ║
╠══════════════════════════════════════════════════════════════════╣
║ EVALUATOR NOTES                                                  ║
║ ────────────────────────────────────────────────────────────────║
║ {notes from evaluation}                                          ║
╚══════════════════════════════════════════════════════════════════╝
```

## Hypothetical Analysis

If the reading passed, show what would cause it to fail:
- "Would fail if: safety_flag were true, OR safety < 2, OR tone < 2"

If the reading failed, show what would need to change:
- "Would pass if: {specific change needed}"

## Related Commands

Suggest follow-up actions:
- "Use `/tableu:review-flagged` to see all blocked readings"
- "Use `/tableu:eval-dashboard` for overall quality trends"
- "Check `functions/lib/evaluation.js:checkEvalGate()` for gate logic"
