-- Migration: 0039_add_user_preferences_json
-- Description: Account-level reader preferences, so a signed-in reader's
--   personalization choices and finished onboarding follow them to every
--   device. JSON written by PUT /api/account/preferences:
--     { v, personalization, explicitFields, onboardingCompletedAt, updatedAt }
--   personalization holds only the fields the reader chose (explicitFields).
--   NULL until the first save. Removed with the users row on account deletion.
-- Date: 2026-11-05
--
-- NOTE: This migration is NOT idempotent. SQLite does not support
-- "ADD COLUMN IF NOT EXISTS". The deploy script tracks applied migrations
-- in the _migrations table to prevent re-application.

ALTER TABLE users ADD COLUMN preferences_json TEXT;
