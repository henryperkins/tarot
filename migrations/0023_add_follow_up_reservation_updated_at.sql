-- Migration: 0023_add_follow_up_reservation_updated_at
-- Description: Add reservation_updated_at column for follow-up reservation TTL refresh
-- Date: 2026-02-05

ALTER TABLE follow_up_usage ADD COLUMN reservation_updated_at INTEGER;

-- Optional index to speed up reservation cleanup
CREATE INDEX IF NOT EXISTS idx_follow_up_reservation_updated
ON follow_up_usage(reservation_updated_at);
