CREATE TABLE local_admin_access (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_ends INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE local_admin_sessions (
  digest TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
