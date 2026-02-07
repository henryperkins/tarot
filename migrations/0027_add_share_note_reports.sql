-- ==========================================================================
-- Mystic Tarot - Share Note Reports
-- ==========================================================================
-- Migration: 0027
-- Description: Store moderation reports for collaborative share notes
-- Created: 2026-02-07
--

CREATE TABLE IF NOT EXISTS share_note_reports (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  token TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES share_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (token) REFERENCES share_tokens(token) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_note_reports_note
  ON share_note_reports(note_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_note_reports_token
  ON share_note_reports(token, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_share_note_reports_note_reporter
  ON share_note_reports(note_id, reporter_id);

-- ==========================================================================
-- Migration Complete
-- ==========================================================================
