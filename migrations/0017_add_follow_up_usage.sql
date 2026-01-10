-- Migration: 0017_add_follow_up_usage
-- Description: Add table for tracking follow-up question usage
-- Date: 2026-01-10

-- Follow-up question usage tracking
-- Enables analytics on follow-up feature adoption and usage patterns
CREATE TABLE IF NOT EXISTS follow_up_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  reading_request_id TEXT,
  turn_number INTEGER NOT NULL DEFAULT 1,
  question_length INTEGER,
  response_length INTEGER,
  journal_context_used INTEGER DEFAULT 0,
  patterns_found INTEGER DEFAULT 0,
  latency_ms INTEGER,
  provider TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for daily usage queries (rate limiting)
CREATE INDEX IF NOT EXISTS idx_follow_up_user_date 
ON follow_up_usage(user_id, created_at);

-- Index for linking follow-ups back to their original reading
CREATE INDEX IF NOT EXISTS idx_follow_up_reading 
ON follow_up_usage(reading_request_id);

-- Index for analytics queries on journal context usage
CREATE INDEX IF NOT EXISTS idx_follow_up_journal_context
ON follow_up_usage(journal_context_used, created_at);
