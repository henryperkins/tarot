-- ============================================================================
-- Mystic Tarot - Authentication and Journal Persistence
-- ============================================================================
-- Migration: 0002
-- Description: Add user authentication and journal entry persistence
-- Created: 2025-11-15
--

-- ============================================================================
-- Users Table
-- ============================================================================
-- Stores user accounts for authenticated journal access
--
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                     -- UUID
  email TEXT UNIQUE NOT NULL,              -- User email (for login)
  username TEXT UNIQUE NOT NULL,           -- Display name
  password_hash TEXT NOT NULL,             -- PBKDF2 derived hash
  password_salt TEXT NOT NULL,             -- Hex-encoded salt for PBKDF2
  created_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  updated_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  last_login_at INTEGER,                   -- Unix timestamp (seconds)

  -- Metadata
  is_active INTEGER NOT NULL DEFAULT 1,    -- Boolean: account active status
  email_verified INTEGER DEFAULT 0         -- Boolean: email verification status (future)
);

-- Indexes for auth queries
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_username
  ON users(username);

-- ============================================================================
-- Sessions Table
-- ============================================================================
-- Stores active user sessions with token-based authentication
--
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                     -- Session token (32-byte random)
  user_id TEXT NOT NULL,                   -- Foreign key to users.id
  created_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  expires_at INTEGER NOT NULL,             -- Unix timestamp (seconds) - 30 days from creation
  last_used_at INTEGER NOT NULL,           -- Unix timestamp (seconds)

  -- Session metadata
  user_agent TEXT,                         -- Browser/device info
  ip_address TEXT,                         -- Client IP (privacy-preserving)

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

-- ============================================================================
-- Journal Entries Table
-- ============================================================================
-- Stores tarot reading journal entries for authenticated users
-- Replaces localStorage for persistent, cross-device access
--
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,                     -- UUID
  user_id TEXT NOT NULL,                   -- Foreign key to users.id
  created_at INTEGER NOT NULL,             -- Unix timestamp (seconds)
  updated_at INTEGER NOT NULL,             -- Unix timestamp (seconds)

  -- Reading metadata
  spread_key TEXT NOT NULL,                -- 'single', 'threeCard', 'celtic', etc.
  spread_name TEXT NOT NULL,               -- Human-readable spread name
  question TEXT,                           -- User's question

  -- Reading data (stored as JSON for flexibility)
  cards_json TEXT NOT NULL,                -- JSON array: [{ position, name, orientation, ... }]
  narrative TEXT,                          -- Generated reading text
  themes_json TEXT,                        -- JSON: { suitFocus, elementalBalance, timingProfile, etc. }
  reflections_json TEXT,                   -- JSON object: { "0": "my note", "1": "another note" }
  context TEXT,                            -- Reading context: 'love', 'career', 'self', 'spiritual'

  -- Metadata
  provider TEXT,                           -- 'azure-gpt5', 'local', etc.
  session_seed TEXT,                       -- Ritual seed (for reproducibility)

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for journal queries
CREATE INDEX IF NOT EXISTS idx_journal_user_created
  ON journal_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_spread_key
  ON journal_entries(spread_key);

CREATE INDEX IF NOT EXISTS idx_journal_created_at
  ON journal_entries(created_at DESC);

-- ============================================================================
-- Migration Complete
-- ============================================================================
