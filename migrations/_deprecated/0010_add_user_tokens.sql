-- Deprecated: superseded by 0024_add_user_tokens
-- Purpose: Add token storage for email verification and password resets
-- Notes:
-- - Tokens are stored as SHA-256 hashes (never plain text)
-- - Supports both verification and password reset flows with expirations

-- ============================================================================
-- User Tokens Table
-- ============================================================================
-- Stores hashed, time-bound tokens for auth flows.
-- token_hash is unique to prevent reuse and allow constant-time lookup.

CREATE TABLE IF NOT EXISTS user_tokens (
  id TEXT PRIMARY KEY,                     -- UUID for auditability
  user_id TEXT NOT NULL,                   -- Foreign key to users.id
  token_hash TEXT NOT NULL,                -- SHA-256 hash of the token
  type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset')),
  created_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  expires_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  used_at INTEGER,                         -- Unix timestamp (seconds)
  metadata TEXT,                           -- Optional JSON metadata
  ip_address TEXT,                         -- Request IP (for abuse forensics)
  user_agent TEXT,                         -- Request UA

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fast lookup by token hash (unique) and user/type for cleanup
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tokens_hash
  ON user_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_type
  ON user_tokens(user_id, type);

CREATE INDEX IF NOT EXISTS idx_user_tokens_expires_at
  ON user_tokens(expires_at);

-- ============================================================================
-- Migration Complete
-- ============================================================================
