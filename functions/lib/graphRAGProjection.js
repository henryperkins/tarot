import { getPassageSource, PASSAGE_SOURCE_DECKS } from '../../shared/passageSource.js';
import { DECK_CATALOG } from '../../shared/vision/deckCatalog.js';
import { getPassagesForPattern } from './knowledgeBase.js';

/** Keep the authored display quotation separate from safe generation evidence. */
export function projectPassageForDeck(passage, deckStyle = 'rws-1909') {
  if (!passage || typeof passage !== 'object' || !Object.hasOwn(DECK_CATALOG, deckStyle)
    || !Object.hasOwn(PASSAGE_SOURCE_DECKS, passage.type)
    || typeof passage.text !== 'string' || !passage.text.trim()) return null;
  const source = getPassageSource(passage);
  if (!source) return null;
  const crossDeckReference = source.deckStyle !== deckStyle;
  let archetypalText = typeof passage.archetypalText === 'string' ? passage.archetypalText.trim() : '';
  if (!archetypalText && passage.patternId !== undefined) {
    // Resolve only exact historical canon quotations, never infer a projection
    // for arbitrary prose from its title or claimed pattern identity.
    const original = getPassagesForPattern(passage.type, passage.patternId)?.passages?.find((entry) => entry.text === passage.text);
    archetypalText = original?.archetypalText || '';
  }
  if (crossDeckReference && !archetypalText) return null;
  const passageContext = passage.context || 'general';
  return {
    ...passage,
    source: 'Tableu Tarot Canon',
    sourceDeck: source.deckStyle,
    archetypalText,
    candidateId: JSON.stringify([passage.type, passage.patternId ?? null, passageContext, source.deckStyle]),
    patternKey: JSON.stringify([passage.type, passage.patternId ?? null, source.deckStyle]),
    promptText: crossDeckReference ? archetypalText : passage.text,
    promptVisualAnchors: crossDeckReference ? [] : (Array.isArray(passage.visualAnchors) ? [...passage.visualAnchors] : []),
    crossDeckReference,
    projectedDeck: deckStyle
  };
}
