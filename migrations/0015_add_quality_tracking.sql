-- Migration: Add quality tracking tables for automated evaluation system
-- This enables:
-- 1. Daily/weekly aggregation of quality scores
-- 2. Regression detection against rolling baselines
-- 3. Alert tracking and acknowledgment
-- 4. A/B testing experiment configuration

-- Quality statistics aggregates
-- Computed daily from metrics_archive during cron job
CREATE TABLE IF NOT EXISTS quality_stats (
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

    -- Uniqueness constraint
    UNIQUE(period_type, period_key, reading_prompt_version,
           eval_prompt_version, variant_id, provider, spread_key)
);

-- Indexes for quality_stats queries
CREATE INDEX IF NOT EXISTS idx_quality_stats_period
    ON quality_stats(period_type, period_key);
CREATE INDEX IF NOT EXISTS idx_quality_stats_version
    ON quality_stats(reading_prompt_version, eval_prompt_version);
CREATE INDEX IF NOT EXISTS idx_quality_stats_variant
    ON quality_stats(variant_id);
CREATE INDEX IF NOT EXISTS idx_quality_stats_spread
    ON quality_stats(spread_key);
CREATE INDEX IF NOT EXISTS idx_quality_stats_created
    ON quality_stats(created_at);

-- Quality alerts (triggered when thresholds exceeded)
CREATE TABLE IF NOT EXISTS quality_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Alert classification
    alert_type TEXT NOT NULL,           -- 'regression' | 'safety_spike' | 'tone_spike' | 'coverage_drop'
    severity TEXT NOT NULL,             -- 'warning' | 'critical'

    -- Context
    period_key TEXT NOT NULL,
    reading_prompt_version TEXT,
    eval_prompt_version TEXT,
    variant_id TEXT,
    spread_key TEXT,
    provider TEXT,

    -- Alert details
    metric_name TEXT,                   -- e.g., 'overall', 'safety_flag_rate', 'card_coverage'
    observed_value REAL,
    threshold_value REAL,
    baseline_value REAL,
    delta REAL,
    reading_count INTEGER,              -- Number of readings in the period

    -- Notes (from eval or manual)
    notes TEXT,

    -- Acknowledgment status
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    resolution_notes TEXT,

    -- Notification tracking
    email_sent_at TEXT,
    email_status TEXT,                  -- 'success' | 'failed' | 'skipped'

    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for quality_alerts queries
CREATE INDEX IF NOT EXISTS idx_quality_alerts_unacked
    ON quality_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quality_alerts_type
    ON quality_alerts(alert_type, created_at);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_severity
    ON quality_alerts(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_period
    ON quality_alerts(period_key);

-- A/B test experiments configuration
CREATE TABLE IF NOT EXISTS ab_experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Experiment identification
    experiment_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    -- Hypothesis being tested
    hypothesis TEXT,

    -- Traffic configuration
    control_variant TEXT NOT NULL DEFAULT 'control',
    treatment_variants TEXT NOT NULL,   -- JSON array: ["v2", "v3"]
    traffic_percentage INTEGER DEFAULT 10,  -- % of requests in experiment

    -- Targeting (NULL = all)
    spread_keys TEXT,                   -- JSON array or NULL for all spreads
    providers TEXT,                     -- JSON array or NULL for all providers

    -- Status management
    status TEXT DEFAULT 'draft',        -- 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
    started_at TEXT,
    ended_at TEXT,

    -- Results tracking
    readings_in_experiment INTEGER DEFAULT 0,
    last_reading_at TEXT,

    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for active experiments lookup
CREATE INDEX IF NOT EXISTS idx_ab_experiments_status
    ON ab_experiments(status);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_active
    ON ab_experiments(status, started_at) WHERE status = 'running';
