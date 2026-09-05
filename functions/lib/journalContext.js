// Journal context is the reading taxonomy, not a free-form question or prompt.
const JOURNAL_CONTEXTS = new Set([
  'love', 'career', 'self', 'spiritual', 'wellbeing', 'decision', 'general'
]);

export function normalizeJournalContext(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  // Older journal entries and imports also use the relationship label.
  if (key === 'relationship' || key === 'relationships') return 'love';
  return JOURNAL_CONTEXTS.has(key) ? key : null;
}
