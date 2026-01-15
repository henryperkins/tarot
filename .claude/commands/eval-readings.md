# Live Reading Evaluation

Fetch recent tarot readings and evaluate them interactively.

Run the following command to fetch the last 5 readings from D1:

```bash
node scripts/claude/fetchRecentReadings.js --count=5
```

After reviewing the readings, help me:

1. **Validate automated eval scores** - Do my assessments match the Llama 3 evaluator?
2. **Identify quality issues** - Personalization, coherence, tone problems?
3. **Check safety** - Any concerning language or inappropriate advice?
4. **Suggest improvements** - What prompt changes would help?

For legacy data sources (if D1 has no data yet):

```bash
# KV (legacy, pre-migration readings)
node scripts/claude/fetchRecentReadings.js --count=5 --source=kv

# R2 archives (requires credentials)
node scripts/claude/fetchRecentReadings.js --count=5 --source=r2
```
