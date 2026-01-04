-- Migration: Add archive tables for metrics and feedback
-- Replaces R2 storage with D1 for archival

-- Metrics archive (from METRICS_DB KV)
CREATE TABLE IF NOT EXISTS metrics_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    kv_key TEXT NOT NULL,
    provider TEXT,
    spread_key TEXT,
    deck_style TEXT,
    data TEXT NOT NULL,
    archived_at INTEGER NOT NULL,
    UNIQUE(request_id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_archive_date ON metrics_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_metrics_archive_provider ON metrics_archive(provider);
CREATE INDEX IF NOT EXISTS idx_metrics_archive_spread ON metrics_archive(spread_key);

-- Feedback archive (from FEEDBACK_KV)
CREATE TABLE IF NOT EXISTS feedback_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id TEXT NOT NULL,
    request_id TEXT,
    data TEXT NOT NULL,
    archived_at INTEGER NOT NULL,
    UNIQUE(feedback_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_archive_date ON feedback_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_feedback_archive_request ON feedback_archive(request_id);

-- Archival summaries (daily stats)
CREATE TABLE IF NOT EXISTS archival_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    metrics_archived INTEGER DEFAULT 0,
    metrics_deleted INTEGER DEFAULT 0,
    metrics_errors INTEGER DEFAULT 0,
    feedback_archived INTEGER DEFAULT 0,
    feedback_deleted INTEGER DEFAULT 0,
    feedback_errors INTEGER DEFAULT 0,
    sessions_deleted INTEGER DEFAULT 0,
    webhook_events_deleted INTEGER DEFAULT 0,
    UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_archival_summaries_date ON archival_summaries(date);
