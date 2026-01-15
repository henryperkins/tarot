-- Migration: Direct D1 storage for eval metrics
-- Replaces KV (METRICS_DB) + R2 archival with direct D1 writes
-- Note: quality_alerts table already exists from 0015_add_quality_tracking.sql

-- Main eval metrics table (replaces reading:* keys in METRICS_DB)
CREATE TABLE IF NOT EXISTS eval_metrics (
    request_id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    -- Core reading metadata
    spread_key TEXT,
    deck_style TEXT,
    provider TEXT,

    -- Eval results (null until eval completes)
    eval_mode TEXT,           -- 'model', 'heuristic', 'error'
    overall_score INTEGER,
    safety_flag INTEGER DEFAULT 0,
    card_coverage REAL,

    -- Gate blocking
    blocked INTEGER DEFAULT 0,
    block_reason TEXT,

    -- Version tracking for A/B and regression
    reading_prompt_version TEXT,
    variant_id TEXT,

    -- Full payload JSON
    payload JSON NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_metrics_created_at ON eval_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_eval_metrics_spread_key ON eval_metrics(spread_key);
CREATE INDEX IF NOT EXISTS idx_eval_metrics_overall_score ON eval_metrics(overall_score);
CREATE INDEX IF NOT EXISTS idx_eval_metrics_safety_flag ON eval_metrics(safety_flag);
CREATE INDEX IF NOT EXISTS idx_eval_metrics_blocked ON eval_metrics(blocked);
