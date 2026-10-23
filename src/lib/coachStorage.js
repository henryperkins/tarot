import { safeStorage } from './safeStorage.js';
import { generateId, safeParse } from './utils.js';

const TEMPLATE_STORAGE_KEY = 'tarot_coach_templates';
export const HISTORY_STORAGE_KEY = 'tarot_coach_history';
const LEGACY_TEMPLATE_STORAGE_KEY = TEMPLATE_STORAGE_KEY;
const LEGACY_HISTORY_STORAGE_KEY = HISTORY_STORAGE_KEY;
export const MAX_TEMPLATES = 8;
const MAX_HISTORY_ITEMS = 10;
export const COACH_STORAGE_SYNC_EVENT = 'coach-storage-sync';
// Undo belongs to the current session and the owner who made the replacement.
// Keep canonical snapshots private so a changed or copied token cannot restore
// another owner's templates or arbitrary data.
const templateUndoSnapshots = new WeakMap();

const dispatchCoachStorageEvent = (key) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(COACH_STORAGE_SYNC_EVENT, { detail: { key } }));
  } catch {
    // CustomEvent or dispatch can fail in older browsers; swallow to avoid crashing.
  }
};

const getScopedKey = (prefix, userId) => {
  if (!userId) return `${prefix}_anon`;
  return `${prefix}_${userId}`;
};

function readFromStorage(key) {
  return safeStorage.getItem(key);
}

function writeToStorage(key, value) {
  if (!safeStorage.isAvailable) {
    return { success: false, error: 'Coach storage is unavailable in this environment.' };
  }
  try {
    const serialized = JSON.stringify(value);
    const wrote = safeStorage.setItem(key, serialized);
    // safeStorage absorbs quota/privacy errors. Confirm persistence before
    // reporting success or notifying other coach views about a change.
    if (!wrote || safeStorage.getItem(key) !== serialized) {
      throw new Error('Browser storage did not retain the coach data.');
    }
    dispatchCoachStorageEvent(key);
    return { success: true };
  } catch (error) {
    console.warn('Unable to persist coach storage payload:', error);
    return { success: false, error: 'We could not update your coach data. Please check storage settings and try again.' };
  }
}

function loadScopedArray(prefix, userId, fallback = []) {
  const scopedKey = getScopedKey(prefix, userId);
  const raw = readFromStorage(scopedKey);

  if (!raw && !userId) {
    const legacyRaw = readFromStorage(prefix);
    if (legacyRaw) {
      const legacyParsed = safeParse(legacyRaw, fallback);
      if (Array.isArray(legacyParsed)) {
        const persistence = writeToStorage(scopedKey, legacyParsed);
        if (persistence.success && safeStorage.isAvailable) {
          safeStorage.removeItem(prefix);
        }
        return legacyParsed;
      }
    }
  }

  const parsed = safeParse(raw, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function loadCoachTemplates(userId = null) {
  return loadScopedArray(LEGACY_TEMPLATE_STORAGE_KEY, userId, []);
}

/**
 * Browser template writers must use this boundary for save, remove and Undo.
 * The snapshot comparison and its write then share one exclusive lock across
 * tabs. The synchronous helpers below remain usable by non-browser callers.
 */
export async function runCoachTemplateMutation(userId, operation) {
  try {
    const locks = globalThis.navigator?.locks;
    if (typeof locks?.request !== 'function' || typeof operation !== 'function') {
      return { success: false, error: 'Template changes are unavailable in this browser. You can still use your question.' };
    }
    const lockName = `tableu:template-mutation:${getScopedKey(TEMPLATE_STORAGE_KEY, userId)}`;
    return await locks.request(lockName, { mode: 'exclusive' }, () => operation());
  } catch {
    return { success: false, error: 'We could not update your templates. Please try again.' };
  }
}

export function saveCoachTemplate(template, userId = null) {
  if (!template || !template.label) {
    return { success: false, error: 'Template requires a label.' };
  }
  const trimmedLabel = template.label.trim();
  if (!trimmedLabel) {
    return { success: false, error: 'Template label cannot be empty.' };
  }
  const existing = loadCoachTemplates(userId);
  const sameNameTemplate = existing.find(item => item.label.toLowerCase() === trimmedLabel.toLowerCase());
  const filtered = existing.filter(item => item.label.toLowerCase() !== trimmedLabel.toLowerCase());
  const entry = {
    id: template.id || generateId('template'),
    label: trimmedLabel,
    topic: template.topic,
    timeframe: template.timeframe,
    depth: template.depth,
    customFocus: template.customFocus || '',
    useCreative: Boolean(template.useCreative),
    savedQuestion: template.savedQuestion || '',
    updatedAt: Date.now()
  };
  const next = [entry, ...filtered].slice(0, MAX_TEMPLATES);
  const storageKey = getScopedKey(TEMPLATE_STORAGE_KEY, userId);
  const persistence = writeToStorage(storageKey, next);
  if (!persistence.success) {
    return { success: false, error: persistence.error || 'Unable to save template right now.' };
  }
  const replacedTemplate = sameNameTemplate || (filtered.length >= MAX_TEMPLATES ? filtered[MAX_TEMPLATES - 1] : null);
  let undoToken = null;
  if (replacedTemplate) {
    const before = JSON.stringify(existing);
    const after = JSON.stringify(next);
    undoToken = { before: JSON.parse(before), after: JSON.parse(after) };
    templateUndoSnapshots.set(undoToken, { storageKey, before, after });
  }
  return { success: true, templates: next, template: entry, replacedTemplate, undoToken };
}

export function undoCoachTemplateSave(token, userId = null) {
  const storageKey = getScopedKey(TEMPLATE_STORAGE_KEY, userId);
  // Read only this owner's scoped key. An invalid or stale Undo must not migrate
  // legacy data, notify other views, or make any other storage change.
  const parsed = safeParse(readFromStorage(storageKey), []);
  const current = Array.isArray(parsed) ? parsed : [];
  const snapshot = token && typeof token === 'object' ? templateUndoSnapshots.get(token) : null;
  let valid = false;
  try {
    valid = Boolean(snapshot && snapshot.storageKey === storageKey
      && Array.isArray(token.before) && token.before.length <= MAX_TEMPLATES
      && Array.isArray(token.after) && token.after.length <= MAX_TEMPLATES
      && JSON.stringify(token.before) === snapshot.before
      && JSON.stringify(token.after) === snapshot.after);
  } catch {
    // Circular or otherwise altered snapshots are not valid recovery data.
  }
  if (!valid) {
    return { success: false, templates: current, error: 'This template replacement can no longer be undone.' };
  }
  if (JSON.stringify(current) !== snapshot.after) {
    return { success: false, templates: current, error: 'Your templates changed after this save. Undo is no longer available.' };
  }
  const before = JSON.parse(snapshot.before);
  const persistence = writeToStorage(storageKey, before);
  if (!persistence.success) {
    return { success: false, templates: current, error: persistence.error || 'Unable to restore your templates right now.' };
  }
  templateUndoSnapshots.delete(token);
  return { success: true, templates: before };
}

export function deleteCoachTemplate(templateId, userId = null) {
  if (!templateId) {
    return { success: false, templates: loadCoachTemplates(userId) };
  }
  const existing = loadCoachTemplates(userId);
  const next = existing.filter(template => template.id !== templateId);
  const storageKey = getScopedKey(TEMPLATE_STORAGE_KEY, userId);
  const persistence = writeToStorage(storageKey, next);
  if (!persistence.success) {
    return {
      success: false,
      error: persistence.error || 'Unable to update templates right now.',
      templates: existing
    };
  }
  return { success: true, templates: next };
}

export function loadCoachHistory(limit = MAX_HISTORY_ITEMS, userId = null) {
  const history = loadScopedArray(LEGACY_HISTORY_STORAGE_KEY, userId, []);
  if (!Array.isArray(history)) {
    return [];
  }
  const normalized = history.filter(entry => entry && typeof entry.question === 'string');
  return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
}

export function recordCoachQuestion(question, limit = MAX_HISTORY_ITEMS, userId = null) {
  const trimmed = (question || '').trim();
  const normalizedLimit = typeof limit === 'number' && limit > 0 ? limit : MAX_HISTORY_ITEMS;
  const historyPool = loadCoachHistory(normalizedLimit * 2, userId);
  const currentHistory = historyPool.slice(0, normalizedLimit);

  if (!trimmed) {
    return { success: true, history: currentHistory };
  }

  const filtered = historyPool.filter(entry => entry.question.toLowerCase() !== trimmed.toLowerCase());
  const entry = {
    id: generateId('question'),
    question: trimmed,
    createdAt: Date.now()
  };
  const next = [entry, ...filtered].slice(0, normalizedLimit);
  const storageKey = getScopedKey(HISTORY_STORAGE_KEY, userId);
  const persistence = writeToStorage(storageKey, next);
  if (!persistence.success) {
    return {
      success: false,
      history: currentHistory,
      error: persistence.error || 'Question applied, but we could not save it to your recent history. Check browser storage or privacy settings.'
    };
  }
  return { success: true, history: next };
}

export function deleteCoachHistoryItem(itemId, userId = null) {
  if (!itemId) {
    return { success: false, history: loadCoachHistory(undefined, userId) };
  }
  const existing = loadCoachHistory(100, userId); // Load more to ensure we don't lose items unnecessarily, though we usually cap at MAX_HISTORY_ITEMS
  const next = existing.filter(item => item.id !== itemId);
  const storageKey = getScopedKey(HISTORY_STORAGE_KEY, userId);
  const persistence = writeToStorage(storageKey, next);
  if (!persistence.success) {
    return {
      success: false,
      error: persistence.error || 'Unable to update history right now.',
      history: existing
    };
  }
  return { success: true, history: next };
}
