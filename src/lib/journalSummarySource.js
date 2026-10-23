import { getTimestamp } from '../../shared/journal/utils.js';

// Select explicit cloud entries so a later save cannot silently change what
// a "recent" summary request means. The endpoint accepts at most ten entries.
export function getSummaryCandidates(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    const id = entry?.id == null ? '' : String(entry.id).trim();
    if (!id || id.startsWith('local-') || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).sort((a, b) => (getTimestamp(b) || 0) - (getTimestamp(a) || 0));
}

function sourceContent(entry) {
  return JSON.stringify([
    getTimestamp(entry), entry.spread, entry.spreadKey, entry.question,
    entry.cards, entry.themes, entry.context, entry.reflections, entry.personalReading,
  ]);
}

export function captureSummarySource(entries) {
  return entries.map((entry) => ({ id: String(entry.id), content: sourceContent(entry) }));
}

export function summarySourceMatches(source, entries) {
  const byId = new Map(entries.map((entry) => [String(entry.id), entry]));
  return source.every(({ id, content }) => {
    const entry = byId.get(id);
    return entry && sourceContent(entry) === content;
  });
}
