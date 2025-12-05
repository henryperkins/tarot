import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { getDeckPool } from '../lib/deck';
import { initAudio, cleanupAudio, stopTTS, toggleAmbience } from '../lib/audio';

const PreferencesContext = createContext(null);

const PREPARE_SECTIONS_STORAGE_KEY = 'tarot-prepare-sections';
const ONBOARDING_STORAGE_KEY = 'tarot-onboarding-complete';
const PERSONALIZATION_STORAGE_KEY = 'tarot-personalization';
const PERSONALIZATION_BANNER_KEY = 'tarot-personalization-banner';
const NUDGE_STATE_STORAGE_KEY = 'tarot-nudge-state';
const DEFAULT_PREPARE_SECTIONS = {
  intention: false,
  experience: false,
  ritual: false,
  audio: false
};

const DEFAULT_PERSONALIZATION = {
  displayName: '',
  tarotExperience: 'newbie',
  readingTone: 'balanced',
  focusAreas: [],
  preferredSpreadDepth: 'standard',
  spiritualFrame: 'mixed',
  showRitualSteps: true
};

/** Nudge state for contextual discovery (trimmed onboarding) */
const DEFAULT_NUDGE_STATE = {
  hasSeenRitualNudge: false,
  hasSeenJournalNudge: false,
  hasDismissedAccountNudge: false,
  readingCount: 0,
  journalSaveCount: 0
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
      root.classList.remove('light-mode');
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

  // --- Audio: Auto-narrate on first view ---
  const [autoNarrate, setAutoNarrate] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-auto-narrate');
      // Default to true if not set
      return saved === null ? true : saved === 'true';
    }
    return true;
  });

  // Persist auto-narrate setting
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-auto-narrate', autoNarrate.toString());
    }
  }, [autoNarrate]);

  // --- Audio: TTS Provider (azure, azure-sdk, or hume) ---
  const TTS_PROVIDER_OPTIONS = ['hume', 'azure', 'azure-sdk'];
  const [ttsProviderState, setTtsProviderState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-tts-provider');
      return TTS_PROVIDER_OPTIONS.includes(saved) ? saved : 'hume'; // Default to Hume for expressive readings
    }
    return 'hume';
  });

  // Wrapper setter that guards against invalid TTS provider values
  const setTtsProvider = (value) => {
    const safeValue = TTS_PROVIDER_OPTIONS.includes(value) ? value : 'hume';
    setTtsProviderState(safeValue);
  };

  // Expose validated state value (alias for clarity)
  const ttsProvider = ttsProviderState;

  // Persist TTS provider setting
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-tts-provider', ttsProviderState);
    }
  }, [ttsProviderState]);

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

  // --- Personalization Preferences ---
  const [personalization, setPersonalizationState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_PERSONALIZATION, ...parsed };
        }
      } catch (error) {
        console.debug('Unable to load personalization:', error);
      }
    }
    return { ...DEFAULT_PERSONALIZATION };
  });

  // Persist personalization changes
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(personalization));
      } catch (error) {
        console.debug('Unable to persist personalization:', error);
      }
    }
  }, [personalization]);

  // Individual setters for personalization fields
  const setDisplayName = (value) => {
    setPersonalizationState(prev => ({ ...prev, displayName: value }));
  };

  const setTarotExperience = (value) => {
    setPersonalizationState(prev => ({ ...prev, tarotExperience: value }));
  };

  const setReadingTone = (value) => {
    setPersonalizationState(prev => ({ ...prev, readingTone: value }));
  };

  const setFocusAreas = (value) => {
    setPersonalizationState(prev => ({ ...prev, focusAreas: value }));
  };

  const setPreferredSpreadDepth = (value) => {
    setPersonalizationState(prev => ({ ...prev, preferredSpreadDepth: value }));
  };

  const setSpiritualFrame = (value) => {
    setPersonalizationState(prev => ({ ...prev, spiritualFrame: value }));
  };

  const setShowRitualSteps = (value) => {
    setPersonalizationState(prev => ({ ...prev, showRitualSteps: value }));
  };

  // Toggle a focus area (for multi-select)
  const toggleFocusArea = (area) => {
    setPersonalizationState(prev => {
      const current = prev.focusAreas || [];
      if (current.includes(area)) {
        return { ...prev, focusAreas: current.filter(a => a !== area) };
      } else {
        return { ...prev, focusAreas: [...current, area] };
      }
    });
  };

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

  // --- Onboarding State ---
  const [onboardingComplete, setOnboardingCompleteState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    }
    return false;
  });

  const [onboardingSpreadKey, setOnboardingSpreadKey] = useState(null);

  // Initialize personalization banner visibility based on localStorage
  // Using lazy initializer avoids needing an effect to set initial state
  const [showPersonalizationBanner, setShowPersonalizationBanner] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    try {
      const hasReadings = localStorage.getItem('tarot_journal');
      const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
      const bannerDismissed = localStorage.getItem(PERSONALIZATION_BANNER_KEY) === 'dismissed';
      // Show banner if user has readings but hasn't completed onboarding and hasn't dismissed
      return !!(hasReadings && !hasCompletedOnboarding && !bannerDismissed);
    } catch (error) {
      console.debug('Unable to evaluate personalization banner state:', error);
      return false;
    }
  });

  const setOnboardingComplete = (value) => {
    setOnboardingCompleteState(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, value.toString());
    }
  };

  const resetOnboarding = () => {
    // Variant is memoized per wizard mount; reset here just clears progress/state.
    setOnboardingComplete(false);
    setOnboardingSpreadKey(null);
  };

  // --- Nudge State (Contextual Discovery) ---
  const [nudgeState, setNudgeStateInternal] = useState(() => {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_NUDGE_STATE };
    }
    try {
      const stored = localStorage.getItem(NUDGE_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_NUDGE_STATE, ...parsed };
      }
    } catch (error) {
      console.debug('Unable to load nudge state:', error);
    }
    return { ...DEFAULT_NUDGE_STATE };
  });

  // Persist nudge state to localStorage
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(NUDGE_STATE_STORAGE_KEY, JSON.stringify(nudgeState));
    } catch (error) {
      console.debug('Unable to persist nudge state:', error);
    }
  }, [nudgeState]);

  // Nudge state setters
  const markRitualNudgeSeen = () => {
    setNudgeStateInternal(prev => ({ ...prev, hasSeenRitualNudge: true }));
  };

  const markJournalNudgeSeen = () => {
    setNudgeStateInternal(prev => ({ ...prev, hasSeenJournalNudge: true }));
  };

  const dismissAccountNudge = () => {
    setNudgeStateInternal(prev => ({ ...prev, hasDismissedAccountNudge: true }));
  };

  const incrementReadingCount = () => {
    setNudgeStateInternal(prev => ({ ...prev, readingCount: prev.readingCount + 1 }));
  };

  const incrementJournalSaveCount = () => {
    setNudgeStateInternal(prev => ({ ...prev, journalSaveCount: prev.journalSaveCount + 1 }));
  };

  // Computed nudge visibility helpers
  const shouldShowRitualNudge = nudgeState.readingCount === 0 && !nudgeState.hasSeenRitualNudge;
  const shouldShowJournalNudge = nudgeState.readingCount === 0 && !nudgeState.hasSeenJournalNudge;
  const shouldShowAccountNudge = nudgeState.journalSaveCount >= 3 && !nudgeState.hasDismissedAccountNudge;

  const value = {
    theme,
    setTheme,
    voiceOn,
    setVoiceOn,
    ambienceOn,
    setAmbienceOn,
    autoNarrate,
    setAutoNarrate,
    ttsProvider,
    setTtsProvider,
    deckStyleId,
    setDeckStyleId,
    includeMinors,
    setIncludeMinors,
    deckSize,
    minorsDataIncomplete,
    reversalFramework,
    setReversalFramework,
    prepareSectionsOpen,
    togglePrepareSection,
    // Personalization
    personalization,
    setDisplayName,
    setTarotExperience,
    setReadingTone,
    setFocusAreas,
    setPreferredSpreadDepth,
    setSpiritualFrame,
    setShowRitualSteps,
    toggleFocusArea,
    // Onboarding
    onboardingComplete,
    setOnboardingComplete,
    onboardingSpreadKey,
    setOnboardingSpreadKey,
    resetOnboarding,
    showPersonalizationBanner,
    setShowPersonalizationBanner,
    // Nudge state (contextual discovery)
    nudgeState,
    shouldShowRitualNudge,
    shouldShowJournalNudge,
    shouldShowAccountNudge,
    markRitualNudgeSeen,
    markJournalNudgeSeen,
    dismissAccountNudge,
    incrementReadingCount,
    incrementJournalSaveCount
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Context + hook pattern is intentional
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
