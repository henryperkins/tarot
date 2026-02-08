-- ==========================================================================
-- Mystic Tarot - User Media Library
-- ==========================================================================
-- Migration: 0028
-- Description: Persist generated story art and card reveal videos per user
-- Created: 2026-02-08
--

CREATE TABLE IF NOT EXISTS user_media (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  media_type TEXT NOT NULL,          -- 'image' | 'video'
  source TEXT NOT NULL,              -- 'story-art' | 'card-reveal'
  title TEXT,
  prompt_question TEXT,
  card_name TEXT,
  position_label TEXT,
  style_id TEXT,
  format_id TEXT,
  mime_type TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  storage_key TEXT NOT NULL,
  bytes INTEGER,
  metadata_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_media_user_created
  ON user_media(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_media_user_type_created
  ON user_media(user_id, media_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_media_user_storage
  ON user_media(user_id, storage_key);

-- ==========================================================================
-- Migration Complete
-- ==========================================================================
