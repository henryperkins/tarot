import { unified } from 'unified';
import remarkParse from 'remark-parse';

const SECTION_KEYWORDS = [
  { key: 'opening', keywords: ['opening', 'beginning', 'threshold', 'arrival'] },
  { key: 'cards', keywords: ['cards', 'the cards', 'story', 'throughline', 'spread', 'timeline'] },
  { key: 'synthesis', keywords: ['synthesis', 'bringing it together', 'overall', 'arc', 'summary', 'together'] },
  { key: 'guidance', keywords: ['guidance', 'moving forward', 'next steps', 'closing', 'gentle next', 'action'] },
  { key: 'guidance', keywords: ['reflections', 'reflection'] }
];

export function getSectionKeyFromHeading(heading) {
  if (!heading) return '';
  const normalized = heading.toLowerCase().trim();
  for (const entry of SECTION_KEYWORDS) {
    if (entry.keywords.some(keyword => normalized.includes(keyword))) {
      return entry.key;
    }
  }
  return '';
}

const parser = unified().use(remarkParse);
const headingText = node => node.value ?? node.children?.map(headingText).join('') ?? '';

// Keep the original document intact. Destinations use UTF-16 source offsets,
// so repeated headings and growing streamed prefixes retain their identity.
export function getReadingSections(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const headings = parser.parse(raw).children.filter(node => node.type === 'heading');
  const depth = Math.min(...headings.map(node => node.depth));
  const chapters = headings.filter(node => node.depth === depth).map(node => ({
    title: headingText(node),
    start: node.position.start.offset,
    headingStart: node.position.start.offset,
    depth: node.depth
  }));
  if (!chapters.length) chapters.push({ title: 'Your reading', start: 0, depth: null });
  else if (raw.slice(0, chapters[0].start).trim()) chapters.unshift({ title: 'Introduction', start: 0, depth: null });
  else chapters[0].start = 0;
  return chapters.map((chapter, index) => ({
    ...chapter,
    id: `reading-section-${chapter.headingStart ?? chapter.start}`,
    end: chapters[index + 1]?.start ?? raw.length
  }));
}

const plainCardName = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
const escapeCardName = value => value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const proseText = node => {
  if (['code', 'inlineCode', 'html', 'image'].includes(node.type)) return ' ';
  if (node.type === 'text') return node.value;
  return node.children?.map(proseText).join(['root', 'paragraph', 'heading', 'list', 'listItem'].includes(node.type) ? '\n' : '') || '';
};
const astrologicalAfter = /^\s+(?:(?:is|was)\s+)?(?:(?:just|now|currently)\s+)?(?:(?:in|enters|entering|moves\s+into|transits?)\s+(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)|waxing|waning|full|new)\b/i;

// Chapter art refers only to named cards actually drawn in this reading.
// Deck labels take precedence when an alias conflicts with a canonical name.
export function getReadingChapterCards(raw, cards = []) {
  if (typeof raw !== 'string' || !raw.trim() || !cards.length) return [];
  const text = plainCardName(proseText(parser.parse(raw)));
  const claims = new Map();
  const claim = (value, card, priority) => {
    const name = plainCardName(value);
    if (name.length < 3) return;
    const key = name.toLowerCase();
    const current = claims.get(key);
    if (!current || priority > current.priority) claims.set(key, { name, card, priority, tied: false });
    else if (priority === current.priority && current.card.index !== card.index) current.tied = true;
  };
  for (const card of cards) {
    for (const [name, priority] of [[card.canonicalName, 1], [card.name, 2]]) {
      claim(name, card, priority);
      const bare = /^The\s+(.+)$/.exec(name || '');
      if (bare) claim(bare[1], card, 0);
      const paired = /^(.+?)\s*\((?:RWS:\s*)?(.+?)\)$/.exec(name || '');
      if (paired) { claim(paired[1], card, priority); claim(paired[2], card, priority); }
    }
    if ([card.name, card.canonicalName].includes('Judgement')) claim('Judgment', card, 1);
  }
  const found = [];
  for (const { name, card, tied } of claims.values()) {
    if (tied) continue;
    const pattern = escapeCardName(name).replace(/^The /, '[Tt]he ').replace(/ /g, '\\s+');
    for (const match of text.matchAll(new RegExp(pattern, 'gu'))) {
      const start = match.index;
      const end = start + match[0].length;
      if (/[\p{L}\p{N}_]/u.test(text[start - 1] || '') || /[\p{L}\p{N}_]/u.test(text[end] || '')) continue;
      if (/(?:sun|moon|soleil|lune)$/i.test(match[0]) && (astrologicalAfter.test(text.slice(end))
        || /\b(?:full|new|waxing|waning|gibbous|crescent|harvest|blood)\s+$/i.test(text.slice(0, start)))) continue;
      found.push({ card, start, end });
    }
  }
  const kept = [];
  for (const match of found.sort((a, b) => b.end - b.start - (a.end - a.start))) {
    if (!kept.some(other => match.start < other.end && other.start < match.end)) kept.push(match);
  }
  const result = [...new Map(kept.sort((a, b) => a.start - b.start).map(match => [match.card.index, match.card])).values()];
  return result.length <= 2 ? result : [];
}
