---
description: View evaluation metrics dashboard with scores, alerts, and trends
argument-hint: [time-range: 24h|7d|30d]
allowed-tools: Bash, Read, AskUserQuestion
---

Display an evaluation metrics dashboard for Tableu tarot readings.

## Time Range Selection

If no time range argument provided ($ARGUMENTS is empty), ask the user which time range they want:
- Last 24 hours (recent readings)
- Last 7 days (weekly trends)
- Last 30 days (monthly overview)

If argument provided, use: $ARGUMENTS (interpret 24h, 7d, 30d, or similar)

## Environment Detection

First, detect the environment:

```bash
lsof -i :8787 >/dev/null 2>&1 && echo "ENV=local" || echo "ENV=production"
```

- If local: Use `npx wrangler d1 execute mystic-tarot-db --local`
- If production: Use `npx wrangler d1 execute mystic-tarot-db --remote`

## Dashboard Sections

### 1. Summary Statistics

Query:
```sql
SELECT
  COUNT(*) as total_readings,
  AVG(overall_score) as avg_overall,
  AVG(CASE WHEN safety_flag = 1 THEN 1.0 ELSE 0.0 END) as safety_flag_rate,
  AVG(card_coverage) as avg_coverage,
  SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked_count,
  SUM(CASE WHEN eval_mode = 'heuristic' THEN 1 ELSE 0 END) as heuristic_count
FROM eval_metrics
WHERE created_at > datetime('now', '-{days} days')
```

### 2. Score Distribution

Query:
```sql
SELECT
  overall_score,
  COUNT(*) as count
FROM eval_metrics
WHERE created_at > datetime('now', '-{days} days')
GROUP BY overall_score
ORDER BY overall_score
```

### 3. Recent Alerts

Query:
```sql
SELECT
  created_at,
  period_key,
  alert_type,
  severity,
  metric_name,
  observed_value,
  threshold_value,
  baseline_value,
  delta,
  reading_count,
  notes
FROM quality_alerts
WHERE created_at > datetime('now', '-{days} days')
ORDER BY created_at DESC
LIMIT 10
```

Build each alert description from its metric, observed value and threshold, adding baseline/delta when present. `notes` is optional; alerts do not store a JSON message payload. `period_key` identifies the aggregate day, while `created_at` is the alert timestamp.

### 4. Low-Scoring Readings

Query:
```sql
SELECT
  request_id,
  spread_key,
  overall_score,
  safety_flag,
  card_coverage,
  eval_mode,
  created_at
FROM eval_metrics
WHERE overall_score < 3
  AND created_at > datetime('now', '-{days} days')
ORDER BY created_at DESC
LIMIT 10
```

## Output Format

Present the data in a readable dashboard format:

```
╔══════════════════════════════════════════════════════════════════╗
║                    TABLEU EVALUATION DASHBOARD                    ║
║                    Time Range: {selected range}                   ║
╠══════════════════════════════════════════════════════════════════╣
║ SUMMARY                                                          ║
║ ────────────────────────────────────────────────────────────────║
║ Total Readings:    {count}        Avg Overall Score: {score}/5   ║
║ Safety Flag Rate:  {rate}%        Avg Card Coverage: {cov}%      ║
║ Blocked Readings:  {blocked}      Heuristic Evals:   {heuristic} ║
╠══════════════════════════════════════════════════════════════════╣
║ SCORE DISTRIBUTION                                               ║
║ ────────────────────────────────────────────────────────────────║
║ ★★★★★ (5): {count} ████████                                      ║
║ ★★★★☆ (4): {count} ████████████████                              ║
║ ★★★☆☆ (3): {count} ████████████                                  ║
║ ★★☆☆☆ (2): {count} ██                                            ║
║ ★☆☆☆☆ (1): {count} █                                             ║
╠══════════════════════════════════════════════════════════════════╣
║ RECENT ALERTS ({count})                                          ║
║ ────────────────────────────────────────────────────────────────║
║ {date} | {severity} | {type}: {message}                          ║
╠══════════════════════════════════════════════════════════════════╣
║ LOW-SCORING READINGS                                             ║
║ ────────────────────────────────────────────────────────────────║
║ {request_id} | {spread} | Score: {score} | Coverage: {cov}%      ║
╚══════════════════════════════════════════════════════════════════╝
```

## Recommendations

After displaying the dashboard, provide actionable recommendations:

1. If safety_flag_rate > 2%: "⚠️ Elevated safety flags - review with /tableu:review-flagged"
2. If avg_overall < 3.5: "⚠️ Overall quality declining - check recent prompt changes"
3. If heuristic_count > 10%: "⚠️ High heuristic rate - Workers AI may be timing out"
4. If blocked_count > 0: "📊 {blocked} readings blocked by quality gate"

Offer to drill down into any section for more details.
