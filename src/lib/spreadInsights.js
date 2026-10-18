import { passesWordBoundary } from './highlightUtils.js';
import { getCardForDeck } from './cardLookup.js';

const asInsights = (items, kind) => (Array.isArray(items) ? items : [])
  .filter(item => item && typeof item.text === 'string' && item.text.trim())
  .map(item => ({ ...item, kind }));

// Partial-pattern quotations can name undrawn cards. Keep them as guarded
// backend context, but omit them from the reader's spread evidence and counts.
export function getVisibleTraditionalPassages(passages) {
  return (Array.isArray(passages) ? passages : []).filter(passage => (
    passage && typeof passage.text === 'string' && passage.text.trim()
    && !passage.isPartialPattern && passage.metadata?.isComplete !== false
  ));
}

function spreadPriority(item) {
  const key = item.key || '';
  if (key.startsWith('rel-') || key.startsWith('relationship-')) return 0;
  if (key === 'suit-dominance' || key === 'symbol-cue') return 1;
  if (key === 'deck-scope') return 4;
  if (key === 'reversal-framework') return 3;
  return 2;
}

export function buildSpreadInsightSections(spreadHighlights, archetypeHighlights) {
  const spread = asInsights(spreadHighlights, 'spread')
    .sort((a, b) => spreadPriority(a) - spreadPriority(b));
  const archetypes = asInsights(archetypeHighlights, 'archetype')
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  // Lead with the strongest detected archetype and concrete spread relationships.
  // Every remaining item stays available in its original category.
  const relationships = spread.filter(item => spreadPriority(item) === 0);
  const supporting = spread.filter(item => spreadPriority(item) !== 0);
  const highlights = [...archetypes.slice(0, 1), ...relationships, ...archetypes.slice(1), ...supporting].slice(0, 3);
  const selected = new Set(highlights);
  return {
    highlights,
    spreadDetails: spread.filter(item => !selected.has(item)),
    archetypes: archetypes.filter(item => !selected.has(item))
  };
}

export function findInsightCardMentions(text, cards = [], { sourceDeck } = {}) {
  if (typeof text !== 'string' || !text) return [];
  const matches = [];
  const rwsLabels = [...text.matchAll(/\(RWS:\s*([^)]*)\)/gi)].map(match => ({
    start: match.index, end: match.index + match[0].length
  }));
  cards.forEach((card, index) => {
    // A quoted RWS Knight must still open the canonical Knight when the chosen
    // Thoth deck calls that card Prince and calls a different card Knight.
    const sourceName = sourceDeck ? getCardForDeck(card, sourceDeck)?.name : card?.name;
    const names = sourceDeck
      ? new Set([sourceName])
      : new Set([card?.name, card?.canonicalName, ...(Array.isArray(card?.aliases) ? card.aliases : [])]);
    const rwsName = getCardForDeck(card, 'rws-1909')?.name;
    if (rwsLabels.length) names.add(rwsName);
    for (const name of names) {
      if (typeof name !== 'string' || !name.trim()) continue;
      const needle = name.toLowerCase();
      const lower = text.toLowerCase();
      for (let start = lower.indexOf(needle); start >= 0; start = lower.indexOf(needle, start + 1)) {
        const end = start + name.length;
        if (!passesWordBoundary(text, start, end)) continue;
        const inRwsLabel = rwsLabels.some(range => start > range.start && end < range.end);
        if (inRwsLabel && name !== rwsName) continue;
        if (!inRwsLabel && sourceDeck && name !== sourceName) continue;
        // Single common words need name capitalization or an explicit card cue.
        const word = text.slice(start, end).replace(/^the\s+/i, '');
        const explicitCard = /^\s+(?:card|upright|reversed)\b/i.test(text.slice(end));
        if (!word.includes(' ') && !/^\p{Lu}/u.test(word) && !explicitCard && !inRwsLabel) continue;
        matches.push({ start, end, index, exact: name === (inRwsLabel ? rwsName : sourceName) });
      }
    }
  });
  // Prefer the longest name, then the selected deck's display name if a court
  // alias collides with another card's canonical name (e.g. Thoth Knight/King).
  matches.sort((a, b) => a.start - b.start || b.end - a.end || Number(b.exact) - Number(a.exact));
  const result = [];
  for (const match of matches) {
    if (match.start >= (result.at(-1)?.end ?? 0)) result.push(match);
  }
  return result;
}
