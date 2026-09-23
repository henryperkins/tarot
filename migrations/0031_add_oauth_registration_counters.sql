-- Migration: 0031_add_oauth_registration_counters
-- Atomic DCR admission, keyed by privacy-preserving address hash and UTC hour.
CREATE TABLE IF NOT EXISTS oauth_registration_counters (
  client_key TEXT NOT NULL,
  window_start_hour INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 10),
  PRIMARY KEY (client_key, window_start_hour)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_oauth_registration_counters_hour
  ON oauth_registration_counters(window_start_hour);
