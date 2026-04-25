import {
  NARRATIVE_PERSONALIZATION_DEFAULTS,
  PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH,
  PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY,
  PERSONALIZATION_REQUEST_FIELDS
} from '../../shared/contracts/personalizationConstants.js';
import { safeJsonParse, sanitizeText } from './utils.js';
import { getMemories } from './userMemory.js';

const USER_PERSONALIZATION_FIELDS = Object.freeze([
  'displayName',
  'readingTone',
  'spiritualFrame',
  'tarotExperience',
  'preferredSpreadDepth',
  'focusAreas'
]);

const ALLOWED_READING_TONES = new Set(['gentle', 'balanced', 'blunt']);
const ALLOWED_SPIRITUAL_FRAMES = new Set(['psychological', 'spiritual', 'mixed', 'playful']);
const ALLOWED_TAROT_EXPERIENCE = new Set(['newbie', 'intermediate', 'experienced']);
const ALLOWED_SPREAD_DEPTH = new Set(['short', 'standard', 'deep']);
const PERSONALIZATION_REQUEST_FIELD_SET = new Set(PERSONALIZATION_REQUEST_FIELDS);

const MAX_FOCUS_AREAS = 12;
const MAX_FOCUS_AREA_LENGTH = 40;
const DEFAULT_GLOBAL_MEMORY_LIMIT = 8;

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function sanitizeEnum(value, allowed) {
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
}

function sanitizeDisplayName(value) {
  if (typeof value !== 'string') return undefined;
  return sanitizeText(value, {
    maxLength: PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH,
    stripMarkdown: true,
    stripControlChars: true,
    filterInstructions: true
  });
}

function sanitizeFocusAreas(value) {
  if (!Array.isArray(value)) return undefined;

  const normalized = [];
  const seen = new Set();

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const cleaned = sanitizeText(entry, {
      maxLength: MAX_FOCUS_AREA_LENGTH,
      stripMarkdown: true,
      stripControlChars: true,
      filterInstructions: true
    });
    if (!cleaned) continue;
    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(cleaned);
    if (normalized.length >= MAX_FOCUS_AREAS) break;
  }

  return normalized;
}

function normalizeExplicitFields(value) {
  const rawFields = Array.isArray(value) ? value : [];
  return rawFields.filter((field, index, list) =>
    PERSONALIZATION_REQUEST_FIELD_SET.has(field) && list.indexOf(field) === index
  );
}

function isClientDefaultRequestValue(field, value) {
  const defaultValue = NARRATIVE_PERSONALIZATION_DEFAULTS[field];
  if (field === 'focusAreas') {
    return Array.isArray(value) && value.length === 0;
  }
  if (field === 'displayName') {
    return value === '';
  }
  return value === defaultValue;
}

function sanitizeRequestPersonalizationInput(value, storedPersonalization) {
  const sanitized = sanitizePersonalizationInput(value);
  if (!storedPersonalization || typeof storedPersonalization !== 'object') {
    return sanitized;
  }

  const explicitFields = new Set(normalizeExplicitFields(value?.[PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY]));
  const result = {};
  for (const field of USER_PERSONALIZATION_FIELDS) {
    if (!hasOwn(sanitized, field)) continue;
    const hasStoredValue = hasOwn(storedPersonalization, field);
    const isExplicit = explicitFields.has(field);
    const isDefaultValue = isClientDefaultRequestValue(field, sanitized[field]);
    if (hasStoredValue && !isExplicit && isDefaultValue) {
      continue;
    }
    result[field] = sanitized[field];
  }

  return result;
}

export function sanitizePersonalizationInput(value) {
  const input = value && typeof value === 'object' ? value : {};
  const result = {};

  if (hasOwn(input, 'displayName') && typeof input.displayName === 'string') {
    result.displayName = sanitizeDisplayName(input.displayName) || '';
  }

  if (hasOwn(input, 'readingTone')) {
    const sanitized = sanitizeEnum(input.readingTone, ALLOWED_READING_TONES);
    if (sanitized !== undefined) {
      result.readingTone = sanitized;
    }
  }

  if (hasOwn(input, 'spiritualFrame')) {
    const sanitized = sanitizeEnum(input.spiritualFrame, ALLOWED_SPIRITUAL_FRAMES);
    if (sanitized !== undefined) {
      result.spiritualFrame = sanitized;
    }
  }

  if (hasOwn(input, 'tarotExperience')) {
    const sanitized = sanitizeEnum(input.tarotExperience, ALLOWED_TAROT_EXPERIENCE);
    if (sanitized !== undefined) {
      result.tarotExperience = sanitized;
    }
  }

  if (hasOwn(input, 'preferredSpreadDepth')) {
    const sanitized = sanitizeEnum(input.preferredSpreadDepth, ALLOWED_SPREAD_DEPTH);
    if (sanitized !== undefined) {
      result.preferredSpreadDepth = sanitized;
    }
  }

  if (hasOwn(input, 'focusAreas') && Array.isArray(input.focusAreas)) {
    result.focusAreas = sanitizeFocusAreas(input.focusAreas) || [];
  }

  return result;
}

export function mergePersonalizationSources(...sources) {
  const merged = {};

  for (const source of sources) {
    const sanitized = sanitizePersonalizationInput(source);
    for (const field of USER_PERSONALIZATION_FIELDS) {
      if (hasOwn(sanitized, field)) {
        merged[field] = sanitized[field];
      }
    }
  }

  return merged;
}

async function loadUserPreferencesRow(db, userId) {
  if (!db || !userId) return null;

  const result = await db.prepare(`
    SELECT display_name, reading_tone, spiritual_frame, preferred_spread_depth
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!result) return null;

  return sanitizePersonalizationInput({
    displayName: result.display_name,
    readingTone: result.reading_tone,
    spiritualFrame: result.spiritual_frame,
    preferredSpreadDepth: result.preferred_spread_depth
  });
}

async function loadLatestJournalPreferences(db, userId) {
  if (!db || !userId) return null;

  const result = await db.prepare(`
    SELECT user_preferences_json
    FROM journal_entries
    WHERE user_id = ?
      AND user_preferences_json IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(userId).first();

  if (!result?.user_preferences_json) return null;

  const parsed = safeJsonParse(result.user_preferences_json, null);
  return sanitizePersonalizationInput(parsed);
}

export async function loadStoredPersonalization(db, userId) {
  if (!db || !userId) return null;

  try {
    const [journalPreferences, userPreferences] = await Promise.all([
      loadLatestJournalPreferences(db, userId),
      loadUserPreferencesRow(db, userId)
    ]);

    const merged = mergePersonalizationSources(journalPreferences, userPreferences);
    return Object.keys(merged).length > 0 ? merged : null;
  } catch (error) {
    console.warn('[loadStoredPersonalization] Error:', error?.message || error);
    return null;
  }
}

export async function resolveReadingPersonalizationContext(db, userId, requestPersonalization, options = {}) {
  const storedPersonalization = await loadStoredPersonalization(db, userId);
  const sanitizedRequestPersonalization = sanitizeRequestPersonalizationInput(
    requestPersonalization,
    storedPersonalization
  );
  const mergedPersonalization = mergePersonalizationSources(
    storedPersonalization,
    sanitizedRequestPersonalization
  );

  let memories = [];
  if (db && userId) {
    const memoryLoader = typeof options.loadMemories === 'function' ? options.loadMemories : getMemories;
    const memoryLimit = Number.isFinite(options.memoryLimit) && options.memoryLimit > 0
      ? Math.floor(options.memoryLimit)
      : DEFAULT_GLOBAL_MEMORY_LIMIT;
    try {
      memories = await memoryLoader(db, userId, {
        scope: 'global',
        limit: memoryLimit
      });
    } catch (error) {
      console.warn('[resolveReadingPersonalizationContext] Memory load failed:', error?.message || error);
    }
  }

  return {
    personalization: Object.keys(mergedPersonalization).length > 0 ? mergedPersonalization : null,
    storedPersonalization,
    memories: Array.isArray(memories) ? memories : []
  };
}
