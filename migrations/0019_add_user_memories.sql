-- Migration: 0019_add_user_memories
-- Description: Add persistent memory storage for follow-up chat personalization
-- Date: 2026-01-12

-- User memories table for cross-session personalization
CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Memory content
  text TEXT NOT NULL,                    -- Memory note text (max 200 chars enforced in code)
  keywords TEXT,                         -- Comma-separated keywords for retrieval
  category TEXT DEFAULT 'general',       -- theme, card_affinity, communication, life_context, general

  -- Scope and lifecycle
  scope TEXT DEFAULT 'global',           -- 'session' or 'global'
  session_id TEXT,                       -- Reading request ID if scope='session'

  -- Metadata
  source TEXT DEFAULT 'ai',              -- 'ai' (tool call), 'user' (manual), 'system'
  confidence REAL DEFAULT 1.0,           -- AI confidence (0.0-1.0)

  -- Timestamps (Unix seconds)
  created_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  expires_at INTEGER,                    -- Optional TTL for session memories

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for retrieving user memories by recency
CREATE INDEX IF NOT EXISTS idx_memories_user_recent
  ON user_memories(user_id, created_at DESC);

-- Index for scoped memory retrieval
CREATE INDEX IF NOT EXISTS idx_memories_user_scope
  ON user_memories(user_id, scope);

-- Index for session-specific memories
CREATE INDEX IF NOT EXISTS idx_memories_session
  ON user_memories(session_id)
  WHERE session_id IS NOT NULL;

-- Index for category-based retrieval
CREATE INDEX IF NOT EXISTS idx_memories_category
  ON user_memories(user_id, category);

-- Prevent duplicate memories (same text for same user in global scope)
CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_user_text_dedup
  ON user_memories(user_id, text)
  WHERE scope = 'global';
