-- Durable saved-source outcomes and one-source replay claims. No provider rollout.
-- Claims intentionally survive parent deletion: deleting an entry cannot reset allowance.
CREATE TABLE IF NOT EXISTS visual_retry_claims (
  id TEXT PRIMARY KEY,
  admission_scope TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  user_id TEXT,
  journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  reading_result_id TEXT,
  attempt_id TEXT,
  visual_job_id TEXT,
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version >= 1),
  dispatch_status TEXT NOT NULL DEFAULT 'prepared' CHECK (dispatch_status IN ('prepared', 'reserved', 'settled', 'revoked')),
  retry_status TEXT NOT NULL DEFAULT 'unavailable' CHECK (retry_status IN ('available', 'pending', 'complete', 'exhausted', 'unavailable', 'revoked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (admission_scope, source_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_visual_retry_claims_owner ON visual_retry_claims(user_id);
CREATE TABLE IF NOT EXISTS journal_visual_state (
  journal_entry_id TEXT PRIMARY KEY REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  source_fingerprint TEXT NOT NULL,
  reading_result_id TEXT,
  attachment_status TEXT NOT NULL CHECK (attachment_status IN ('missing', 'pending', 'attached', 'failed', 'expired')),
  retry_status TEXT NOT NULL DEFAULT 'unavailable' CHECK (retry_status IN ('available', 'pending', 'complete', 'exhausted', 'unavailable', 'revoked')),
  reason TEXT,
  validated_snapshot_json TEXT,
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version >= 1),
  claim_id TEXT REFERENCES visual_retry_claims(id),
  attempt_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_visual_state_owner ON journal_visual_state(user_id);
-- Tombstone closes account cleanup/late registration races before users is removed.
CREATE TABLE IF NOT EXISTS visual_owner_revocations (
  user_id TEXT PRIMARY KEY,
  revoked_at INTEGER NOT NULL
);
-- Transport/attempt fencing is private; never project these columns into public state.
ALTER TABLE reading_visual_results ADD COLUMN active_attempt_id TEXT;
ALTER TABLE reading_visual_results ADD COLUMN active_state_version INTEGER;
ALTER TABLE reading_visual_results ADD COLUMN saved_source_fingerprint TEXT;
ALTER TABLE reading_visual_results ADD COLUMN saved_entry_id TEXT;
-- Actual journal deletion only. Ordinary expiry never writes this tombstone.
CREATE TABLE IF NOT EXISTS visual_result_revocations (
  reading_result_id TEXT PRIMARY KEY,
  user_id TEXT,
  revoked_at INTEGER NOT NULL
);
-- Replay-owned immutable admission/source and durable inference reservations.
ALTER TABLE visual_retry_claims ADD COLUMN aggregate_scope TEXT;
ALTER TABLE visual_retry_claims ADD COLUMN source_json TEXT;
ALTER TABLE visual_retry_claims ADD COLUMN saved_fields_json TEXT;
ALTER TABLE visual_retry_claims ADD COLUMN journal_state_version INTEGER;
ALTER TABLE visual_retry_claims ADD COLUMN binding_json TEXT;
ALTER TABLE visual_retry_claims ADD COLUMN visual_token TEXT;
ALTER TABLE visual_retry_claims ADD COLUMN expires_at INTEGER;
ALTER TABLE visual_retry_claims ADD COLUMN reserved_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_visual_retry_claims_admission ON visual_retry_claims(aggregate_scope, reserved_at);
CREATE TABLE IF NOT EXISTS visual_guest_principals (
  token_hash TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL UNIQUE,
  aggregate_scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
