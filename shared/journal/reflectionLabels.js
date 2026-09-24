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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function labelForCard(card, index) {
  const position = cleanText(card?.position);
  const name = cleanText(card?.displayName) || cleanText(card?.name) || cleanText(card?.card);
  if (position && name) return `${position} · ${name}`;
  return position || name || `Card ${index + 1}`;
}

/**
 * @param {Record<string, string>|null|undefined} reflections
 * @param {Array<object>} [cards] - The entry's cards, in spread order
 * @returns {Array<[string, string]>} [label, note] pairs: whole reading first,
 *   then cards in spread order, then any other keys
 */
export function buildReflectionEntries(reflections, cards = []) {
  if (!reflections || typeof reflections !== 'object' || Array.isArray(reflections)) return [];
  const safeCards = Array.isArray(cards) ? cards : [];

  const readingNotes = [];
  const cardNotes = [];
  const otherNotes = [];
  for (const [key, note] of Object.entries(reflections)) {
    if (typeof note !== 'string' || !note.trim()) continue;
    if (key === READING_REFLECTION_KEY) {
      readingNotes.push([READING_REFLECTION_LABEL, note]);
    } else if (/^\d+$/.test(key)) {
      const index = Number(key);
      cardNotes.push({ index, entry: [labelForCard(safeCards[index], index), note] });
    } else {
      otherNotes.push([key, note]);
    }
  }
  cardNotes.sort((a, b) => a.index - b.index);
  return [...readingNotes, ...cardNotes.map(({ entry }) => entry), ...otherNotes];
}
