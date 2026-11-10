/**
 * Account Preferences Endpoint
 * GET /api/account/preferences
 * PUT /api/account/preferences
 *
 * The reader's own choices that should follow a signed-in account between
 * devices: the personalization fields they set (name, tone, framing,
 * experience, spread depth, focus areas) and whether they finished or skipped
 * onboarding. Stored in users.preferences_json (migration 0039).
 *
 * PUT replaces the stored choices with the client's explicit set, so a reset
 * on one device clears them everywhere. Onboarding completion only moves
 * forward: replaying the tutorial on one device does not undo it.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { isMachineCredential } from '../../lib/entitlements.js';
import { jsonResponse, readJsonBody, safeJsonParse } from '../../lib/utils.js';
import { sanitizePersonalizationInput } from '../../lib/userPersonalization.js';
import { PERSONALIZATION_REQUEST_FIELDS } from '../../../shared/contracts/personalizationConstants.js';

const PREFERENCES_VERSION = 1;
const MAX_STORED_LENGTH = 4096;
const FIELD_SET = new Set(PERSONALIZATION_REQUEST_FIELDS);

const DEFAULT_DEPS = {
  getUserFromRequest,
  isMachineCredential,
  jsonResponse,
  readJsonBody,
  now: () => Math.floor(Date.now() / 1000)
};

function isMissingColumn(error) {
  return /no such column|no such table/i.test(String(error?.message || ''));
}

function normalizeExplicitFields(value) {
  const fields = Array.isArray(value) ? value : [];
  return fields.filter((field, index) => FIELD_SET.has(field) && fields.indexOf(field) === index);
}

/**
 * Keep only the fields the reader chose, sanitized as reading requests are.
 * A chosen field that fails validation is dropped rather than stored.
 */
export function normalizeAccountPreferences(input, { previous = null, now = 0 } = {}) {
  const explicitFields = normalizeExplicitFields(input?.explicitFields);
  const sanitized = sanitizePersonalizationInput(input?.personalization);
  const personalization = {};
  const kept = [];
  for (const field of explicitFields) {
    if (Object.prototype.hasOwnProperty.call(sanitized, field)) {
      personalization[field] = sanitized[field];
      kept.push(field);
    }
  }
  const previousCompletedAt = Number(previous?.onboardingCompletedAt) || null;
  const onboardingCompletedAt = previousCompletedAt
    || (input?.onboardingCompleted === true ? now : null);
  return {
    v: PREFERENCES_VERSION,
    personalization,
    explicitFields: kept,
    onboardingCompletedAt,
    updatedAt: now
  };
}

export function parseStoredPreferences(raw) {
  if (!raw) return null;
  const parsed = safeJsonParse(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;
  // Re-normalize on read so a stored value never reaches the client unsanitized.
  const normalized = normalizeAccountPreferences(parsed, { previous: parsed, now: Number(parsed.updatedAt) || 0 });
  return normalized;
}

async function requireSessionUser(request, env, deps) {
  const user = await deps.getUserFromRequest(request, env);
  if (!user) {
    return { error: deps.jsonResponse({ error: 'Authentication required' }, { status: 401 }) };
  }
  if (deps.isMachineCredential(user)) {
    return { error: deps.jsonResponse({ error: 'Session authentication required' }, { status: 401 }) };
  }
  return { user };
}

export async function onRequestGet(context, deps = DEFAULT_DEPS) {
  const { request, env } = context;
  try {
    const { user, error } = await requireSessionUser(request, env, deps);
    if (error) return error;
    let row;
    try {
      row = await env.DB.prepare('SELECT preferences_json FROM users WHERE id = ?').bind(user.id).first();
    } catch (dbError) {
      // Code can reach production before its migration; read as "nothing stored".
      if (isMissingColumn(dbError)) return deps.jsonResponse({ preferences: null, available: false });
      throw dbError;
    }
    return deps.jsonResponse({ preferences: parseStoredPreferences(row?.preferences_json), available: true });
  } catch (error) {
    console.error('[account] Preferences read error:', error?.message || error);
    return deps.jsonResponse({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

export async function onRequestPut(context, deps = DEFAULT_DEPS) {
  const { request, env } = context;
  try {
    const { user, error } = await requireSessionUser(request, env, deps);
    if (error) return error;

    let body;
    try {
      body = await deps.readJsonBody(request);
    } catch {
      return deps.jsonResponse({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return deps.jsonResponse({ error: 'Invalid preferences payload' }, { status: 400 });
    }

    let previousRaw;
    try {
      previousRaw = await env.DB.prepare('SELECT preferences_json FROM users WHERE id = ?').bind(user.id).first();
    } catch (dbError) {
      if (isMissingColumn(dbError)) {
        return deps.jsonResponse({ error: 'Preferences are not available yet', code: 'preferences_unavailable' }, { status: 503 });
      }
      throw dbError;
    }

    const previous = parseStoredPreferences(previousRaw?.preferences_json);
    const next = normalizeAccountPreferences(body, { previous, now: deps.now() });
    const serialized = JSON.stringify(next);
    if (serialized.length > MAX_STORED_LENGTH) {
      return deps.jsonResponse({ error: 'Preferences are too large' }, { status: 413 });
    }

    // Preserve completion from the row at write time, not the earlier SELECT:
    // another device can finish onboarding while this request is in flight.
    // RETURNING also keeps the response consistent with this atomic write.
    const saved = await env.DB.prepare(`UPDATE users SET preferences_json = json_set(
      ?, '$.onboardingCompletedAt', COALESCE(
        NULLIF(CAST(json_extract(
          CASE WHEN json_valid(preferences_json) THEN preferences_json ELSE '{}' END,
          '$.onboardingCompletedAt'
        ) AS NUMERIC), 0), ?
      )
    ), updated_at = ? WHERE id = ? RETURNING preferences_json`)
      .bind(serialized, next.onboardingCompletedAt, next.updatedAt, user.id)
      .first();

    return deps.jsonResponse({ preferences: parseStoredPreferences(saved?.preferences_json), available: true });
  } catch (error) {
    console.error('[account] Preferences save error:', error?.message || error);
    return deps.jsonResponse({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
