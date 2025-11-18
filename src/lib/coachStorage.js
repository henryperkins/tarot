const TEMPLATE_STORAGE_KEY = 'tarot_coach_templates';
const HISTORY_STORAGE_KEY = 'tarot_coach_history';
const MAX_TEMPLATES = 8;
const MAX_HISTORY_ITEMS = 10;

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
  return localStorage.getItem(key);
}

function writeToStorage(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Unable to persist coach storage payload:', error);
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
  writeToStorage(TEMPLATE_STORAGE_KEY, next);
  return { success: true, templates: next, template: entry };
}

export function deleteCoachTemplate(templateId) {
  if (!templateId) {
    return { success: false, templates: loadCoachTemplates() };
  }
  const existing = loadCoachTemplates();
  const next = existing.filter(template => template.id !== templateId);
  writeToStorage(TEMPLATE_STORAGE_KEY, next);
  return { success: true, templates: next };
}

export function loadCoachHistory(limit = MAX_HISTORY_ITEMS) {
  const raw = readFromStorage(HISTORY_STORAGE_KEY);
  const history = safeParse(raw, []);
  if (!Array.isArray(history)) {
    return [];
  }
  return typeof limit === 'number' ? history.slice(0, limit) : history;
}

export function recordCoachQuestion(question, limit = MAX_HISTORY_ITEMS) {
  const trimmed = (question || '').trim();
  if (!trimmed) {
    return loadCoachHistory(limit);
  }
  const history = loadCoachHistory(limit * 2);
  const filtered = history.filter(entry => entry.question.toLowerCase() !== trimmed.toLowerCase());
  const entry = {
    id: generateId('question'),
    question: trimmed,
    createdAt: Date.now()
  };
  const next = [entry, ...filtered].slice(0, limit);
  writeToStorage(HISTORY_STORAGE_KEY, next);
  return next;
}
