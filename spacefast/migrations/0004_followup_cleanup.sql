CREATE TRIGGER tableu_journal_followups_delete BEFORE DELETE ON journal_entries
FOR EACH ROW DELETE FROM journal_followups WHERE entry_id = OLD.id
