import {
  PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH as SHARED_PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH
} from '../../shared/contracts/personalizationConstants.js';

export const DEFAULT_PERSONALIZATION = {
  displayName: '',
  tarotExperience: 'newbie',
  readingTone: 'balanced',
  focusAreas: [],
  preferredSpreadDepth: 'standard',
  spiritualFrame: 'mixed',
  showRitualSteps: true
};

export const PERSONALIZATION_STORAGE_KEY_BASE = 'tarot-personalization';
export const LEGACY_PERSONALIZATION_STORAGE_KEY = PERSONALIZATION_STORAGE_KEY_BASE;
export const PERSONALIZATION_GUEST_KEY = `${PERSONALIZATION_STORAGE_KEY_BASE}:guest`;
export const PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH = SHARED_PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH;

const ALLOWED_TAROT_EXPERIENCE = new Set(['newbie', 'intermediate', 'experienced']);
const ALLOWED_READING_TONE = new Set(['gentle', 'balanced', 'blunt']);
const ALLOWED_SPREAD_DEPTH = new Set(['short', 'standard', 'deep']);
const ALLOWED_SPIRITUAL_FRAME = new Set(['psychological', 'spiritual', 'mixed', 'playful']);
const MAX_FOCUS_AREAS = 12;
const MAX_FOCUS_AREA_LENGTH = 40;

export function getPersonalizationStorageKey(userId) {
  if (!userId) return PERSONALIZATION_GUEST_KEY;
  return `${PERSONALIZATION_STORAGE_KEY_BASE}:${userId}`;
}

function sanitizeEnum(value, allowed, fallback) {
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}

function sanitizeDisplayName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH);
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

export function sanitizePersonalization(value) {
  const input = value && typeof value === 'object' ? value : {};

  return {
    ...DEFAULT_PERSONALIZATION,
    displayName: sanitizeDisplayName(input.displayName),
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
