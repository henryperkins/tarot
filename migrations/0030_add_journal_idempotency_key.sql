-- Migration: 0030_add_journal_idempotency_key
-- Purpose: Atomic reading identity for journal saves from the ChatGPT MCP tools.
--
-- MCP saves set idempotency_key = 'reading:<requestId>'. The partial unique
-- index makes "is this reading already saved?" a constraint, not a
-- lookup-then-insert race (idx_journal_request_id is not unique). App saves
-- never set the column, and existing rows stay NULL, so the index builds on
-- any existing data.

ALTER TABLE journal_entries ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_user_idempotency_key_unique
  ON journal_entries(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
