-- Migration 0016: Add optional location data to journal entries
-- Location is ONLY stored when user explicitly opts in via persistLocationToJournal consent flag
-- Privacy: coordinates are stripped from metrics/logs; only timezone is retained for analytics

ALTER TABLE journal_entries ADD COLUMN location_latitude REAL;
ALTER TABLE journal_entries ADD COLUMN location_longitude REAL;
ALTER TABLE journal_entries ADD COLUMN location_timezone TEXT;
ALTER TABLE journal_entries ADD COLUMN location_consent INTEGER DEFAULT 0;

-- Index for timezone-based queries (e.g., analytics by region)
CREATE INDEX IF NOT EXISTS idx_journal_location_timezone
  ON journal_entries(location_timezone)
  WHERE location_timezone IS NOT NULL;
