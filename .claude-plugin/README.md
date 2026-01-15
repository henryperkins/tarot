# Tableu Plugin for Claude Code

Integration plugin for the Tableu tarot reading web app, providing evaluation monitoring, quality analysis, and development workflows.

## Features

### Commands

| Command | Description |
|---------|-------------|
| `/tableu:eval-dashboard` | View evaluation metrics with scores, alerts, and trends |
| `/tableu:review-flagged` | Interactive review of safety-flagged or low-scoring readings |
| `/tableu:export` | Export evaluation data in JSONL, CSV, or training formats |
| `/tableu:quality-gate` | Test if a reading would pass/fail the quality gate |
| `/tableu:prompt-preview` | Preview the prompt structure that would be sent to the LLM |

### Agents

| Agent | Purpose |
|-------|---------|
| `eval-analyst` | Analyzes metrics patterns, detects regressions, suggests calibration |
| `quality-investigator` | Deep dives on individual readings to explain scores |
| `prompt-analyzer` | Correlates scores with prompt sections, suggests improvements |

### Skills

| Skill | Purpose |
|-------|---------|
| `tableu-evaluation` | Comprehensive knowledge of the evaluation system, rubric, and troubleshooting |

### Hooks

| Event | Trigger | Action |
|-------|---------|--------|
| PostToolUse:Bash | `wrangler dev` or `npm run deploy` | Reminder about eval monitoring |

## Environment Detection

The plugin automatically detects whether you're running locally (wrangler dev on :8787) or need to query production:

- **Local**: Uses `wrangler d1 execute mystic-tarot-db --local`
- **Production**: Uses `wrangler d1 execute mystic-tarot-db --remote`

## Quick Start

1. **View current quality metrics:**
   ```
   /tableu:eval-dashboard
   ```

2. **Review flagged readings:**
   ```
   /tableu:review-flagged safety
   ```

3. **Export data for analysis:**
   ```
   /tableu:export jsonl 7
   ```

4. **Check a specific reading:**
   ```
   /tableu:quality-gate abc123
   ```

## Prompt Development

The plugin also helps with prompt engineering:

1. **Preview prompt structure:**
   ```
   /tableu:prompt-preview threeCard What should I focus on?
   ```

2. **Analyze prompt-to-score relationships:**
   Ask: "Which parts of our prompt affect personalization scores?"
   (Triggers `prompt-analyzer` agent)

3. **Get improvement suggestions:**
   Ask: "Tarot coherence scores are low, how can we fix the prompt?"
   (Triggers `prompt-analyzer` agent)

## Key Files

The plugin integrates with these codebase files:

**Evaluation:**
- `functions/lib/evaluation.js` - Core evaluation engine
- `functions/lib/readingQuality.js` - Narrative metrics computation
- `functions/lib/qualityAlerts.js` - Alert dispatch system
- `scripts/evaluation/*.js` - Evaluation workflow scripts

**Prompt Construction:**
- `functions/lib/narrative/prompts.js` - Main prompt builder
- `functions/lib/narrative/spreads/*.js` - Spread-specific formatting
- `functions/lib/spreadAnalysis.js` - Analysis and reversal framework
- `functions/lib/knowledgeGraph.js` - Pattern detection
- `functions/lib/graphRAG.js` - Knowledge retrieval

## Database

Queries the `eval_metrics` and `quality_alerts` tables in D1:

```sql
-- Recent evaluations
SELECT * FROM eval_metrics ORDER BY created_at DESC LIMIT 10;

-- Quality alerts
SELECT * FROM quality_alerts ORDER BY date_str DESC LIMIT 10;
```

## Related Documentation

- `docs/evaluation-system.md` - Full evaluation system documentation
- `CLAUDE.md` - Project overview and architecture
