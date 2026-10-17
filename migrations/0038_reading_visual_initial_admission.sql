-- Original visual jobs have dedicated explicit admission, independent of replay.
-- Reservations survive source/account deletion and uncertain provider outcomes.
CREATE TABLE IF NOT EXISTS visual_initial_admissions (
  reading_result_id TEXT PRIMARY KEY,
  user_id TEXT,
  aggregate_scope TEXT NOT NULL,
  binding_json TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visual_initial_admissions_owner
  ON visual_initial_admissions(user_id);

CREATE TABLE IF NOT EXISTS visual_initial_reservations (
  dispatch_id TEXT PRIMARY KEY,
  reading_result_id TEXT,
  aggregate_scope TEXT NOT NULL,
  reserved_cost_microusd INTEGER NOT NULL CHECK (reserved_cost_microusd > 0),
  reserved_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visual_initial_reservations_scope
  ON visual_initial_reservations(aggregate_scope, reserved_at);
