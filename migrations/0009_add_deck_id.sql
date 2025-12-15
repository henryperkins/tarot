-- Migration: 0009_add_deck_id
-- Purpose: Add deck_id column to journal_entries for deck filtering
--
-- Fixes: Frontend collects deckId but backend never persists it,
--        making deck-based filtering in Journal always return empty results.
--
-- Backward compatible: NULL for entries created before this migration

-- ============================================================================
-- Add deck_id column to journal_entries
-- ============================================================================
-- Used for filtering readings by deck style (rws1909, marseille, thoth, etc.)

ALTER TABLE journal_entries ADD COLUMN deck_id TEXT;

-- Index for deck_id filtering
CREATE INDEX IF NOT EXISTS idx_journal_deck_id
  ON journal_entries(user_id, deck_id)
  WHERE deck_id IS NOT NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================
