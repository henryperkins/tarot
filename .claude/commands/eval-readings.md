# Live Reading Evaluation

Fetch recent tarot readings and evaluate them interactively.

Run the following command to fetch the last 5 readings:

```bash
node scripts/claude/fetchRecentReadings.js --count=5 --source=kv
```

After reviewing the readings, help me:

1. **Validate automated eval scores** - Do my assessments match the Llama 3 evaluator?
2. **Identify quality issues** - Personalization, coherence, tone problems?
3. **Check safety** - Any concerning language or inappropriate advice?
4. **Suggest improvements** - What prompt changes would help?

If no readings are found in KV (they may have been archived), try R2:

```bash
node scripts/claude/fetchRecentReadings.js --count=5 --source=r2
```

Note: R2 access requires environment variables: `CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
