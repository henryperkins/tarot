import {
  NARRATIVE_PERSONALIZATION_DEFAULTS,
  PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH as SHARED_PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH,
  PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY,
  PERSONALIZATION_REQUEST_FIELDS
} from '../../shared/contracts/personalizationConstants.js';

export const DEFAULT_PERSONALIZATION = {
  ...NARRATIVE_PERSONALIZATION_DEFAULTS,
  showRitualSteps: true
};

export const PERSONALIZATION_STORAGE_KEY_BASE = 'tarot-personalization';
export const LEGACY_PERSONALIZATION_STORAGE_KEY = PERSONALIZATION_STORAGE_KEY_BASE;
export const PERSONALIZATION_GUEST_KEY = `${PERSONALIZATION_STORAGE_KEY_BASE}:guest`;
export const PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH = SHARED_PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH;
export const PERSONALIZATION_EXPLICIT_FIELDS_SUFFIX = ':explicit-fields';

const ALLOWED_TAROT_EXPERIENCE = new Set(['newbie', 'intermediate', 'experienced']);
const ALLOWED_READING_TONE = new Set(['gentle', 'balanced', 'blunt']);
const ALLOWED_SPREAD_DEPTH = new Set(['short', 'standard', 'deep']);
const ALLOWED_SPIRITUAL_FRAME = new Set(['psychological', 'spiritual', 'mixed', 'playful']);
const PERSONALIZATION_REQUEST_FIELD_SET = new Set(PERSONALIZATION_REQUEST_FIELDS);
const MAX_FOCUS_AREAS = 12;
const MAX_FOCUS_AREA_LENGTH = 40;

export function getPersonalizationStorageKey(userId) {
  if (!userId) return PERSONALIZATION_GUEST_KEY;
  return `${PERSONALIZATION_STORAGE_KEY_BASE}:${userId}`;
}

export function getPersonalizationExplicitFieldsStorageKey(storageKey) {
  return `${storageKey}${PERSONALIZATION_EXPLICIT_FIELDS_SUFFIX}`;
}

function normalizeExplicitFields(value) {
  const rawFields = Array.isArray(value) ? value : [];
  return rawFields.filter((field, index, list) =>
    PERSONALIZATION_REQUEST_FIELD_SET.has(field) && list.indexOf(field) === index
  );
}

function sameArrayValues(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function hasNonDefaultRequestValue(field, value) {
  const defaultValue = NARRATIVE_PERSONALIZATION_DEFAULTS[field];
  if (field === 'displayName') {
    return typeof value === 'string' && value.trim().length > 0;
  }
  if (field === 'focusAreas') {
    return Array.isArray(value) && value.length > 0;
  }
  if (Array.isArray(defaultValue)) {
    return !sameArrayValues(value, defaultValue);
  }
  return value !== defaultValue;
}

function sanitizeEnum(value, allowed, fallback) {
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}

function sanitizeDisplayName(value, { trim = true } = {}) {
  if (typeof value !== 'string') return '';
  const normalizedValue = trim ? value.trim() : value;
  return normalizedValue.slice(0, PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH);
}

function sanitizeFocusAreas(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const normalized = [];
  for (const area of value) {
    if (typeof area !== 'string') continue;
    const cleaned = area.trim().slice(0, MAX_FOCUS_AREA_LENGTH);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    normalized.push(cleaned);
    if (normalized.length >= MAX_FOCUS_AREAS) break;
  }

  return normalized;
}

export function sanitizePersonalization(value, { trimDisplayName = true } = {}) {
  const input = value && typeof value === 'object' ? value : {};

  return {
    ...DEFAULT_PERSONALIZATION,
    displayName: sanitizeDisplayName(input.displayName, { trim: trimDisplayName }),
    tarotExperience: sanitizeEnum(
      input.tarotExperience,
      ALLOWED_TAROT_EXPERIENCE,
      DEFAULT_PERSONALIZATION.tarotExperience
    ),
    readingTone: sanitizeEnum(input.readingTone, ALLOWED_READING_TONE, DEFAULT_PERSONALIZATION.readingTone),
    focusAreas: sanitizeFocusAreas(input.focusAreas),
    preferredSpreadDepth: sanitizeEnum(
      input.preferredSpreadDepth,
      ALLOWED_SPREAD_DEPTH,
      DEFAULT_PERSONALIZATION.preferredSpreadDepth
    ),
    spiritualFrame: sanitizeEnum(
      input.spiritualFrame,
      ALLOWED_SPIRITUAL_FRAME,
      DEFAULT_PERSONALIZATION.spiritualFrame
    ),
    showRitualSteps: typeof input.showRitualSteps === 'boolean'
      ? input.showRitualSteps
      : DEFAULT_PERSONALIZATION.showRitualSteps
  };
}

export function sanitizeGuestPersonalization(value) {
  void value;
  return { ...DEFAULT_PERSONALIZATION };
}

export function derivePersonalizationExplicitFields(value) {
  const normalized = sanitizePersonalization(value);
  return PERSONALIZATION_REQUEST_FIELDS.filter((field) =>
    hasNonDefaultRequestValue(field, normalized[field])
  );
}

export function loadPersonalizationFromStorage(storageKey, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') {
    return { ...DEFAULT_PERSONALIZATION };
  }
  try {
    const stored = store.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return sanitizePersonalization(parsed);
    }
  } catch (error) {
    console.debug('Unable to load personalization:', error);
  }
  return sanitizePersonalization(null);
}

export function loadPersonalizationExplicitFields(storageKey, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') {
    return [];
  }
  try {
    const stored = store.getItem(getPersonalizationExplicitFieldsStorageKey(storageKey));
    if (!stored) return [];
    return normalizeExplicitFields(JSON.parse(stored));
  } catch (error) {
    console.debug('Unable to load personalization explicit fields:', error);
    return [];
  }
}

export function savePersonalizationExplicitFields(storageKey, fields, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.setItem !== 'function') return;
  try {
    const normalized = normalizeExplicitFields(fields);
    const key = getPersonalizationExplicitFieldsStorageKey(storageKey);
    if (normalized.length > 0) {
      store.setItem(key, JSON.stringify(normalized));
    } else if (typeof store.removeItem === 'function') {
      store.removeItem(key);
    } else {
      store.setItem(key, JSON.stringify([]));
    }
  } catch (error) {
    console.debug('Unable to persist personalization explicit fields:', error);
  }
}

export function buildPersonalizationRequestPayload(personalization, explicitFields = []) {
  if (!personalization || typeof personalization !== 'object') {
    return null;
  }

  const normalized = sanitizePersonalization(personalization);
  const explicitSet = new Set(normalizeExplicitFields(explicitFields));
  const payload = {};

  for (const field of PERSONALIZATION_REQUEST_FIELDS) {
    const value = normalized[field];
    const isExplicit = explicitSet.has(field);
    if (!isExplicit && !hasNonDefaultRequestValue(field, value)) {
      continue;
    }

    if (field === 'displayName') {
      if (typeof value === 'string' && value.trim()) {
        payload[field] = value.trim();
      } else if (isExplicit) {
        payload[field] = '';
      }
      continue;
    }

    if (field === 'focusAreas') {
      if (Array.isArray(value) && value.length > 0) {
        payload[field] = value;
      } else if (isExplicit) {
        payload[field] = [];
      }
      continue;
    }

    payload[field] = value;
  }

  const includedExplicitFields = PERSONALIZATION_REQUEST_FIELDS.filter((field) =>
    explicitSet.has(field) && Object.prototype.hasOwnProperty.call(payload, field)
  );
  if (includedExplicitFields.length > 0) {
    payload[PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY] = includedExplicitFields;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}
