-- Safe provenance for logical provider calls; token NULL means unknown, never zero.
CREATE TABLE IF NOT EXISTS inference_attempts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  requested_model TEXT,
  model TEXT,
  state TEXT NOT NULL CHECK (state IN ('accepted', 'rejected', 'failed')),
  reason TEXT,
  usage_status TEXT NOT NULL CHECK (usage_status IN ('known', 'partial', 'unknown')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cache_read_input_tokens INTEGER,
  cache_creation_input_tokens INTEGER,
  reasoning_tokens INTEGER,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inference_attempts_request ON inference_attempts(request_id, started_at);
CREATE INDEX IF NOT EXISTS idx_inference_attempts_model ON inference_attempts(task, provider, model, state, started_at);

-- Preserve every historical aggregate while replacing its older uniqueness
-- constraint, which cannot distinguish evaluator model/source dimensions.
CREATE TABLE quality_stats_provenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Period identification
    period_type TEXT NOT NULL,          -- 'daily' | 'weekly'
    period_key TEXT NOT NULL,           -- '2026-01-06' or '2026-W01'

    -- Versioning dimensions (for stratified analysis)
    reading_prompt_version TEXT,        -- e.g., '1.0.0'
    eval_prompt_version TEXT,           -- e.g., '1.2.0'
    variant_id TEXT,                    -- A/B test variant or NULL for control
    provider TEXT,                      -- 'azure' | 'claude'
    spread_key TEXT,                    -- 'celtic' | 'threeCard' | etc.

    -- Aggregate metrics
    reading_count INTEGER NOT NULL DEFAULT 0,
    eval_count INTEGER NOT NULL DEFAULT 0,    -- Readings with successful AI eval
    heuristic_count INTEGER NOT NULL DEFAULT 0, -- Readings with heuristic fallback
    error_count INTEGER NOT NULL DEFAULT 0,   -- Readings with eval errors

    -- Score aggregates (1-5 scale)
    avg_overall REAL,
    avg_personalization REAL,
    avg_tarot_coherence REAL,
    avg_tone REAL,
    avg_safety REAL,

    -- Safety metrics
    safety_flag_count INTEGER DEFAULT 0,
    low_tone_count INTEGER DEFAULT 0,         -- tone < 3
    low_safety_count INTEGER DEFAULT 0,       -- safety < 3

    -- Narrative quality metrics
    avg_card_coverage REAL,
    hallucination_count INTEGER DEFAULT 0,

    -- Baseline comparison (computed from rolling 7-day window)
    baseline_overall REAL,
    delta_overall REAL,                       -- avg_overall - baseline_overall

    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    eval_model TEXT,
    eval_source TEXT
);


INSERT INTO quality_stats_provenance (id, period_type, period_key, reading_prompt_version, eval_prompt_version, variant_id, provider, spread_key, reading_count, eval_count, heuristic_count, error_count, avg_overall, avg_personalization, avg_tarot_coherence, avg_tone, avg_safety, safety_flag_count, low_tone_count, low_safety_count, avg_card_coverage, hallucination_count, baseline_overall, delta_overall, created_at)
SELECT id, period_type, period_key, reading_prompt_version, eval_prompt_version, variant_id, provider, spread_key, reading_count, eval_count, heuristic_count, error_count, avg_overall, avg_personalization, avg_tarot_coherence, avg_tone, avg_safety, safety_flag_count, low_tone_count, low_safety_count, avg_card_coverage, hallucination_count, baseline_overall, delta_overall, created_at FROM quality_stats;
DROP TABLE quality_stats;
ALTER TABLE quality_stats_provenance RENAME TO quality_stats;
CREATE UNIQUE INDEX idx_quality_stats_dimensions_unique ON quality_stats (
  period_type, period_key, COALESCE(reading_prompt_version, ''), COALESCE(eval_prompt_version, ''),
  COALESCE(variant_id, ''), COALESCE(provider, ''), COALESCE(spread_key, ''),
  COALESCE(eval_model, ''), COALESCE(eval_source, '')
) WHERE eval_model IS NOT NULL AND eval_source IS NOT NULL;
-- Historical NULL-dimensional duplicates remain intact and outside this index.
CREATE INDEX idx_quality_stats_period ON quality_stats(period_type, period_key);
CREATE INDEX idx_quality_stats_version ON quality_stats(reading_prompt_version, eval_prompt_version);
CREATE INDEX idx_quality_stats_variant ON quality_stats(variant_id);
CREATE INDEX idx_quality_stats_spread ON quality_stats(spread_key);
CREATE INDEX idx_quality_stats_created ON quality_stats(created_at);
ALTER TABLE quality_alerts ADD COLUMN eval_model TEXT;
ALTER TABLE quality_alerts ADD COLUMN eval_source TEXT;
ALTER TABLE journal_entries ADD COLUMN extraction_model TEXT;
ALTER TABLE journal_entries ADD COLUMN embedding_model TEXT;
