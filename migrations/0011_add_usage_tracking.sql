-- Migration: 0011_add_usage_tracking
-- Purpose: Add usage_tracking table for monthly quota enforcement
--
-- Tracks per-user monthly usage of rate-limited features:
-- - AI readings (free: 5, plus: 50, pro: unlimited)
-- - TTS generations (free: 3, plus: 50, pro: unlimited)
-- - API calls (pro only: 1000/month)
--
-- Uses calendar month (UTC) for simplicity and predictability.
-- Counters reset on the 1st of each month.

-- ============================================================================
-- Create usage_tracking table
-- ============================================================================
-- Monthly aggregates per user for quota enforcement

CREATE TABLE IF NOT EXISTS usage_tracking (
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,              -- Format: 'YYYY-MM' (UTC calendar month)
  readings_count INTEGER DEFAULT 0,
  tts_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  PRIMARY KEY (user_id, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- Add index for cleanup queries
-- ============================================================================
-- Enables efficient deletion of old months during scheduled maintenance

CREATE INDEX IF NOT EXISTS idx_usage_tracking_month ON usage_tracking(month);

-- ============================================================================
-- Migration Complete
-- ============================================================================
