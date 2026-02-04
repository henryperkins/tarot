import { trimForTelemetry } from './readingTelemetry.js';

const MEDIA_SCHEMA_VERSION = 1;
const DEFAULT_STORAGE_MODE = 'redact';

function normalizeStorageMode(mode) {
  if (!mode) return DEFAULT_STORAGE_MODE;
  return String(mode).toLowerCase();
}

export function buildMediaTelemetryPayload({
  requestId,
  timestamp,
  feature,
  status,
  provider,
  models = null,
  apiVersion = null,
  tier = null,
  input = null,
  output = null,
  timings = null,
  error = null
}) {
  return {
    schemaVersion: MEDIA_SCHEMA_VERSION,
    requestId,
    timestamp,
    feature,
    status,
    provider,
    models,
    apiVersion,
    tier,
    input,
    output,
    timings,
    error
  };
}

export function sanitizeMediaTelemetry(payload, mode = DEFAULT_STORAGE_MODE) {
  const normalizedMode = normalizeStorageMode(mode);

  if (normalizedMode === 'minimal') {
    return {
      schemaVersion: payload.schemaVersion,
      requestId: payload.requestId,
      timestamp: payload.timestamp,
      feature: payload.feature,
      status: payload.status,
      provider: payload.provider,
      models: payload.models || null,
      tier: payload.tier || null,
      output: payload.output ? { cached: payload.output.cached || false } : null,
      timings: payload.timings ? { totalMs: payload.timings.totalMs ?? null } : null
    };
  }

  const sanitized = { ...payload };

  if (sanitized.error && typeof sanitized.error === 'object') {
    sanitized.error = { ...sanitized.error };
    if (normalizedMode === 'redact') {
      delete sanitized.error.message;
    } else if (normalizedMode === 'full' && sanitized.error.message) {
      sanitized.error.message = trimForTelemetry(String(sanitized.error.message), 500);
    }
  }

  return sanitized;
}

export async function persistMediaTelemetry(env, payload, options = {}) {
  if (!env?.METRICS_DB?.put || !payload?.requestId) return;

  const storageMode = env?.METRICS_STORAGE_MODE || DEFAULT_STORAGE_MODE;
  const sanitized = sanitizeMediaTelemetry(payload, storageMode);
  const key = options.key || `media:${payload.requestId}`;

  try {
    await env.METRICS_DB.put(key, JSON.stringify(sanitized));
  } catch (err) {
    console.warn(`[${payload.requestId}] Failed to persist media telemetry: ${err.message}`);
  }
}
