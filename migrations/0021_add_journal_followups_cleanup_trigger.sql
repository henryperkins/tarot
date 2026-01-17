-- Migration: 0021_add_journal_followups_cleanup_trigger
-- Description: Ensure journal follow-up rows are removed when parent entries are deleted
-- Date: 2026-01-17

-- Remove any prior version of the cleanup trigger
DROP TRIGGER IF EXISTS trg_journal_followups_delete;

-- Cascade deletes from journal_entries to journal_followups to avoid orphaned rows
CREATE TRIGGER IF NOT EXISTS trg_journal_followups_delete
AFTER DELETE ON journal_entries
FOR EACH ROW
BEGIN
  DELETE FROM journal_followups WHERE entry_id = OLD.id;
END;
