# Monitor Evaluation Logs

Watch live evaluation activity from the production Worker.

Tail for five minutes, keeping only `[eval]` lines. Run it in the background; `timeout` ends it and you get the output then:

```bash
timeout 300 npx wrangler tail --format=json \
  | jq -c --unbuffered '.logs[]? | select((.message[0] // "" | tostring) | contains("[eval]")) | {t: (.timestamp / 1000 | floor | todate), level, msg: .message}'
```

- Use `npx`, since `wrangler` is not on PATH. Don't redirect stderr into the pipe, or wrangler errors get filtered out.
- Keep `--format=json`. Pretty output splits the `Scores:` object across lines, so a line filter loses the scores.
- An empty result means no reading was evaluated during the window. If the tail itself fails, check `npx wrangler whoami`.

Look for (all logged by `functions/lib/evaluation.js`):

- `Starting evaluation with <model>` - Eval triggered
- `Scores:` - Eval completed; the object holds the five scores, `safety_flag`, `notes` and `latencyMs`
- `Metrics updated with eval results (mode: ...)` - Stored; `heuristic` means the model eval failed or was incomplete, `error` means no scores were stored
- `Skipped: EVAL_ENABLED !== true` or `Skipped: AI binding not available` - Evaluation is not running at all
- `SAFETY FLAG TRIGGERED` - Reading flagged for review
- `Low tone score: N` - Tone below 3 (the gate blocks only below 2)
- `Timeout after Nms` - Eval exceeded `EVAL_TIMEOUT_MS` (async) or `EVAL_GATE_TIMEOUT_MS` (sync gate)
- `Failed to parse JSON` or `Empty extraction` - Model response issues
- `Error:` or `scheduleEvaluation failed` - Evaluation or storage threw
- `Input truncated` - Reading or question was cut to fit the eval prompt

Help me:

1. **Interpret patterns** - Are evaluations healthy?
2. **Debug issues** - Why are evals failing, timing out, or being skipped?
3. **Review flagged readings** - Should I investigate specific requests?
