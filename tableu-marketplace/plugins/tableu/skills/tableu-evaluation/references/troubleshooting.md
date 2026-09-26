# Evaluation Troubleshooting Guide

Step-by-step debugging procedures for common evaluation issues.

Run these from the repo root. `wrangler` is not on PATH, so use `npx wrangler`. `--remote` reads production D1; use `--local` for the dev database.

## Diagnosing Low Scores

### Step 1: Retrieve the Evaluation Record

```bash
# By request ID
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT * FROM eval_metrics WHERE request_id = 'abc123'"

# Recent low scores
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT request_id, spread_key, overall_score, safety_flag, card_coverage, eval_mode
   FROM eval_metrics
   WHERE overall_score < 3
   ORDER BY created_at DESC
   LIMIT 20"
```

### Step 2: Examine the Payload

The `payload` JSON column (schema v2) contains:
- `eval`: `scores` (five dimensions, `safety_flag`, `notes`), `mode`, `model`, and any `deterministic_overrides`, `deterministic_tone_overrides`, `heuristic_triggers` or `fallbackReason`
- `narrative.coverage`: `percentage` (0-1), `missingCards`, `hallucinatedCards`
- `narrative.spine`: `isValid`, section counts, `suggestions`
- `readingText`, `userQuestion`: PII-redacted text
- `cardsInfo`: position, card and orientation for each card

```bash
# Extract payload for analysis
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT json_extract(payload, '$.eval') as eval,
          json_extract(payload, '$.narrative') as narrative
   FROM eval_metrics
   WHERE request_id = 'abc123'"
```

### Step 3: Check Specific Issues

**Low tarot_coherence:**
1. Check `narrative.coverage.percentage` against the spread's Min Coverage (80%, or 75% for celtic and 8+ card spreads); see `thresholds.md`
2. Check `narrative.coverage.hallucinatedCards`: within the allowance caps coherence at 3, above it caps at 2
3. Check `narrative.spine.isValid` - Did reading follow structure?
4. Review the evaluator's evidence in `eval.scores.notes`

**Safety flag:**
1. Check `eval.deterministic_overrides` - a medical, death, self-harm, violence or legal/abuse pattern forces the flag
2. Check `narrative.coverage.hallucinatedCards` - above the allowance sets the flag
3. Review `readingText` for medical/financial advice or death/doom language
4. Look for deterministic predictions

**Low tone:**
1. Check `eval.deterministic_tone_overrides` - deterministic phrasing caps tone at 3; `eval.tone_before_cap` keeps the evaluator's own score
2. Look for "you will" instead of "you may", and two or more clause-opening "You must…" / "You need to…" directives that outnumber softening
3. Look for disempowering framing

## Heuristic Mode Issues

When `eval_mode = 'heuristic'`, the model evaluation failed or returned incomplete scores, and heuristic scores were stored instead.

### Step 1: Find the Cause

```bash
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT request_id,
          json_extract(payload, '$.eval.fallbackReason') as reason,
          json_extract(payload, '$.eval.originalError') as error
   FROM eval_metrics
   WHERE eval_mode = 'heuristic'
   ORDER BY created_at DESC
   LIMIT 20"
```

`eval_error_timeout` means the call exceeded `EVAL_TIMEOUT_MS` (async) or `EVAL_GATE_TIMEOUT_MS` (sync gate), `eval_error_invalid_json` means the model's reply wasn't parseable, and `incomplete_scores_*` names the missing dimensions.

### Step 2: Review Timeout Settings

```bash
# Current timeouts (async eval and sync gate)
grep -E 'EVAL_(GATE_)?TIMEOUT_MS' wrangler.jsonc
```

Consider increasing if frequently timing out. Keep `EVAL_TIMEOUT_MS` well under the 30 s `waitUntil()` budget.

### Step 3: Check Error Logs

The repository command is `.claude/commands/eval-logs.md`. When Claude Code is started from the repository root, run `/eval-logs`; it is not a command supplied by this plugin. If it is unavailable, run the equivalent command directly:

```bash
timeout 300 npx wrangler tail --format=json \
  | jq -c --unbuffered '.logs[]? | select((.message[0] // "" | tostring) | test("\\[eval\\]|error"; "i")) | {t: (.timestamp / 1000 | floor | todate), level, msg: .message}'
```

Keep `--format=json` so each log entry remains intact. Do not redirect Wrangler's stderr into the filter; use `npx wrangler whoami` if the tail cannot connect.

`timeout` is GNU coreutils and is not on stock macOS. There, install coreutils (`brew install coreutils`) and use `gtimeout 300`, or drop the prefix and stop the tail with Ctrl-C.

## Alert Investigation

### Regression Alert

A regression alert means the day's average overall score dropped against the 7-day baseline for the same prompt version, variant, spread and provider.

```bash
# Compare current vs baseline
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT date(created_at) as day,
          AVG(overall_score) as avg_score,
          COUNT(*) as count
   FROM eval_metrics
   WHERE created_at > datetime('now', '-14 days')
   GROUP BY day
   ORDER BY day"
```

Investigate:
1. Did prompt version change?
2. Did AI model change?
3. Did card/spread data change?

### Safety Spike Alert

```bash
# Recent safety flags
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT request_id, spread_key, hallucinated_cards,
          json_extract(payload, '$.eval.deterministic_overrides') as overrides
   FROM eval_metrics
   WHERE safety_flag = 1
   AND created_at > datetime('now', '-24 hours')"
```

Common causes:
1. Hallucinated cards above the spread's allowance
2. Deterministic safety patterns (`overrides`)
3. Prompt changes introducing risky language

### Coverage Drop Alert

```bash
# Coverage trend
npx wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT date(created_at) as day,
          AVG(card_coverage) as avg_coverage,
          spread_key
   FROM eval_metrics
   WHERE created_at > datetime('now', '-7 days')
   GROUP BY day, spread_key
   ORDER BY day, spread_key"
```

Common causes:
1. Prompt changes affecting card mention rate
2. New spread with different coverage expectations
3. GraphRAG changes affecting context

## Environment Detection

### Check if Local or Production

```bash
# Is wrangler dev running?
lsof -i :8787 2>/dev/null && echo "Local dev running" || echo "Not running locally"

# Check which DB you're querying
npx wrangler d1 list
```

### Switch Environments

```bash
# Local
npx wrangler d1 execute mystic-tarot-db --local --command "SELECT COUNT(*) FROM eval_metrics"

# Production
npx wrangler d1 execute mystic-tarot-db --remote --command "SELECT COUNT(*) FROM eval_metrics"
```

## Common Fixes

### Fix 1: Increase Timeout

If `fallbackReason` is often `eval_error_timeout`:

```jsonc
// wrangler.jsonc
{
  "vars": {
    "EVAL_TIMEOUT_MS": "25000",  // async eval; increase from 20000, stay under 30000
    "EVAL_GATE_TIMEOUT_MS": "15000"  // sync gate; raising it delays gated readings
  }
}
```

### Fix 2: Adjust Alert Thresholds

If alerts fire on noise, set these Worker vars in `wrangler.jsonc` rather than editing `DEFAULT_THRESHOLDS` in `functions/lib/qualityAnalysis.js`:

```jsonc
{
  "vars": {
    "QUALITY_REGRESSION_THRESHOLD": "-0.4",   // Overall warning; default -0.3
    "QUALITY_CRITICAL_THRESHOLD": "-0.6",     // Overall critical; default -0.5
    "QUALITY_SAFETY_SPIKE_THRESHOLD": "0.03", // Safety-flag rate warning; default 0.02
    "QUALITY_ALERT_MIN_READINGS": "40"        // Minimum group size; default 20
  }
}
```

### Fix 3: Improve Card Coverage

If coverage consistently low:
1. Check `buildEnhancedClaudePrompt()` in `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`
2. Ensure cards section is prominent in prompt
3. Review GraphRAG passage retrieval

### Fix 4: Fix Hallucination Detection

If false positives in hallucination detection:
1. Check patterns in `functions/lib/readingQuality.js`
2. Add exclusions for new terminology
3. Update deck-specific aliases

## Testing Changes

### Test Evaluation Locally

`EVAL_ENABLED` is on in `wrangler.jsonc`, and the Workers AI binding is remote even in local dev, so each local reading is evaluated by (and billed to) Workers AI.

```bash
# Start local dev (Worker on :8787)
npm run dev

# Make a reading request
curl -X POST http://localhost:8787/api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadInfo": { "name": "Three-Card Story (Past · Present · Future)", "key": "threeCard" },
    "userQuestion": "What should I focus on this week?",
    "cardsInfo": [
      { "position": "Past — influences that led here", "card": "The Fool", "orientation": "Upright", "meaning": "New beginnings, innocence, spontaneity, free spirit" },
      { "position": "Present — where you stand now", "card": "The Magician", "orientation": "Upright", "meaning": "Manifestation, resourcefulness, power, inspired action" },
      { "position": "Future — trajectory if nothing shifts", "card": "The High Priestess", "orientation": "Reversed", "meaning": "Secrets, disconnected from intuition, withdrawal" }
    ]
  }'

# Check local eval_metrics
npx wrangler d1 execute mystic-tarot-db --local --command \
  "SELECT * FROM eval_metrics ORDER BY created_at DESC LIMIT 1"
```

### Verify Gate Logic

```bash
# Gate outcomes and score bounds on the synthetic failure corpus
npm run test:eval:synthetic

# Gate policy
node --test tests/evalGatePolicy.test.mjs
```

### Run Calibration Analysis

```bash
node scripts/evaluation/exportEvalData.js --days=7 | node scripts/evaluation/calibrateEval.js
```
