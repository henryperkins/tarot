/**
 * Conservative, source-addressed alignment for live or hydrated Markdown.
 * Identity works across the spread; physical rules cover only reviewed vector
 * details. An unmatched metaphor remains ordinary prose. This is not a general
 * semantic model, and word overlap never establishes personal context.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { MAJOR_RULES } from '../data/cardGestureDetails/majors.js';
import { CUP_PENTACLE_RULES } from '../data/cardGestureDetails/cupsPentacles.js';
import { WAND_SWORD_RULES } from '../data/cardGestureDetails/wandsSwords.js';
import { getVectorGestureDetails } from '../data/cardGestureArtwork.js';
import { getCanonicalCard } from './cardLookup.js';
import { buildCardLinkCatalog, findCardMentions } from './narrativeCardLinks.js';
import { validatePassageAssociationsPayload } from '../../shared/contracts/readingPassageAssociations.js';

const VECTOR_EDITION = 'rws-immanuelle-vector';
const parser = unified().use(remarkParse).use(remarkGfm);
const WORD = /[\p{L}\p{N}_]/u;
const OPAQUE = new Set(['link', 'linkReference', 'image', 'imageReference', 'code', 'inlineCode', 'html', 'delete']);
const EXPANDED_RULES = { ...MAJOR_RULES, ...CUP_PENTACLE_RULES, ...WAND_SWORD_RULES };

// A symbol label alone cannot establish a painted detail. These predicates
// require a physical description in the same sentence and the right card.
const LITERAL_RULES = {
  ...EXPANDED_RULES,
  'The Star': [
    { id: 'pool-pour', match: /\bpool\b/giu, scene: /\b(?:pour\w*|flow\w*|water|pitcher\w*)\b/i, before: /\b(?:into|towards?|in|touches)\s+(?:(?:a|the)\s+)?$/i },
    { id: 'land-pour', match: /\bland\b/giu, scene: /\b(?:pour\w*|flow\w*|water|pitcher\w*)\b/i, before: /\b(?:onto|on|touches)\s+(?:the\s+)?$/i }
  ],
  'The Hermit': [{ id: 'lantern', match: /\blantern\b/giu, scene: /\b(?:holds?|holding|held|carr\w*|rais\w*|light\w*|glow\w*|shin\w*)\b/i }],
  'Five of Wands': [{ id: 'staffs', match: /\b(?:staffs|staves|scrum)\b/giu, scene: /\b(?:figures?|people|men|swing\w*|rais\w*|hold\w*|cross\w*|clash\w*)\b/i }],
  'Ace of Wands': [
    { id: 'sprout', match: /\bsprouting leaves\b|\bsprouts?\b/giu, scene: /\b(?:wand|hand|cloud)\b/i },
    { id: 'castle', match: /\bcastle\b/giu, scene: /\b(?:hills?|distance|distant|landscape)\b/i }
  ],
  'Seven of Swords': [
    { id: 'carried', match: /\bfive swords\b/giu, scene: /\b(?:figure|camp|carr\w*|tiptoe\w*)\b/i },
    { id: 'two-swords', match: /\bleaving two behind\b|\btwo (?:planted |standing )?swords\b/giu, scene: /\b(?:camp|behind|plant\w*|leav\w*|standing)\b/i }
  ],
  'Queen of Cups': [{ id: 'cup', match: /\b(?:ornate,?\s+)?covered cup\b/giu, scene: /\b(?:hold\w*|held|sits?|seated)\b/i }],
  'Three of Pentacles': [{ id: 'collaborators', match: /\ba craftsman\b|\bcraftsman\b/giu, scene: /\b(?:cathedral|monk|noble)\b/i }],
  'Wheel of Fortune': [{ id: 'wheel', match: /\b(?:great )?wheel\b/giu, scene: /\b(?:sphinx|snake|Anubis)\b/i }]
};

/** Keep raw offsets while excluding Markdown nodes the renderer cannot annotate. */
function proseBlocks(raw) {
  const blocks = [];
  const walk = node => {
    if (OPAQUE.has(node.type)) return;
    if (node.type === 'paragraph' || node.type === 'heading') {
      let text = '';
      let htmlSeen = false;
      const offsets = [];
      const append = child => {
        // Raw HTML can contain prose-like children. Conservatively leave its
        // paragraph suffix unannotated without retracting earlier plain text.
        if (child.type === 'html') htmlSeen = true;
        if (htmlSeen) { text += '\uFFFC'; offsets.push(null); return; }
        if (OPAQUE.has(child.type)) { text += '\uFFFC'; offsets.push(null); return; }
        if (child.type === 'text') {
          const start = child.position?.start.offset;
          const end = child.position?.end.offset;
          // Entities/escapes need a separate projection; never guess their span.
          if (raw.slice(start, end) !== child.value) { text += '\uFFFC'; offsets.push(null); return; }
          // Unclosed links, references, code and emphasis may change node type
          // on a later chunk. Do not publish cues in that unstable suffix.
          const unstable = child.value.search(/[[\]`<*_]/);
          const value = unstable < 0 ? child.value : child.value.slice(0, unstable);
          for (let i = 0; i < value.length; i++) { text += value[i]; offsets.push(start + i); }
          if (unstable >= 0) { text += '\uFFFC'; offsets.push(null); }
          return;
        }
        if (child.type === 'break') { text += '\n'; offsets.push(null); return; }
        for (const nested of child.children || []) append(nested);
      };
      append(node);
      blocks.push({ text, offsets, heading: node.type === 'heading', end: node.position.end.offset });
      return;
    }
    for (const child of node.children || []) walk(child);
  };
  walk(parser.parse(raw));
  return blocks;
}

function sentences(block, raw, complete) {
  const chunks = [];
  const pattern = /[^.!?\uFFFC]+(?:[.!?]+["’”')]*(?=\s|$)|$)/gu;
  for (const match of block.text.matchAll(pattern)) {
    const leading = match[0].length - match[0].trimStart().length;
    const text = match[0].trim();
    if (!text) continue;
    const offset = match.index + leading;
    const end = offset + text.length;
    const closed = complete || /[.!?]["’”')]*$/.test(text)
      || (block.heading ? /^\n/.test(raw.slice(block.end)) : /\n\s*\n/.test(raw.slice(block.end)));
    chunks.push({ text, offset, closed, end });
  }
  return chunks;
}

function sourceSpan(block, from, to, raw, complete) {
  const start = block.offsets[from];
  const last = block.offsets[to - 1];
  if (!Number.isInteger(start) || !Number.isInteger(last)) return null;
  if (block.offsets.slice(from, to).some(value => value === null)) return null;
  const end = last + 1;
  // A trailing word can still become poolside, Starfish, etc. A closing
  // Markdown delimiter or an observed separator commits its boundary.
  if ((!complete && end === raw.length) || WORD.test(raw[end] || '')) return null;
  return { start, end, quote: raw.slice(start, end) };
}

/**
 * All cards use the same conservative physical-clause boundary. A closed
 * sentence supplies negation/qualifiers before any detail is published.
 * Observation language ("you see him holding...") is distinct from assigning
 * the image to the reader ("you hold..."). Commas within adjective lists are
 * not clause boundaries. This English fallback makes no interpretive claims.
 */
function physicalClause(scene, from, to, sentence) {
  const nonDepiction = /^\s*(?:metaphorically|figuratively|consider|imagine|envision|suppose|pretend|if|what if|let)\b/i;
  if (nonDepiction.test(sentence) || nonDepiction.test(scene)) return null;
  let start = 0;
  let end = scene.length;
  // Split only a new clause or explicit qualifier, not "ornate, covered cup".
  const boundaries = /;|\b(?:but|whereas)\b|\b(?:and|while)\s+(?=(?:you|your|we|our|I|my)\b)|,(?=\s*(?:(?:and|or)\s+)?(?:you|your|we|our|I|my|a|an|the|not|no|never|without|remind\w*|suggest\w*|symboli[sz]\w*|represent\w*)\b)/giu;
  for (const boundary of scene.matchAll(boundaries)) {
    if (boundary.index + boundary[0].length <= from) start = boundary.index + boundary[0].length;
    else if (boundary.index >= to) { end = boundary.index; break; }
    else return null;
  }
  let clause = scene.slice(start, end);
  if (nonDepiction.test(clause)) return null;
  const interpretation = clause.search(/\b(?:as a metaphor|metaphorically|figuratively|symboliz\w*|symbolis\w*|represent\w*|suggest\w*|remind\w*|invit\w*)\b/i);
  if (interpretation >= 0) {
    if (interpretation < to - start) return null;
    clause = clause.slice(0, interpretation);
  }
  // Remove only affirmative observation framing. "You do not see..." and
  // "you see yourself..." still fail the pronoun/negation checks below.
  clause = clause.replace(/^\s*(?:(?:in|on) (?:the|this) (?:card|image|picture|artwork),?\s*)?you\s+(?:(?:can|may|will)\s+)?(?:see|notice|observe)\s+/i, '');
  if (/\b(?:you|your|yours|yourself|yourselves|we|our|ours|ourselves|us|I|my|mine|myself|me)\b/i.test(clause)) return null;
  if (/\b(?:no|not|never|neither|without|cannot|\w+n['’]t)\b/i.test(clause)) return null;
  return clause;
}

export function alignReadingPassages({
  rawText, cards = [], deckStyle = 'rws-1909', artworkEdition = cards?.[0]?.artworkEdition || 'unknown',
  userQuestion = '', querentReflections = null, sourceComplete = true
} = {}) {
  const raw = typeof rawText === 'string' ? rawText : '';
  const empty = { artworkEdition, expectedRaw: raw, associations: [], introductions: [], errors: [] };
  if (!raw || !Array.isArray(cards) || !cards.length) return empty;
  const normalized = cards.map((card, index) => {
    const canonicalName = getCanonicalCard(card)?.name || card.canonicalName || card.name || card.card;
    return { ...card, index: card.index ?? index, name: canonicalName, canonicalName };
  });
  const byIndex = new Map(normalized.map(card => [card.index, card]));
  const catalog = buildCardLinkCatalog({ cards: normalized, deckStyle });
  if (!catalog) return empty;
  const introductions = new Map();
  const candidates = [];
  let context = null;
  const supported = name => artworkEdition === VECTOR_EDITION
    && normalized.filter(card => card.canonicalName === name).every(card => !card.artworkEdition || card.artworkEdition === VECTOR_EDITION)
    ? getVectorGestureDetails(name) : [];
  const target = (index, detailIds = []) => ({ spreadIndex: index, canonicalName: byIndex.get(index).canonicalName, detailIds });
  const add = (kind, passage, targets) => {
    if (!passage) return;
    candidates.push({ id: `${kind}-${targets.map(t => t.spreadIndex).join('-')}-${passage.start}`, kind,
      label: targets.map(t => t.canonicalName).join(' & '), passage, targets });
  };

  for (const block of proseBlocks(raw)) {
    if (block.heading) context = null;
    const blockMentions = findCardMentions(block.text, catalog).flatMap(mention => {
      const passage = sourceSpan(block, mention.start, mention.end, raw, sourceComplete);
      return passage ? [{ ...mention, passage }] : [];
    });
    for (const mention of blockMentions) {
      if (introductions.has(mention.card)) continue;
      const { start, end } = mention.passage;
      introductions.set(mention.card, { spreadIndex: mention.card, canonicalName: byIndex.get(mention.card).canonicalName,
        start, namedEnd: end, descriptionStart: end, midpoint: end, end, dynamic: true, pending: !sourceComplete });
    }

    const inheritedContext = context;
    for (const sentence of sentences(block, raw, sourceComplete)) {
      const mentions = blockMentions.filter(m => m.start >= sentence.offset && m.end <= sentence.end);
      const unique = [...new Set(mentions.map(m => m.card))];
      // Commit named associations only when the sentence/heading is closed:
      // an arriving second name must not replace a reader-held first-name cue.
      if (sentence.closed) {
        const between = mentions.length === 2 ? block.text.slice(mentions[0].end, mentions[1].start) : '';
        const paired = unique.length === 2 && /^\s*,?\s*(?:and|with|alongside|versus)\s+(?:the\s+)?$/i.test(between);
        if (paired) {
          const first = mentions[0];
          const last = mentions.at(-1);
          const prefix = block.text.slice(sentence.offset, first.start);
          const start = /^The\s+$/i.test(prefix) ? sentence.offset : first.start;
          const passage = sourceSpan(block, start, last.end, raw, sourceComplete);
          // Naming cards together establishes only identity. Detail-bearing
          // interpretation belongs to a validated semantic association source.
          add('relationship', passage, unique.map(index => target(index)));
        } else {
          for (const mention of mentions) add('identity', mention.passage, [target(mention.card)]);
        }
      }

      const possibleOwners = [...new Set([context, ...mentions.map(m => m.card)])].filter(index => index !== null);
      const literal = [];
      if (!block.heading) for (const index of possibleOwners) {
        const card = byIndex.get(index);
        // Never publish a detail before its possible negation has arrived.
        if (!sentence.closed) continue;
        const available = new Set(supported(card.canonicalName).map(detail => detail.id));
        for (const rule of LITERAL_RULES[card.canonicalName] || []) {
          if (!available.has(rule.id)) continue;
          for (const match of sentence.text.matchAll(rule.match)) {
            const at = sentence.offset + match.index;
            const preceding = mentions.filter(m => m.end <= at).at(-1);
            const owner = preceding?.card ?? context;
            if (owner !== index) continue;
            // A future named card cannot change ownership or lend its imagery
            // to an earlier detail in the sentence.
            const nextMention = mentions.find(m => m.start > at);
            const sceneStart = preceding ? preceding.end - sentence.offset : 0;
            const sceneEnd = nextMention ? nextMention.start - sentence.offset : sentence.text.length;
            const scene = sentence.text.slice(sceneStart, sceneEnd);
            const physical = physicalClause(scene, match.index - sceneStart, match.index + match[0].length - sceneStart, sentence.text);
            if (physical === null || !rule.scene.test(physical)) continue;
            if (rule.before && !rule.before.test(sentence.text.slice(sceneStart, match.index))) continue;
            const passage = sourceSpan(block, at, at + match[0].length, raw, sourceComplete);
            if (passage && !mentions.some(m => passage.start < m.passage.end && passage.end > m.passage.start)) literal.push({ passage, id: rule.id, index });
          }
        }
      }
      const describedDetails = new Set();
      for (const { passage, id, index } of literal.sort((a, b) => a.passage.start - b.passage.start)) {
        const key = `${index}:${id}`;
        if (describedDetails.has(key)) continue;
        describedDetails.add(key);
        add('literal', passage, [target(index, [id])]);
        const intro = introductions.get(index);
        if (intro?.pending) Object.assign(intro, { pending: false, descriptionStart: Math.max(intro.namedEnd, passage.start),
          midpoint: Math.max(intro.namedEnd, passage.start), end: Math.max(intro.namedEnd, passage.end) });
      }
      if (unique.length === 1) context = unique[0];
      else if (unique.length > 1) context = null;
    }
    // A closed paragraph with no supported image still gets a quiet identity
    // arrival. No future description offsets are invented from the prefix.
    if (sourceComplete || (!block.heading && /\n\s*\n/.test(raw.slice(block.end)))) {
      const described = new Set(blockMentions.map(mention => mention.card));
      if (!block.heading && inheritedContext !== null) described.add(inheritedContext);
      for (const index of described) {
        const intro = introductions.get(index);
        if (intro?.pending) Object.assign(intro, { pending: false, end: Math.max(intro.end, block.end), midpoint: Math.max(intro.midpoint, block.end) });
      }
    }
  }

  // Intentional priorities resolve same-span candidates before validation. The
  // renderer consumes source order, never artwork registry order.
  const associations = [];
  for (const cue of candidates.sort((a, b) => a.passage.start - b.passage.start || b.passage.end - a.passage.end)) {
    if (!associations.some(existing => cue.passage.start < existing.passage.end && cue.passage.end > existing.passage.start)) associations.push(cue);
  }
  const validation = validatePassageAssociationsPayload({ artworkEdition, expectedRaw: raw, associations, introductions: [...introductions.values()] },
    { rawText: raw, sourceComplete, cards: normalized, artworkEdition, getSupportedDetails: supported, userQuestion, reflections: querentReflections });
  return { artworkEdition, expectedRaw: raw, associations: validation.associations, introductions: validation.introductions, errors: validation.errors };
}

export function resolveDynamicPassages({ source, cards = [], artworkEdition } = {}) {
  if (!source?.runId || typeof source.raw !== 'string' || !source.raw) return { associations: [], introductions: [], invalid: [] };
  const aligned = alignReadingPassages({ rawText: source.raw, cards,
    sourceComplete: source.status === 'complete',
    artworkEdition: artworkEdition || cards[0]?.artworkEdition || 'unknown',
    userQuestion: source.question || source.userQuestion || '', querentReflections: source.reflectionsText || source.reflections || null });
  return {
    associations: aligned.associations.map(cue => ({ ...cue, targets: cue.targets.map(t => ({ ...t, occurrenceId: `${source.runId}:${t.spreadIndex}` })) })),
    introductions: aligned.introductions.map(intro => ({ ...intro, occurrenceId: `${source.runId}:${intro.spreadIndex}` })),
    invalid: aligned.errors
  };
}
