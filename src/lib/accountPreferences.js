import { NARRATIVE_PERSONALIZATION_DEFAULTS, PERSONALIZATION_REQUEST_FIELDS } from '../../shared/contracts/personalizationConstants.js';

/**
 * A signed-in reader's choices kept on their account, so a new device opens
 * on their own setup instead of first-run onboarding (GET/PUT
 * /api/account/preferences, functions/api/account/preferences.js).
 *
 * This device's own choices take precedence. Values inherited from the
 * account keep their provenance, so a later account update or reset can
 * refresh them without turning an old copy into a local override.
 */
const ENDPOINT = '/api/account/preferences';
export const ACCOUNT_PREFERENCES_TIMEOUT_MS = 4000;
const FIELD_SET = new Set(PERSONALIZATION_REQUEST_FIELDS);
const hasOwn = (source, key) => Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
const normalizeFields = fields => Array.isArray(fields) ? [...new Set(fields.filter(field => FIELD_SET.has(field)))] : [];

/** Provenance is local to the same account-scoped key as personalization. */
export function loadAccountPreferenceOrigins(storageKey, storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(`${storageKey}:account-origins`) || 'null');
    if (parsed?.v === 1) {
      return { inheritedFields: normalizeFields(parsed.inheritedFields), resetPending: parsed.resetPending === true };
    }
  } catch {
    // Old records have no provenance. Preserve their choices as local rather
    // than guessing which ones came from an earlier account copy.
  }
  return { inheritedFields: [], resetPending: false };
}

export function saveAccountPreferenceOrigins(storageKey, origins, storage) {
  try {
    storage?.setItem(`${storageKey}:account-origins`, JSON.stringify({
      v: 1,
      inheritedFields: normalizeFields(origins.inheritedFields),
      resetPending: origins.resetPending === true
    }));
  } catch {
    // Storage blocked or full: live choices still work for this page.
  }
}

async function request(method, body, { signal, timeoutMs = ACCOUNT_PREFERENCES_TIMEOUT_MS, keepalive = false } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetch(ENDPOINT, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      keepalive
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error || `Account preferences request failed (${response.status})`);
      error.status = response.status;
      error.code = data?.code || null;
      throw error;
    }
    return data || {};
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function fetchAccountPreferences(options) {
  return request('GET', null, options);
}

export function saveAccountPreferences(payload, options) {
  return request('PUT', payload, options);
}

/** The body PUT expects: only chosen fields, plus whether onboarding is done here. */
export function buildAccountPreferencesPayload({ personalization, explicitFields, onboardingComplete }) {
  const fields = (Array.isArray(explicitFields) ? explicitFields : [])
    .filter((field, index, list) => FIELD_SET.has(field) && list.indexOf(field) === index && hasOwn(personalization, field));
  return {
    personalization: Object.fromEntries(fields.map(field => [field, personalization[field]])),
    explicitFields: fields,
    onboardingCompleted: Boolean(onboardingComplete)
  };
}

/**
 * What the account adds to this device: values for fields the reader chose
 * elsewhere but not here. Choices made on this device are never replaced.
 */
export function mergeAccountPersonalization({ explicitFields, inheritedFields = [], remote }) {
  const inherited = new Set(normalizeFields(inheritedFields));
  const local = new Set(normalizeFields(explicitFields).filter(field => !inherited.has(field)));
  const adopted = {};
  const adoptedFields = [];
  for (const field of normalizeFields(remote?.explicitFields)) {
    if (!FIELD_SET.has(field) || local.has(field) || !hasOwn(remote?.personalization, field)) continue;
    adopted[field] = remote.personalization[field];
    adoptedFields.push(field);
  }
  const clearedFields = [...inherited].filter(field => !local.has(field) && !adoptedFields.includes(field));
  for (const field of clearedFields) adopted[field] = NARRATIVE_PERSONALIZATION_DEFAULTS[field];
  return { adopted, adoptedFields, clearedFields };
}

/** A stable key for comparing what this device would send with what the account holds. */
export function accountPayloadKey(payload) {
  const fields = [...payload.explicitFields].sort();
  return JSON.stringify({
    personalization: fields.map(field => [field, payload.personalization[field]]),
    onboardingCompleted: payload.onboardingCompleted
  });
}
