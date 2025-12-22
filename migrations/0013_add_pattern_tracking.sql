-- Migration: 0013_add_pattern_tracking
-- Purpose: Track recurring archetypal patterns (triads, dyads) across readings.

CREATE TABLE IF NOT EXISTS pattern_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,           -- 'triad', 'dyad', 'progression'
  pattern_id TEXT NOT NULL,             -- e.g., 'death-temperance-star'
  entry_id TEXT NOT NULL,
  year_month TEXT NOT NULL,             -- YYYY-MM
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pattern_user_type 
  ON pattern_occurrences(user_id, pattern_type, pattern_id);

CREATE INDEX IF NOT EXISTS idx_pattern_year_month 
  ON pattern_occurrences(user_id, year_month);
