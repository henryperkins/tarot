import { safeStorage } from './safeStorage';
import { generateId, safeParse } from './utils';

const TEMPLATE_STORAGE_KEY = 'tarot_coach_templates';
export const HISTORY_STORAGE_KEY = 'tarot_coach_history';
const LEGACY_TEMPLATE_STORAGE_KEY = TEMPLATE_STORAGE_KEY;
const LEGACY_HISTORY_STORAGE_KEY = HISTORY_STORAGE_KEY;
export const MAX_TEMPLATES = 8;
const MAX_HISTORY_ITEMS = 10;

const getScopedKey = (prefix: string, userId?: string | null) => {
  if (!userId) return `${prefix}_anon`;
  return `${prefix}_${userId}`;
};

async function readFromStorage(key: string) {
  return safeStorage.getItem(key);
}

async function writeToStorage(key: string, value: unknown) {
  if (!safeStorage.isAvailable) {
    return { success: false, error: 'Coach storage is unavailable in this environment.' };
  }
  try {
    await safeStorage.setItem(key, JSON.stringify(value));
    return { success: true };
  } catch (error) {
    console.warn('Unable to persist coach storage payload:', error);
    return { success: false, error: 'We could not update your coach data. Please check storage settings and try again.' };
  }
}

async function loadScopedArray(prefix: string, userId?: string | null, fallback: unknown[] = []) {
  const scopedKey = getScopedKey(prefix, userId);
  const raw = await readFromStorage(scopedKey);

  if (!raw && !userId) {
    const legacyRaw = await readFromStorage(prefix);
    if (legacyRaw) {
      const legacyParsed = safeParse(legacyRaw, fallback);
      if (Array.isArray(legacyParsed)) {
        const persistence = await writeToStorage(scopedKey, legacyParsed);
        if (persistence.success && safeStorage.isAvailable) {
          await safeStorage.removeItem(prefix);
        }
        return legacyParsed;
      }
    }
  }

  const parsed = safeParse(raw, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export async function loadCoachTemplates(userId: string | null = null) {
  return loadScopedArray(LEGACY_TEMPLATE_STORAGE_KEY, userId, []);
}

export async function saveCoachTemplate(template: any, userId: string | null = null) {
  if (!template || !template.label) {
    return { success: false, error: 'Template requires a label.' };
  }
  const trimmedLabel = template.label.trim();
  if (!trimmedLabel) {
    return { success: false, error: 'Template label cannot be empty.' };
  }
  const existing = await loadCoachTemplates(userId);
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
    updatedAt: Date.now(),
  };
  const next = [entry, ...filtered].slice(0, MAX_TEMPLATES);
  const storageKey = getScopedKey(TEMPLATE_STORAGE_KEY, userId);
  const persistence = await writeToStorage(storageKey, next);
  if (!persistence.success) {
    return { success: false, error: persistence.error || 'Unable to save template right now.' };
  }
  return { success: true, templates: next, template: entry };
}

export async function deleteCoachTemplate(templateId: string, userId: string | null = null) {
  if (!templateId) {
    return { success: false, templates: await loadCoachTemplates(userId) };
  }
  const existing = await loadCoachTemplates(userId);
  const next = existing.filter(template => template.id !== templateId);
  const storageKey = getScopedKey(TEMPLATE_STORAGE_KEY, userId);
  const persistence = await writeToStorage(storageKey, next);
  if (!persistence.success) {
    return {
      success: false,
      error: persistence.error || 'Unable to update templates right now.',
      templates: existing,
    };
  }
  return { success: true, templates: next };
}

export async function loadCoachHistory(limit: number = MAX_HISTORY_ITEMS, userId: string | null = null) {
  const history = await loadScopedArray(LEGACY_HISTORY_STORAGE_KEY, userId, []);
  if (!Array.isArray(history)) {
    return [];
  }
  const normalized = history.filter(entry => entry && typeof entry.question === 'string');
  return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
}

export async function recordCoachQuestion(
  question: string,
  limit: number = MAX_HISTORY_ITEMS,
  userId: string | null = null,
) {
  const trimmed = (question || '').trim();
  const normalizedLimit = typeof limit === 'number' && limit > 0 ? limit : MAX_HISTORY_ITEMS;
  const historyPool = await loadCoachHistory(normalizedLimit * 2, userId);
  const currentHistory = historyPool.slice(0, normalizedLimit);

  if (!trimmed) {
    return { success: true, history: currentHistory };
  }

  const filtered = historyPool.filter(entry => entry.question.toLowerCase() !== trimmed.toLowerCase());
  const entry = {
    id: generateId('question'),
    question: trimmed,
    createdAt: Date.now(),
  };
  const next = [entry, ...filtered].slice(0, normalizedLimit);
  const storageKey = getScopedKey(HISTORY_STORAGE_KEY, userId);
  const persistence = await writeToStorage(storageKey, next);
  if (!persistence.success) {
    return {
      success: false,
      history: currentHistory,
      error: persistence.error || 'Question applied, but we could not save it to your recent history. Check storage settings and try again.',
    };
  }
  return { success: true, history: next };
}

export async function deleteCoachHistoryItem(itemId: string, userId: string | null = null) {
  if (!itemId) {
    return { success: false, history: await loadCoachHistory(undefined, userId) };
  }
  const existing = await loadCoachHistory(100, userId);
  const next = existing.filter(item => item.id !== itemId);
  const storageKey = getScopedKey(HISTORY_STORAGE_KEY, userId);
  const persistence = await writeToStorage(storageKey, next);
  if (!persistence.success) {
    return {
      success: false,
      error: persistence.error || 'Unable to update history right now.',
      history: existing,
    };
  }
  return { success: true, history: next };
}
