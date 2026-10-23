// scripts/enrichment/lib/knowledgeExtraction.js
// Deterministic extraction of card evidence from fetched web sources.
//
// Fetched pages are untrusted remote input. Everything here only recognizes
// structure (headings, keyword lines, symbol labels) and never interprets or
// executes anything found in the page.

export const PASSAGE_CONTEXTS = Object.freeze([
  'grief',
  'relationship',
  'career',
  'health',
  'spiritual',
  'transition',
  'shadow'
]);

const HEADING = /^\s{0,3}#{1,6}\s+/;
const KEYWORD_LINE = /^\s*(upright|reversed|reverse)\s*:\s*(.+)$/i;
const POINT_HEADING = /^\s*point\s+\d+\s*[–—-]\s*(.+)$/i;
const SECTION_LINE = /^\s*(?:the\s+[a-z' -]+\s+)?(upright|reversed|reverse)\b[\s:.-]*$/i;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitKeywords(value) {
  return String(value || '')
    .split(/[,;]/)
    .map((entry) => entry.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
}

function isSectionStart(line) {
  const text = line.replace(HEADING, '').trim();
  if (!text) return false;
  if (KEYWORD_LINE.test(line)) return false;
  if (SECTION_LINE.test(text)) return true;
  // A bare "Upright" or "Reverse" heading, with or without a card prefix.
  return /^(upright|reversed|reverse)\b/i.test(text) && text.length <= 60;
}

function sectionKind(line) {
  const text = line.replace(HEADING, '').trim();
  const match = SECTION_LINE.exec(text) || /^([a-z]+)\b/i.exec(text);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  return kind === 'reverse' ? 'reversed' : kind;
}

/**
 * Pull the card's own name variants out of a title so matching is exact.
 */
function cardVariants(name) {
  const bare = name.replace(/^The\s+/i, '').trim();
  return [name, bare].filter(Boolean);
}

/**
 * Identify which Major Arcana card a source is about.
 * A name alone is not enough: "The Sun" and "The World" appear in ordinary
 * prose, so a tarot context signal is required as well.
 */
export function detectCard({ title = '', content = '' }, catalog) {
  const haystack = normalize(`${title}. ${content}`).toLowerCase();
  const titleText = normalize(title).toLowerCase();
  const hasTarotContext = /\btarot\b|\bmajor arcana\b|\btarot card\b|\bwands?\b|\bcups?\b|\bpentacles?\b|\bswords?\b/.test(haystack);
  if (!hasTarotContext) return null;

  let best = null;
  for (const card of catalog) {
    for (const variant of cardVariants(card.name)) {
      const pattern = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!pattern.test(haystack)) continue;
      const index = haystack.search(pattern);
      const inTitle = pattern.test(titleText);
      const confidence = inTitle ? 'high' : index < 240 ? 'medium' : 'low';
      const score = (inTitle ? 1000 : 0) - index + variant.length;
      if (!best || score > best.score) {
        best = { cardNumber: card.number, cardName: card.name, confidence, score, index };
      }
    }
  }
  if (!best) return null;
  return { cardNumber: best.cardNumber, cardName: best.cardName, confidence: best.confidence };
}

/**
 * Extract card evidence: orientation keywords, symbol labels, and the prose
 * under the upright and reversed sections.
 */
export function extractEvidence(content) {
  const text = String(content || '');
  const lines = text.split(/\r?\n/);
  const uprightKeywords = [];
  const reversedKeywords = [];
  const symbols = [];
  const uprightLines = [];
  const reversedLines = [];
  let section = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const keywordMatch = KEYWORD_LINE.exec(trimmed);
    if (keywordMatch) {
      const kind = keywordMatch[1].toLowerCase() === 'reverse' ? 'reversed' : keywordMatch[1].toLowerCase();
      const values = splitKeywords(keywordMatch[2]);
      if (kind === 'reversed') reversedKeywords.push(...values);
      else uprightKeywords.push(...values);
      continue;
    }

    const pointMatch = POINT_HEADING.exec(trimmed);
    if (pointMatch) {
      symbols.push(normalize(pointMatch[1]));
      continue;
    }

    if (isSectionStart(line)) {
      section = sectionKind(line);
      continue;
    }

    if (section === 'reversed') reversedLines.push(normalize(line));
    else if (section === 'upright') uprightLines.push(normalize(line));
  }

  return {
    uprightKeywords: [...new Set(uprightKeywords)],
    reversedKeywords: [...new Set(reversedKeywords)],
    symbols: [...new Set(symbols)],
    uprightText: uprightLines.join(' '),
    reversedText: reversedLines.join(' ')
  };
}

function sentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30);
}

function pickSentences(text, limit, maxChars) {
  return sentences(text)
    .filter((sentence) => sentence.length <= maxChars)
    .slice(0, limit);
}

/**
 * Build a compact, labelled digest of the evidence. The digest is what a
 * drafting model sees, so it is deliberately smaller than the source and never
 * contains the article verbatim.
 */
export function buildDigest({ card, evidence, maxChars = 1600 }) {
  const parts = [`Card: ${card.cardName} (Major Arcana ${card.cardNumber})`];
  if (evidence.uprightKeywords.length) {
    parts.push(`Upright keywords: ${evidence.uprightKeywords.join(', ')}`);
  }
  if (evidence.reversedKeywords.length) {
    parts.push(`Reversed keywords: ${evidence.reversedKeywords.join(', ')}`);
  }
  if (evidence.symbols.length) {
    parts.push(`Symbols depicted: ${evidence.symbols.join(', ')}`);
  }
  const upright = pickSentences(evidence.uprightText, 2, 320);
  if (upright.length) parts.push(`Upright notes: ${upright.join(' ')}`);
  const reversed = pickSentences(evidence.reversedText, 2, 320);
  if (reversed.length) parts.push(`Reversed notes: ${reversed.join(' ')}`);

  let digest = parts.join('\n');
  if (digest.length > maxChars) {
    digest = `${digest.slice(0, maxChars - 1).trimEnd()}…`;
  }
  return digest;
}

/**
 * A source is worth drafting from when it names a card and carries at least
 * one orientation signal.
 */
export function assessEvidence(evidence) {
  const signals = evidence.uprightKeywords.length
    + evidence.reversedKeywords.length
    + evidence.symbols.length
    + (evidence.uprightText ? 1 : 0)
    + (evidence.reversedText ? 1 : 0);
  if (signals === 0) {
    return { sufficient: false, reason: 'No orientation keywords, symbols, or section text found.' };
  }
  return { sufficient: true, reason: null };
}
