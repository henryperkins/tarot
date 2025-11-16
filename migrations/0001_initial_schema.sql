-- ============================================================================
-- Mystic Tarot - Initial Database Schema
-- ============================================================================
-- Migration: 0001
-- Description: Initial schema for readings history and analytics
-- Created: 2025-11-15
--

-- ============================================================================
-- Readings Table
-- ============================================================================
-- Stores tarot readings for analytics and optional user history
-- Note: No personally identifiable information (PII) is stored
--
CREATE TABLE IF NOT EXISTS readings (
  id TEXT PRIMARY KEY,                     -- UUID generated client-side
  created_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  spread_key TEXT NOT NULL,                -- 'single', 'threeCard', 'celtic', etc.
  spread_name TEXT NOT NULL,               -- Human-readable spread name
  card_count INTEGER NOT NULL,             -- Number of cards in the reading
  has_reversals INTEGER NOT NULL DEFAULT 0,-- Boolean: 1 if any reversed cards
  reversal_count INTEGER NOT NULL DEFAULT 0,-- Number of reversed cards
  question_length INTEGER,                 -- Length of user's question (for analytics)
  provider TEXT,                           -- 'claude-sonnet-4.5' or 'local'
  reading_length INTEGER,                  -- Length of generated reading text

  -- Analytics fields
  session_seed TEXT,                       -- Ritual seed (for reproducibility)
  has_reflections INTEGER DEFAULT 0,       -- Boolean: 1 if user added reflections

  -- Optional tracking (privacy-preserving)
  user_agent TEXT,                         -- Browser/device info
  locale TEXT,                             -- User's locale (e.g., 'en-US')

  -- Metadata
  version INTEGER DEFAULT 1                -- Schema version for future migrations
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_readings_created_at
  ON readings(created_at);

CREATE INDEX IF NOT EXISTS idx_readings_spread_key
  ON readings(spread_key);

CREATE INDEX IF NOT EXISTS idx_readings_provider
  ON readings(provider);

-- ============================================================================
-- Cards Table
-- ============================================================================
-- Stores individual card draws within each reading
--
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_id TEXT NOT NULL,                -- Foreign key to readings.id
  position_index INTEGER NOT NULL,         -- 0-based position in spread
  position_label TEXT,                     -- 'Past', 'Present', 'Challenge', etc.
  card_name TEXT NOT NULL,                 -- 'The Fool', 'Ace of Wands', etc.
  card_number INTEGER,                     -- Major Arcana number (0-21), null for Minor
  suit TEXT,                               -- 'Wands', 'Cups', 'Swords', 'Pentacles', or null
  rank TEXT,                               -- 'Ace', '2', 'King', etc., or null
  is_reversed INTEGER NOT NULL DEFAULT 0,  -- Boolean: 1 if reversed

  FOREIGN KEY (reading_id) REFERENCES readings(id) ON DELETE CASCADE
);

-- Index for querying cards by reading
CREATE INDEX IF NOT EXISTS idx_cards_reading_id
  ON cards(reading_id);

CREATE INDEX IF NOT EXISTS idx_cards_card_name
  ON cards(card_name);

-- ============================================================================
-- Analytics Aggregates Table (Optional)
-- ============================================================================
-- Pre-computed daily/weekly/monthly stats for performance
-- Can be populated via scheduled Workers or manual scripts
--
CREATE TABLE IF NOT EXISTS reading_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start INTEGER NOT NULL,           -- Unix timestamp (start of period)
  period_end INTEGER NOT NULL,             -- Unix timestamp (end of period)
  period_type TEXT NOT NULL,               -- 'day', 'week', 'month'

  -- Aggregated metrics
  total_readings INTEGER DEFAULT 0,
  total_cards_drawn INTEGER DEFAULT 0,

  -- By spread
  single_count INTEGER DEFAULT 0,
  three_card_count INTEGER DEFAULT 0,
  five_card_count INTEGER DEFAULT 0,
  decision_count INTEGER DEFAULT 0,
  relationship_count INTEGER DEFAULT 0,
  celtic_count INTEGER DEFAULT 0,

  -- By provider
  claude_count INTEGER DEFAULT 0,
  local_count INTEGER DEFAULT 0,

  -- Card frequencies (JSON blob)
  card_frequency_json TEXT,                -- JSON: {"The Fool": 42, "Ace of Wands": 31, ...}

  updated_at INTEGER NOT NULL              -- Last updated timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_stats_period
  ON reading_stats(period_start, period_type);

-- ============================================================================
-- User Preferences Table (Future)
-- ============================================================================
-- Optional: Store user preferences keyed by anonymous session ID
-- Uncomment when implementing user preference persistence
--
-- CREATE TABLE IF NOT EXISTS user_preferences (
--   session_id TEXT PRIMARY KEY,            -- Anonymous session identifier
--   created_at INTEGER NOT NULL,
--   updated_at INTEGER NOT NULL,
--
--   -- Preferences
--   audio_enabled INTEGER DEFAULT 1,
--   voice_enabled INTEGER DEFAULT 0,
--   theme TEXT DEFAULT 'dark',
--
--   -- Privacy
--   analytics_consent INTEGER DEFAULT 0,
--
--   -- Metadata
--   last_seen_at INTEGER
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_user_prefs_last_seen
--   ON user_preferences(last_seen_at);

-- ============================================================================
-- Migration Complete
-- ============================================================================
