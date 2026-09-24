# Calibrate Evaluation Scores

Analyze evaluation score distributions and suggest calibration adjustments.

Export the last 7 days of evaluations and pipe them straight into the calibration analysis:

```bash
node scripts/evaluation/exportEvalData.js --days=7 | node scripts/evaluation/calibrateEval.js
```

- The export reads production D1 through `npx wrangler` (read-only). Add `--local` to the export to read the local dev database instead.
- The pipe keeps the export off disk, since evaluator notes can quote reading text.
- Stderr should show `Exported N evaluation records`. `Export failed` means the analysis ran on no data; check `npx wrangler whoami`.
- The script also runs an offline synthetic-failure check. To run only that check, with no credentials: `node scripts/evaluation/calibrateEval.js < /dev/null`.

Based on the output, help me:

1. **Interpret the distributions** - Are scores healthy or problematic?
2. **Identify calibration issues** - Inflation, compression, bias? Compare prompt versions and A/B variants.
3. **Suggest rubric adjustments** - How to improve the eval prompt?
4. **Review flagged readings** - Should safety flags be more/less sensitive? Use `/safety-audit` for individual readings.

Reference: The evaluation rubric is `EVAL_SYSTEM_PROMPT_TEMPLATE` in `functions/lib/evaluation.js`, versioned by `EVAL_PROMPT_VERSION`. Its coverage caps are filled per spread from `getQualityGateThresholds()` in `functions/lib/readingQuality.js`.
