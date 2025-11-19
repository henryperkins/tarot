-- ============================================================================
-- API Keys and Rate Limiting
-- ============================================================================
-- Migration: 0004
-- Description: Add API keys for programmatic access
-- Created: 2025-11-19
--

-- ============================================================================
-- API Keys Table
-- ============================================================================
-- Stores API keys for programmatic access
--
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,                     -- UUID
  user_id TEXT NOT NULL,                   -- Foreign key to users.id
  key_hash TEXT NOT NULL UNIQUE,           -- Hashed API key (SHA-256)
  key_prefix TEXT NOT NULL,                -- First 8 chars for identification
  name TEXT NOT NULL,                      -- User-provided name for the key
  created_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  expires_at INTEGER,                      -- Optional expiration (seconds)
  last_used_at INTEGER,                    -- Unix timestamp (seconds)
  is_active INTEGER NOT NULL DEFAULT 1,    -- Boolean

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
  ON api_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
  ON api_keys(key_hash);
