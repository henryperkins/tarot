/**
 * Narrative card links
 *
 * Finds where a reading names a card from the querent's spread, or describes
 * something drawn on one, so the reading surface can point at that card the
 * way a reader rests a hand on it. Pure and DOM-free: the Markdown renderer
 * uses it as a remark plugin and Node tests call it directly.
 */
import { getCardTouchPoints } from '../data/cardTouchPoints.js';
import { getCanonicalCard } from './cardLookup.js';
import { getDeckAlias, THOTH_COURT_ALIASES, MARSEILLE_COURT_ALIASES } from '../../shared/vision/deckAssets.js';

// Hand-placed touch points describe the 1909 RWS artwork only.
const TOUCH_POINT_DECKS = new Set(['rws-1909']);
// A paragraph that names its card this early opens that card's passage. A
// second card is allowed only when the first is named right at the start
// ("Present: The Tower … the Six of Cups' water").
const INTRO_WINDOW = 100;
const INTRO_LEAD = 40;
const MAX_TOUCHES_PER_CARD = 4;

const ACCENT_CLASSES = { a: 'aàáâä', e: 'eèéêë', i: 'iìíîï', o: 'oòóôö', u: 'uùúûü', c: 'cç' };

const IRREGULAR_PLURALS = {
  child: 'children',
  man: 'men',
  woman: 'women',
  foot: 'feet',
  person: 'people',
  wolf: 'wolves',
  leaf: 'leaves',
  knife: 'knives',
  thief: 'thieves',
  staff: 'staves',
  ox: 'oxen'
};

// Object words that double as suit names; capitalized, they name the suit.
const SUIT_OBJECT_WORDS = new Set([
  'cup', 'cups', 'wand', 'wands', 'sword', 'swords', 'pentacle', 'pentacles',
  'coin', 'coins', 'disk', 'disks', 'baton', 'batons', 'staff', 'staves'
]);

// After a possessive card name ("the Tower's fire") these words name an
// element, not something drawn on the card.
const ELEMENT_WORDS = new Set(['water', 'fire', 'air', 'earth', 'flame', 'flames']);

// Capitalized mid-sentence, these words name a card ("Death to Hermit to
// Sun") or the deck, not something drawn on one.
const CARD_NAME_WORDS = new Set([
  'fool', 'magician', 'priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot',
  'strength', 'hermit', 'wheel', 'fortune', 'justice', 'hanged', 'death', 'temperance', 'devil',
  'tower', 'star', 'moon', 'sun', 'judgement', 'judgment', 'world', 'ace', 'page', 'knight',
  'queen', 'king', 'rider', 'waite'
]);

// Figures of speech, and the deck's own name, that reuse a touch term without
// pointing at the art.
const IDIOMS = [
  /\brider[\s‐-―-]*waite\b/gi,
  /\bfigur(?:e|es|ed|ing)\s+(?:it\s+|this\s+|that\s+)?out\b/gi,
  /\b(?:on\s+the\s+)?other\s+hand\b/gi,
  /\bon\s+the\s+one\s+hand\b/gi,
  /\b(?:first|second)[-\s]hand\b/gi,
  /\bhands[-\s]on\b/gi,
  /\bhand\s+in\s+hand\b/gi,
  /\bat\s+hand\b/gi,
  /\binner\s+child\b/gi,
  /\bheart\s+of\b/gi,
  /\b(?:at|take)\s+heart\b/gi,
  /\bstar\s+sign\b/gi,
  /\b(?:sun|moon)\s+sign\b/gi,
  /\bwater\s+under\s+the\s+bridge\b/gi,
  /\bplay(?:ing)?\s+with\s+fire\b/gi
];

const ZODIAC = '(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)';
// "The Moon is waxing in Aquarius" is astrological weather, not the card.
const ASTRO_AFTER = new RegExp(`^\\s+(?:(?:is|was)\\s+)?(?:(?:just|now|currently)\\s+)?(?:(?:in|enters|entering|moves\\s+into|transits?)\\s+${ZODIAC}|waxing|waning|(?:is|was)\\s+(?:full|new))\\b`);
const ASTRO_BEFORE = /\b(?:full|new|waxing|waning|gibbous|crescent|harvest|blood)\s+$/i;

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(char) {
  return Boolean(char) && WORD_CHAR.test(char);
}

function atWordBoundary(text, start, end) {
  return !isWordChar(text[start - 1]) && !isWordChar(text[end]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex source that tolerates accents, curly apostrophes and a lowercase "the". */
function namePattern(name) {
  let rest = name;
  let prefix = '';
  const article = /^the\s+/i.exec(name);
  if (article) {
    prefix = '[Tt]he\\s+';
    rest = name.slice(article[0].length);
  }
  const body = Array.from(rest).map((char) => {
    if (/\s/.test(char)) return '\\s+';
    if (char === '\'' || char === '’') return '[\'’]';
    const lower = char.toLowerCase();
    const base = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const accents = ACCENT_CLASSES[base];
    if (accents) return `[${char === lower ? accents : accents.toUpperCase()}]`;
    return escapeRegExp(char);
  }).join('');
  return prefix + body.replace(/(?:\\s\+)+/g, '\\s+');
}

function termPattern(term) {
  return term
    .split(/\s+/)
    .map((word) => escapeRegExp(word).replace(/'/g, '[\'’]').replace(/-/g, '[-\\s]?'))
    .join('\\s+');
}

function pluralize(word) {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word];
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Every surface form a touch term may take in a reading. */
export function expandTouchTerm(term) {
  if (term.startsWith('=')) return [term.slice(1)];
  const words = term.split(/\s+/);
  const last = words.pop();
  const forms = new Set([term, [...words, pluralize(last)].join(' ')]);
  if (last === 'staff') forms.add([...words, 'staffs'].join(' '));
  return Array.from(forms);
}

function courtTitle(card, deckStyle) {
  if (!card?.rank || !['Page', 'Knight', 'Queen', 'King'].includes(card.rank)) return null;
  if (deckStyle === 'thoth-a1') return THOTH_COURT_ALIASES[card.rank] || card.rank;
  if (deckStyle === 'marseille-classic') return MARSEILLE_COURT_ALIASES[card.rank] || card.rank;
  return card.rank;
}

function nameClaims(card, deckStyle, uniqueCourtTitles) {
  const canonical = getCanonicalCard(card) || card;
  const claims = [];
  const claim = (value, priority) => {
    const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (name.length >= 3) claims.push({ name, priority });
  };
  claim(canonical.name, 1);
  // Majors also go by their bare names: "Death to Hermit to Temperance to Sun".
  const bare = /^The\s+(.+)$/.exec(canonical.name);
  if (bare) claim(bare[1], 0);
  if (canonical.name === 'Judgement') claim('Judgment', 1);
  if (canonical.name === 'Wheel of Fortune') claim('the Wheel', 0);
  // Deck labels can carry two names: "La Force (RWS: Strength)", "Pleasure (Six of Cups)".
  const alias = getDeckAlias(canonical, deckStyle);
  const paired = /^(.+?)\s*\((?:RWS:\s*)?(.+?)\)$/.exec(alias || '');
  if (paired) {
    claim(paired[1], 2);
    claim(paired[2], 2);
  } else {
    claim(alias, 2);
  }
  const title = courtTitle(canonical, deckStyle);
  if (title && uniqueCourtTitles.has(title)) claim(`the ${title}`, 0);
  return claims;
}

/**
 * Prepare a spread for matching.
 *
 * @param {Object} options
 * @param {Array<Object>} options.cards - Spread cards in position order; each needs `index` and its canonical identity.
 * @param {string} [options.deckStyle] - Active deck id.
 * @returns {{ entries: Array<Object>, touchPointsEnabled: boolean } | null}
 */
export function buildCardLinkCatalog({ cards, deckStyle = 'rws-1909' } = {}) {
  const list = (Array.isArray(cards) ? cards : []).filter((card) => card && Number.isInteger(card.index));
  if (list.length === 0) return null;
  const touchPointsEnabled = TOUCH_POINT_DECKS.has(deckStyle);

  const titleCounts = new Map();
  for (const card of list) {
    const title = courtTitle(getCanonicalCard(card) || card, deckStyle);
    if (title) titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  }
  const uniqueCourtTitles = new Set([...titleCounts].filter(([, count]) => count === 1).map(([title]) => title));

  // A name claimed by two cards goes to the stronger claim, or to neither.
  const owners = new Map();
  const claimsByCard = list.map((card) => nameClaims(card, deckStyle, uniqueCourtTitles));
  claimsByCard.forEach((claims, position) => {
    for (const { name, priority } of claims) {
      const key = name.toLowerCase();
      const current = owners.get(key);
      if (!current || priority > current.priority) owners.set(key, { position, priority, tied: false });
      else if (priority === current.priority && current.position !== position) current.tied = true;
    }
  });

  const entries = list.map((card, position) => {
    const canonical = getCanonicalCard(card) || card;
    const names = claimsByCard[position]
      .filter(({ name }) => {
        const owner = owners.get(name.toLowerCase());
        return owner && owner.position === position && !owner.tied;
      })
      .map(({ name }) => name)
      .sort((a, b) => b.length - a.length);
    const namesRe = names.length ? new RegExp(Array.from(new Set(names.map(namePattern))).join('|'), 'gu') : null;
    const touchPoints = touchPointsEnabled ? getCardTouchPoints(canonical.name) : [];
    const touchMatchers = touchPoints.map((point) => {
      const forms = point.terms.flatMap(expandTouchTerm).sort((a, b) => b.length - a.length);
      const objectForms = forms.filter((form) => SUIT_OBJECT_WORDS.has(form.split(/\s+/).pop()));
      const otherForms = forms.filter((form) => !objectForms.includes(form));
      return {
        id: point.id,
        insensitive: otherForms.length ? new RegExp(otherForms.map(termPattern).join('|'), 'giu') : null,
        // Suit words only count lowercase, so "the Cups suit" never lights a cup.
        lowercase: objectForms.length ? new RegExp(objectForms.map(termPattern).join('|'), 'gu') : null
      };
    });
    const weakPoints = new Set(touchPoints.filter((point) => point.weak).map((point) => point.id));
    return { index: card.index, canonicalName: canonical.name, names, namesRe, touchMatchers, weakPoints };
  });

  return { entries, touchPointsEnabled };
}

function collectMatches(re, text, extra) {
  const found = [];
  if (!re) return found;
  re.lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (end > start && atWordBoundary(text, start, end)) found.push({ start, end, ...extra });
    // Step one character so a short form ("the Valet") can't hide a longer,
    // overlapping name ("Valet of Epees"); dropOverlaps keeps the longest.
    re.lastIndex = start + 1;
  }
  return found;
}

/** Keep the longest of overlapping ranges, then restore document order. */
function dropOverlaps(ranges) {
  const kept = [];
  const byStrength = [...ranges].sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  for (const range of byStrength) {
    if (!kept.some((other) => range.start < other.end && other.start < range.end)) kept.push(range);
  }
  return kept.sort((a, b) => a.start - b.start);
}

function isAstrological(text, mention) {
  if (!/(?:sun|moon|soleil|lune)$/i.test(text.slice(mention.start, mention.end))) return false;
  return ASTRO_AFTER.test(text.slice(mention.end)) || ASTRO_BEFORE.test(text.slice(0, mention.start));
}

/** Card names in `text`, in document order. */
export function findCardMentions(text, catalog) {
  if (!text || !catalog) return [];
  const found = catalog.entries
    .flatMap((entry) => collectMatches(entry.namesRe, text, { card: entry.index }))
    .filter((mention) => !isAstrological(text, mention));
  return dropOverlaps(found);
}

function idiomRanges(text) {
  return IDIOMS.flatMap((re) => collectMatches(re, text, {}));
}

function touchCandidates(text, entry) {
  return entry.touchMatchers.flatMap((matcher) => [
    ...collectMatches(matcher.insensitive, text, { card: entry.index, point: matcher.id }),
    ...collectMatches(matcher.lowercase, text, { card: entry.index, point: matcher.id })
  ]);
}

function nearestMentionBefore(mentions, position) {
  let nearest = null;
  for (const mention of mentions) {
    if (mention.start >= position) break;
    nearest = mention;
  }
  return nearest;
}

function sentenceEnd(text, end) {
  const after = /[.!?](?:\s|$)/.exec(text.slice(end));
  return after ? end + after.index + 1 : text.length;
}

function sentenceAround(text, start, end) {
  const before = text.slice(0, start);
  const from = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '), before.lastIndexOf('\n')) + 1;
  return text.slice(from, sentenceEnd(text, end));
}

// "Temperance to Sun", "the Rider–Waite deck": a capital that doesn't just
// open a sentence turns a card word into a name.
function namesACard(text, candidate) {
  const word = text.slice(candidate.start, candidate.end);
  if (!/^\p{Lu}/u.test(word) || !CARD_NAME_WORDS.has(word.split(/[\s'’-]/)[0].toLowerCase())) return false;
  return !/(?:^|[.!?:]\s|\n)[\s"'“‘(*_]*$/.test(text.slice(0, candidate.start));
}

function isElementalUse(text, candidate, mentions) {
  const word = text.slice(candidate.start, candidate.end).toLowerCase();
  if (!ELEMENT_WORDS.has(word)) return false;
  if (/^(?:\s+|-)(?:element|elements|energy|sign|signs|suit|quality|qualities|card|cards|heavy|dominant)\b/i.test(text.slice(candidate.end))) return true;
  const previous = nearestMentionBefore(mentions, candidate.start);
  if (previous && /^['’]s?\s+$/.test(text.slice(previous.end, candidate.start))) return true;
  // "The elements run water, then fire, then air" names elements, not imagery.
  const sentence = sentenceAround(text, candidate.start, candidate.end).toLowerCase();
  if (/\belement(?:s|al)?\b/.test(sentence)) return true;
  return new Set(sentence.match(/\b(?:water|fire|air|earth)\b/g) || []).size >= 2;
}

function uniqueInOrder(values) {
  return Array.from(new Set(values));
}

/**
 * Read one block of reading text.
 *
 * @param {string} text - Plain text of a paragraph, heading or list item.
 * @param {Object} catalog - From buildCardLinkCatalog.
 * @param {Object} [options]
 * @param {number|null} [options.context] - Card whose passage this block continues.
 * @param {boolean} [options.allowTouches=true] - Headings name cards but don't describe them.
 */
export function analyzeBlock(text, catalog, { context = null, allowTouches = true } = {}) {
  const empty = { mentions: [], touches: [], cards: [], primary: null, mode: 'none', intro: null };
  if (!text || !catalog) return empty;

  const mentions = findCardMentions(text, catalog);
  const mentioned = uniqueInOrder(mentions.map((mention) => mention.card));
  const first = mentions[0];
  // The name has to come in the opening sentence, not after a sentence about
  // some other card.
  const opensPassage = first && first.start < sentenceEnd(text, 0) && (
    (first.start <= INTRO_LEAD && mentioned.length <= 2)
    || (first.start <= INTRO_WINDOW && mentioned.length === 1)
  );
  const intro = opensPassage ? first.card : null;

  let primary = null;
  let mode = 'none';
  let cards = [];
  if (intro !== null) {
    primary = intro;
    mode = 'single';
    cards = uniqueInOrder([intro, ...mentioned]);
  } else if (mentioned.length === 1) {
    primary = mentioned[0];
    mode = 'single';
    cards = uniqueInOrder([primary, ...(context !== null ? [context] : [])]);
  } else if (mentioned.length > 1) {
    mode = 'sweep';
    cards = mentioned;
  } else if (context !== null) {
    primary = context;
    mode = 'single';
    cards = [context];
  }

  let touches = [];
  if (allowTouches && catalog.touchPointsEnabled && cards.length > 0) {
    const excluded = [...mentions, ...idiomRanges(text)];
    const candidates = catalog.entries
      .filter((entry) => cards.includes(entry.index))
      .flatMap((entry) => touchCandidates(text, entry))
      .filter((candidate) => !excluded.some((range) => candidate.start < range.end && range.start < candidate.end))
      .filter((candidate) => !namesACard(text, candidate))
      .filter((candidate) => !isElementalUse(text, candidate, mentions));

    // A described detail belongs to the card named just before it; before any
    // name, to the passage the block continues. A word only one spread card
    // can show goes to that card, once the passage has named it, at the latest
    // in the same sentence.
    const inPlay = (candidate) => candidate.card === primary || candidate.card === context
      || mentions.some((mention) => mention.card === candidate.card && mention.start < sentenceEnd(text, candidate.end));
    const owned = candidates.filter((candidate) => {
      const owner = nearestMentionBefore(mentions, candidate.start)?.card ?? context ?? primary;
      if (candidate.card === owner) return true;
      const sameSpan = candidates.filter((other) => other.start === candidate.start && other.end === candidate.end);
      if (sameSpan.some((other) => other.card === owner)) return false;
      return sameSpan.length === 1 && inPlay(candidate);
    });

    // Light a few details per card; generic ones (a "figure") give way first.
    const ordered = dropOverlaps(owned);
    const kept = new Map();
    for (const entry of catalog.entries) {
      const points = uniqueInOrder(ordered.filter((touch) => touch.card === entry.index).map((touch) => touch.point));
      const ranked = [...points.filter((point) => !entry.weakPoints.has(point)), ...points.filter((point) => entry.weakPoints.has(point))];
      kept.set(entry.index, new Set(ranked.slice(0, MAX_TOUCHES_PER_CARD)));
    }
    touches = ordered.filter((touch) => kept.get(touch.card)?.has(touch.point));

    // A passage that names another card in passing ("For the Knight, …") is
    // still describing its own card: the hand stays where the light is.
    if (mode === 'single' && intro === null && touches.length && !touches.some((touch) => touch.card === primary)) {
      const counts = new Map();
      for (const touch of touches) counts.set(touch.card, (counts.get(touch.card) || 0) + 1);
      primary = cards.reduce((best, card) => ((counts.get(card) || 0) > (counts.get(best) || 0) ? card : best), primary);
    }
  }

  return { mentions, touches, cards, primary, mode, intro };
}

// ---------------------------------------------------------------------------
// Remark plugin
// ---------------------------------------------------------------------------

function collectSegments(node, { paragraphsOnly = false } = {}) {
  const segments = [];
  let length = 0;
  const visit = (current, parent) => {
    if (current.type === 'text') {
      segments.push({ node: current, parent, start: length, end: length + current.value.length });
      length += current.value.length;
      return;
    }
    if (current.type === 'inlineCode') {
      length += current.value.length;
      segments.push({ opaque: true, start: length - current.value.length, end: length });
      return;
    }
    if (current.type === 'break') {
      length += 1;
      return;
    }
    if (current.type === 'list') return;
    if (Array.isArray(current.children)) {
      for (const child of current.children) visit(child, current);
    }
  };
  if (paragraphsOnly) {
    node.children?.forEach((child, index) => {
      if (child.type !== 'paragraph') return;
      if (index > 0 && length > 0) length += 1;
      visit(child, node);
    });
  } else {
    visit(node, null);
  }
  const text = segments.reduce((value, segment) => {
    const gap = segment.start - value.length;
    const filler = gap > 0 ? ' '.repeat(gap) : '';
    return value + filler + (segment.opaque ? ' '.repeat(segment.end - segment.start) : segment.node.value);
  }, '');
  return { segments: segments.filter((segment) => !segment.opaque), text };
}

function linkNode(range, value) {
  const isTouch = range.point !== undefined;
  return {
    type: isTouch ? 'cardTouch' : 'cardMention',
    data: {
      hName: 'span',
      hProperties: isTouch
        ? { className: ['reading-imagery'], dataCardIndex: String(range.card), dataTouchId: range.point }
        : { className: ['narrative-emphasis', 'reading-card-ref'], dataCardIndex: String(range.card) }
    },
    children: [{ type: 'text', value }]
  };
}

function wrapRanges(segments, ranges, text) {
  const work = new Map();
  const queue = (segment, range) => {
    if (!work.has(segment)) work.set(segment, []);
    work.get(segment).push(range);
  };
  for (const range of ranges) {
    const whole = segments.find((candidate) => range.start >= candidate.start && range.end <= candidate.end);
    if (whole) {
      queue(whole, range);
      continue;
    }
    // "The **Queen of Cups**" splits a name across formatting; mark each part
    // except a bare article.
    for (const segment of segments) {
      const start = Math.max(range.start, segment.start);
      const end = Math.min(range.end, segment.end);
      if (end <= start || /^\s*(?:the\s*)?$/i.test(text.slice(start, end))) continue;
      queue(segment, { ...range, start, end });
    }
  }
  for (const [segment, local] of work) {
    const { node, parent } = segment;
    const value = node.value;
    const parts = [];
    let cursor = 0;
    for (const range of local.sort((a, b) => a.start - b.start)) {
      const from = range.start - segment.start;
      const to = range.end - segment.start;
      if (from > cursor) parts.push({ type: 'text', value: value.slice(cursor, from) });
      parts.push(linkNode(range, value.slice(from, to)));
      cursor = to;
    }
    if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) });
    const at = parent.children.indexOf(node);
    if (at >= 0) parent.children.splice(at, 1, ...parts);
  }
}

function setBlockData(node, properties) {
  node.data = node.data || {};
  node.data.hProperties = { ...(node.data.hProperties || {}), ...properties };
}

/**
 * Remark plugin: wraps card names and described details in spans and labels
 * each block with the cards it speaks about.
 *
 * Block properties: `data-reading-block` (sequence), `data-block-cards`
 * (indices in order), `data-block-primary`, `data-block-mode`
 * (single | sweep | none), `data-block-touches` ("card:point …") and, on the
 * paragraph that opens a card's passage, `data-card-intro`.
 */
export function remarkCardLinks(options = {}) {
  const catalog = options.catalog || null;
  return (tree) => {
    if (options.authoredOnly || options.associations?.length) {
      annotateAuthoredRanges(tree, options.associations || []);
      return;
    }
    if (!catalog) return;
    // Readings usually open with an overview that names every card; a card's
    // plate belongs with its own passage, not that summary.
    const state = { context: null, pendingIntro: null, introduced: new Set(), sequence: 0, headings: 0, inOverview: false };

    const annotate = (node, kind) => {
      const { segments, text } = collectSegments(node, { paragraphsOnly: kind === 'listItem' });
      // Only prose continues a card's passage; headings and bullets stand alone.
      const analysis = analyzeBlock(text, catalog, {
        context: kind === 'paragraph' ? state.context : null,
        allowTouches: kind !== 'heading'
      });

      if (kind === 'heading') {
        const named = uniqueInOrder(analysis.mentions.map((mention) => mention.card));
        state.context = named.length === 1 ? named[0] : null;
        state.pendingIntro = state.context;
        state.headings += 1;
        state.inOverview = state.headings === 1 && state.context === null;
      } else if (kind === 'paragraph' && analysis.intro !== null) {
        state.context = analysis.intro;
      }

      let introCard = null;
      if (kind === 'paragraph' && !state.inOverview) {
        const candidate = analysis.intro ?? state.pendingIntro;
        if (candidate !== null && !state.introduced.has(candidate)) {
          introCard = candidate;
          state.introduced.add(candidate);
        }
      }
      if (kind !== 'heading') state.pendingIntro = null;

      wrapRanges(segments, [...analysis.mentions, ...analysis.touches], text);
      state.sequence += 1;
      setBlockData(node, {
        dataReadingBlock: String(state.sequence),
        dataBlockCards: analysis.cards.join(' '),
        dataBlockPrimary: analysis.primary === null ? '' : String(analysis.primary),
        dataBlockMode: analysis.mode,
        dataBlockTouches: analysis.touches.map((touch) => `${touch.card}:${touch.point}`).join(' '),
        ...(introCard !== null ? { dataCardIntro: String(introCard) } : {})
      });
    };

    const visitFlow = (nodes) => {
      for (const node of nodes || []) {
        if (node.type === 'heading') annotate(node, 'heading');
        else if (node.type === 'paragraph') annotate(node, 'paragraph');
        else if (node.type === 'list') {
          for (const item of node.children || []) {
            annotate(item, 'listItem');
            visitFlow((item.children || []).filter((child) => child.type === 'list'));
          }
        } else if (node.type === 'blockquote') visitFlow(node.children);
      }
    };

    visitFlow(tree.children);
  };
}

/** Parse a rendered block's data attributes back into a focus description. */
export function readBlockFocus(element) {
  if (!element?.dataset) return null;
  const { readingBlock, blockCards, blockPrimary, blockMode, blockTouches } = element.dataset;
  const cards = (blockCards || '').split(' ').filter(Boolean).map(Number).filter(Number.isInteger);
  if (!readingBlock || cards.length === 0) return null;
  const touches = {};
  for (const token of (blockTouches || '').split(' ').filter(Boolean)) {
    const split = token.indexOf(':');
    const card = Number(token.slice(0, split));
    const point = token.slice(split + 1);
    if (!Number.isInteger(card) || !point) continue;
    touches[card] = touches[card] || [];
    if (!touches[card].includes(point)) touches[card].push(point);
  }
  const primary = blockPrimary === '' || blockPrimary === undefined ? null : Number(blockPrimary);
  return {
    key: `block:${readingBlock}:${blockCards}:${blockTouches || ''}`,
    mode: blockMode === 'sweep' ? 'sweep' : 'single',
    cards,
    primary: Number.isInteger(primary) ? primary : null,
    touches
  };
}

/** Resolve authored metadata only against its exact recorded raw source. */
export function resolveGestureSidecar({ sidecar, source, cards = [], artworkEdition } = {}) {
  const result = { associations: [], introductions: [], invalid: [] };
  const expected = sidecar?.expectedRaw;
  if (typeof expected !== 'string' || typeof source?.raw !== 'string' || !source.runId || !expected.startsWith(source.raw)
    || (['complete', 'completed'].includes(source.status) && source.raw !== expected)
    || (artworkEdition && sidecar.artworkEdition && artworkEdition !== sidecar.artworkEdition)) {
    result.invalid.push({ reason: 'source-or-edition-mismatch' });
    return result;
  }
  const target = (value) => {
    if (!value || !Number.isInteger(value.spreadIndex) || (value.detailIds !== undefined && (!Array.isArray(value.detailIds) || value.detailIds.some((id) => typeof id !== 'string')))) return null;
    const card = cards.find((card, index) => (card.index ?? index) === value.spreadIndex);
    const name = card && (getCanonicalCard(card)?.name || card.canonicalName || card.name || card.card);
    return name === value.canonicalName ? { occurrenceId: `${source.runId}:${value.spreadIndex}`, detailIds: [...(value.detailIds || [])] } : null;
  };
  const rangeValid = (range) => range && Number.isInteger(range.start) && Number.isInteger(range.end)
    && range.start >= 0 && range.end > range.start && range.end <= expected.length
    && range.quote === expected.slice(range.start, range.end);
  for (const association of sidecar.associations || []) {
    const targets = (association.targets || []).map(target);
    if (!association.id || !['identity', 'literal', 'interpretation', 'balance', 'relationship'].includes(association.kind)
      || !targets.length || targets.some((value) => !value) || !rangeValid(association.passage)
      || (association.meaningRange && !rangeValid(association.meaningRange))) {
      result.invalid.push({ id: association.id, reason: 'invalid-association' });
      continue;
    }
    if (association.passage.end > source.raw.length) continue;
    const { personalContext, ...rest } = association;
    const context = personalContext && (personalContext.type === 'recorded-fixture-context'
      ? sidecar.recordedContext?.reflectionsText
      : personalContext.type === 'question' ? source.question
        : personalContext.type === 'card-reflection' ? cards.find((card, index) => (card.index ?? index) === personalContext.spreadIndex)?.reflection : null);
    const validatedContext = typeof context === 'string' && typeof personalContext?.quote === 'string' && context.includes(personalContext.quote) ? personalContext : undefined;
    result.associations.push({ ...rest, targets: association.kind === 'identity' ? targets.map((value) => ({ ...value, detailIds: [] })) : targets,
      ...(validatedContext ? { personalContext: validatedContext } : {}) });
  }
  for (const introduction of sidecar.introductions || []) {
    const resolved = target(introduction);
    const boundaries = ['start', 'namedEnd', 'descriptionStart', 'midpoint', 'end'].map((key) => introduction[key]);
    if (!resolved || boundaries.some((value) => !Number.isInteger(value) || value < 0 || value > expected.length)
      || boundaries.some((value, index) => index > 0 && value < boundaries[index - 1])) {
      result.invalid.push({ reason: 'invalid-introduction', spreadIndex: introduction.spreadIndex });
      continue;
    }
    result.introductions.push({ ...introduction, occurrenceId: resolved.occurrenceId });
  }
  return result;
}

function annotateAuthoredRanges(tree, associations) {
  const ranges = associations.map((association) => ({ ...association.passage, association }));
  const overlapping = new Set();
  for (const a of ranges) for (const b of ranges) if (a !== b && a.start < b.end && b.start < a.end) { overlapping.add(a); overlapping.add(b); }
  const offsets = (node) => [node.position?.start?.offset, node.position?.end?.offset];
  const sliceNode = (node, start, end) => {
    const [from, to] = offsets(node);
    if (from >= end || to <= start) return undefined;
    if (from >= start && to <= end) return node;
    const position = { start: { ...node.position.start, offset: Math.max(start, from) }, end: { ...node.position.end, offset: Math.min(end, to) } };
    if (node.type === 'text') {
      // Decoded entities and escapes have no unambiguous character projection.
      if (to - from !== node.value.length) return null;
      return { ...node, value: node.value.slice(Math.max(start, from) - from, Math.min(end, to) - from),
        position };
    }
    if (!['strong', 'emphasis', 'delete'].includes(node.type)) return null;
    const children = node.children.filter((child) => { const [a, b] = offsets(child); return a < end && b > start; }).map((child) => sliceNode(child, start, end));
    if (children.includes(null)) return null;
    // An exact visible phrase can end before a Markdown closing delimiter.
    // Delimiter-only remainders carry no text and are safely absent, whereas
    // null means an unsupported projection and must reject the annotation.
    const content = children.filter(Boolean);
    return content.length ? { ...node, children: content, position } : undefined;
  };
  const visit = (node) => {
    if (['paragraph', 'heading'].includes(node.type)) {
      const [from, to] = offsets(node);
      for (const range of ranges.filter((value) => !overlapping.has(value) && value.start >= from && value.end <= to).sort((a,b) => b.start - a.start)) {
        const selected = node.children.filter((child) => { const [a,b] = offsets(child); return a < range.end && b > range.start; });
        const forbidden = (child) => !['text','strong','emphasis','delete'].includes(child.type) || child.children?.some(forbidden);
        if (!selected.length || selected.some(forbidden)) continue;
        const middle = selected.map((child) => sliceNode(child, range.start, range.end));
        if (middle.includes(null) || !middle.some(Boolean)) continue;
        const [firstStart] = offsets(selected[0]);
        const [,lastEnd] = offsets(selected.at(-1));
        const before = firstStart < range.start ? sliceNode(selected[0], firstStart, range.start) : undefined;
        const after = lastEnd > range.end ? sliceNode(selected.at(-1), range.end, lastEnd) : undefined;
        if (before === null || after === null) continue;
        const wrapper = { type: 'gestureAssociation', data: { hName: 'span', hProperties: {
          className: ['reading-gesture-association'], dataGestureId: range.association.id,
          dataSourceStart: String(range.start), dataSourceEnd: String(range.end), dataGestureLabel: range.association.label || range.quote.replace(/[*_]/g, '')
        } }, children: middle.filter(Boolean), position: { start: { offset: range.start }, end: { offset: range.end } } };
        node.children.splice(node.children.indexOf(selected[0]), selected.length, ...[before, wrapper, after].filter(Boolean));
      }
      return;
    }
    if (['code', 'html', 'link', 'inlineCode'].includes(node.type)) return;
    node.children?.forEach(visit);
  };
  visit(tree);
}
