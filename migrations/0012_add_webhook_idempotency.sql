-- Migration: 0012_add_webhook_idempotency
-- Purpose: Track processed webhook events to prevent duplicate handling
--
-- Stripe retries webhooks for up to 3 days on delivery failure.
-- The same event.id is sent on each retry. This table ensures we only
-- process each event once, preventing duplicate subscription updates.
--
-- Cleanup: Events older than 7 days can be safely deleted (Stripe stops
-- retrying after 3 days, so 7 days provides a safe buffer).

-- ============================================================================
-- Create processed_webhook_events table
-- ============================================================================
-- Tracks which webhook events have been successfully processed

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  provider TEXT NOT NULL,           -- 'stripe', 'google_play' (future)
  event_id TEXT NOT NULL,
  event_type TEXT,                  -- e.g., 'customer.subscription.updated'
  processed_at INTEGER NOT NULL,    -- Unix timestamp (ms)
  PRIMARY KEY (provider, event_id)
);

-- ============================================================================
-- Add index for cleanup queries
-- ============================================================================
-- Enables efficient deletion of old events during scheduled maintenance

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON processed_webhook_events(processed_at);

-- ============================================================================
-- Migration Complete
-- ============================================================================
