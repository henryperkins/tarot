-- Migration: 0026_add_pattern_tracking_failures
-- Description: Record pattern tracking failures for analytics gap monitoring
-- Date: 2026-02-02

CREATE TABLE IF NOT EXISTS pattern_tracking_failures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entry_id TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pattern_tracking_failures_user_date
  ON pattern_tracking_failures(user_id, created_at);
