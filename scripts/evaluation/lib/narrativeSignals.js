// Deterministic signals that separate a reading about this querent from a
// template: whether it engages the question, and whether it repeats the same
// sentences with only the card names swapped.
import { MAJOR_ARCANA } from '../../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../../src/data/minorArcana.js';
import { buildCardAliases } from '../../../functions/lib/readingQuality.js';

const STOPWORDS = new Set([
  // English function words and question scaffolding
  'about', 'after', 'again', 'also', 'and', 'any', 'are', 'around', 'because', 'been', 'before', 'being',
  'between', 'both', 'but', 'can', 'could', 'did', 'does', 'doing', 'during', 'each', 'even', 'every',
  'for', 'from', 'get', 'getting', 'going', 'had', 'has', 'have', 'having', 'her', 'here', 'him', 'his',
  'how', 'into', 'its', 'just', 'keep', 'know', 'let', 'like', 'lot', 'make', 'many', 'may', 'might',
  'more', 'most', 'much', 'must', 'myself', 'need', 'needs', 'now', 'off', 'once', 'one', 'only', 'other',
  'our', 'out', 'over', 'own', 'really', 'right', 'same', 'see', 'she', 'should', 'some', 'something',
  'still', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'things', 'this', 'those', 'through', 'too', 'under', 'understand', 'until', 'very', 'want', 'was',
  'way', 'well', 'were', 'what', 'when', 'where', 'whether', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'within', 'without', 'would', 'you', 'your', 'yours', 'yourself',
  // Tarot vocabulary every reading uses regardless of the question
  'card', 'cards', 'reading', 'readings', 'spread', 'tarot', 'guidance', 'insight', 'insights',
  // Spanish function words
  'como', 'con', 'cual', 'cuando', 'del', 'desde', 'donde', 'entre', 'esta', 'este', 'esto', 'hacia',
  'las', 'los', 'mas', 'mientras', 'mis', 'muy', 'nos', 'para', 'pero', 'por', 'porque', 'puedo',
  'que', 'quiero', 'sin', 'sobre', 'son', 'sus', 'tengo', 'una', 'uno', 'unos'
]);

const SUFFIXES = ['ations', 'ation', 'ments', 'ment', 'ness', 'ities', 'ity', 'ings', 'ing', 'ives', 'ive', 'ed', 'es', 's', 'ly'];

export const MIN_SALIENT_QUESTION_TERMS = 3;
const MIN_MATCHED_TERMS = 2;
const MIN_MATCHED_RATIO = 0.34;
const MIN_REPEATED_SENTENCES = 3;
const MIN_REPEATED_SHARE = 0.25;
const MIN_TEMPLATE_SENTENCE_WORDS = 6;

function normalizeWords(text) {
  if (typeof text !== 'string') return [];
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .match(/\p{L}+/gu) || [];
}

function stem(word) {
  let value = word;
  for (const suffix of SUFFIXES) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 3) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  return value.length > 3 && value.endsWith('e') ? value.slice(0, -1) : value;
}

function stemsMatch(a, b) {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/**
 * Measure whether a reading engages the salient terms of the querent's question.
 * Questions with fewer than three salient terms ("Any guidance?") are not scored.
 *
 * @param {string} question - The querent's question
 * @param {string} reading - Plain reading text
 * @returns {{ applicable: boolean, addressed: boolean, terms: string[], matchedTerms: string[], ratio: number|null }}
 */
export function analyzeQuestionEngagement(question, reading) {
  const terms = [...new Set(normalizeWords(question).filter((word) => word.length >= 3 && !STOPWORDS.has(word)))];
  if (terms.length < MIN_SALIENT_QUESTION_TERMS) {
    return { applicable: false, addressed: true, terms, matchedTerms: [], ratio: null };
  }

  const readingStems = [...new Set(normalizeWords(reading).map(stem))];
  const matchedTerms = terms.filter((term) => {
    const termStem = stem(term);
    return readingStems.some((readingStem) => stemsMatch(termStem, readingStem));
  });
  const ratio = matchedTerms.length / terms.length;
  return {
    applicable: true,
    addressed: matchedTerms.length >= MIN_MATCHED_TERMS || ratio >= MIN_MATCHED_RATIO,
    terms,
    matchedTerms,
    ratio
  };
}

function stripDiacritics(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNamePattern(names, flags) {
  if (names.length === 0) return null;
  const source = [...new Set(names)]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, flags);
}

const deckNamePatternCache = new Map();

/**
 * Every name a card goes by in the given deck ("Six of Cups", "Lust",
 * "Princess of Disks", "La Force"), without diacritics. Multi-word names match
 * in any case; single-word deck names such as "Art" or "Peace" match only
 * when capitalized, so ordinary words in running prose stay as they are.
 */
function getDeckNamePatterns(deckStyle = 'rws-1909') {
  if (deckNamePatternCache.has(deckStyle)) return deckNamePatternCache.get(deckStyle);

  const names = [...MAJOR_ARCANA, ...MINOR_ARCANA]
    .flatMap((card) => buildCardAliases(card, deckStyle))
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => stripDiacritics(name.trim()).replace(/^The\s+/i, ''));
  const rwsNames = new Set([...MAJOR_ARCANA, ...MINOR_ARCANA].map((card) => card.name.replace(/^The\s+/i, '')));
  const patterns = {
    // RWS names keep matching in any case, as before ("the death of an old habit").
    anyCase: buildNamePattern(names.filter((name) => /\s/.test(name) || rwsNames.has(name)), 'giu'),
    capitalized: buildNamePattern(names.filter((name) => !/\s/.test(name) && !rwsNames.has(name)), 'gu')
  };
  deckNamePatternCache.set(deckStyle, patterns);
  return patterns;
}

const DECK_ALIAS_MINOR_PATTERN = /\b(?:ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king|princess|prince|valet|chevalier|reine|roi)\s+of\s+\p{L}+/giu;

function templateKey(sentence, deckStyle) {
  const { anyCase, capitalized } = getDeckNamePatterns(deckStyle);
  let key = stripDiacritics(sentence).replace(DECK_ALIAS_MINOR_PATTERN, ' card ');
  if (anyCase) key = key.replace(anyCase, ' card ');
  if (capitalized) key = key.replace(capitalized, ' card ');
  return key
    .toLowerCase()
    .replace(/\b(?:the|la|le|l)?\s*card\b/g, ' card ')
    .replace(/\b(?:upright|reversed)\b/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect card sections written from one template: the same sentences repeated
 * with only the card name changed.
 *
 * @param {string} reading - Plain reading text
 * @param {Object} [options]
 * @param {string} [options.deckStyle] - Deck whose card names to recognize (Thoth "Lust", Marseille "La Force")
 * @returns {{ templated: boolean, sentenceCount: number, repeatedSentenceCount: number, repeatedShare: number, examples: string[] }}
 */
export function analyzeTemplateRepetition(reading, { deckStyle = 'rws-1909' } = {}) {
  const sentences = (typeof reading === 'string' ? reading : '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => templateKey(sentence, deckStyle))
    .filter((key) => key.split(' ').length >= MIN_TEMPLATE_SENTENCE_WORDS);

  const counts = new Map();
  sentences.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  const repeated = sentences.filter((key) => counts.get(key) > 1);
  const repeatedShare = sentences.length ? repeated.length / sentences.length : 0;

  return {
    templated: repeated.length >= MIN_REPEATED_SENTENCES && repeatedShare >= MIN_REPEATED_SHARE,
    sentenceCount: sentences.length,
    repeatedSentenceCount: repeated.length,
    repeatedShare,
    examples: [...new Set(repeated)].slice(0, 3)
  };
}
