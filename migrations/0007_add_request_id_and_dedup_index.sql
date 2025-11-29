-- Migration: 0007_add_request_id_and_dedup_index
-- Purpose: Add request_id column for API tracing and unique index to prevent
--          duplicate journal entries from double-saves
--
-- Fixes:
--   1. Missing request_id column referenced by export scripts
--   2. Duplicate entries caused by double-click or network retry
--
-- Backward compatible: NULL for entries created before this migration

-- ============================================================================
-- Add request_id column to journal_entries
-- ============================================================================
-- Used for correlating readings with API logs, feedback, and metrics

ALTER TABLE journal_entries ADD COLUMN request_id TEXT;

-- Index for request_id lookups (used by feedback/metrics correlation)
CREATE INDEX IF NOT EXISTS idx_journal_request_id
  ON journal_entries(request_id)
  WHERE request_id IS NOT NULL;

-- ============================================================================
-- Add unique constraint on (user_id, session_seed) to prevent duplicates
-- ============================================================================
-- Only applies when session_seed is non-null (readings with ritual seed)
-- This is a partial unique index - allows multiple NULL session_seeds

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_user_session_seed_unique
  ON journal_entries(user_id, session_seed)
  WHERE session_seed IS NOT NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================
