-- One completed narration of up to 64,000 characters uses one monthly unit.
CREATE TABLE narration_monthly_usage (
  identity TEXT NOT NULL,
  month TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  PRIMARY KEY (identity, month)
);
CREATE TABLE narration_requests (
  id TEXT PRIMARY KEY,
  identity TEXT NOT NULL,
  user_id TEXT,
  month TEXT NOT NULL,
  monthly_limit INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('reserved', 'settled', 'released')),
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (identity, month) REFERENCES narration_monthly_usage(identity, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX narration_one_active_identity ON narration_requests(identity) WHERE state = 'reserved';
CREATE INDEX narration_request_expiry ON narration_requests(state, expires_at);
CREATE TRIGGER narration_quota_guard BEFORE INSERT ON narration_requests
WHEN NEW.state = 'reserved'
BEGIN
  SELECT CASE WHEN NEW.monthly_limit >= 0 AND
    (SELECT used + reserved FROM narration_monthly_usage WHERE identity = NEW.identity AND month = NEW.month) >= NEW.monthly_limit
    THEN RAISE(ABORT, 'narration_monthly_limit') END;
END;
CREATE TRIGGER narration_reserve AFTER INSERT ON narration_requests
WHEN NEW.state = 'reserved'
BEGIN
  UPDATE narration_monthly_usage SET reserved = reserved + 1
  WHERE identity = NEW.identity AND month = NEW.month;
END;
CREATE TRIGGER narration_resolve AFTER UPDATE OF state ON narration_requests
WHEN OLD.state = 'reserved' AND NEW.state IN ('settled', 'released')
BEGIN
  UPDATE narration_monthly_usage SET reserved = reserved - 1,
    used = used + CASE WHEN NEW.state = 'settled' THEN 1 ELSE 0 END
  WHERE identity = NEW.identity AND month = NEW.month;
END;
CREATE TRIGGER narration_user_usage AFTER UPDATE OF state ON narration_requests
WHEN OLD.state = 'reserved' AND NEW.state = 'settled' AND NEW.user_id IS NOT NULL
BEGIN
  INSERT INTO usage_tracking (user_id, month, tts_count, created_at, updated_at)
  VALUES (NEW.user_id, NEW.month, 1, NEW.updated_at, NEW.updated_at)
  ON CONFLICT(user_id, month) DO UPDATE SET tts_count = tts_count + 1, updated_at = excluded.updated_at;
END;
CREATE TABLE narration_request_limits (
  identity TEXT NOT NULL,
  scope TEXT NOT NULL,
  window_key INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (identity, scope, window_key)
);
