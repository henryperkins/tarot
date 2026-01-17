**Findings**
- **HIGH** Review queue pulls from legacy `metrics_archive`, but evaluation data now goes to `eval_metrics`; this likely leaves the admin review queue empty post‑migration and hides safety/tone flags. See `functions/api/admin/quality-stats.js:394` and the “legacy” note in `docs/evaluation-system.md:118`.
- **HIGH** Gate‑blocked readings recompute narrative metrics from the safe fallback, then `scheduleEvaluation` reuses those metrics (and writes `card_coverage`) while still evaluating the original reading text; this mismatches structural metrics vs. evaluated content and can mask hallucinations/coverage issues in quality stats. See `functions/api/tarot-reading.js:165-196` and `functions/lib/evaluation.js:957-959`, `functions/lib/evaluation.js:1072-1088`.
- **MEDIUM** Alert delta formatting treats any |delta| < 1 as a percentage, so score drops like `-0.3` show as “-30%” in logs/emails; this misrepresents overall score regressions. See `functions/lib/qualityAlerts.js:415-421`.
- **MEDIUM** Threshold env parsing uses `parseFloat(...) || default`, so `0` can’t be configured (falls back to default). This makes it impossible to intentionally set zero thresholds for testing or strict gating. See `functions/lib/qualityAnalysis.js:38-46`.
- **MEDIUM** Alert sample size uses `reading_count` rather than evaluated count; if eval lags or is disabled, alerts can trigger from tiny eval samples, inflating false positives. See `functions/lib/qualityAnalysis.js:217-285`.
- **LOW** `quality_stats` uniqueness relies on nullable columns; SQLite treats NULLs as distinct, so re‑running analysis for a day can insert duplicates for “null” dimensions and skew baselines. See `migrations/0015_add_quality_tracking.sql:53-55`.

**Open Questions / Assumptions**
- Is `metrics_archive` still populated in production? If not, should the review queue be moved to `eval_metrics` (or a view) so safety flags are visible?
- For gate‑blocked readings, do you want to store both “original” and “fallback” narrative metrics (or explicitly pin eval metrics to original)? The current mix looks accidental.
- Should alert sampling use `eval_count + heuristic_count` instead of `reading_count` to avoid low‑sample noise?
- Testing gap: I didn’t find tests covering review queue data source or alert delta formatting; should we add those?

**Change Summary**
- No code changes made in this review.

If you want, I can propose a concrete patch to: (1) move review queue to `eval_metrics`, (2) store original vs. fallback metrics separately, and (3) fix alert delta formatting and threshold parsing.
