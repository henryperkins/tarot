import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'tableu-storage'
});

export const storageKeys = {
  theme: 'tarot-theme',
  voiceEnabled: 'tarot-voice-enabled',
  ambienceEnabled: 'tarot-ambience-enabled',
  deckStyleId: 'tarot-deck-style-id',
  subscriptionTier: 'tarot-subscription-tier',
  subscriptionProductId: 'tarot-subscription-product-id',
  subscriptionUpdatedAt: 'tarot-subscription-updated-at'
};

export const getString = (key) => storage.getString(key) ?? null;
export const getBoolean = (key) => storage.getBoolean(key);
export const getNumber = (key) => storage.getNumber(key);
export const setString = (key, value) => storage.set(key, value);
export const setBoolean = (key, value) => storage.set(key, value);
export const setNumber = (key, value) => storage.set(key, value);
export const removeKey = (key) => storage.delete(key);

export const getJson = (key) => {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setJson = (key, value) => {
  storage.set(key, JSON.stringify(value));
};
