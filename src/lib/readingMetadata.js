import { sanitizeSourceUsage } from '../../shared/readingSourceUsage.js';

// Replace the previous reading's metadata; never merge across reading identities.
export function readingMetadataFromEntry(entry = {}) {
  return {
    readingId: entry.id || null,
    requestId: entry.requestId || null,
    provider: entry.provider || null,
    spreadKey: entry.spreadKey || null,
    spreadName: entry.spreadName || entry.spread || null,
    deckStyle: entry.deckId || null,
    userQuestion: entry.question || '',
    graphContext: entry.themes?.knowledgeGraph || null,
    ephemeris: null,
    sourceUsage: entry.provider === 'safe-fallback' ? null : sanitizeSourceUsage(entry.sourceUsage)
  };
}
