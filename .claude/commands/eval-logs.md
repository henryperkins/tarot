# Monitor Evaluation Logs

Watch live evaluation activity from Cloudflare Workers.

Start tailing logs filtered to evaluation events:

```bash
wrangler tail --format=pretty 2>&1 | grep --line-buffered "\[eval\]"
```

Look for:

- `[eval] Starting evaluation` - Eval triggered
- `[eval] Scores: {...}` - Evaluation completed with scores
- `[eval] SAFETY FLAG TRIGGERED` - Reading flagged for review
- `[eval] Low tone score` - Tone concerns detected
- `[eval] Timeout` - Eval took too long
- `[eval] Failed to parse JSON` - Model response issues

Help me:

1. **Interpret patterns** - Are evaluations healthy?
2. **Debug issues** - Why are evals failing/timing out?
3. **Review flagged readings** - Should I investigate specific requests?

To stop tailing, press Ctrl+C.
