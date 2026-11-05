import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PERSONALIZATION_REQUEST_FIELDS } from '../../shared/contracts/personalizationConstants.js';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { getDeckPool } from '../lib/deck';
import { initAudio, cleanupAudio, stopTTS, toggleAmbience, normalizeTtsProvider } from '../lib/audio';
import { safeStorage } from '../lib/safeStorage';
import { migrateLegacyPersonalization, REVERSAL_FRAMEWORK_KEYS, safeSessionStorage } from '../lib/preferenceStorage';
import { useAuth } from './AuthContext';
import {
  accountPayloadKey,
  buildAccountPreferencesPayload,
  fetchAccountPreferences,
  loadAccountPreferenceOrigins,
  mergeAccountPersonalization,
  saveAccountPreferenceOrigins,
  saveAccountPreferences
} from '../lib/accountPreferences';
import {
  DEFAULT_PERSONALIZATION,
  PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH,
  derivePersonalizationExplicitFields,
  loadPersonalizationExplicitFields,
  getPersonalizationStorageKey,
  savePersonalizationExplicitFields,
  sanitizePersonalization,
  loadPersonalizationFromStorage
} from '../utils/personalizationStorage';

const PreferencesContext = createContext(null);

const PREPARE_SECTIONS_STORAGE_KEY = 'tarot-prepare-sections';
const ONBOARDING_STORAGE_KEY = 'tarot-onboarding-complete';
const PERSONALIZATION_BANNER_KEY = 'tarot-personalization-banner';
const NUDGE_STATE_STORAGE_KEY = 'tarot-nudge-state';
const LOCATION_JOURNAL_CONSENT_KEY = 'tarot-location-journal-consent';
// Setup's one remaining disclosure; the ritual moved to the reading table.
const DEFAULT_PREPARE_SECTIONS = {
  deck: false
};
const PERSONALIZATION_REQUEST_FIELD_SET = new Set(PERSONALIZATION_REQUEST_FIELDS);

/** Nudge state for contextual discovery (trimmed onboarding) */
const DEFAULT_NUDGE_STATE = {
  hasSeenRitualNudge: false,
  hasSeenJournalNudge: false,
  hasDismissedAccountNudge: false,
  readingCount: 0,
  journalSaveCount: 0,
  // Prevent double-counting the same narrative completion across UI remounts.
  // (e.g. navigate away/back while ReadingProvider keeps the same personalReading)
  lastCountedReadingRequestId: null
};

const THEME_COLOR_META_NAME = 'theme-color';
const FALLBACK_THEME_COLORS = {
  dark: 'rgb(15 14 19)',
  light: 'rgb(250 250 250)'
};

function updateThemeColorMeta(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const computedColor = root
    ? getComputedStyle(root).getPropertyValue('--bg-main').trim()
    : '';
  const fallbackColor = FALLBACK_THEME_COLORS[theme] || FALLBACK_THEME_COLORS.dark;
  const resolvedColor = computedColor || fallbackColor;

  document
    .querySelectorAll(`meta[name="${THEME_COLOR_META_NAME}"]`)
    .forEach(meta => {
      meta.setAttribute('content', resolvedColor);
    });
}

export function PreferencesProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || null;
  const personalizationStorageKey = useMemo(
    () => getPersonalizationStorageKey(userId),
    [userId]
  );
  const personalizationKeyRef = useRef(personalizationStorageKey);

  // --- Theme ---
  const [theme, setTheme] = useState(() => (
    safeStorage.getItem('tarot-theme') === 'light' ? 'light' : 'dark'
  ));

  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root) {
      root.classList.remove('light-mode');
      root.classList.toggle('light', theme === 'light');
    }
    updateThemeColorMeta(theme);
    safeStorage.setItem('tarot-theme', theme);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('tarot-theme-change', { detail: { theme } }));
      } catch (error) {
        console.debug('Unable to broadcast theme change', error);
      }
    }
  }, [theme]);

  // --- Audio: Voice ---
  const [voiceOn, setVoiceOn] = useState(() => safeStorage.getItem('tarot-voice-enabled') === 'true');

  // Persist voice setting
  useEffect(() => {
    safeStorage.setItem('tarot-voice-enabled', voiceOn.toString());
    // If turned off, stop any current narration
    if (!voiceOn) {
      stopTTS();
    }
  }, [voiceOn]);

  // --- Audio: Auto-narrate on first view ---
  const [autoNarrate, setAutoNarrate] = useState(() => {
    const saved = safeStorage.getItem('tarot-auto-narrate');
    // Default to true if not set or storage is unavailable.
    return saved === null ? true : saved === 'true';
  });

  // Persist auto-narrate setting
  useEffect(() => {
    safeStorage.setItem('tarot-auto-narrate', autoNarrate.toString());
  }, [autoNarrate]);

  // Retired saved engines migrate to the default narrator. Keep the safe
  // storage wrapper: blocked localStorage must not break preferences.
  const [ttsProviderState, setTtsProviderState] = useState(() => {
    return normalizeTtsProvider(safeStorage.getItem('tarot-tts-provider'));
  });
  const setTtsProvider = useCallback((value) => {
    const nextProvider = normalizeTtsProvider(value);
    if (nextProvider !== ttsProviderState) {
      stopTTS();
      setTtsProviderState(nextProvider);
    }
  }, [ttsProviderState]);

  // Expose validated state value (alias for clarity)
  const ttsProvider = ttsProviderState;

  // Persist the selected provider, including migrated saved engine values.
  useEffect(() => {
    safeStorage.setItem('tarot-tts-provider', ttsProviderState);
  }, [ttsProviderState]);

  // --- Audio: TTS Speed ---
  const TTS_SPEED_OPTIONS = [0.85, 1.0, 1.15];
  const [ttsSpeed, setTtsSpeedState] = useState(() => {
    const parsed = parseFloat(safeStorage.getItem('tarot-tts-speed'));
    return !isNaN(parsed) && TTS_SPEED_OPTIONS.includes(parsed) ? parsed : 1.0;
  });

  // Wrapper setter that guards against invalid speed values
  const setTtsSpeed = (value) => {
    const parsed = parseFloat(value);
    const safeValue = !isNaN(parsed) && TTS_SPEED_OPTIONS.includes(parsed) ? parsed : 1.0;
    setTtsSpeedState(safeValue);
  };

  // Persist TTS speed setting
  useEffect(() => {
    safeStorage.setItem('tarot-tts-speed', ttsSpeed.toString());
  }, [ttsSpeed]);

  // --- Audio: Ambience ---
  const [ambienceOn, setAmbienceOn] = useState(() => safeStorage.getItem('tarot-ambience-enabled') === 'true');

  // Persist ambience setting and toggle audio
  useEffect(() => {
    safeStorage.setItem('tarot-ambience-enabled', ambienceOn.toString());
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
  const [deckStyleId, setDeckStyleId] = useState(() => safeStorage.getItem('tarot-deck-style') || 'rws-1909');

  useEffect(() => {
    safeStorage.setItem('tarot-deck-style', deckStyleId);
  }, [deckStyleId]);

  // --- Deck Scope & Composition ---
  // Device-scoped: survives reload and is labelled "Device only" in settings.
  const [includeMinors, setIncludeMinors] = useState(() => {
    const stored = safeStorage.getItem('tarot-include-minors');
    return stored === null ? true : stored !== 'false'; // Default to full 78 cards
  });

  useEffect(() => {
    safeStorage.setItem('tarot-include-minors', includeMinors.toString());
  }, [includeMinors]);

  // Computed deck properties
  const { deckSize, minorsDataIncomplete } = useMemo(() => {
    const pool = getDeckPool(includeMinors);
    return {
      deckSize: pool.length,
      minorsDataIncomplete: includeMinors && pool.length === MAJOR_ARCANA.length
    };
  }, [includeMinors]);

  // --- Reversal Framework ---
  // Device-scoped. `null` means "Auto"; every other value is a named lens.
  const [reversalFramework, setReversalFramework] = useState(() => {
    const stored = safeStorage.getItem('tarot-reversal-framework');
    if (!stored || stored === 'auto') return null;
    return REVERSAL_FRAMEWORK_KEYS.includes(stored) ? stored : null;
  });

  useEffect(() => {
    if (reversalFramework) {
      safeStorage.setItem('tarot-reversal-framework', reversalFramework);
    } else {
      safeStorage.removeItem('tarot-reversal-framework');
    }
  }, [reversalFramework]);

  // --- Personalization Preferences ---
  const [personalization, setPersonalizationState] = useState(() =>
    loadPersonalizationFromStorage(personalizationStorageKey, safeStorage)
  );
  const [loadedPersonalizationKey, setLoadedPersonalizationKey] = useState(null);
  const [personalizationOwnerKey, setPersonalizationOwnerKey] = useState(personalizationStorageKey);
  const [personalizationExplicitFields, setPersonalizationExplicitFields] = useState(() => {
    const storedFields = loadPersonalizationExplicitFields(personalizationStorageKey, safeStorage);
    if (storedFields.length > 0) return storedFields;
    return derivePersonalizationExplicitFields(loadPersonalizationFromStorage(personalizationStorageKey, safeStorage));
  });
  const [accountPreferenceOrigins, setAccountPreferenceOrigins] = useState(() =>
    loadAccountPreferenceOrigins(personalizationStorageKey, safeStorage)
  );

  // Handle auth transitions + migrate legacy device-scoped personalization storage.
  useEffect(() => {
    // A same-owner auth refresh must retain live changes when persistence failed.
    if (authLoading || loadedPersonalizationKey === personalizationStorageKey) return;

    const nextKey = personalizationStorageKey;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      personalizationKeyRef.current = nextKey;
      const migrated = migrateLegacyPersonalization(nextKey, { userId });
      const loadedPersonalization = migrated || loadPersonalizationFromStorage(nextKey, safeStorage);
      const loadedExplicitFields = loadPersonalizationExplicitFields(nextKey, safeStorage);
      setPersonalizationState(loadedPersonalization);
      setAccountPreferenceOrigins(loadAccountPreferenceOrigins(nextKey, safeStorage));
      setPersonalizationExplicitFields(
        loadedExplicitFields.length > 0
          ? loadedExplicitFields
          : derivePersonalizationExplicitFields(loadedPersonalization)
      );
      setLoadedPersonalizationKey(nextKey);
      setPersonalizationOwnerKey(nextKey);
    });
    return () => { cancelled = true; };
  }, [authLoading, loadedPersonalizationKey, personalizationStorageKey, userId]);

  // Persist personalization changes
  useEffect(() => {
    // Auth resolution and scope changes must load before defaults can persist.
    if (authLoading || loadedPersonalizationKey !== personalizationStorageKey) return;
    const persistedPersonalization = sanitizePersonalization(personalization);
    safeStorage.setItem(personalizationKeyRef.current, JSON.stringify(persistedPersonalization));
  }, [authLoading, loadedPersonalizationKey, personalization, personalizationStorageKey]);

  useEffect(() => {
    if (authLoading || loadedPersonalizationKey !== personalizationStorageKey) return;
    savePersonalizationExplicitFields(personalizationKeyRef.current, personalizationExplicitFields, safeStorage);
  }, [authLoading, loadedPersonalizationKey, personalizationExplicitFields, personalizationStorageKey]);

  useEffect(() => {
    if (authLoading || loadedPersonalizationKey !== personalizationStorageKey) return;
    saveAccountPreferenceOrigins(personalizationKeyRef.current, accountPreferenceOrigins, safeStorage);
  }, [authLoading, loadedPersonalizationKey, accountPreferenceOrigins, personalizationStorageKey]);

  const resetPersonalization = useCallback(() => {
    setPersonalizationState({ ...DEFAULT_PERSONALIZATION });
    setPersonalizationExplicitFields([]);
    setAccountPreferenceOrigins({ inheritedFields: [], resetPending: true });
    safeStorage.removeItem(personalizationKeyRef.current);
  }, []);

  const markPersonalizationFieldsExplicit = useCallback((fields) => {
    const touchedFields = Array.isArray(fields)
      ? fields.filter((field) => PERSONALIZATION_REQUEST_FIELD_SET.has(field))
      : [];

    if (touchedFields.length === 0) return;

    // Choosing the same value is still an explicit local choice.
    setAccountPreferenceOrigins(current => ({
      ...current,
      inheritedFields: current.inheritedFields.filter(field => !touchedFields.includes(field))
    }));

    setPersonalizationExplicitFields((current) => {
      const merged = new Set(current);
      let changed = false;
      touchedFields.forEach((field) => {
        if (!merged.has(field)) {
          merged.add(field);
          changed = true;
        }
      });
      return changed ? Array.from(merged) : current;
    });
  }, []);

  const updatePersonalization = useCallback((nextValueOrUpdater, explicitFields) => {
    markPersonalizationFieldsExplicit(
      Array.isArray(explicitFields)
        ? explicitFields
        : Object.keys(nextValueOrUpdater || {})
    );

    setPersonalizationState((prev) => {
      const nextValue = typeof nextValueOrUpdater === 'function'
        ? nextValueOrUpdater(prev)
        : { ...prev, ...nextValueOrUpdater };
      return sanitizePersonalization(nextValue);
    });
  }, [markPersonalizationFieldsExplicit]);

  // Individual setters for personalization fields
  const setDisplayName = (value) => {
    const normalizedValue = typeof value === 'string'
      ? value.slice(0, PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH)
      : '';
    updatePersonalization({ displayName: normalizedValue });
  };

  const setTarotExperience = (value) => {
    updatePersonalization({ tarotExperience: value });
  };

  const setReadingTone = (value) => {
    updatePersonalization({ readingTone: value });
  };

  const setFocusAreas = (value) => {
    updatePersonalization({ focusAreas: value });
  };

  const setPreferredSpreadDepth = (value) => {
    updatePersonalization({ preferredSpreadDepth: value });
  };

  const setSpiritualFrame = (value) => {
    updatePersonalization({ spiritualFrame: value });
  };

  const setShowRitualSteps = (value) => {
    updatePersonalization({ showRitualSteps: value });
  };

  // Toggle a focus area (for multi-select)
  const toggleFocusArea = (area) => {
    updatePersonalization((prev) => {
      const current = prev.focusAreas || [];
      if (current.includes(area)) {
        return { ...prev, focusAreas: current.filter(a => a !== area) };
      } else {
        return { ...prev, focusAreas: [...current, area] };
      }
    }, ['focusAreas']);
  };

  // --- UI State: Prepare Sections ---
  const [prepareSectionsOpen, setPrepareSectionsOpen] = useState(() => {
    try {
      const stored = safeSessionStorage.getItem(PREPARE_SECTIONS_STORAGE_KEY);
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
    safeSessionStorage.setItem(PREPARE_SECTIONS_STORAGE_KEY, JSON.stringify(prepareSectionsOpen));
  }, [prepareSectionsOpen]);

  const togglePrepareSection = (section) => {
    setPrepareSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // --- Onboarding State ---
  const [onboardingComplete, setOnboardingCompleteState] = useState(() => safeStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true');
  const onboardingMutationEpochRef = useRef(0);

  const [onboardingSpreadKey, setOnboardingSpreadKey] = useState(null);

  // Initialize personalization banner visibility based on localStorage
  // Using lazy initializer avoids needing an effect to set initial state
  const [showPersonalizationBanner, setShowPersonalizationBanner] = useState(() => {
    const hasReadings = safeStorage.getItem('tarot_journal');
    const hasCompletedOnboarding = safeStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    const bannerDismissed = safeStorage.getItem(PERSONALIZATION_BANNER_KEY) === 'dismissed';
    // Show banner if user has readings but hasn't completed onboarding and hasn't dismissed.
    return !!(hasReadings && !hasCompletedOnboarding && !bannerDismissed);
  });

  const setOnboardingComplete = (value) => {
    onboardingMutationEpochRef.current += 1;
    setOnboardingCompleteState(value);
    safeStorage.setItem(ONBOARDING_STORAGE_KEY, value.toString());
  };

  const resetOnboarding = () => {
    // Variant is memoized per wizard mount; reset here just clears progress/state.
    setOnboardingComplete(false);
    setOnboardingSpreadKey(null);
  };

  // --- Account continuity (signed-in readers) ---
  // Personalization and finished onboarding live on this device; a signed-in
  // reader's account keeps a copy, so another device opens on their own setup
  // instead of first-run onboarding. Read once per account per page load, after
  // this device's choices for that account are loaded.
  const [accountSync, setAccountSync] = useState({ userId: null, status: 'idle' });
  const accountRequestedForRef = useRef(null);
  const accountRequestEpochRef = useRef(0);
  const accountPushKeyRef = useRef(null);
  const accountConfirmedKeyRef = useRef(null);
  const accountDesiredKeyRef = useRef(null);
  const accountReadyForRef = useRef(null);
  const accountSaveQueueRef = useRef({ inFlight: null, pending: null });
  const explicitFieldsRef = useRef(personalizationExplicitFields);
  const accountOriginsRef = useRef(accountPreferenceOrigins);
  useEffect(() => {
    explicitFieldsRef.current = personalizationExplicitFields;
    accountOriginsRef.current = accountPreferenceOrigins;
  }, [personalizationExplicitFields, accountPreferenceOrigins]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      accountRequestEpochRef.current += 1;
      accountRequestedForRef.current = null;
      accountPushKeyRef.current = null;
      accountConfirmedKeyRef.current = null;
      accountDesiredKeyRef.current = null;
      accountReadyForRef.current = null;
      accountSaveQueueRef.current.pending = null;
      return;
    }
    if (loadedPersonalizationKey !== personalizationStorageKey) {
      accountRequestEpochRef.current += 1;
      accountRequestedForRef.current = null;
      accountReadyForRef.current = null;
      accountConfirmedKeyRef.current = null;
      accountDesiredKeyRef.current = null;
      accountSaveQueueRef.current.pending = null;
      return;
    }
    if (accountRequestedForRef.current === userId) return;
    const requestEpoch = ++accountRequestEpochRef.current;
    const onboardingEpoch = onboardingMutationEpochRef.current;
    accountRequestedForRef.current = userId;
    accountReadyForRef.current = null;
    accountConfirmedKeyRef.current = null;
    accountDesiredKeyRef.current = null;
    fetchAccountPreferences()
      .then((data) => {
        if (accountRequestedForRef.current !== userId || accountRequestEpochRef.current !== requestEpoch) return;
        if (data?.available === false) {
          setAccountSync({ userId, status: 'unavailable' });
          return;
        }
        const remote = data?.preferences || null;
        const origins = accountOriginsRef.current;
        const { adopted, adoptedFields, clearedFields } = mergeAccountPersonalization({
          explicitFields: explicitFieldsRef.current,
          inheritedFields: origins.inheritedFields,
          // A reset made here must reach the account even when its GET was
          // still in flight, or the page reloaded before the PUT completed.
          remote: origins.resetPending ? null : remote
        });
        if (adoptedFields.length > 0 || clearedFields.length > 0) {
          setPersonalizationState(prev => sanitizePersonalization({ ...prev, ...adopted }));
          setPersonalizationExplicitFields(prev => Array.from(new Set([
            ...prev.filter(field => !clearedFields.includes(field)), ...adoptedFields
          ])));
        }
        setAccountPreferenceOrigins(current => ({ ...current, inheritedFields: adoptedFields }));
        if (remote?.onboardingCompletedAt && onboardingMutationEpochRef.current === onboardingEpoch) {
          setOnboardingCompleteState(true);
          safeStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        }
        // What the account already holds (nothing counts as an empty record), so
        // only a real difference is sent back.
        accountPushKeyRef.current = accountPayloadKey(buildAccountPreferencesPayload({
          personalization: remote?.personalization || {},
          explicitFields: remote?.explicitFields || [],
          onboardingComplete: Boolean(remote?.onboardingCompletedAt)
        }));
        accountConfirmedKeyRef.current = accountPushKeyRef.current;
        accountReadyForRef.current = userId;
        setAccountSync({ userId, status: 'ready' });
      })
      .catch(() => {
        if (accountRequestedForRef.current === userId && accountRequestEpochRef.current === requestEpoch) {
          setAccountSync({ userId, status: 'error' });
        }
      });
  }, [authLoading, userId, loadedPersonalizationKey, personalizationStorageKey]);

  // 'signed-out' | 'loading' | 'ready' | 'unavailable' | 'error'
  const accountPreferencesStatus = !userId
    ? 'signed-out'
    : accountSync.userId === userId ? accountSync.status : 'loading';

  // Send this device's choices back whenever they differ from the account copy.
  useEffect(() => {
    if (authLoading || loadedPersonalizationKey !== personalizationStorageKey
      || !userId || accountReadyForRef.current !== userId
      || accountSync.userId !== userId || accountSync.status !== 'ready') return undefined;
    const payload = buildAccountPreferencesPayload({
      personalization,
      explicitFields: personalizationExplicitFields,
      onboardingComplete
    });
    const key = accountPayloadKey(payload);
    const requestEpoch = accountRequestEpochRef.current;
    accountDesiredKeyRef.current = key;
    const queue = accountSaveQueueRef.current;
    // A newer edit supersedes queued work immediately, even while its debounce
    // is still pending. The request already in flight must finish first.
    if (queue.pending?.key !== key) queue.pending = null;
    if (key === accountPushKeyRef.current) {
      // The account may already be empty (for example after a reset elsewhere).
      // A confirmed matching copy also acknowledges this device's pending reset.
      if (accountPreferenceOrigins.resetPending && key === accountConfirmedKeyRef.current) queueMicrotask(() => {
        if (accountRequestedForRef.current !== userId || accountRequestEpochRef.current !== requestEpoch) return;
        setAccountPreferenceOrigins(current => current === accountPreferenceOrigins
          ? { ...current, resetPending: false } : current);
      });
      return undefined;
    }
    const drainQueue = () => {
      if (queue.inFlight || !queue.pending) return;
      const next = queue.pending;
      queue.pending = null;
      const isCurrent = () => accountRequestedForRef.current === next.userId
        && accountRequestEpochRef.current === next.requestEpoch;
      if (!isCurrent() || accountReadyForRef.current !== next.userId
        || accountDesiredKeyRef.current !== next.key) return;
      queue.inFlight = next;
      accountPushKeyRef.current = next.key;
      saveAccountPreferences(next.payload).then(() => {
        if (!isCurrent()) return;
        accountConfirmedKeyRef.current = next.key;
        if (accountDesiredKeyRef.current === next.key) {
          // Repeating the same reset while its request is in flight has the
          // same intended payload and is acknowledged by this success too.
          setAccountPreferenceOrigins(current => current.resetPending
            ? { ...current, resetPending: false } : current);
        }
      }).catch((error) => {
        if (!isCurrent()) return;
        if (error?.code === 'preferences_unavailable') {
          accountReadyForRef.current = null;
          setAccountSync({ userId: next.userId, status: 'unavailable' });
        } else if (accountPushKeyRef.current === next.key) {
          // Let the next change try again.
          accountPushKeyRef.current = null;
        }
      }).finally(() => {
        queue.inFlight = null;
        drainQueue();
      });
    };
    const timer = setTimeout(() => {
      if (key === accountPushKeyRef.current) return;
      queue.pending = { payload, key, userId, requestEpoch };
      drainQueue();
    }, 700);
    return () => clearTimeout(timer);
  }, [authLoading, loadedPersonalizationKey, personalizationStorageKey, userId, accountSync, personalization, personalizationExplicitFields, onboardingComplete, accountPreferenceOrigins]);

  // --- Nudge State (Contextual Discovery) ---
  const [nudgeState, setNudgeStateInternal] = useState(() => {
    try {
      const stored = safeStorage.getItem(NUDGE_STATE_STORAGE_KEY);
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
    safeStorage.setItem(NUDGE_STATE_STORAGE_KEY, JSON.stringify(nudgeState));
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

  const incrementReadingCount = (requestId = null) => {
    setNudgeStateInternal(prev => {
      const safeRequestId = typeof requestId === 'string' && requestId.trim().length ? requestId.trim() : null;

      // If we know the requestId, only count it once.
      if (safeRequestId && prev.lastCountedReadingRequestId === safeRequestId) {
        return prev;
      }

      return {
        ...prev,
        readingCount: prev.readingCount + 1,
        lastCountedReadingRequestId: safeRequestId ? safeRequestId : prev.lastCountedReadingRequestId
      };
    });
  };

  const incrementJournalSaveCount = () => {
    setNudgeStateInternal(prev => ({ ...prev, journalSaveCount: prev.journalSaveCount + 1 }));
  };

  // Computed nudge visibility helpers
  const shouldShowRitualNudge = nudgeState.readingCount === 0 && !nudgeState.hasSeenRitualNudge;
  // Journal nudge is shown after the first narrative completes.
  // readingCount increments on completion, so first completion => readingCount === 1.
  const shouldShowJournalNudge = nudgeState.readingCount === 1 && !nudgeState.hasSeenJournalNudge;
  const shouldShowAccountNudge = nudgeState.journalSaveCount >= 3 && !nudgeState.hasDismissedAccountNudge;

  // --- Location Preferences ---
  // locationEnabled: session-level toggle for location-aware readings (not persisted)
  const [locationEnabled, setLocationEnabledState] = useState(false);

  // cachedLocation: transient location data (not persisted for privacy)
  const [cachedLocation, setCachedLocation] = useState(null);

  // persistLocationToJournal: explicit consent to store location with journal entries
  const [persistLocationToJournal, setPersistLocationToJournalState] = useState(() => safeStorage.getItem(LOCATION_JOURNAL_CONSENT_KEY) === 'true');

  // Persist journal location consent to localStorage
  useEffect(() => {
    safeStorage.setItem(LOCATION_JOURNAL_CONSENT_KEY, persistLocationToJournal.toString());
  }, [persistLocationToJournal]);

  const setPersistLocationToJournal = useCallback((value) => {
    setPersistLocationToJournalState(Boolean(value));
  }, []);

  const setLocationEnabled = useCallback(value => {
    setLocationEnabledState(Boolean(value));
    if (!value) setCachedLocation(null);
  }, []);

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
    ttsSpeed,
    setTtsSpeed,
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
    personalizationReady: personalizationOwnerKey === personalizationStorageKey,
    personalization,
    personalizationExplicitFields,
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
    accountPreferencesStatus,
    onboardingSpreadKey,
    setOnboardingSpreadKey,
    resetOnboarding,
    showPersonalizationBanner,
    setShowPersonalizationBanner,
    resetPersonalization,
    // Nudge state (contextual discovery)
    nudgeState,
    shouldShowRitualNudge,
    shouldShowJournalNudge,
    shouldShowAccountNudge,
    markRitualNudgeSeen,
    markJournalNudgeSeen,
    dismissAccountNudge,
    incrementReadingCount,
    incrementJournalSaveCount,
    // Location preferences
    locationEnabled,
    setLocationEnabled,
    cachedLocation,
    setCachedLocation,
    persistLocationToJournal,
    setPersistLocationToJournal
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
