/**
 * Plain-text preview and title helpers for saved journal entries.
 */

const EXCERPT_CHAR_LIMIT = 220;

/** "Three-Card Story (Past · Present · Future)" → "Three-Card Story". */
export function shortSpreadName(name) {
  if (typeof name !== 'string') return '';
  const short = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return short || name.trim();
}

function stripInlineMarkdown(line) {
  return line
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a plain-text preview for Comfortable archive cards.
 * Personal reflections lead so the reader's own voice surfaces first;
 * otherwise the opening prose of the saved reading is summarized without
 * Markdown syntax or repeating the entry question.
 */
export function buildEntryExcerpt(reflections, narrativeText, question = '') {
  const normalizedQuestion = typeof question === 'string'
    ? question.replace(/\s+/g, ' ').trim().toLowerCase()
    : '';

  if (Array.isArray(reflections) && reflections.length > 0) {
    const [label, rawNote] = reflections[0];
    const cleanNote = typeof rawNote === 'string' ? rawNote.replace(/\s+/g, ' ').trim() : '';
    if (cleanNote) {
      return {
        kind: 'reflection',
        label: label || 'Reflection',
        text: cleanNote.length > EXCERPT_CHAR_LIMIT
          ? `${cleanNote.slice(0, EXCERPT_CHAR_LIMIT).trimEnd()}…`
          : cleanNote
      };
    }
  }

  if (typeof narrativeText !== 'string' || !narrativeText.trim()) {
    return null;
  }

  // Inspect only a bounded prefix so long readings stay O(1) while scrolling or filtering.
  const lines = narrativeText.slice(0, 1600).split(/\r?\n/);
  const proseParts = [];
  let collectedLength = 0;
  let inFence = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !trimmed) {
      if (proseParts.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed) || /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (proseParts.length > 0) break;
      continue;
    }
    const unwrapped = trimmed
      .replace(/^>\s*/, '')
      .replace(/^(?:[-*+]|\d+\.)\s+/, '');
    const clean = stripInlineMarkdown(unwrapped);
    if (!clean) continue;
    if (proseParts.length === 0 && normalizedQuestion && clean.toLowerCase() === normalizedQuestion) {
      continue;
    }
    proseParts.push(clean);
    collectedLength += clean.length;
    if (collectedLength >= EXCERPT_CHAR_LIMIT) break;
  }

  const combined = proseParts.join(' ').trim();
  if (!combined) return null;

  return {
    kind: 'narrative',
    text: combined.length > EXCERPT_CHAR_LIMIT
      ? `${combined.slice(0, EXCERPT_CHAR_LIMIT).trimEnd()}…`
      : combined
  };
}
