-- Operational AI safeguards, separate from advertised subscription allowances.
CREATE TABLE IF NOT EXISTS feature_usage (
  id TEXT PRIMARY KEY,
  identity_key TEXT NOT NULL,
  feature TEXT NOT NULL CHECK (feature IN ('vision', 'question', 'summary')),
  day_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('reserved', 'completed', 'released')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  settled_at INTEGER
);

-- One in-flight operation per identity/feature, including across UTC midnight.
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_usage_active
  ON feature_usage (identity_key, feature) WHERE state = 'reserved';
CREATE INDEX IF NOT EXISTS idx_feature_usage_day
  ON feature_usage (identity_key, feature, day_key, state);
CREATE INDEX IF NOT EXISTS idx_feature_usage_expiry
  ON feature_usage (expires_at) WHERE state = 'reserved';

CREATE INDEX IF NOT EXISTS idx_feature_usage_attempt_time
  ON feature_usage (identity_key, feature, created_at);
