# Evaluation Troubleshooting Guide

Step-by-step debugging procedures for common evaluation issues.

## Diagnosing Low Scores

### Step 1: Retrieve the Evaluation Record

```bash
# By request ID
wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT * FROM eval_metrics WHERE request_id = 'abc123'"

# Recent low scores
wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT request_id, spread_key, overall_score, safety_flag, card_coverage, eval_mode
   FROM eval_metrics
   WHERE overall_score < 3
   ORDER BY created_at DESC
   LIMIT 20"
```

### Step 2: Examine the Payload

The `payload` JSON column contains:
- `evalResult`: Scores and reasoning
- `narrativeMetrics`: Spine, coverage, hallucinations
- `redactedReading`: PII-filtered reading text
- `cardsInfo`: Cards in the spread

```bash
# Extract payload for analysis
wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT json_extract(payload, '$.evalResult') as eval,
          json_extract(payload, '$.narrativeMetrics') as metrics
   FROM eval_metrics
   WHERE request_id = 'abc123'"
```

### Step 3: Check Specific Issues

**Low tarot_coherence:**
1. Check `cardCoverage` - Is it below 90%?
2. Check `hallucinatedCards` - Any cards mentioned but not drawn?
3. Check `spine.isValid` - Did reading follow structure?
4. Review reasoning in `evalResult.reasoning`

**Safety flag:**
1. Check `hallucinatedCards` - Auto-triggers safety_flag
2. Review reading text for medical/financial advice
3. Check for death/doom language
4. Look for deterministic predictions

**Low tone:**
1. Look for "you will" instead of "you may"
2. Check for deterministic language
3. Look for disempowering framing

## Heuristic Mode Issues

When `eval_mode = 'heuristic'`:

### Step 1: Check AI Availability

```bash
# Check Workers AI status
curl -X GET "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ai/models" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

### Step 2: Review Timeout Settings

```bash
# Current timeout
grep EVAL_TIMEOUT_MS wrangler.jsonc
```

Consider increasing if frequently timing out.

### Step 3: Check Error Logs

```bash
# Live tail for eval errors
wrangler tail --format pretty | grep -E "\[eval\]|error"
```

## Alert Investigation

### Regression Alert

A regression alert means scores dropped vs. 7-day baseline.

```bash
# Compare current vs baseline
wrangler d1 execute mystic-tarot-db --remote --command \
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
wrangler d1 execute mystic-tarot-db --remote --command \
  "SELECT request_id, spread_key,
          json_extract(payload, '$.narrativeMetrics.hallucinatedCards') as hallucinations
   FROM eval_metrics
   WHERE safety_flag = 1
   AND created_at > datetime('now', '-24 hours')"
```

Common causes:
1. Hallucination detection triggering
2. Prompt changes introducing risky language
3. New card data with issues

### Coverage Drop Alert

```bash
# Coverage trend
wrangler d1 execute mystic-tarot-db --remote --command \
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
wrangler d1 list
```

### Switch Environments

```bash
# Local
wrangler d1 execute mystic-tarot-db --local --command "SELECT COUNT(*) FROM eval_metrics"

# Production
wrangler d1 execute mystic-tarot-db --remote --command "SELECT COUNT(*) FROM eval_metrics"
```

## Common Fixes

### Fix 1: Increase Timeout

If seeing frequent heuristic fallbacks:

```jsonc
// wrangler.jsonc
{
  "vars": {
    "EVAL_TIMEOUT_MS": "8000"  // Increase from 5000
  }
}
```

### Fix 2: Adjust Thresholds

If too many false positives:

```javascript
// functions/lib/qualityAlerts.js
const CUSTOM_THRESHOLDS = {
  overall: { warning: -0.4, critical: -0.6 }  // More lenient
};
```

### Fix 3: Improve Card Coverage

If coverage consistently low:
1. Check `buildEnhancedClaudePrompt()` in `functions/lib/narrative/prompts.js`
2. Ensure cards section is prominent in prompt
3. Review GraphRAG passage retrieval

### Fix 4: Fix Hallucination Detection

If false positives in hallucination detection:
1. Check patterns in `functions/lib/readingQuality.js`
2. Add exclusions for new terminology
3. Update deck-specific aliases

## Testing Changes

### Test Evaluation Locally

```bash
# Start local dev
npm run dev:workers

# Make a reading request
curl -X POST http://localhost:8787/api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{"question": "Test question", "spread": "threeCard", ...}'

# Check local eval_metrics
wrangler d1 execute mystic-tarot-db --local --command \
  "SELECT * FROM eval_metrics ORDER BY created_at DESC LIMIT 1"
```

### Verify Gate Logic

```bash
node scripts/evaluation/verifyNarrativeGate.js
```

### Run Calibration Analysis

```bash
node scripts/evaluation/exportEvalData.js --days=7 --output=/tmp/eval.jsonl
cat /tmp/eval.jsonl | node scripts/evaluation/calibrateEval.js
```
