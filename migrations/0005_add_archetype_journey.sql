-- ============================================================================
-- Mystic Tarot - Archetype Journey Analytics
-- ============================================================================
-- Migration: 0005
-- Description: Add card appearance tracking for gamified analytics
-- Created: 2025-11-20
--

-- ============================================================================
-- Card Appearances Table
-- ============================================================================
-- Tracks card occurrences per user for archetype journey analytics
-- Enables "Top 5 cards this month", streaks, trends, and badge achievements
--
CREATE TABLE IF NOT EXISTS card_appearances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                   -- Foreign key to users.id
  card_name TEXT NOT NULL,                 -- 'The Fool', 'Ace of Wands', etc.
  card_number INTEGER,                     -- Major Arcana: 0-21, Minor: 22-77, null if unknown
  year_month TEXT NOT NULL,                -- YYYY-MM format (e.g., '2025-11')
  count INTEGER NOT NULL DEFAULT 1,        -- Number of appearances in this month
  last_seen INTEGER NOT NULL,              -- Unix timestamp (seconds) of most recent appearance
  first_seen INTEGER NOT NULL,             -- Unix timestamp (seconds) of first appearance in this period

  -- Constraint: one row per user+card+month
  UNIQUE(user_id, card_name, year_month),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_card_appearances_user_month
  ON card_appearances(user_id, year_month DESC);

CREATE INDEX IF NOT EXISTS idx_card_appearances_card
  ON card_appearances(card_name);

-- ============================================================================
-- Archetype Badges Table
-- ============================================================================
-- Stores earned badges for streak achievements and milestones
--
CREATE TABLE IF NOT EXISTS archetype_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                   -- Foreign key to users.id
  badge_type TEXT NOT NULL,                -- 'streak', 'frequency', 'completion', etc.
  badge_key TEXT NOT NULL,                 -- Unique badge identifier (e.g., 'tower_3x_nov')
  card_name TEXT,                          -- Card associated with badge (if applicable)
  earned_at INTEGER NOT NULL,              -- Unix timestamp (seconds)
  metadata_json TEXT,                      -- JSON: { count: 3, month: '2025-11', context: 'Tower appeared 3x' }

  -- Constraint: one badge per user+key
  UNIQUE(user_id, badge_key),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for badge queries
CREATE INDEX IF NOT EXISTS idx_archetype_badges_user
  ON archetype_badges(user_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_archetype_badges_type
  ON archetype_badges(badge_type);

-- ============================================================================
-- User Analytics Preferences Table
-- ============================================================================
-- Stores user preferences for analytics features (opt-in/opt-out)
--
CREATE TABLE IF NOT EXISTS user_analytics_prefs (
  user_id TEXT PRIMARY KEY,                -- Foreign key to users.id
  archetype_journey_enabled INTEGER DEFAULT 1,  -- Boolean: opt-in for analytics
  show_badges INTEGER DEFAULT 1,           -- Boolean: show badge notifications
  updated_at INTEGER NOT NULL,             -- Unix timestamp (seconds)

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- Migration Complete
-- ============================================================================
