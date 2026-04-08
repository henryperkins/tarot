-- Migration: 0029_add_journal_followups_canonical_answer
-- Description: Preserve canonical follow-up text for backend conversation history reuse
-- Date: 2026-04-08

ALTER TABLE journal_followups
ADD COLUMN canonical_answer TEXT;
