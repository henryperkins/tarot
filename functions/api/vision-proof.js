import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { createVisionBackend } from '../../shared/vision/visionBackends.js';
import { buildVisionProofPayload, signVisionProof } from '../lib/visionProof.js';
import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';

const MAX_EVIDENCE = 5;
const MAX_DATA_URL_BYTES = 8 * 1024 * 1024; // 8MB per upload
const visionBackendCache = new Map();

function clampConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeLabel(label) {
  if (typeof label === 'string' && label.trim()) {
    return label.trim();
  }
  return 'uploaded-image';
}

function sanitizeMatches(matches, deckStyle) {
  if (!Array.isArray(matches)) return [];
  return matches
    .map((match) => {
      const card = canonicalizeCardName(match?.cardName || match?.card, deckStyle);
      const confidence = clampConfidence(match?.score ?? match?.confidence);
      if (!card) return null;
      return {
        card,
        confidence,
        basis: match?.basis || null
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function sanitizeAttention(attention) {
  if (!attention || typeof attention !== 'object') return null;
  const gridSize = Number(attention.gridSize) || (Array.isArray(attention.heatmap) ? attention.heatmap.length : null);
  const heatmap = Array.isArray(attention.heatmap)
    ? attention.heatmap.map((row) => (Array.isArray(row) ? row.map((value) => Number(Number(value).toFixed(4))) : []))
    : null;
  const focusRegions = Array.isArray(attention.focusRegions)
    ? attention.focusRegions.slice(0, 8).map((region) => ({
        x: Number(region.x),
        y: Number(region.y),
        intensity: Number(Number(region.intensity).toFixed(4))
      }))
    : null;
  const symbolAlignment = Array.isArray(attention.symbolAlignment)
    ? attention.symbolAlignment.slice(0, 5).map((symbol) => ({
        object: symbol.object,
        position: symbol.position,
        attentionScore: Number(Number(symbol.attentionScore).toFixed(4)),
        isModelFocused: Boolean(symbol.isModelFocused)
      }))
    : null;
  return {
    gridSize,
    heatmap,
    focusRegions,
    symbolAlignment,
    stats: attention.stats || null
  };
}

function sanitizeSymbolVerification(symbolVerification) {
  if (!symbolVerification || typeof symbolVerification !== 'object') {
    return null;
  }

  const matchRate = typeof symbolVerification.matchRate === 'number'
    ? Number(Number(symbolVerification.matchRate).toFixed(4))
    : null;

  const matches = Array.isArray(symbolVerification.matches)
    ? symbolVerification.matches.slice(0, 6).map((match) => ({
        object: match.object,
        expectedPosition: match.expectedPosition || null,
        found: Boolean(match.found),
        confidence: typeof match.confidence === 'number'
          ? Number(Number(match.confidence).toFixed(4))
          : null,
        detectionLabel: match.detectionLabel || null
      }))
    : null;

  const missingSymbols = Array.isArray(symbolVerification.missingSymbols)
    ? symbolVerification.missingSymbols.slice(0, 6)
    : [];

  const unexpectedDetections = Array.isArray(symbolVerification.unexpectedDetections)
    ? symbolVerification.unexpectedDetections.slice(0, 5).map((det) => ({
        label: det.label,
        confidence: typeof det.confidence === 'number'
          ? Number(Number(det.confidence).toFixed(4))
          : null
      }))
    : [];

  return {
    expectedCount: symbolVerification.expectedCount ?? null,
    detectedCount: symbolVerification.detectedCount ?? null,
    matchRate,
    matches,
    missingSymbols,
    unexpectedDetections
  };
}

async function getVisionBackend(deckStyle) {
  if (visionBackendCache.has(deckStyle)) {
    return visionBackendCache.get(deckStyle);
  }
  const backendPromise = (async () => {
    const backend = createVisionBackend({
      backendId: 'clip-default',
      cardScope: 'all',
      deckStyle,
      maxResults: 5
    });
    await backend.warmup();
    return backend;
  })();
  visionBackendCache.set(deckStyle, backendPromise);
  return backendPromise;
}

function validateEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error('Vision proof requires at least one uploaded image.');
  }
  if (evidence.length > MAX_EVIDENCE) {
    throw new Error(`Please limit vision uploads to ${MAX_EVIDENCE} images per request.`);
  }
  return evidence.map((entry, index) => {
    const label = normalizeLabel(entry?.label || `upload-${index + 1}`);
    const dataUrl = entry?.dataUrl;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error(`Upload ${label} must include a base64 data URL.`);
    }
    if (dataUrl.length > MAX_DATA_URL_BYTES * 1.37) {
      throw new Error(`${label} exceeds the maximum upload size (${MAX_DATA_URL_BYTES} bytes).`);
    }
    return { label, dataUrl };
  });
}

async function analyzeEvidence(evidence, deckStyle) {
  const backend = await getVisionBackend(deckStyle);
  const analyses = await backend.analyzeImages(
    evidence.map((entry) => ({
      source: entry.dataUrl,
      label: entry.label
    })),
    { includeAttention: true, includeSymbols: true }
  );
  return analyses.map((entry) => {
    const predictedCard = canonicalizeCardName(entry.topMatch?.canonicalName || entry.topMatch?.cardName, deckStyle);
    return {
      label: normalizeLabel(entry.label || entry.imagePath),
      predictedCard,
      confidence: clampConfidence(entry.confidence ?? entry.topMatch?.score ?? null),
      basis: entry.topMatch?.basis || null,
      matches: sanitizeMatches(entry.matches, deckStyle),
      attention: sanitizeAttention(entry.attention),
      symbolVerification: sanitizeSymbolVerification(entry.symbolVerification)
    };
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJsonBody(request);
    const deckStyle = body?.deckStyle || 'rws-1909';
    const evidence = validateEvidence(body?.evidence);
    const insights = await analyzeEvidence(evidence, deckStyle);

    const payload = buildVisionProofPayload({
      id: crypto.randomUUID ? crypto.randomUUID() : `proof_${Date.now()}`,
      deckStyle,
      insights
    });
    const signature = await signVisionProof(payload, env?.VISION_PROOF_SECRET);

    return jsonResponse({
      proof: {
        ...payload,
        signature
      }
    }, { status: 201 });
  } catch (error) {
    console.error('vision-proof error:', error);
    const status = /size|limit/i.test(error.message) ? 413 : 400;
    return jsonResponse({ error: error.message || 'Vision proof failed.' }, { status });
  }
}

export function onRequestGet() {
  return jsonResponse({ error: 'Not supported.' }, { status: 405 });
}
