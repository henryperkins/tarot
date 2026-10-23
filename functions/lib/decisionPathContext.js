import { DECISION_PATH_MAX_LENGTH } from '../../shared/contracts/readingRequestLimits.js';
import { sanitizeReadingContext, getReadingContextInputStats } from './readingCardContext.js';

// Only maps produced inside this module carry the marker. It never crosses
// JSON/schema boundaries: jobs retain raw requests and normalize in the route.
const NORMALIZED_PATHS = Symbol('normalizedDecisionPaths');

const PATHS = [['a', 'pathA', 1], ['b', 'pathB', 2]];
const stripPrefix = text => text.replace(/^\s*Path\s+[AB]\s*(?:[:—–-]\s*|$)/i, '').trim();
const isBoilerplate = text => /^(?:energy\s*(?:&|and)\s*likely outcome|energy\s*(?:&|and)\s*outcome)$/i.test(text);

/** Resolve request-local facts only. Raw safety text must never enter telemetry. */
export function resolveDecisionPathContext({ spreadKey, cardsInfo = [], decisionPaths = {} } = {}) {
  const result = { decisionPaths: {}, sources: [], inputStats: {}, rawSafetyText: '', diagnostics: [] };
  Object.defineProperty(result.decisionPaths, NORMALIZED_PATHS, { value: true });
  if (spreadKey !== 'decision') {
    if (Object.keys(decisionPaths || {}).length) result.diagnostics.push('decisionPaths:not_applicable');
    Object.freeze(result.decisionPaths);
    return result;
  }
  const canonicalInput = decisionPaths?.[NORMALIZED_PATHS] === true;
  const safety = [];
  for (const [key, id, cardIndex] of PATHS) {
    const explicit = Object.hasOwn(decisionPaths || {}, key);
    const position = typeof cardsInfo?.[cardIndex]?.position === 'string' ? cardsInfo[cardIndex].position : '';
    const legacy = stripPrefix(position);
    // Include all relevant raw positions, even overridden ones: instruction
    // filtering, explicit clears and excerpt limits must not hide crisis signals.
    if (position && legacy && !isBoilerplate(legacy)) safety.push(position);
    const raw = explicit ? decisionPaths[key] : legacy && !isBoilerplate(legacy) ? position : undefined;
    if (typeof raw !== 'string') continue;
    if (explicit) safety.push(raw);
    // Canonical values are opaque facts, including meaningful nested prefixes.
    // Both raw explicit values and raw legacy positions lose exactly one prefix.
    const label = canonicalInput && explicit ? raw : stripPrefix(raw);
    const safe = sanitizeReadingContext(label);
    let text = safe.slice(0, DECISION_PATH_MAX_LENGTH);
    if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
    result.decisionPaths[key] = text;
    result.inputStats[id] = {
      ...getReadingContextInputStats(raw, safe),
      sanitizedLength: safe.length,
      limitApplied: safe.length > DECISION_PATH_MAX_LENGTH
    };
    if (raw) result.sources.push({ id, kind: 'decisionPath', pathKey: key, cardIndex, origin: explicit ? 'explicit' : 'position', text, originalLength: raw.length, sanitizedLength: safe.length });
  }
  result.rawSafetyText = safety.join('\n');
  Object.freeze(result.decisionPaths);
  return result;
}

/** Stable presentation roles prevent legacy labels bypassing their bounded fields.
 * Return copies only; the request's card/position identity stays untouched.
 */
export function decisionPathRoleCards(cardsInfo = []) {
  return cardsInfo.map((card, index) => index === 1 || index === 2
    ? { ...card, position: `Path ${index === 1 ? 'A' : 'B'} — energy & likely outcome` }
    : card);
}
