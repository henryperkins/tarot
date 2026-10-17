// Small, synchronous binding checks used before any optional reading UI loads.
// The full proposal schemas remain in visualCueBatches; parity is tested there.
const FIELDS = ['readingResultId', 'sourceRevision', 'spreadHash', 'contextHash', 'artworkEdition', 'catalogVersion'];
const DIGEST = /^[a-f0-9]{64}$/;
const nonempty = value => typeof value === 'string' && value.length > 0;

export function isVisualCueBinding(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === FIELDS.length && Object.keys(value).every(key => FIELDS.includes(key))
    && nonempty(value.readingResultId) && Number.isSafeInteger(value.sourceRevision) && value.sourceRevision >= 0
    && typeof value.spreadHash === 'string' && DIGEST.test(value.spreadHash)
    && typeof value.contextHash === 'string' && DIGEST.test(value.contextHash)
    && nonempty(value.artworkEdition) && nonempty(value.catalogVersion));
}

export function canonicalVisualCueJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalVisualCueJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalVisualCueJSON(value[key])}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Visual cue data must be JSON serializable');
  return serialized;
}

export function sameVisualCueBinding(left, right) {
  return isVisualCueBinding(left) && isVisualCueBinding(right)
    && FIELDS.every(key => left[key] === right[key]);
}

export async function hashVisualCueText(text) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
