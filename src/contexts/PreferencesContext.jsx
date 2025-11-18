import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { getDeckPool } from '../lib/deck';
import { initAudio, cleanupAudio, stopTTS, toggleAmbience } from '../lib/audio';

const PreferencesContext = createContext(null);

const PREPARE_SECTIONS_STORAGE_KEY = 'tarot-prepare-sections';
const DEFAULT_PREPARE_SECTIONS = {
  intention: false,
  experience: false,
  ritual: false
};

export function PreferencesProvider({ children }) {
  // --- Theme ---
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tarot-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root) {
      root.classList.toggle('light', theme === 'light');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-theme', theme);
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('tarot-theme-change', { detail: { theme } }));
      } catch (error) {
        console.debug('Unable to broadcast theme change', error);
      }
    }
  }, [theme]);

  // --- Audio: Voice ---
  const [voiceOn, setVoiceOn] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-voice-enabled');
      return saved === 'true';
    }
    return false;
  });

  // Persist voice setting
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-voice-enabled', voiceOn.toString());
    }
    // If turned off, stop any current narration
    if (!voiceOn) {
      stopTTS();
    }
  }, [voiceOn]);

  // --- Audio: Ambience ---
  const [ambienceOn, setAmbienceOn] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-ambience-enabled');
      return saved === 'true';
    }
    return false;
  });

  // Persist ambience setting and toggle audio
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-ambience-enabled', ambienceOn.toString());
    }
    toggleAmbience(ambienceOn);
  }, [ambienceOn]);

  // Initialize audio on mount
  useEffect(() => {
    initAudio();
    // We don't cleanup here because this context wraps the app and we might want audio to persist
    // or we rely on app unmount. However, standard practice is usually cleanup on unmount.
    return () => {
      cleanupAudio();
    };
  }, []);

  // --- Deck Style ---
  const [deckStyleId, setDeckStyleId] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-deck-style');
      return saved || 'rws-1909';
    }
    return 'rws-1909';
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-deck-style', deckStyleId);
    }
  }, [deckStyleId]);

  // --- Deck Scope & Composition ---
  const [includeMinors, setIncludeMinors] = useState(true); // Default to full 78 cards

  // Computed deck properties
  const { deckSize, minorsDataIncomplete } = useMemo(() => {
    const pool = getDeckPool(includeMinors);
    return {
      deckSize: pool.length,
      minorsDataIncomplete: includeMinors && pool.length === MAJOR_ARCANA.length
    };
  }, [includeMinors]);

  // --- Reversal Framework ---
  // Not persisted by default in original code, but kept as state
  const [reversalFramework, setReversalFramework] = useState(null);

  // --- UI State: Prepare Sections ---
  const [prepareSectionsOpen, setPrepareSectionsOpen] = useState(() => {
    if (typeof sessionStorage === 'undefined') {
      return { ...DEFAULT_PREPARE_SECTIONS };
    }
    try {
      const stored = sessionStorage.getItem(PREPARE_SECTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PREPARE_SECTIONS, ...parsed };
      }
    } catch (error) {
      console.debug('Unable to load prepare panel state:', error);
    }
    return { ...DEFAULT_PREPARE_SECTIONS };
  });

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(
        PREPARE_SECTIONS_STORAGE_KEY,
        JSON.stringify(prepareSectionsOpen)
      );
    } catch (error) {
      console.debug('Unable to persist prepare panel state:', error);
    }
  }, [prepareSectionsOpen]);

  const togglePrepareSection = (section) => {
    setPrepareSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const value = {
    theme,
    setTheme,
    voiceOn,
    setVoiceOn,
    ambienceOn,
    setAmbienceOn,
    deckStyleId,
    setDeckStyleId,
    includeMinors,
    setIncludeMinors,
    deckSize,
    minorsDataIncomplete,
    reversalFramework,
    setReversalFramework,
    prepareSectionsOpen,
    togglePrepareSection
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}