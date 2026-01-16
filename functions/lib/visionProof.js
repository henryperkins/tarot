import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';

const encoder = new TextEncoder();
const _decoder = typeof TextDecoder === 'function' ? new TextDecoder() : null;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_INSIGHTS = 10;
const MAX_REASONING_CHARS = 600;
const MAX_VISUAL_DETAILS = 6;
const MAX_VISUAL_DETAIL_CHARS = 120;

function normalizeOrientation(orientation) {
  if (typeof orientation !== 'string') return null;
  const normalized = orientation.trim().toLowerCase();
  if (normalized.startsWith('upright')) return 'upright';
  if (normalized.startsWith('reversed') || normalized.startsWith('reverse')) return 'reversed';
  if (normalized === 'unknown') return 'unknown';
  return null;
}

function truncateText(value, maxChars) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!maxChars || trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars).trim();
}

function normalizeVisualDetails(details) {
  if (!details) return null;
  const items = Array.isArray(details)
    ? details
    : (typeof details === 'string' ? details.split(/[\n;]+/g) : []);
  const normalized = items
    .map((item) => truncateText(item, MAX_VISUAL_DETAIL_CHARS))
    .filter(Boolean)
    .slice(0, MAX_VISUAL_DETAILS);
  return normalized.length ? normalized : null;
}

function normalizeMergeSource(mergeSource) {
  if (typeof mergeSource !== 'string') return null;
  const trimmed = mergeSource.trim();
  return trimmed ? trimmed.slice(0, 40) : null;
}

function normalizeComponentScores(componentScores) {
  if (!componentScores || typeof componentScores !== 'object') return null;
  const clip = typeof componentScores.clip === 'number' ? componentScores.clip : null;
  const llama = typeof componentScores.llama === 'number' ? componentScores.llama : null;
  if (clip == null && llama == null) return null;
  return { clip, llama };
}

function getSubtle() {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  if (globalThis.crypto?.webcrypto?.subtle) {
    return globalThis.crypto.webcrypto.subtle;
  }
  throw new Error('WebCrypto subtle API is not available in this environment.');
}

function toArrayBufferFromBase64(base64) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function fromArrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

async function importHmacKey(secret) {
  if (!secret) {
    throw new Error('VISION_PROOF_SECRET is not configured.');
  }
  const subtle = getSubtle();
  return subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function serializeProofPayload(payload) {
  return JSON.stringify(payload);
}

export function trimInsights(rawInsights = [], deckStyle = 'rws-1909') {
  if (!Array.isArray(rawInsights)) {
    return [];
  }
  return rawInsights
    .filter(Boolean)
    .slice(0, MAX_INSIGHTS)
    .map((insight) => ({
      label: typeof insight.label === 'string' ? insight.label : 'uploaded-image',
      predictedCard: canonicalizeCardName(insight.predictedCard || insight.card || null, deckStyle) || null,
      confidence: typeof insight.confidence === 'number' ? insight.confidence : null,
      basis: typeof insight.basis === 'string' ? insight.basis : null,
      matches: Array.isArray(insight.matches) ? insight.matches.slice(0, 3) : [],
      attention: insight.attention || null,
      symbolVerification: insight.symbolVerification || null,
      visualProfile: insight.visualProfile || null,
      orientation: normalizeOrientation(insight.orientation),
      reasoning: truncateText(insight.reasoning, MAX_REASONING_CHARS),
      visualDetails: normalizeVisualDetails(insight.visualDetails),
      mergeSource: normalizeMergeSource(insight.mergeSource),
      componentScores: normalizeComponentScores(insight.componentScores)
    }));
}

export function buildVisionProofPayload({ id, deckStyle = 'rws-1909', insights, ttlMs = DEFAULT_TTL_MS }) {
  const now = Date.now();
  const payload = {
    id,
    deckStyle,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    insights: trimInsights(insights, deckStyle)
  };
  return payload;
}

export async function signVisionProof(payload, secret) {
  const key = await importHmacKey(secret);
  const subtle = getSubtle();
  const data = encoder.encode(serializeProofPayload(payload));
  const signatureBuffer = await subtle.sign('HMAC', key, data);
  return fromArrayBufferToBase64(signatureBuffer);
}

export async function verifyVisionProof(proof, secret) {
  if (!proof || typeof proof !== 'object') {
    throw new Error('Vision proof payload is missing.');
  }
  const { signature, id, deckStyle = 'rws-1909', createdAt, expiresAt, insights } = proof;
  if (!signature || typeof signature !== 'string') {
    throw new Error('Vision proof signature missing.');
  }
  const payload = {
    id,
    deckStyle,
    createdAt,
    expiresAt,
    insights: trimInsights(insights, deckStyle)
  };
  if (!payload.id) {
    throw new Error('Vision proof id missing.');
  }
  if (!payload.createdAt || !payload.expiresAt) {
    throw new Error('Vision proof timestamps missing.');
  }
  const now = Date.now();
  const expiresAtMs = Date.parse(payload.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs < now) {
    throw new Error('Vision proof has expired.');
  }
  const key = await importHmacKey(secret);
  const subtle = getSubtle();
  const data = encoder.encode(serializeProofPayload(payload));
  const signatureBuffer = toArrayBufferFromBase64(signature);
  const verified = await subtle.verify('HMAC', key, signatureBuffer, data);
  if (!verified) {
    throw new Error('Vision proof signature invalid.');
  }
  return payload;
}
