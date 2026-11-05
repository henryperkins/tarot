// Words and arithmetic for the optional ritual on the reading table (see
// components/scenes/TableDeck.jsx), kept free of React so they can be checked
// directly in tests/tableRitual.test.mjs.

export const KNOCKS_NEEDED = 3;
const FULL_DECK = 78;
const KNOCKED = ['', 'Knocked once', 'Knocked twice', 'Knocked three times'];

function knocksMade(knockCount) {
  const count = Number.isFinite(knockCount) ? Math.floor(knockCount) : 0;
  return Math.min(KNOCKS_NEEDED, Math.max(0, count));
}

/** The deck face's name: the knock it will make, or that all three are made. */
export function knockLabel(knockCount) {
  const count = knocksMade(knockCount);
  return count >= KNOCKS_NEEDED
    ? 'Knocked three times'
    : `Knock on the deck, ${count + 1} of ${KNOCKS_NEEDED}`;
}

/** A cut falls after the first card and before the last. */
export function cutRange(deckSize) {
  const size = Number.isInteger(deckSize) && deckSize > 1 ? deckSize : FULL_DECK;
  return { min: 1, max: size - 1, size };
}

export function clampCut(value, deckSize) {
  const { min, max, size } = cutRange(deckSize);
  if (!Number.isFinite(value)) return Math.floor(size / 2);
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** The cut a pointer at `clientX` names along an edge drawn across `rect`. */
export function cutAtPosition(clientX, rect, deckSize) {
  const { size } = cutRange(deckSize);
  if (!rect || !(rect.width > 0) || !Number.isFinite(clientX)) return clampCut(NaN, size);
  return clampCut(((clientX - rect.left) / rect.width) * size, size);
}

/** The value a screen reader speaks for the cut edge. */
export function cutValueText(cutIndex, deckSize) {
  const { size } = cutRange(deckSize);
  return `Card ${clampCut(cutIndex, size)} of ${size}`;
}

/** What the table's status line says about the ritual so far. */
export function ritualStatus({ knockCount = 0, hasCut = false, cutIndex, deckSize } = {}) {
  const { size } = cutRange(deckSize);
  const parts = [];
  const knocks = knocksMade(knockCount);
  if (knocks > 0) parts.push(KNOCKED[knocks]);
  if (hasCut) parts.push(`Cut at card ${clampCut(cutIndex, size)} of ${size}`);
  return parts.length ? `${parts.join('. ')}.` : '';
}
