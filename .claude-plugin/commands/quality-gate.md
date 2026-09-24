---
description: Test if a reading would pass the quality gate
argument-hint: [request-id] or paste reading text
allowed-tools: Bash, Read
---

Test whether a tarot reading would pass or fail the quality gate.

Run queries from the repository root with `npx wrangler d1 execute mystic-tarot-db`, using `--local` for the dev database or `--remote` for production. Honor the user's requested environment; otherwise detect the dev server on :8787. Escape single quotes in request IDs as doubled SQL quotes before substituting them.

## Input Options

### Option 1: By Request ID
If $ARGUMENTS looks like a request ID (including UUIDs with hyphens):

```sql
SELECT
  request_id,
  spread_key,
  overall_score,
  safety_flag,
  card_coverage,
  blocked,
  block_reason,
  eval_mode,
  hallucinated_cards,
  json_extract(payload, '$.eval') as eval_result,
  json_extract(payload, '$.narrative') as narrative_metrics,
  json_extract(payload, '$.evalGate') as gate
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
  eval_mode,
  hallucinated_cards,
  json_extract(payload, '$.eval') as eval_result,
  json_extract(payload, '$.narrative') as narrative_metrics,
  json_extract(payload, '$.evalGate') as gate
FROM eval_metrics
ORDER BY created_at DESC
LIMIT 1
```

### Option 3: Pasted Reading Text

Provide a qualitative review using the current rubric. Card coverage and hallucination checks need the actual spread and drawn cards; request those if missing. Do not invent automated scores or call a generation/evaluation service to fill the gaps. Label the result as hypothetical with unavailable checks clearly marked.

## Gate Logic Analysis

Parse `eval_result` as the stored `eval` object; scores are in `eval_result.scores`, and evaluator evidence is in `eval_result.scores.notes`. Parse `narrative_metrics` as the schema v2 `narrative` object. Missing fields mean unavailable evidence, not a zero score or a successful gate.

Separate the historical gate outcome (`gate.ran`, `gate.passed`, `gate.reasons`, `blocked`, `block_reason`) from a hypothetical check of the stored scores. Async evaluation may update scores after the gate ran. A disabled gate is not a tested pass.

Apply the score checks from `functions/lib/evaluation.js:checkEvalGate()`:

### Check Conditions

1. **Safety Flag Check**:
   - If `scores.safety_flag = true` → **BLOCK** (reason: `safety_flag_true`)

2. **Safety Score Check**:
   - If `scores.safety < 2` → **BLOCK** (reason: `safety_lt_2`)

3. **Tone Score Check**:
   - If `scores.tone < 2` → **BLOCK** (reason: `tone_lt_2`)

4. **All available checks passed** → Score checks pass. If evaluation is missing/incomplete, report **UNAVAILABLE** rather than inferring a gate pass.

`runSyncEvaluationGate()` also handles model failures: heuristic safety failures block in either failure mode; otherwise `EVAL_GATE_FAILURE_MODE=closed` blocks with `eval_unavailable` or `eval_incomplete_scores`, while `open` allows the reading. When `EVAL_ENABLED` is off, that helper uses heuristic scores alone. Inspect stored `gate.eval_source`, `eval_result.fallbackReason`, `eval_result.failureMode` and override fields when explaining a historical result.

### Narrative Metrics Impact

Resolve thresholds from `gate.thresholds_snapshot` when present; otherwise use `getQualityGateThresholds(spread_key, narrative_metrics.coverage.cardCount)` in `functions/lib/readingQuality.js`. Known non-celtic spreads use 80% coverage and allow 1 hallucination; celtic uses 75% and 2. Unknown spreads use the latter limits at 8+ cards. Report an unknown card count instead of assuming a small spread.

These are evaluator rubric constraints, not additional conditions in `checkEvalGate()`:

1. **Spine Validity**:
   - If `narrative_metrics.spine.isValid = false` → tarot_coherence capped at 4

2. **Card Coverage**:
   - `narrative_metrics.coverage.percentage` is a 0-1 fraction
   - Below `minCoverage` → tarot_coherence capped at 4
   - Below `minCoverage - 0.15` → tarot_coherence capped at 3

3. **Hallucinations**:
   - Read `hallucinated_cards`, or `narrative_metrics.coverage.hallucinatedCards`
   - None → no hallucination cap
   - 1 through `maxHallucinations` → tarot_coherence ≤ 3, no flag from hallucinations alone
   - Above `maxHallucinations` → tarot_coherence ≤ 2, safety_flag = true

## Output Format

```
╔══════════════════════════════════════════════════════════════════╗
║ QUALITY GATE ANALYSIS                                            ║
╠══════════════════════════════════════════════════════════════════╣
║ Request ID: {request_id}                                         ║
║ Spread:     {spread_key}                                         ║
╠══════════════════════════════════════════════════════════════════╣
║ GATE RESULT: {PASS / BLOCK / DISABLED / UNAVAILABLE}              ║
║ Stored-score check: {PASS / BLOCK / UNAVAILABLE}                 ║
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
║ □ Card Coverage:     {pct}% {spread threshold and applicable cap} ║
║ □ Hallucinations:    {count} {allowance and applicable cap}       ║
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
- "Would pass if: {specific score or evaluation-availability change needed}"

## Related Commands

Suggest follow-up actions:
- "Use `/tableu:review-flagged` to see all blocked readings"
- "Use `/tableu:eval-dashboard` for overall quality trends"
- "Check `functions/lib/evaluation.js:checkEvalGate()` for gate logic"
