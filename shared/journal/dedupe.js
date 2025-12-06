/**
 * Deduplicate journal entries by stable keys.
 * Priority:
 * 1) sessionSeed (server-side dedupe constraint)
 * 2) Composite fingerprint of timestamp + spreadKey + question + cards signature
 *
 * Returns a new array sorted by descending timestamp.
 */
export function dedupeEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const seen = new Set();
  const normalized = [];

  const getTimestamp = (entry) => {
    const candidates = [entry?.ts, entry?.created_at, entry?.updated_at]
      .map((value) => (Number.isFinite(value) ? (value < 1e12 ? value * 1000 : value) : null));
    return candidates.find(Boolean) || null;
  };

  const buildCardsSignature = (cards = []) => {
    if (!Array.isArray(cards) || cards.length === 0) return '';
    return cards
      .map((card) => {
        if (!card) return 'card:unknown';
        const pos = card.position || card.slot || '';
        const name = card.name || card.card || 'unknown';
        const orientation = card.orientation || (card.isReversed ? 'reversed' : 'upright') || '';
        return `${pos}|${name}|${orientation}`.toLowerCase();
      })
      .join(';');
  };

  entries.forEach((entry) => {
    if (!entry) return;
    const ts = getTimestamp(entry);
    const sessionSeed = entry.sessionSeed || entry.session_seed || null;
    const cardsSig = buildCardsSignature(entry.cards || entry.cards_json || []);
    const question = (entry.question || entry.prompt || '').trim().toLowerCase();
    const spreadKey = (entry.spreadKey || entry.spread_key || '').toLowerCase();
    const fingerprint = sessionSeed
      ? `seed:${sessionSeed}`
      : `ts:${ts || 'none'}|spread:${spreadKey}|q:${question}|cards:${cardsSig}`;

    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    normalized.push({ ...entry, ts });
  });

  return normalized
    .sort((a, b) => {
      const tsA = getTimestamp(a) || 0;
      const tsB = getTimestamp(b) || 0;
      return tsB - tsA;
    });
}

export default dedupeEntries;
