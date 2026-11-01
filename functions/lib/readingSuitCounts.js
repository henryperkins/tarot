import { canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { parseMinorName } from './minorMeta.js';

const SUIT_ALIASES = {
  wands: 'Wands', batons: 'Wands', staves: 'Wands',
  cups: 'Cups', coupes: 'Cups', chalices: 'Cups',
  swords: 'Swords', epees: 'Swords',
  pentacles: 'Pentacles', disks: 'Pentacles', discs: 'Pentacles', coins: 'Pentacles', deniers: 'Pentacles'
};
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const NUMBER = `(?:\\d+|${NUMBERS.join('|')})`;
const SUIT = `(?:${Object.keys(SUIT_ALIASES).join('|')})`;
const MINOR_REFERENCE = new RegExp(`\\b(?:ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king|prince|princess)\\s+of\\s+${SUIT}\\b`, 'gi');

// Count identities/positions, never repeated mentions in generated prose or
// elemental correspondences (Major Arcana can be Water without being Cups).
export function countDrawnSuits(cardsInfo, deckStyle = 'rws-1909') {
  const counts = { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 };
  for (const card of Array.isArray(cardsInfo) ? cardsInfo : []) {
    const name = typeof card === 'string' ? card : card?.canonicalKey || card?.canonicalName || card?.card || card?.name;
    const key = card?.canonicalKey || card?.canonicalName || canonicalCardKey(name, deckStyle);
    const minor = parseMinorName(key);
    if (minor) counts[minor.suit]++;
  }
  return counts;
}

function numericCount(value) {
  const word = NUMBERS.indexOf(value.toLowerCase());
  return word >= 0 ? word : Number(value);
}

function isNonAssertion(prefix, suffix) {
  const clause = prefix.split(/[.!?;\n]/).at(-1).slice(-180);
  const localClause = clause.split(',').at(-1);
  const rest = suffix.split(/[.!;\n]/)[0];
  return rest.includes('?')
    || /\b(?:if|unless|imagine|suppose|hypothetically)\b/i.test(localClause)
    || /\b(?:would|could|might|may|should)\s+(?:(?:drawing|having)\s+)?$/i.test(clause)
    || /^\s+(?:would|could|might|may)\b/i.test(rest)
    || /\b(?:not|never|cannot|(?:do|does|did|is|are|was|were|have|has|had|could|would|should)n['’]t)\s+(?:(?:have|contain|include|show|draw|exactly|really|actually)\s+){0,3}$/i.test(clause)
    || /^\s+(?:(?:are|is|were|was)\s+(?:not|never)|(?:is|are|was|were)n['’]t)\b/i.test(rest)
    // Bounds and approximations are not assertions of an exact total.
    || /\b(?:at\s+(?:least|most)|(?:no\s+)?(?:more|less|fewer)\s+than|about|around|approximately|up\s+to)\s*$/i.test(clause);
}

function isNamedDrawnSubset(prefix, suffix, suit, claimed, actual, cardsInfo, deckStyle) {
  if (claimed < 2 || claimed >= actual || !/\b(?:these|those)\s+$/i.test(prefix)) return false;
  const paragraph = prefix.split(/\n\s*\n/).at(-1);
  const tail = suffix.split(/\n\s*\n/)[0];
  // A demonstrative must not excuse an explicit whole-spread count.
  if (/\b(?:only|exactly|all|every|total|entire|entirety|exhaust\w*|whole|altogether|full|complete|spread|drawn|inventory|lineup|group|contingent|collection|roster|set|no others|nothing else)\b/i.test(`${paragraph} ${tail}`)) return false;
  // Require a local comparison rather than inferring a subset from a bare list.
  const local = paragraph.slice(-700);
  if (!/\b(?:next to|alongside|paired|pair|between|compared|contrast|connect(?:s|ed)?|together|beside)\b/i.test(local)) return false;
  const referents = new Set();
  const add = name => {
    const key = canonicalCardKey(name, deckStyle);
    if (parseMinorName(key)?.suit === suit) referents.add(key);
  };
  for (const match of local.matchAll(MINOR_REFERENCE)) add(match[0]);
  // A deck epithet needs explicit card context, e.g. "Disappointment reversed".
  // Ordinary uses of words such as love or pleasure do not supply an identity.
  for (const match of local.matchAll(/\b([A-Z][\p{L}]*(?:\s+[A-Z][\p{L}]*){0,2})\s+(?:[Rr]eversed|[Uu]pright|[Cc]ard)\b/gu)) add(match[1]);
  if (referents.size !== claimed) return false;
  const drawn = new Set((Array.isArray(cardsInfo) ? cardsInfo : []).map(card => {
    const key = card?.canonicalKey || card?.canonicalName;
    return key ? key.toLowerCase() : canonicalCardKey(typeof card === 'string' ? card : card?.card || card?.name, deckStyle);
  }));
  return [...referents].every(key => drawn.has(key));
}

// Intentionally checks explicit English count assertions, not every possible
// numerical paraphrase. In particular, "Four of Cups" is a card rank, not a count.
export function detectSuitCountMismatches(readingText, cardsInfo, deckStyle = 'rws-1909') {
  const counts = countDrawnSuits(cardsInfo, deckStyle);
  const text = String(readingText || '').replace(/[*_]/g, '');
  const patterns = [
    new RegExp(`\\b(?<count>${NUMBER})\\s+(?<suit>${SUIT})\\s+cards?\\b`, 'gi'),
    new RegExp(`\\b(?<count>${NUMBER})\\s+of\\s+(?:(?:the|your|these)\\s+)?(?:${NUMBER}\\s+)?cards\\s+(?:are|belong\\s+to)\\s+(?:the\\s+)?(?<suit>${SUIT})\\b`, 'gi'),
    new RegExp(`\\b(?<suit>${SUIT})\\s+(?:appears?|occurs?)\\s+(?<count>${NUMBER})\\s+times\\b`, 'gi')
  ];
  const mismatches = [];
  const seen = new Set();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (isNonAssertion(text.slice(0, match.index), text.slice(match.index + match[0].length))) continue;
      const suit = SUIT_ALIASES[match.groups.suit.toLowerCase()];
      const claimed = numericCount(match.groups.count);
      const actual = counts[suit];
      if (claimed !== actual && isNamedDrawnSubset(text.slice(0, match.index), text.slice(match.index + match[0].length), suit, claimed, actual, cardsInfo, deckStyle)) continue;
      const key = `${suit}:${claimed}`;
      if (claimed !== actual && !seen.has(key)) {
        seen.add(key);
        mismatches.push({ suit, claimed, actual });
      }
    }
  }
  return mismatches;
}
