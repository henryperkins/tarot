export const TEMPLATE_STORAGE_KEY = 'tarot_coach_templates';
export const HISTORY_STORAGE_KEY = 'tarot_coach_history';
export const MAX_TEMPLATES = 8;
export const MAX_HISTORY_ITEMS = 10;
export const COACH_STORAGE_SYNC_EVENT = 'coach-storage-sync';

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

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn('Failed to parse coach storage payload:', error);
    return fallback;
  }
}

function readFromStorage(key) {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Unable to read coach storage payload:', error);
    return null;
  }
}

function writeToStorage(key, value) {
  if (typeof localStorage === 'undefined') {
    return { success: false, error: 'Coach storage is unavailable in this environment.' };
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    dispatchCoachStorageEvent(key);
    return { success: true };
  } catch (error) {
    console.warn('Unable to persist coach storage payload:', error);
    return { success: false, error: 'We could not update your coach data. Please check storage settings and try again.' };
  }
}

function generateId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadCoachTemplates() {
  const raw = readFromStorage(TEMPLATE_STORAGE_KEY);
  const templates = safeParse(raw, []);
  return Array.isArray(templates) ? templates : [];
}

export function saveCoachTemplate(template) {
  if (!template || !template.label) {
    return { success: false, error: 'Template requires a label.' };
  }
  const trimmedLabel = template.label.trim();
  if (!trimmedLabel) {
    return { success: false, error: 'Template label cannot be empty.' };
  }
  const existing = loadCoachTemplates();
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
  const persistence = writeToStorage(TEMPLATE_STORAGE_KEY, next);
  if (!persistence.success) {
    return { success: false, error: persistence.error || 'Unable to save template right now.' };
  }
  return { success: true, templates: next, template: entry };
}

export function deleteCoachTemplate(templateId) {
  if (!templateId) {
    return { success: false, templates: loadCoachTemplates() };
  }
  const existing = loadCoachTemplates();
  const next = existing.filter(template => template.id !== templateId);
  const persistence = writeToStorage(TEMPLATE_STORAGE_KEY, next);
  if (!persistence.success) {
    return {
      success: false,
      error: persistence.error || 'Unable to update templates right now.',
      templates: existing
    };
  }
  return { success: true, templates: next };
}

export function loadCoachHistory(limit = MAX_HISTORY_ITEMS) {
  const raw = readFromStorage(HISTORY_STORAGE_KEY);
  const history = safeParse(raw, []);
  if (!Array.isArray(history)) {
    return [];
  }
  const normalized = history.filter(entry => entry && typeof entry.question === 'string');
  return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
}

export function recordCoachQuestion(question, limit = MAX_HISTORY_ITEMS) {
  const trimmed = (question || '').trim();
  const normalizedLimit = typeof limit === 'number' && limit > 0 ? limit : MAX_HISTORY_ITEMS;
  const historyPool = loadCoachHistory(normalizedLimit * 2);
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
  const persistence = writeToStorage(HISTORY_STORAGE_KEY, next);
  if (!persistence.success) {
    return {
      success: false,
      history: currentHistory,
      error: persistence.error || 'Question applied, but we could not save it to your recent history. Check browser storage or privacy settings.'
    };
  }
  return { success: true, history: next };
}

export function deleteCoachHistoryItem(itemId) {
  if (!itemId) {
    return { success: false, history: loadCoachHistory() };
  }
  const existing = loadCoachHistory(100); // Load more to ensure we don't lose items unnecessarily, though we usually cap at MAX_HISTORY_ITEMS
  const next = existing.filter(item => item.id !== itemId);
  const persistence = writeToStorage(HISTORY_STORAGE_KEY, next);
  if (!persistence.success) {
    return {
      success: false,
      error: persistence.error || 'Unable to update history right now.',
      history: existing
    };
  }
  return { success: true, history: next };
}
