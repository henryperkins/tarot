-- ============================================================================
-- Mystic Tarot - Collaborative Share Links
-- ============================================================================
-- Migration: 0003
-- Description: Share tokens, entry linkage, and collaborative notes
-- Created: 2025-11-18
--

CREATE TABLE IF NOT EXISTS share_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('entry', 'journal')),
  title TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_user
  ON share_tokens(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS share_token_entries (
  token TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (token, entry_id),
  FOREIGN KEY (token) REFERENCES share_tokens(token) ON DELETE CASCADE,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS share_notes (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  author_name TEXT,
  body TEXT NOT NULL,
  card_position TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (token) REFERENCES share_tokens(token) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_notes_token
  ON share_notes(token, created_at ASC);

-- ============================================================================
-- Migration Complete
-- ============================================================================
