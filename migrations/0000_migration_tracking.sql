-- Migration: 0000_migration_tracking
-- Purpose: Track which migrations have been applied to prevent re-application
--
-- This table is used by the deployment script to ensure migrations are only
-- applied once. It must be the first migration (0000) to bootstrap the system.
--
-- Note: This migration is idempotent and can be safely re-run.

-- ============================================================================
-- Create migration tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL,
  checksum TEXT
);

-- ============================================================================
-- Migration Complete
-- ============================================================================
