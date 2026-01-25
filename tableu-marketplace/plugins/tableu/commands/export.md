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

Example: `/tableu:export jsonl 30` exports 30 days as JSONL

## Environment Detection

```bash
lsof -i :8787 >/dev/null 2>&1 && echo "ENV=local" || echo "ENV=production"
```

## Export Formats

### JSONL Format (Default)

Use existing export script:
```bash
node scripts/evaluation/exportEvalData.js --days={days} --output=/tmp/eval-export.jsonl
```

Each line contains:
```json
{
  "request_id": "...",
  "spread_key": "...",
  "deck_style": "...",
  "overall_score": 4,
  "safety_flag": false,
  "card_coverage": 0.95,
  "eval_mode": "model",
  "reading_prompt_version": "...",
  "created_at": "...",
  "payload": { ... }
}
```

### CSV Format

Query D1 directly and format as CSV:
```sql
SELECT
  request_id,
  spread_key,
  deck_style,
  overall_score,
  json_extract(payload, '$.evalResult.personalization') as personalization,
  json_extract(payload, '$.evalResult.tarot_coherence') as tarot_coherence,
  json_extract(payload, '$.evalResult.tone') as tone,
  json_extract(payload, '$.evalResult.safety') as safety,
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
node scripts/training/exportReadings.js --metrics-source db --days={days} --out=/tmp/training-export.jsonl
```

This includes:
- Full reading text (redacted)
- User question (redacted)
- Cards info
- Evaluation scores
- Narrative metrics
- Suitable for fine-tuning or analysis

## Output Location

Default output locations:
- JSONL: `/tmp/eval-export.jsonl`
- CSV: `/tmp/eval-export.csv`
- Training: `/tmp/training-export.jsonl`

## Post-Export Actions

After export, offer:

1. **Run calibration analysis**:
   ```bash
   cat /tmp/eval-export.jsonl | node scripts/evaluation/calibrateEval.js
   ```

2. **View summary statistics**:
   ```bash
   wc -l /tmp/eval-export.jsonl
   jq -s 'group_by(.overall_score) | map({score: .[0].overall_score, count: length})' /tmp/eval-export.jsonl
   ```

3. **Filter for specific conditions**:
   ```bash
   jq 'select(.safety_flag == true)' /tmp/eval-export.jsonl
   jq 'select(.overall_score < 3)' /tmp/eval-export.jsonl
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
║ Blocked:            {blocked}                                    ║
╚══════════════════════════════════════════════════════════════════╝
```

Suggest next steps based on the data.
