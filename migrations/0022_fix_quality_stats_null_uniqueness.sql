-- Migration: Fix quality_stats NULL uniqueness issue
-- SQLite treats NULL != NULL in UNIQUE constraints, allowing duplicate rows
-- when nullable dimension columns are NULL. This migration:
-- 1. Removes duplicates (keeping the most recent row per dimension set)
-- 2. Drops the broken UNIQUE constraint
-- 3. Creates a new unique index using COALESCE to treat NULLs as empty strings

-- Step 1: Remove duplicate rows, keeping only the most recent per dimension set
DELETE FROM quality_stats
WHERE id NOT IN (
  SELECT MAX(id)
  FROM quality_stats
  GROUP BY
    period_type,
    period_key,
    COALESCE(reading_prompt_version, ''),
    COALESCE(eval_prompt_version, ''),
    COALESCE(variant_id, ''),
    COALESCE(provider, ''),
    COALESCE(spread_key, '')
);

-- Step 2: Drop the old broken unique index (SQLite requires recreating the table
-- to remove a table-level constraint, but we can just add a new index that
-- the application will rely on instead)

-- Step 3: Create a new unique index that properly handles NULLs
-- Using COALESCE to convert NULLs to empty strings for uniqueness comparison
CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_stats_dimensions_unique
ON quality_stats (
  period_type,
  period_key,
  COALESCE(reading_prompt_version, ''),
  COALESCE(eval_prompt_version, ''),
  COALESCE(variant_id, ''),
  COALESCE(provider, ''),
  COALESCE(spread_key, '')
);
