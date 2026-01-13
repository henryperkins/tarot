-- Migration: 0020_add_user_preferences
-- Description: Add user preference columns for personalization
-- Date: 2026-01-12
--
-- NOTE: This migration is NOT idempotent. SQLite does not support
-- "ADD COLUMN IF NOT EXISTS". The deploy script tracks applied migrations
-- in the _migrations table to prevent re-application. Do not run this
-- migration manually without checking _migrations first.

-- Add personalization preferences to users table
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN reading_tone TEXT DEFAULT 'balanced';
ALTER TABLE users ADD COLUMN spiritual_frame TEXT DEFAULT 'mixed';
ALTER TABLE users ADD COLUMN preferred_spread_depth TEXT DEFAULT 'standard';
