import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';

const catalog = new Map([...MAJOR_ARCANA, ...MINOR_ARCANA].map(card => [card.name.toLowerCase(), card]));

/** Defensive internal membership; admission of ordinary requests is separate. */
export function groupGraphCardIdentities(cardsInfo, { deckStyle = 'rws-1909' } = {}) {
  const grouped = new Map();
  const invalidIndices = [];
  (Array.isArray(cardsInfo) ? cardsInfo : []).forEach((card, index) => {
    const resolvedName = card?.canonicalName || card?.canonicalKey;
    const rawName = card?.card || card?.name || card?.title;
    const canonicalMajor = rawName && catalog.get(rawName.toLowerCase());
    const label = resolvedName || (canonicalMajor && Number.isInteger(canonicalMajor.number) && canonicalMajor.number === card?.number ? rawName : rawName ? canonicalizeCardName(rawName, deckStyle) : null);
    // Number-only Major objects are an existing internal graph interface.
    let canonical = label ? catalog.get(label.toLowerCase())
      : !rawName && Number.isInteger(card?.number) ? MAJOR_ARCANA.find(entry => entry.number === card.number) : null;
    if (!canonical && rawName && !resolvedName) {
      for (const aliasDeck of ['rws-1909', 'marseille-classic', 'thoth-a1']) {
        canonical = catalog.get(canonicalizeCardName(rawName, aliasDeck)?.toLowerCase());
        if (canonical) break;
      }
    }
    if (!canonical) {
      invalidIndices.push(index);
      return;
    }
    const canonicalKey = canonical.name.toLowerCase();
    if (!grouped.has(canonicalKey)) grouped.set(canonicalKey, {
      canonicalKey,
      card: { ...card, canonicalKey,
        number: canonical.number ?? null, suit: canonical.suit ?? null,
        rank: canonical.rank ?? null, rankValue: canonical.rankValue ?? null },
      indices: []
    });
    grouped.get(canonicalKey).indices.push(index);
  });
  return { members: [...grouped.values()], invalidIndices };
}

export function graphMemberIndices(cardsInfo, selectedCards, options) {
  const selected = new Set(selectedCards.map(card => card.canonicalKey));
  return groupGraphCardIdentities(cardsInfo, options).members
    .filter(member => selected.has(member.canonicalKey))
    .flatMap(member => member.indices).sort((a, b) => a - b);
}
