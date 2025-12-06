# Calibrate Evaluation Scores

Analyze evaluation score distributions and suggest calibration adjustments.

First, export recent evaluation data:

```bash
node scripts/evaluation/exportEvalData.js --days=7 --output=/tmp/eval-data.jsonl
```

Then run calibration analysis:

```bash
cat /tmp/eval-data.jsonl | node scripts/evaluation/calibrateEval.js
```

Based on the output, help me:

1. **Interpret the distributions** - Are scores healthy or problematic?
2. **Identify calibration issues** - Inflation, compression, bias?
3. **Suggest rubric adjustments** - How to improve the eval prompt?
4. **Review flagged readings** - Should safety flags be more/less sensitive?

Reference: The evaluation rubric is in `functions/lib/evaluation.js` (look for `EVAL_SYSTEM_PROMPT`).
