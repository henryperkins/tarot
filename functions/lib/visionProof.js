import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';

const encoder = new TextEncoder();
const _decoder = typeof TextDecoder === 'function' ? new TextDecoder() : null;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_INSIGHTS = 10;
const MAX_REASONING_CHARS = 600;
const MAX_VISUAL_DETAILS = 6;
const MAX_VISUAL_DETAIL_CHARS = 120;
const CANONICAL_IDENTITY_VERSION = 2;

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

function normalizeRouterFeatures(routerFeatures) {
  if (!routerFeatures || typeof routerFeatures !== 'object') return null;
  return {
    clipScore: typeof routerFeatures.clipScore === 'number' ? routerFeatures.clipScore : null,
    llamaScore: typeof routerFeatures.llamaScore === 'number' ? routerFeatures.llamaScore : null,
    llamaOk: Boolean(routerFeatures.llamaOk),
    clipScoreGap: typeof routerFeatures.clipScoreGap === 'number' ? routerFeatures.clipScoreGap : null,
    llamaAgrees: Boolean(routerFeatures.llamaAgrees),
    symbolWeightedMatch: typeof routerFeatures.symbolWeightedMatch === 'number' ? routerFeatures.symbolWeightedMatch : null,
    orientationKnown: Boolean(routerFeatures.orientationKnown),
    imageQualityScore: typeof routerFeatures.imageQualityScore === 'number' ? routerFeatures.imageQualityScore : null
  };
}

function normalizeImageQuality(imageQuality) {
  if (!imageQuality || typeof imageQuality !== 'object') return null;
  return {
    cardRectFound: typeof imageQuality.cardRectFound === 'boolean' ? imageQuality.cardRectFound : null,
    perspectiveSkew: typeof imageQuality.perspectiveSkew === 'number' ? imageQuality.perspectiveSkew : null,
    blurScore: typeof imageQuality.blurScore === 'number' ? imageQuality.blurScore : null,
    glareScore: typeof imageQuality.glareScore === 'number' ? imageQuality.glareScore : null,
    occlusionScore: typeof imageQuality.occlusionScore === 'number' ? imageQuality.occlusionScore : null,
    borderVisible: typeof imageQuality.borderVisible === 'boolean' ? imageQuality.borderVisible : null,
    usableForSymbolDetection: imageQuality.usableForSymbolDetection !== false
  };
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

/** Canonical fields use the RWS namespace; only raw display labels use deck aliases. */
export function resolveVisionCardIdentity(entry, deckStyle = 'rws-1909') {
  const canonicalReference = (typeof entry?.canonicalKey === 'string' && entry.canonicalKey.trim())
    || (typeof entry?.canonicalName === 'string' && entry.canonicalName.trim());
  const canonicalName = canonicalReference
    ? canonicalizeCardName(canonicalReference, 'rws-1909')
    : canonicalizeCardName(entry?.predictedCard || entry?.card || entry?.cardName, deckStyle);
  return {
    canonicalName: canonicalName || null,
    canonicalKey: canonicalName ? canonicalName.toLowerCase() : null
  };
}

function boundedInsights(rawInsights) {
  return Array.isArray(rawInsights) ? rawInsights.filter(Boolean).slice(0, MAX_INSIGHTS) : [];
}

function trimInsight(insight, predictedCard, matches) {
  return {
    label: typeof insight.label === 'string' ? insight.label : 'uploaded-image',
    predictedCard,
    confidence: typeof insight.confidence === 'number' ? insight.confidence : null,
    basis: typeof insight.basis === 'string' ? insight.basis : null,
    matches,
    attention: insight.attention || null,
    symbolVerification: insight.symbolVerification || null,
    visualProfile: insight.visualProfile || null,
    orientation: normalizeOrientation(insight.orientation),
    reasoning: truncateText(insight.reasoning, MAX_REASONING_CHARS),
    visualDetails: normalizeVisualDetails(insight.visualDetails),
    mergeSource: normalizeMergeSource(insight.mergeSource),
    componentScores: normalizeComponentScores(insight.componentScores),
    routerFeatures: normalizeRouterFeatures(insight.routerFeatures),
    calibratedConfidence: typeof insight.calibratedConfidence === 'number' ? insight.calibratedConfidence : null,
    decisionReason: normalizeMergeSource(insight.decisionReason),
    abstain: Boolean(insight.abstain),
    imageQuality: normalizeImageQuality(insight.imageQuality)
  };
}

// Preserve the exact pre-versioned verification shape and alias behavior. New
// fields must never influence the identity authenticated by a legacy signature.
function trimLegacyInsights(rawInsights, deckStyle) {
  return boundedInsights(rawInsights).map((insight) => trimInsight(
    insight,
    canonicalizeCardName(insight.predictedCard || insight.card || null, deckStyle) || null,
    Array.isArray(insight.matches) ? insight.matches.slice(0, 3) : []
  ));
}

export function trimInsights(rawInsights = [], deckStyle = 'rws-1909') {
  return boundedInsights(rawInsights).map((insight) => {
    const identity = resolveVisionCardIdentity(insight, deckStyle);
    const matches = Array.isArray(insight.matches)
      ? insight.matches.slice(0, 3).map((match) => {
        const matchIdentity = resolveVisionCardIdentity(match, deckStyle);
        return matchIdentity.canonicalName ? { ...match, card: matchIdentity.canonicalName, ...matchIdentity } : null;
      }).filter(Boolean)
      : [];
    return { ...trimInsight(insight, identity.canonicalName, matches), ...identity };
  });
}

function validateSignedIdentities(insights) {
  const assertIdentity = (entry, nameField) => {
    const identity = resolveVisionCardIdentity(entry, 'rws-1909');
    if (entry?.[nameField] !== identity.canonicalName
      || entry?.canonicalName !== identity.canonicalName
      || entry?.canonicalKey !== identity.canonicalKey) {
      throw new Error('Vision proof canonical identity invalid.');
    }
  };
  for (const insight of boundedInsights(insights)) {
    assertIdentity(insight, 'predictedCard');
    if (Array.isArray(insight.matches)) {
      insight.matches.slice(0, 3).forEach((match) => assertIdentity(match, 'card'));
    }
  }
}

function addVerifiedLegacyIdentities(insights) {
  return insights.map((insight) => ({
    ...insight,
    ...resolveVisionCardIdentity({ predictedCard: insight.predictedCard }, 'rws-1909'),
    matches: insight.matches.map((match) => ({
      ...match,
      ...resolveVisionCardIdentity({ card: match?.card || match?.cardName }, 'rws-1909')
    }))
  }));
}

export function buildVisionProofPayload({ id, deckStyle = 'rws-1909', insights, ttlMs = DEFAULT_TTL_MS }) {
  const now = Date.now();
  const payload = {
    version: CANONICAL_IDENTITY_VERSION,
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
  const { signature, version, id, deckStyle = 'rws-1909', createdAt, expiresAt, insights } = proof;
  if (!signature || typeof signature !== 'string') {
    throw new Error('Vision proof signature missing.');
  }
  if (version !== undefined && version !== CANONICAL_IDENTITY_VERSION) {
    throw new Error('Vision proof version unsupported.');
  }
  if (version === CANONICAL_IDENTITY_VERSION) validateSignedIdentities(insights);
  const payload = {
    ...(version === CANONICAL_IDENTITY_VERSION ? { version } : {}),
    id,
    deckStyle,
    createdAt,
    expiresAt,
    insights: version === CANONICAL_IDENTITY_VERSION
      ? trimInsights(insights, deckStyle)
      : trimLegacyInsights(insights, deckStyle)
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
  // Legacy predictedCard/matches from the first-party producer are already
  // canonical. Add the explicit namespace only after their old bytes verify.
  return version === CANONICAL_IDENTITY_VERSION
    ? payload
    : { ...payload, insights: addVerifiedLegacyIdentities(payload.insights) };
}
