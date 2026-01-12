-- Migration: 0018_add_journal_followups
-- Description: Store follow-up conversations alongside journal entries
-- Date: 2026-02-05

CREATE TABLE IF NOT EXISTS journal_followups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  reading_request_id TEXT,
  request_id TEXT,
  turn_number INTEGER,
  question TEXT,
  answer TEXT,
  journal_context_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id)
);

-- Quickly fetch follow-ups per entry
CREATE INDEX IF NOT EXISTS idx_journal_followups_entry
ON journal_followups(entry_id, created_at);

-- Link follow-ups back to reading + ownership
CREATE INDEX IF NOT EXISTS idx_journal_followups_user
ON journal_followups(user_id, reading_request_id);

-- Prevent duplicate turn numbers per entry (best-effort; uses NULL-safe match)
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_followups_entry_turn
ON journal_followups(entry_id, turn_number);
