-- ============================================================================
-- Tableu - OAuth identity support (Auth0, Google, Apple)
-- ============================================================================
-- Migration: 0025
-- Description: Add provider identities + optional profile fields for social login
-- Created: 2026-02-01
--

-- Add optional profile fields for OAuth identities
ALTER TABLE users ADD COLUMN auth_provider TEXT;   -- e.g., 'auth0', 'google', 'apple', 'email'
ALTER TABLE users ADD COLUMN auth_subject TEXT;    -- provider user id (sub)
ALTER TABLE users ADD COLUMN full_name TEXT;       -- display name from provider
ALTER TABLE users ADD COLUMN avatar_url TEXT;      -- profile image URL

-- Helpful indexes for provider lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_provider_subject
  ON users(auth_provider, auth_subject);
