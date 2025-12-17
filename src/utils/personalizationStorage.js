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

export function getPersonalizationStorageKey(userId) {
  if (!userId) return PERSONALIZATION_GUEST_KEY;
  return `${PERSONALIZATION_STORAGE_KEY_BASE}:${userId}`;
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
      return { ...DEFAULT_PERSONALIZATION, ...parsed };
    }
  } catch (error) {
    console.debug('Unable to load personalization:', error);
  }
  return { ...DEFAULT_PERSONALIZATION };
}
