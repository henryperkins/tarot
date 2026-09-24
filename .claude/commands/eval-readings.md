# Live Reading Evaluation

Fetch recent tarot readings and evaluate them interactively.

Run the following command to fetch the last 5 readings from production D1:

```bash
node scripts/claude/fetchRecentReadings.js --count=5
```

If the fetch fails, the script exits non-zero with the wrangler error; check `npx wrangler whoami`. Don't fall back to `--source=kv` or `--source=r2`: nothing writes readings to those stores anymore.

After reviewing the readings, help me:

1. **Validate automated eval scores** - Do my assessments match the Workers AI evaluator (`EVAL_MODEL` in `wrangler.jsonc`)?
2. **Identify quality issues** - Personalization, coherence, tone problems?
3. **Check safety** - Any concerning language or inappropriate advice?
4. **Suggest improvements** - What prompt changes would help?
