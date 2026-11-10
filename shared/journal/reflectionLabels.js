/**
 * Display labels for a journal entry's reflections map.
 *
 * Reflections are stored as a flat string map. Card notes are keyed by the
 * card's index in the entry ("0", "1", ...). A note on the whole reading
 * uses the reserved key "Overall". Keys that predate that scheme are shown
 * as-is. Shared by the journal UI and the text/PDF export.
 */

export const READING_REFLECTION_KEY = 'Overall';
export const READING_REFLECTION_LABEL = 'Whole reading';
// One saved note (or one edit) is at most this long; appended notes on the
// same target are joined by a blank line.
export const MAX_REFLECTION_LENGTH = 2000;
export const REFLECTION_NOTE_SEPARATOR = '\n\n';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function labelForCard(card, index) {
  const position = cleanText(card?.position);
  const name = cleanText(card?.displayName) || cleanText(card?.name) || cleanText(card?.card);
  if (position && name) return `${position} · ${name}`;
  return position || name || `Card ${index + 1}`;
}

function isReflectionMap(reflections) {
  return Boolean(reflections) && typeof reflections === 'object' && !Array.isArray(reflections);
}

/**
 * The notes on an entry, with the key each one is stored under.
 *
 * @param {Record<string, string>|null|undefined} reflections
 * @param {Array<object>} [cards] - The entry's cards, in spread order
 * @returns {Array<{ key: string, label: string, note: string, cardIndex: number|null, editable: boolean }>}
 *   Whole reading first, then cards in spread order, then any other keys.
 *   Keys that predate the index scheme are not `editable`.
 */
export function buildReflectionItems(reflections, cards = []) {
  if (!isReflectionMap(reflections)) return [];
  const safeCards = Array.isArray(cards) ? cards : [];

  const readingNotes = [];
  const cardNotes = [];
  const otherNotes = [];
  for (const [key, note] of Object.entries(reflections)) {
    if (typeof note !== 'string' || !note.trim()) continue;
    if (key === READING_REFLECTION_KEY) {
      readingNotes.push({ key, label: READING_REFLECTION_LABEL, note, cardIndex: null, editable: true });
    } else if (/^\d+$/.test(key)) {
      const index = Number(key);
      cardNotes.push({ key, label: labelForCard(safeCards[index], index), note, cardIndex: index, editable: index < safeCards.length });
    } else {
      otherNotes.push({ key, label: key, note, cardIndex: null, editable: false });
    }
  }
  cardNotes.sort((a, b) => a.cardIndex - b.cardIndex);
  return [...readingNotes, ...cardNotes, ...otherNotes];
}

/**
 * @param {Record<string, string>|null|undefined} reflections
 * @param {Array<object>} [cards] - The entry's cards, in spread order
 * @returns {Array<[string, string]>} [label, note] pairs: whole reading first,
 *   then cards in spread order, then any other keys
 */
export function buildReflectionEntries(reflections, cards = []) {
  return buildReflectionItems(reflections, cards).map(({ label, note }) => [label, note]);
}

/**
 * Where a new note can go: the whole reading, then each card.
 * @returns {Array<{ key: string, label: string, cardIndex: number|null }>}
 */
export function buildReflectionTargets(cards = []) {
  const safeCards = Array.isArray(cards) ? cards : [];
  return [
    { key: READING_REFLECTION_KEY, label: READING_REFLECTION_LABEL, cardIndex: null },
    ...safeCards.map((card, index) => ({ key: String(index), label: labelForCard(card, index), cardIndex: index }))
  ];
}

/**
 * Apply one edit to a reflections map without mutating it, as the journal
 * reflections endpoint does: append joins with a blank line, replace
 * overwrites, remove deletes the key.
 *
 * @param {Record<string, string>|null|undefined} reflections
 * @param {{ key: string, text?: string, mode: 'append'|'replace'|'remove' }} edit
 * @returns {Record<string, string>}
 */
export function applyReflectionEdit(reflections, { key, text = '', mode }) {
  const next = isReflectionMap(reflections) ? { ...reflections } : {};
  if (mode === 'remove') {
    delete next[key];
    return next;
  }
  const existing = typeof next[key] === 'string' ? next[key] : '';
  next[key] = mode === 'append' && existing ? `${existing}${REFLECTION_NOTE_SEPARATOR}${text}` : text;
  return next;
}
