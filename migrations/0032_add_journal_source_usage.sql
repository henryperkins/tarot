-- Attribution snapshot for the saved narrative. Older readings stay unknown.
ALTER TABLE journal_entries ADD COLUMN source_usage_json TEXT;
