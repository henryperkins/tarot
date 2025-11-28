-- Migration: 0006_add_user_preferences
-- Purpose: Add user_preferences_json column to journal_entries for storing
--          personalization snapshot at time of reading (Phase 5.2)
--
-- Schema:
--   user_preferences_json TEXT - JSON object with:
--     - readingTone: 'gentle' | 'balanced' | 'blunt'
--     - spiritualFrame: 'psychological' | 'spiritual' | 'mixed' | 'playful'
--     - tarotExperience: 'newbie' | 'intermediate' | 'experienced'
--     - displayName: string (optional, only if set)
--
-- Backward compatible: NULL for entries created before this migration

-- ============================================================================
-- Add user_preferences_json column to journal_entries
-- ============================================================================

ALTER TABLE journal_entries ADD COLUMN user_preferences_json TEXT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
