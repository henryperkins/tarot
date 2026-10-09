import { buildHeuristicScores, checkEvalGate } from './evaluation.js';
import { getLocalComposerLanguageSupport } from './narrativeBackends.js';
import { detectHallucinatedCards } from './readingQuality.js';

const MAX_BYTES = 262144;

/**
 * Release completed prose units without rewriting their source offsets. These
 * deterministic checks cover the delivered prefix; whole-reading structure and
 * coverage still need validation before the stream can announce completion.
 */
export function createReadingPassageGuard({ cardsInfo, spreadKey, deckStyle = 'rws-1909' }) {
  let raw = '';
  let deliveredEnd = 0;
  let bytes = 0;
  let closed = false;
  const encoder = new TextEncoder();
  const reject = () => {
    closed = true;
    throw Object.assign(new Error('This reading could not be completed. Please try again.'), {
      code: 'reading_stream_rejected'
    });
  };
  const acceptThrough = end => {
    const prefix = raw.slice(0, end);
    if (!getLocalComposerLanguageSupport(prefix).supported) reject();
    // Coverage and spine are incomplete by definition while text is arriving.
    // Only pass metrics that can already be assessed for this delivered prefix.
    const metrics = { hallucinatedCards: detectHallucinatedCards(prefix, cardsInfo, deckStyle) };
    const result = buildHeuristicScores(metrics, spreadKey, {
      readingText: prefix, cardCount: cardsInfo.length
    });
    if (checkEvalGate(result).shouldBlock) reject();
    const chunk = raw.slice(deliveredEnd, end);
    deliveredEnd = end;
    return chunk;
  };
  return {
    push(delta) {
      if (closed) throw new Error('Reading passage stream is closed.');
      if (typeof delta !== 'string') reject();
      bytes += encoder.encode(delta).byteLength;
      if (bytes > MAX_BYTES) reject();
      raw += delta;
      const ready = [];
      const pending = raw.slice(deliveredEnd);
      const base = deliveredEnd;
      // Wait for whitespace after sentence punctuation, or a paragraph break.
      // An unterminated clause stays private until its qualification can arrive.
      const boundaries = /[.!?]["'’”)\]]*[ \t\r\n]+|\n[ \t\r]*\n/g;
      for (const match of pending.matchAll(boundaries)) {
        ready.push(acceptThrough(base + match.index + match[0].length));
      }
      return ready;
    },
    finish() {
      if (closed) throw new Error('Reading passage stream is closed.');
      const tail = deliveredEnd < raw.length ? [acceptThrough(raw.length)] : [];
      closed = true;
      return tail;
    },
    get fullText() { return raw; }
  };
}
