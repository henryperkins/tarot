---
description: Export evaluation data for analysis or training
argument-hint: [format: jsonl|csv|training] [days: 7|30|90]
allowed-tools: Bash, Read, Write
---

Export Tableu evaluation data in various formats.

## Arguments

Parse arguments from $ARGUMENTS:
- **format**: jsonl (default), csv, or training
- **days**: Number of days to export (default: 7)

Validate `days` as a positive integer and set `export_days` to that value before running the examples. Run from the repository root.

Example: `/tableu:export jsonl 30` exports 30 days as JSONL

## Environment Detection

```bash
export_target=remote
if lsof -i :8787 >/dev/null 2>&1; then export_target=local; fi
export_days=7 # Replace with the validated days argument
```

Honor an explicitly requested environment over this detection. Pass the selected target to every export; the scripts otherwise default to production. Keep these variables in the same shell as the export command.

## Export Formats

### JSONL Format (Default)

Use existing export script:
```bash
node scripts/evaluation/exportEvalData.js --days="$export_days" --"$export_target" --output=/tmp/eval-export.jsonl
```

Each line contains:
```json
{
  "requestId": "example-request",
  "timestamp": "2026-09-24 12:00:00",
  "provider": "openai",
  "spreadKey": "threeCard",
  "eval": {
    "scores": { "personalization": 3, "tarot_coherence": 4, "tone": 4, "safety": 5, "overall": 4, "safety_flag": false, "notes": null },
    "mode": "model"
  },
  "cardCoverage": 1,
  "hallucinatedCards": 0,
  "readingPromptVersion": "example-version",
  "variantId": null,
  "schemaVersion": 2
}
```

The exporter returns these camelCase fields, not raw D1 rows. `eval` may also contain model metadata or errors; pending/error records may have missing scores. JSONL does not include `blocked`, full reading text, or the full stored payload. Evaluator notes can quote reading text, so retain exports only at the requested destination.

### CSV Format

Query D1 with `npx wrangler d1 execute mystic-tarot-db --"$export_target" --json --command ...` and format the returned `results` as CSV. Substitute the validated day count for `{days}`:
```sql
SELECT
  request_id,
  spread_key,
  deck_style,
  overall_score,
  json_extract(payload, '$.eval.scores.personalization') as personalization,
  json_extract(payload, '$.eval.scores.tarot_coherence') as tarot_coherence,
  json_extract(payload, '$.eval.scores.tone') as tone,
  json_extract(payload, '$.eval.scores.safety') as safety,
  safety_flag,
  card_coverage,
  eval_mode,
  blocked,
  reading_prompt_version,
  created_at
FROM eval_metrics
WHERE created_at > datetime('now', '-{days} days')
ORDER BY created_at DESC
```

Output to: `/tmp/eval-export.csv`

### Training Format

Use full training export script:
```bash
node scripts/training/exportReadings.js --metrics-source d1 --metrics-days "$export_days" \
  --wrangler-target "$export_target" --feedback-source none --require-eval \
  --out /tmp/training-export.jsonl
```

This joins journal entries to evaluation metrics by request ID. `--metrics-days` limits the metrics window; `--require-eval` excludes journal entries without a matching evaluation. It is not an export of every `eval_metrics` row, and can be empty if no journal entries match.

Training records include journal reading text, question, cards, reflections, plus `eval`, `evalScores` and `metrics.narrative` when available. Journal text is **not redacted by this exporter**. Keep the output private; do not describe it as anonymized or upload it as part of this command. Feedback is disabled in this example; include it only when requested.

## Output Location

Default output locations:
- JSONL: `/tmp/eval-export.jsonl`
- CSV: `/tmp/eval-export.csv`
- Training: `/tmp/training-export.jsonl`

## Post-Export Actions

Check the exporter exit status before reporting success. For JSONL evaluation exports, offer the following (training records and CSV use different schemas):

1. **Run calibration analysis**:
   ```bash
   cat /tmp/eval-export.jsonl | node scripts/evaluation/calibrateEval.js
   ```

2. **View summary statistics**:
   ```bash
   jq -s 'length' /tmp/eval-export.jsonl
   jq -s 'map(select((.eval.scores.overall | type) == "number")) | group_by(.eval.scores.overall) | map({score: .[0].eval.scores.overall, count: length})' /tmp/eval-export.jsonl
   ```

3. **Filter for specific conditions**:
   ```bash
   jq 'select(.eval.scores.safety_flag == true)' /tmp/eval-export.jsonl
   jq 'select((.eval.scores.overall | type) == "number" and .eval.scores.overall < 3)' /tmp/eval-export.jsonl
   ```

## Output Summary

After export completes, display:

```
╔══════════════════════════════════════════════════════════════════╗
║ EXPORT COMPLETE                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║ Format:     {format}                                             ║
║ Days:       {days}                                               ║
║ Records:    {count}                                              ║
║ Output:     {filepath}                                           ║
║ Size:       {size}                                               ║
╠══════════════════════════════════════════════════════════════════╣
║ QUICK STATS                                                      ║
║ ────────────────────────────────────────────────────────────────║
║ Avg Overall Score:  {avg}                                        ║
║ Safety Flags:       {flags}                                      ║
║ Blocked:            {CSV count, otherwise "not exported"}        ║
╚══════════════════════════════════════════════════════════════════╝
```

Suggest next steps based on the data.
