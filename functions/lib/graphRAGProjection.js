import { getPassageSource, PASSAGE_SOURCE_DECKS } from '../../shared/passageSource.js';
import { DECK_CATALOG } from '../../shared/vision/deckCatalog.js';
import { getDeckAlias, getDeckSuitAlias } from '../../shared/vision/deckAssets.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { ARCHETYPAL_TRIADS } from '../../src/data/knowledgeGraphData.js';
import { getPassagesForPattern } from './knowledgeBase.js';
import { PARTIAL_PATTERN_PROJECTIONS, PARTIAL_PROJECTION_VERSION } from './knowledgeBasePartialProjections.js';
import { bindMinorPassageToCards, projectMinorPatternReference, minorMemberNames } from './minorPatternReferences.js';

/** Identity alone never authorizes prose. Rebuild all editorial fields from the registry. */
function resolveRegistryPassage(passage) {
  if (!passage || typeof passage !== 'object' || !Object.hasOwn(PASSAGE_SOURCE_DECKS, passage.type) || passage.patternId === undefined) return null;
  const entry = getPassagesForPattern(passage.type, passage.patternId);
  const authoredText = passage.authoredDisplayText ?? passage.text;
  const original = entry?.passages?.find(row => row.text === authoredText
    && (row.context || 'general') === (passage.authoredContext || passage.context || 'general')
    && (!passage.sourceId || passage.sourceId === row.sourceId));
  if (!original) return null;
  const sourceDeck = original.sourceDeck || PASSAGE_SOURCE_DECKS[passage.type];
  if (passage.sourceDeck && passage.sourceDeck !== sourceDeck) return null;
  return { entry, original, sourceDeck };
}

/** Project the matched subset before deck adaptation or relevance scoring. */
export function projectPassageForPattern(passage, { isComplete = !passage?.isPartialPattern, matchedCards = passage?.matchedCards, missingCards = passage?.missingCards } = {}) {
  const verified = resolveRegistryPassage(passage);
  if (!verified) return null;
  const { entry, original, sourceDeck } = verified;
  const base = { ...passage, ...original, type: passage.type, patternId: String(passage.patternId), title: entry.title, theme: entry.theme, sourceDeck,
    source: original.source, sourceId: original.sourceId, sourceUrl: original.sourceUrl || null, sourceUrls: original.sourceUrls || [], provenance: original.provenance || null,
    archetypalText: original.archetypalText || '', visualAnchors: original.visualAnchors || [], tags: original.tags || [], isEnriched: original.isEnriched === true,
    authoredDisplayText: original.text, authoredContext: original.context || 'general', projectionVersion: original.projectionVersion || 'meaning-v1', projectionReviewStatus: original.projectionReviewStatus || 'pending' };
  if (['suit-progression', 'court-lineage'].includes(passage.type)) return projectMinorPatternReference(base);
  if (isComplete) return { ...base, isPartialPattern: false };
  if (passage.type !== 'triad' || (original.context || 'general') !== 'general') return null;
  const triad = ARCHETYPAL_TRIADS.find(row => row.id === String(passage.patternId));
  if (!triad || !Array.isArray(matchedCards) || !Array.isArray(missingCards) || matchedCards.length !== 2 || missingCards.length !== 1
    || ![...matchedCards, ...missingCards].every(Number.isInteger) || new Set([...matchedCards, ...missingCards]).size !== 3
    || !triad.cards.every(number => [...matchedCards, ...missingCards].includes(number))) return null;
  const matched = [...matchedCards].sort((a, b) => a - b);
  const pair = PARTIAL_PATTERN_PROJECTIONS[triad.id]?.[matched.join('-')];
  // Numeric neutral fallback is independently authored; never edit the full arc.
  const meaning = pair || { title: 'Matched pair', theme: 'Two-card reflection', text: 'Consider the relationship between these two drawn cards. Explore what each contributes without assuming an additional stage or an event in your life.', visualAnchors: [], projectionReviewStatus: 'pending' };
  return { ...base, ...meaning, archetypalText: meaning.text, context: 'general', tags: [], isPartialPattern: true, matchedCards: matched, missingCards: [...missingCards], projectionVersion: PARTIAL_PROJECTION_VERSION, visualAnchors: [] };
}

function selectedName(number, deckStyle) {
  const card = MAJOR_ARCANA.find(row => row.number === number);
  if (!card) return null;
  // getDeckAlias labels its Marseille mapping explicitly; canonical IDs stay internal.
  return getDeckAlias(card, deckStyle).split(' (RWS:')[0];
}

// Exact authored card names and these explicit capitalized short forms denote
// cards. Lowercase meaning words (strength, justice, fortune, wheel) stay prose.
const AUTHORED_SHORT_MAJOR_NAMES = { 1: ['Magician'], 2: ['High Priestess'], 3: ['Empress'], 4: ['Emperor'], 5: ['Hierophant'], 6: ['Lovers'], 7: ['Chariot'], 9: ['Hermit'], 10: ['Wheel'], 12: ['Hanged Man'], 15: ['Devil'], 16: ['Tower'], 17: ['Star'], 18: ['Moon'], 19: ['Sun'], 21: ['World'] };

function adaptNames(text, deckStyle) {
  if (typeof text !== 'string' || deckStyle === 'rws-1909') return text;
  const aliases = new Map();
  for (const card of MAJOR_ARCANA) {
    const alias = selectedName(card.number, deckStyle);
    aliases.set(card.name, alias);
    aliases.set(`The ${card.name.replace(/^The /, '')}`, alias);
    aliases.set(`the ${card.name.replace(/^The /, '')}`, alias.replace(/^The /, 'the '));
    for (const shortName of AUTHORED_SHORT_MAJOR_NAMES[card.number] || []) {
      aliases.set(shortName, alias.replace(/^The /, ''));
      aliases.set(`The ${shortName}`, alias);
      aliases.set(`the ${shortName}`, alias.replace(/^The /, 'the '));
    }
  }
  for (const suit of ['Wands', 'Cups', 'Swords', 'Pentacles']) aliases.set(suit, getDeckSuitAlias(suit, deckStyle));
  for (const card of MINOR_ARCANA) aliases.set(card.name, getDeckAlias(card, deckStyle));
  // One substitution pass prevents a selected alias from being reinterpreted.
  const escaped = [...aliases.keys()].sort((a,b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.replace(new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'g'), name => aliases.get(name));
}

/** Keep authored history separate from verified generation evidence. */
export function projectPassageForDeck(passage, deckStyle = 'rws-1909', { cardsInfo } = {}) {
  if (!Object.hasOwn(DECK_CATALOG, deckStyle)) return null;
  if (cardsInfo !== undefined) passage = bindMinorPassageToCards(passage, cardsInfo, deckStyle);
  const projected = projectPassageForPattern(passage);
  if (!projected) return null;
  const source = getPassageSource(projected);
  if (!source) return null;
  const crossDeckReference = source.deckStyle !== deckStyle;
  const meaning = typeof projected.archetypalText === 'string' ? projected.archetypalText.trim() : '';
  if (crossDeckReference && (!meaning || (projected.isEnriched && projected.projectionReviewStatus !== 'approved'))) return null;
  const subset = projected.matchedCardKeys || (projected.isPartialPattern ? projected.matchedCards : null);
  const entry = getPassagesForPattern(projected.type, projected.patternId);
  const cardNumbers = projected.matchedCardKeys ? [] : subset || (projected.type === 'major-arcana' ? [Number(projected.patternId)] : projected.type === 'triad' ? ARCHETYPAL_TRIADS.find(row => row.id === projected.patternId)?.cards : entry?.cards) || [];
  const sourceUrls = [...new Set([
    ...(Array.isArray(projected.sourceUrls) ? projected.sourceUrls : []),
    projected.sourceUrl
  ].filter(url => typeof url === 'string' && /^https?:\/\//i.test(url)))];
  const candidateId = JSON.stringify([projected.type, projected.patternId, projected.context || 'general', subset, projected.sourceId]);
  return { ...projected,
    title: adaptNames(projected.title, deckStyle), theme: adaptNames(projected.theme, deckStyle),
    cardNumbers: [...cardNumbers], cardNames: projected.matchedCardKeys
      ? minorMemberNames(projected.matchedCardKeys).map(card => getDeckAlias(card, deckStyle))
      : cardNumbers.map(number => selectedName(number, deckStyle)).filter(Boolean),
    sourceUrls, sourceDeck: source.deckStyle,
    candidateId, patternKey: JSON.stringify([projected.type, projected.patternId, subset, deckStyle]),
    projectionId: JSON.stringify([candidateId, projected.projectionVersion, deckStyle]),
    promptText: adaptNames(crossDeckReference ? meaning : projected.text, deckStyle),
    promptVisualAnchors: crossDeckReference || projected.isPartialPattern ? [] : [...(projected.visualAnchors || [])],
    crossDeckReference, projectedDeck: deckStyle
  };
}

export function getPassageProjectionRejectionReason(passage, deckStyle = 'rws-1909') {
  if (!Object.hasOwn(DECK_CATALOG, deckStyle)) return 'unknown_deck';
  if (!resolveRegistryPassage(passage)) return 'unverified_registry_content';
  const projected = projectPassageForPattern(passage);
  if (!projected) return 'unverified_matched_subset';
  if (projected.sourceDeck !== deckStyle && (!projected.archetypalText || projected.isEnriched && projected.projectionReviewStatus !== 'approved')) return 'missing_or_unapproved_meaning_projection';
  return null;
}
