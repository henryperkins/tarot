import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getBoolean, getString, setBoolean, setString, storageKeys } from '../lib/storage';

const PreferencesContext = createContext(null);

const DEFAULTS = {
  theme: 'dark',
  voiceOn: true,
  ambienceOn: true,
  deckStyleId: 'rws-1909'
};

export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState(() => getString(storageKeys.theme) || DEFAULTS.theme);
  const [voiceOn, setVoiceOn] = useState(() => {
    const stored = getBoolean(storageKeys.voiceEnabled);
    return typeof stored === 'boolean' ? stored : DEFAULTS.voiceOn;
  });
  const [ambienceOn, setAmbienceOn] = useState(() => {
    const stored = getBoolean(storageKeys.ambienceEnabled);
    return typeof stored === 'boolean' ? stored : DEFAULTS.ambienceOn;
  });
  const [deckStyleId, setDeckStyleId] = useState(() => getString(storageKeys.deckStyleId) || DEFAULTS.deckStyleId);

  useEffect(() => {
    setString(storageKeys.theme, theme);
  }, [theme]);

  useEffect(() => {
    setBoolean(storageKeys.voiceEnabled, voiceOn);
  }, [voiceOn]);

  useEffect(() => {
    setBoolean(storageKeys.ambienceEnabled, ambienceOn);
  }, [ambienceOn]);

  useEffect(() => {
    setString(storageKeys.deckStyleId, deckStyleId);
  }, [deckStyleId]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    voiceOn,
    setVoiceOn,
    ambienceOn,
    setAmbienceOn,
    deckStyleId,
    setDeckStyleId
  }), [theme, voiceOn, ambienceOn, deckStyleId]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
