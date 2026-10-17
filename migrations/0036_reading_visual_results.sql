-- Migration: 0036_reading_visual_results
-- Description: Durable persistence for independent visual cue ledgers and journal links
-- Date: 2026-10-09

CREATE TABLE IF NOT EXISTS reading_visual_results (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  binding_json TEXT NOT NULL,
  source_revision INTEGER NOT NULL DEFAULT 0,
  raw_hash TEXT NOT NULL,
  final_raw TEXT,
  observed_raw TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  ledger_revision INTEGER NOT NULL DEFAULT 0,
  ledger_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reading_visual_results_user
  ON reading_visual_results(user_id, updated_at);

CREATE TABLE IF NOT EXISTS journal_visual_links (
  journal_entry_id TEXT PRIMARY KEY,
  reading_result_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expected_raw_hash TEXT NOT NULL,
  archived_visual_json TEXT,
  source_revision INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (reading_result_id) REFERENCES reading_visual_results(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_journal_visual_links_result
  ON journal_visual_links(reading_result_id);

CREATE INDEX IF NOT EXISTS idx_journal_visual_links_user
  ON journal_visual_links(user_id);
