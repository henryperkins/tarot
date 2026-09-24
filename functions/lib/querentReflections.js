/**
 * Querent reflections for one reading request.
 *
 * `reflectionsText` holds notes that are not tied to a card; each card's own
 * reflection lives on `cardsInfo[i].userReflection`. The prompt renders the two
 * separately, so neither field repeats the other. Checks that need everything
 * the querent wrote (crisis signals, context and language detection, the eval
 * gate policy, log redaction, the local composer) read the combined text below.
 */

function normalizeForComparison(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Combine general notes with each card's reflection, one "Position: text" line
 * per card. A card reflection the notes already contain (older clients sent
 * them there too) is not repeated.
 *
 * @param {string} reflectionsText - Notes not tied to a card
 * @param {Array<{position?: string, userReflection?: string|null}>} cardsInfo - Drawn cards
 * @returns {string} Everything the querent wrote, or '' when there is nothing
 */
export function collectQuerentReflections(reflectionsText, cardsInfo = []) {
  const notes = typeof reflectionsText === 'string' ? reflectionsText.trim() : '';
  const normalizedNotes = normalizeForComparison(notes);

  const cardLines = (Array.isArray(cardsInfo) ? cardsInfo : [])
    .map((card, index) => {
      const reflection = typeof card?.userReflection === 'string' ? card.userReflection.trim() : '';
      if (!reflection) return '';
      if (normalizedNotes && normalizedNotes.includes(normalizeForComparison(reflection))) return '';
      return `${card?.position || `Position ${index + 1}`}: ${reflection}`;
    })
    .filter(Boolean);

  return [notes, ...cardLines].filter(Boolean).join('\n');
}
