-- =========================================================================
-- Mystic Tarot - Subscription Metadata
-- =========================================================================
-- Migration: 0008
-- Description: Add subscription-related columns to users table
-- Created: 2025-12-05
--
-- This migration extends the existing `users` table (created in 0002) with
-- fields needed for subscription and entitlement management. It is designed
-- to be backwards-compatible with existing data: all existing users default
-- to the "free" tier until upgraded via Stripe or Google Play.
-- =========================================================================

-- Add subscription-related columns to the users table
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_provider TEXT; -- 'stripe', 'google_play', 'api_key', etc.
ALTER TABLE users ADD COLUMN subscription_status TEXT;   -- 'active', 'canceled', 'past_due', 'incomplete', etc.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;     -- Stripe customer identifier (cus_...)

-- Create an index for the Stripe customer ID (enforced unique per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON users(stripe_customer_id);

-- =========================================================================
-- Migration Complete
-- =========================================================================

