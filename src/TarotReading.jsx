import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore, useId } from 'react';
import { SpreadSelector } from './components/SpreadSelector';
import { ReadingPreparation } from './components/ReadingPreparation';
import { ReadingStart } from './components/reading/ReadingStart';
import { DeferredDialog } from './components/DeferredDialog';
import { ConfirmModal } from './components/ConfirmModal';
import { MobileSettingsDrawer } from './components/MobileSettingsDrawer';
import { MobileActionBar, MobileActionGroup } from './components/MobileActionBar';
import { formatReading } from './lib/formatting';
import { readingMetadataFromEntry } from './lib/readingMetadata';
import { getKnownDeckStyleId } from './lib/readingDeck';
import { QuickIntentionCard } from './components/QuickIntentionCard';
import { InstallControl } from './components/InstallControl';
import { Header } from './components/Header';
import { AppBottomRegion } from './components/AppBottomRegion';
import { StepProgress } from './components/StepProgress';
import { Gear, ArrowCounterClockwise } from '@phosphor-icons/react';
import { InstallFooter } from './components/InstallFooter';
import { OnboardingWizard } from './components/onboarding';
import { PersonalizationBanner } from './components/PersonalizationBanner';
import { LazyLoadBoundary } from './components/LazyLoadBoundary';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './styles/tarot.css';

// Hooks & Contexts
import { useAuth } from './contexts/AuthContext';
import { usePreferences } from './contexts/PreferencesContext';
import { useReading } from './contexts/ReadingContext';
import { useSaveReading } from './hooks/useSaveReading';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useSmallScreen } from './hooks/useSmallScreen';
import { useLandscape } from './hooks/useLandscape';
import { useHandsetLayout } from './hooks/useHandsetLayout';
import { useFeatureFlags } from './hooks/useFeatureFlags';
import { useSavedMemoryPresence } from './hooks/useSavedMemoryPresence';
import { loadCoachRecommendation } from './lib/journalInsights';
import { safeStorage } from './lib/safeStorage';
import { shouldUseMobileStableMode } from './lib/mobileStableMode';
import { getSpreadInfo, normalizeSpreadKey } from './data/spreads';
import {
  NARRATIVE_FOCUS_TARGET_ID,
  getNarrativeFocusTarget,
  getServerNarrativeFocusTarget,
  subscribeNarrativeFocusTarget
} from './lib/narrativeFocusTarget';
import { BADGE_LABEL_CLASS } from './styles/labelClasses';

const STEP_PROGRESS_STEPS = [
  { id: 'spread', label: 'Spread' },
  { id: 'intention', label: 'Intent (question)' },
  { id: 'ritual', label: 'Ritual (optional)' },
  { id: 'reading', label: 'Reading' }
];

// The reading table loads on the first Draw. It is fetched after the first tap
// or key press (see below), so a connection lost before the Draw still has it.
const loadReadingDisplay = () => import('./components/ReadingDisplay');
const ReadingDisplay = lazy(() => loadReadingDisplay().then(module => ({ default: module.ReadingDisplay })));
const FollowUpModal = lazy(() => import('./components/FollowUpModal'));
const GuidedIntentionCoach = lazy(() => import('./components/GuidedIntentionCoach').then(module => ({ default: module.GuidedIntentionCoach })));

function ReadingSkipLinks({ showSetupSection }) {
  const narrativeTarget = useSyncExternalStore(
    subscribeNarrativeFocusTarget,
    getNarrativeFocusTarget,
    getServerNarrativeFocusTarget
  );

  const handleSkip = (event) => {
    event.preventDefault();
    const target = document.getElementById(event.currentTarget.hash.slice(1));
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  return (
    <div className="skip-links">
      {showSetupSection && <a href="#step-spread" onClick={handleSkip} className="skip-link">Skip to spreads</a>}
      <a href="#step-reading" onClick={handleSkip} className="skip-link">Skip to reading</a>
      {narrativeTarget && <a href={`#${NARRATIVE_FOCUS_TARGET_ID}`} onClick={handleSkip} className="skip-link">Skip to interpretation</a>}
    </div>
  );
}

export default function TarotReading() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id || null;

  // --- 1. Global Preferences (Context) ---
  const {
    personalization,
    // Deck & Reversals
    deckStyleId,
    setDeckStyleId,
    minorsDataIncomplete,
    // UI State
    prepareSectionsOpen,
    togglePrepareSection,
    // Onboarding
    onboardingComplete,
    setOnboardingComplete,
    setOnboardingSpreadKey,
    showPersonalizationBanner,
    setShowPersonalizationBanner,
    accountPreferencesStatus
  } = usePreferences();

  // Accessibility: reduced motion preference
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen();
  const isLandscape = useLandscape();
  const isHandsetLayout = useHandsetLayout();
  const memoriesHintId = useId();
  const { newDeckInterface } = useFeatureFlags();
  const showDegradedServiceBanner = import.meta.env?.VITE_SHOW_DEGRADED_SERVICE_BANNER === 'true';
  // Use one canonical handset decision for all mobile shell patterns
  // (bottom action bar + settings drawer + quick intention).
  const isHandset = isHandsetLayout;

  // --- 2. Reading Context ---
  const {
    // Audio
    ttsAnnouncement,
    srAnnouncement,

    // Tarot State
    selectedSpread,
    setSelectedSpread: _setSelectedSpread,
    selectSpread,
    chooseSpread,
    reading,
    setReading,
    isShuffling,
    isSpreadDealt,
    setIsSpreadDealt,
    dealSpread,
    revealedCards,
    setRevealedCards,
    dealIndex,
    setDealIndex,
    hasKnocked,
    ritualWasPerformed,
    hasConfirmedSpread,
    setHasConfirmedSpread,
    userQuestion,
    setUserQuestion,
    setSessionSeed,
    shouldSkipRitual,
    shuffle,
    dealNext,
    revealAll,
    onSpreadConfirm,

    // Vision (only what's needed for deck change)
    resetVisionProof,
    setVisionResults,
    setVisionConflicts,

    // Reading Generation & UI
    personalReading,
    useSavedMemories,
    setUseSavedMemories,
    setPersonalReading,
    setThemes,
    setNarrativePhase,
    narrativePhase,
    isGenerating,
    setIsGenerating,
    setAnalysisContext,
    readingMeta,
    setReadingMeta,
    journalStatus,
    setJournalStatus,
    setFollowUps,
    setReflections,
    setShowAllHighlights,
    generatePersonalReading,
    cancelPersonalReading,

  } = useReading();

  // --- 3. Local View State & Wiring ---
  // UI Specifics
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [connectionBanner, setConnectionBanner] = useState(null);
  const [pendingCoachPrefill, setPendingCoachPrefill] = useState(null);
  const [coachRecommendationVersion, setCoachRecommendationVersion] = useState(0);
  const [isIntentionCoachOpen, setIsIntentionCoachOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [followUpIntent, setFollowUpIntent] = useState('continue');
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [highlightQuickIntention, setHighlightQuickIntention] = useState(false);
  const [onboardingDeferred, setOnboardingDeferred] = useState(false);
  const onboardingDue = !onboardingComplete && !showPersonalizationBanner && !onboardingDeferred;
  // A signed-in reader may have finished onboarding on another device: wait for
  // the account (PreferencesContext) before choosing between welcome and setup.
  const onboardingDecisionPending = onboardingDue
    && (authLoading || (Boolean(user) && accountPreferencesStatus === 'loading'));
  const isOnboardingOpen = onboardingDue && !onboardingDecisionPending;
  const shouldFocusCinematicFlow = newDeckInterface && (
    Boolean(reading?.length) ||
    isGenerating ||
    Boolean(personalReading)
  );
  const [showSetupInFocusMode, setShowSetupInFocusMode] = useState(false);
  const [viewedProgressStep, setViewedProgressStep] = useState(null);
  const showSetupSection = !isOnboardingOpen && !onboardingDecisionPending && (!shouldFocusCinematicFlow || showSetupInFocusMode);
  const memoryPresence = useSavedMemoryPresence(userId, showSetupSection && !isFollowUpOpen);
  const suppressFocusInterruptions = shouldFocusCinematicFlow;
  const shouldEnableMobileStableMode = useMemo(() => shouldUseMobileStableMode({
    isHandset,
    prefersReducedMotion
  }), [isHandset, prefersReducedMotion]);

  const navigate = useNavigate();
  const location = useLocation();
  const spreadSectionRef = useRef(null);
  const prepareSectionRef = useRef(null);
  const readingSectionRef = useRef(null);
  const followUpOpenerRef = useRef(null);
  const quickIntentionCardRef = useRef(null);
  const quickIntentionInputRef = useRef(null);
  const quickIntentionHighlightTimeoutRef = useRef(null);
  const hasAutoCompletedRef = useRef(false);
  const pendingFocusSpreadRef = useRef(false);
  const coachRecommendation = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const recommendation = loadCoachRecommendation(userId);
    // coachRecommendationVersion forces a re-read after persistence changes
    return coachRecommendationVersion ? recommendation : recommendation;
  }, [userId, coachRecommendationVersion]);

  // --- Effects & Helpers ---
  useEffect(() => {
    return () => {
      if (quickIntentionHighlightTimeoutRef.current) {
        window.clearTimeout(quickIntentionHighlightTimeoutRef.current);
      }
    };
  }, []);
  const refreshCoachRecommendation = useCallback(() => {
    setCoachRecommendationVersion((version) => version + 1);
  }, []);
  const openIntentionCoach = useCallback(() => {
    refreshCoachRecommendation();
    setPendingCoachPrefill(null);
    setIsIntentionCoachOpen(true);
  }, [refreshCoachRecommendation]);

  // Reset analysis state when Shuffle is triggered
  // (Handled in ReadingContext now, but we might need to clear local UI state if any)
  const handleShuffle = useCallback(() => {
    setViewedProgressStep(null);
    setIsFollowUpOpen(false);
    setShowSetupInFocusMode(false);
    shuffle(); // Context handles the resets
  }, [shuffle]);

  const checkApiHealth = useCallback(async () => {
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      setApiHealthBanner({ status: 'offline', message: 'Offline mode' });
      setConnectionBanner({
        status: 'offline',
        message: 'You appear to be offline. Check your connection, then retry.',
        actionLabel: 'Retry'
      });
      return;
    }

    try {
      const [tarotHealth, ttsHealth] = await Promise.all([
        fetch('/api/health/tarot-reading', { method: 'GET', cache: 'no-store' }).catch(() => null),
        fetch('/api/health/tts', { method: 'GET', cache: 'no-store' }).catch(() => null)
      ]);
      const anthropicAvailable = tarotHealth?.ok ?? false;
      const narrationAvailable = ttsHealth?.ok ?? false;
      if (!anthropicAvailable || !narrationAvailable) {
        if (showDegradedServiceBanner) {
          setApiHealthBanner({
            status: 'degraded',
            anthropic: anthropicAvailable,
            narration: narrationAvailable,
            message: 'Using local services' +
              (!anthropicAvailable ? ' (Claude unavailable)' : '') +
              (!narrationAvailable ? ' (narration voice unavailable)' : '')
          });
          setConnectionBanner({
            status: 'degraded',
            message: 'Service check failed. Using local fallback.',
            actionLabel: 'Retry'
          });
        } else {
          setApiHealthBanner(null);
          setConnectionBanner(null);
        }
      } else {
        setApiHealthBanner(null);
        setConnectionBanner(null);
      }
    } catch (err) {
      console.debug('API health check failed:', err);
      setApiHealthBanner({ status: 'offline', message: 'Offline mode' });
      setConnectionBanner({
        status: 'offline',
        message: 'Connection issue. Check your network, then retry.',
        actionLabel: 'Retry'
      });
    }
  }, [showDegradedServiceBanner]);

  // Check API health - runs on mount and when tab becomes visible
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      checkApiHealth();
    });

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkApiHealth();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkApiHealth]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => checkApiHealth();
    const handleOffline = () => {
      setApiHealthBanner({ status: 'offline', message: 'Offline mode' });
      setConnectionBanner({
        status: 'offline',
        message: 'You appear to be offline. Check your connection, then retry.',
        actionLabel: 'Retry'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkApiHealth]);

  // Process router state for initial question / journal suggestions.
  // Clean up navigation state after consuming so we don't re-apply on rerender.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const suggestedSpreadRaw = location.state?.suggestedSpread;
    const suggestedQuestionRaw = location.state?.suggestedQuestion;
    const initialQuestionRaw = location.state?.initialQuestion;

    const suggestedSpread = typeof suggestedSpreadRaw === 'string' ? suggestedSpreadRaw.trim() : '';
    const suggestedQuestion = typeof suggestedQuestionRaw === 'string' ? suggestedQuestionRaw : '';
    const initialQuestion = typeof initialQuestionRaw === 'string' ? initialQuestionRaw : '';

    const nextQuestionCandidate = suggestedQuestion.trim() ? suggestedQuestion : initialQuestion;

    if (suggestedSpread) {
      selectSpread(suggestedSpread);
    }

    if (nextQuestionCandidate) {
      setUserQuestion(nextQuestionCandidate);
    }

    if (suggestedSpread || nextQuestionCandidate) {
      const nextState = { ...location.state };
      delete nextState.initialQuestion;
      delete nextState.suggestedSpread;
      delete nextState.suggestedQuestion;
      const cleanedState = Object.keys(nextState).length > 0 ? nextState : null;
      navigate(location.pathname, { replace: true, state: cleanedState });
    }
  }, [location.pathname, location.state, navigate, selectSpread, setUserQuestion]);

  // Hydrate reading + open follow-up chat when launched from Journal
  useEffect(() => {
    const followUpEntry = location.state?.followUpEntry;
    if (!followUpEntry) return;
    const followUpIntent = location.state?.followUpIntent;
    const normalizedIntent = followUpIntent === 'ask' ? 'ask' : 'continue';

    // Retire the old stream and its checkpoint before installing saved history.
    // Otherwise its input-mismatch cleanup can clear the newly restored prose.
    cancelPersonalReading({ announce: false });

    const {
      cards = [],
      question = '',
      personalReading: entryNarrative = '',
      themes: entryThemes = null,
      spreadKey,
      context: entryContext,
      followUps = [],
      sessionSeed: entrySessionSeed
    } = followUpEntry;

    const normalizedSpread = spreadKey || selectedSpread;
    if (normalizedSpread) {
      selectSpread(normalizedSpread);
      setHasConfirmedSpread(true);
    }

    const normalizedCards = Array.isArray(cards)
      ? cards.map((card) => ({
        name: card?.name || 'Card',
        suit: card?.suit ?? null,
        rank: card?.rank ?? null,
        rankValue: card?.rankValue ?? null,
        number: card?.number ?? null,
        isReversed: typeof card?.orientation === 'string'
          ? card.orientation.toLowerCase().includes('revers')
          : Boolean(card?.isReversed)
      }))
      : [];

    setReading(normalizedCards, entryThemes?.drawIncludeMinors, getKnownDeckStyleId(followUpEntry.deckId, entryThemes?.deckStyle));
    setIsSpreadDealt(true);
    setRevealedCards(new Set(normalizedCards.map((_, index) => index)));
    setDealIndex(normalizedCards.length);
    setSessionSeed(entrySessionSeed || null);
    setUserQuestion(question || '');
    setThemes(entryThemes || null);
    setAnalysisContext(entryContext || null);
    setPersonalReading({ ...formatReading(entryNarrative || ''), isRestored: true });
    setNarrativePhase('complete');
    setIsGenerating(false);
    setJournalStatus(null);
    setFollowUps(Array.isArray(followUps) ? followUps : []);
    setReadingMeta(readingMetadataFromEntry({ ...followUpEntry, spreadKey: normalizedSpread }));
	    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncing UI state from router state
	    setFollowUpIntent(normalizedIntent);
	    setIsFollowUpOpen(true);

    const nextState = { ...location.state };
    delete nextState.followUpEntry;
    delete nextState.openFollowUp;
    delete nextState.followUpIntent;
    const cleanedState = Object.keys(nextState).length > 0 ? nextState : null;
    navigate(location.pathname, { replace: true, state: cleanedState });
  }, [
    location.pathname,
    location.state,
    navigate,
    selectedSpread,
    selectSpread,
    setAnalysisContext,
    setDealIndex,
    setFollowUps,
    setHasConfirmedSpread,
    setIsGenerating,
    setIsSpreadDealt,
    setNarrativePhase,
    setPersonalReading,
    setReading,
    setReadingMeta,
    setRevealedCards,
    setSessionSeed,
    setThemes,
    setUserQuestion,
    setJournalStatus,
    setIsFollowUpOpen,
    cancelPersonalReading
  ]);


  // Coach Shortcut
  useEffect(() => {
    function handleCoachShortcut(event) {
      if (event.defaultPrevented) return;
      if (isIntentionCoachOpen || isCardModalOpen) return;
      const target = event.target;
      const tagName = target?.tagName;
      const isTypingTarget =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTypingTarget) return;

      if ((event.key === 'g' || event.key === 'G') && event.shiftKey) {
        event.preventDefault();
        openIntentionCoach();
      }
    }
    window.addEventListener('keydown', handleCoachShortcut);
    return () => {
      window.removeEventListener('keydown', handleCoachShortcut);
    };
  }, [isIntentionCoachOpen, isCardModalOpen, openIntentionCoach]);

  // Clear Journal Status Timeout
  useEffect(() => {
    if (!journalStatus) return;
    const timeout = setTimeout(() => setJournalStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [journalStatus, setJournalStatus]);

  // Reset Highlights on Spread Change
  useEffect(() => {
    setShowAllHighlights(false);
  }, [selectedSpread, reading, setShowAllHighlights]);

  // --- Handlers ---

  const handleDeckChange = useCallback((newDeckId) => {
    setDeckStyleId(newDeckId);
    setVisionResults([]);
    setVisionConflicts([]);
    resetVisionProof();
  }, [setDeckStyleId, setVisionResults, setVisionConflicts, resetVisionProof]);

  // Fetch the reading table once the person starts preparing a reading (their
  // first tap or key), so a connection that drops before the first Draw does
  // not leave nothing to show; LazyLoadBoundary covers the rest. Waiting for
  // input keeps it out of the startup download. Skipped under Save-Data.
  useEffect(() => {
    if (typeof window === 'undefined' || navigator.connection?.saveData) return undefined;
    const usesIdle = 'requestIdleCallback' in window;
    let handle = null;
    const prefetch = () => { loadReadingDisplay().catch(() => {}); };
    const stopListening = () => {
      window.removeEventListener('pointerdown', onFirstInput, true);
      window.removeEventListener('keydown', onFirstInput, true);
    };
    function onFirstInput() {
      stopListening();
      handle = usesIdle
        ? window.requestIdleCallback(prefetch, { timeout: 2000 })
        : window.setTimeout(prefetch, 300);
    }
    window.addEventListener('pointerdown', onFirstInput, true);
    window.addEventListener('keydown', onFirstInput, true);
    return () => {
      stopListening();
      if (handle === null) return;
      if (usesIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  const scrollQuickIntentionIntoView = useCallback(() => {
    if (!isHandset) return;
    const target = quickIntentionInputRef.current;
    if (!target) return;
    const header = document.querySelector('.header-sticky');
    const dock = document.querySelector('[data-app-bottom-region][data-has-fixed="true"]');
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
    const headerBottom = header && getComputedStyle(header).position === 'sticky'
      ? header.getBoundingClientRect().bottom : viewportTop;
    const dockBox = dock?.getBoundingClientRect();
    const top = Math.max(viewportTop, headerBottom) + 8;
    const bottom = Math.min(viewportBottom, dockBox?.top ?? viewportBottom) - 8;
    const box = target.getBoundingClientRect();
    // A route entrance can temporarily move a fixed dock outside the viewport.
    // Wait for its settled bounds rather than scrolling against invalid geometry.
    if (bottom <= top || (dockBox && dockBox.bottom > window.innerHeight + 1)) return;
    // Coming back up to the card, keep its prompt (the field's label) in view
    // too when both fit; otherwise the field alone wins.
    const label = target.id ? document.querySelector(`label[for="${CSS.escape(target.id)}"]`) : null;
    const labelTop = label?.getBoundingClientRect().top ?? box.top;
    const startTop = labelTop < box.top && box.bottom - labelTop <= bottom - top ? labelTop : box.top;
    const delta = startTop < top ? startTop - top : box.bottom > bottom ? box.bottom - bottom : 0;
    if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
  }, [isHandset]);

  useEffect(() => {
    if (!isHandset) return undefined;
    const field = quickIntentionInputRef.current;
    if (!field) return undefined;
    let frame = null;
    let allowCorrection = false;
    let settleUntil = 0;
    const correct = () => {
      frame = null;
      if (!allowCorrection || document.activeElement !== field) return;
      scrollQuickIntentionIntoView();
      if (performance.now() < settleUntil) frame = requestAnimationFrame(correct);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(correct);
    };
    const focus = () => {
      allowCorrection = true;
      settleUntil = performance.now() + 600;
      schedule();
    };
    const stop = () => {
      allowCorrection = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const resize = () => {
      if (document.activeElement === field) focus();
    };
    const observer = new ResizeObserver(schedule);
    [field, document.querySelector('.header-sticky'), document.querySelector('[data-app-bottom-region][data-has-fixed="true"]')]
      .filter(Boolean).forEach(element => observer.observe(element));
    field.addEventListener('focus', focus);
    field.addEventListener('blur', stop);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      stop();
      observer.disconnect();
      field.removeEventListener('focus', focus);
      field.removeEventListener('blur', stop);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [isHandset, showSetupSection, scrollQuickIntentionIntoView]);

  // Bring the handset question card into view and pulse it briefly.
  const promptQuickIntention = useCallback(() => {
    scrollQuickIntentionIntoView();
    setHighlightQuickIntention(true);
    if (quickIntentionHighlightTimeoutRef.current) {
      window.clearTimeout(quickIntentionHighlightTimeoutRef.current);
    }
    quickIntentionHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightQuickIntention(false);
      quickIntentionHighlightTimeoutRef.current = null;
    }, 1500);
  }, [scrollQuickIntentionIntoView]);

  const handleQuestionFocus = useCallback(() => {
  }, []);

  const handleQuestionBlur = useCallback(() => {
  }, []);

  const handleQuickIntentionFocus = useCallback(() => {
    scrollQuickIntentionIntoView();
  }, [scrollQuickIntentionIntoView]);

  const applySpreadSelection = useCallback((key) => {
    const shouldPromptQuickIntention = isHandset && !hasConfirmedSpread;
    const keepsCurrentSpread = normalizeSpreadKey(key) === selectedSpread;
    // The reader's tap (useTarotState.chooseSpread): the spread already in use
    // keeps its cards, ritual and reading.
    chooseSpread(key);
    if (!keepsCurrentSpread) {
      // Reset narrative/analysis state
      setPersonalReading(null);
      setJournalStatus(null);
      setReflections({});
      setIsGenerating(false);
    }
    if (shouldPromptQuickIntention) {
      promptQuickIntention();
    }
  }, [chooseSpread, hasConfirmedSpread, isHandset, promptQuickIntention, selectedSpread, setIsGenerating, setJournalStatus, setPersonalReading, setReflections]);

  // A different spread puts drawn cards away, so a tap on the revisited setup
  // asks first instead of clearing the table and its reading at once. Returns
  // false while the question is open so the selector leaves its carousel be.
  const [pendingSpreadKey, setPendingSpreadKey] = useState(null);
  // WebKit focuses the nearest focusable ancestor of a clicked card, so the
  // confirmation returns focus to the card itself, not to #step-spread.
  const spreadChangeReturnRef = useRef(null);
  const handleSpreadSelection = useCallback((key, { opener = null } = {}) => {
    if (normalizeSpreadKey(key) !== selectedSpread && reading?.length) {
      spreadChangeReturnRef.current = opener;
      setPendingSpreadKey(normalizeSpreadKey(key));
      return false;
    }
    applySpreadSelection(key);
    return true;
  }, [applySpreadSelection, reading, selectedSpread]);
  const closeSpreadChange = useCallback(() => setPendingSpreadKey(null), []);
  const confirmSpreadChange = useCallback(() => {
    if (pendingSpreadKey) applySpreadSelection(pendingSpreadKey);
  }, [applySpreadSelection, pendingSpreadKey]);
  const pendingSpreadHasReading = Boolean(personalReading && !personalReading.isError);

  const handleCoachClose = useCallback(() => {
    setIsIntentionCoachOpen(false);
    setPendingCoachPrefill(null);
  }, []);

  const handleCoachApply = (guidedQuestion) => {
    if (!guidedQuestion) return;
    setUserQuestion(guidedQuestion);
    handleCoachClose();
  };

  // Mirrors the reading's "Save or ask" shortcut: focus the existing Draw cards
  // action where it currently sits in the page.
  const handleSetupActionsJump = useCallback(event => {
    const control = event.currentTarget.closest('[data-app-chrome]')
      ?.querySelector('[data-app-bottom-actions] [data-chrome-action="draw"]');
    if (!control || control.disabled) return;
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'instant' : 'smooth' });
  }, [prefersReducedMotion]);

  // The ritual happens at the table, after Draw cards. Until then its progress
  // step points at Draw cards, wherever it sits: the bottom bar on handsets,
  // the pinned row (or the page, when released) on wider screens.
  const focusDrawCards = useCallback(() => {
    const control = isHandset
      ? document.querySelector('[data-app-bottom-actions] [data-chrome-action="draw"]')
      : readingSectionRef.current?.querySelector('.setup-draw-row__action');
    if (!control || control.disabled) return;
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'instant' : 'smooth' });
  }, [isHandset, prefersReducedMotion]);

  const handleStepNav = useCallback((stepId) => {
    const hasCards = Boolean(reading?.length);
    // Spread and Intent revisit the setup and show as current while viewed.
    // Ritual and Reading lead to the table, whose own state names the step.
    setViewedProgressStep(stepId === 'spread' || stepId === 'intention' ? stepId : null);
    if (stepId === 'ritual' && !hasCards) {
      focusDrawCards();
      return;
    }
    const toTable = stepId === 'ritual' || stepId === 'reading';
    const refs = {
      spread: spreadSectionRef,
      intention: prepareSectionRef,
      reading: readingSectionRef
    };
    const scrollToStep = () => {
      // Before Deal the ritual starts at the deck's face; afterwards, or with
      // ritual steps hidden, the step leads to the table itself.
      const deckFace = stepId === 'ritual'
        ? readingSectionRef.current?.querySelector('[data-table-ritual-start]')
        : null;
      const target = deckFace || refs[toTable ? 'reading' : stepId]?.current;
      if (!target || typeof target.scrollIntoView !== 'function') return;
      const behavior = prefersReducedMotion || isHandset ? 'auto' : 'smooth';
      // Focus follows the step, as the skip links do: keyboard and screen-reader
      // users continue from the section they asked for, and the page's focus
      // keeping (observeAppChrome) has no reason to scroll back to the progress
      // button after an instant scroll.
      target.focus?.({ preventScroll: true });
      target.scrollIntoView({
        behavior,
        block: deckFace ? 'center' : 'start'
      });
    };

    // On handsets the question is written on the page in the quick card.
    if (isHandset && stepId === 'intention') {
      if (shouldFocusCinematicFlow && !showSetupInFocusMode) {
        setShowSetupInFocusMode(true);
        window.setTimeout(promptQuickIntention, prefersReducedMotion ? 0 : 30);
      } else {
        promptQuickIntention();
      }
      return;
    }

    if (shouldFocusCinematicFlow && !toTable && !showSetupInFocusMode) {
      setShowSetupInFocusMode(true);
      window.setTimeout(scrollToStep, prefersReducedMotion ? 0 : 30);
      return;
    }

    if (toTable && showSetupInFocusMode) {
      setShowSetupInFocusMode(false);
      window.setTimeout(scrollToStep, prefersReducedMotion ? 0 : 20);
      return;
    }

    scrollToStep();
  }, [focusDrawCards, isHandset, prefersReducedMotion, promptQuickIntention, reading, shouldFocusCinematicFlow, showSetupInFocusMode]);

  // Handle navigation requests passed via router state (e.g., from Journal empty state)
  useEffect(() => {
    if (!location.state?.focusSpread) {
      return;
    }

    // Mark that we need to focus spread, then clean up router state
    pendingFocusSpreadRef.current = true;
    navigate(location.pathname, { replace: true, state: null });

    // Schedule the scroll after navigation state is cleaned
    const timeoutId = window.setTimeout(() => {
      if (pendingFocusSpreadRef.current) {
        handleStepNav('spread');
        pendingFocusSpreadRef.current = false;
      }
    }, 40);

    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, location.state, navigate, handleStepNav]);

  useEffect(() => {
    if (
      hasConfirmedSpread &&
      shouldSkipRitual &&
      !hasKnocked &&
      !hasAutoCompletedRef.current
    ) {
      hasAutoCompletedRef.current = true;
      console.warn('Ritual auto-complete fallback triggered - shuffle should handle this.');
    }
  }, [hasConfirmedSpread, shouldSkipRitual, hasKnocked]);

  useEffect(() => {
    if (!hasConfirmedSpread) {
      hasAutoCompletedRef.current = false;
    }
  }, [hasConfirmedSpread]);

  const handleRevealAll = useCallback(() => {
    revealAll();
    const behavior = prefersReducedMotion || isHandset ? 'auto' : 'smooth';
    readingSectionRef.current?.scrollIntoView({ behavior, block: 'start' });
  }, [isHandset, prefersReducedMotion, revealAll]);

  const handlePersonalizationBannerDismiss = useCallback(() => {
    setShowPersonalizationBanner(false);
    safeStorage.setItem('tarot-personalization-banner', 'dismissed');
  }, [setShowPersonalizationBanner]);

  const handlePersonalizationBannerPersonalize = useCallback(() => {
    safeStorage.removeItem('tarot-personalization-banner');
    setShowPersonalizationBanner(false);
    setOnboardingComplete(false);
    setOnboardingDeferred(false);
  }, [setShowPersonalizationBanner, setOnboardingComplete, setOnboardingDeferred]);

  // --- Onboarding Handler ---

  const handleOnboardingComplete = useCallback((selections) => {
    if (selections?.resumeLater) {
      setOnboardingDeferred(true);
    } else {
      setOnboardingComplete(true);
      setOnboardingDeferred(false);
    }
    if (selections?.selectedSpread) {
      setOnboardingSpreadKey(selections.selectedSpread);
      selectSpread(selections.selectedSpread);
    }
    if (selections?.question) {
      setUserQuestion(selections.question);
    }
  }, [selectSpread, setOnboardingComplete, setOnboardingDeferred, setOnboardingSpreadKey, setUserQuestion]);

  const handleOnboardingSpreadSelect = useCallback((spreadKey) => {
    setOnboardingSpreadKey(spreadKey);
  }, [setOnboardingSpreadKey]);

  // --- Logic: Journal Saving ---

  const saveController = useSaveReading();
  const { saveReading, isSaving, savedEntryId } = saveController;

  // Determine Active Step for StepProgress
  // These are milestone-based flags that represent permanent progress through the flow
  const hasQuestion = Boolean(userQuestion && userQuestion.trim().length > 0);
  const safeSpreadKey = normalizeSpreadKey(selectedSpread);
  const spreadInfo = getSpreadInfo(safeSpreadKey);
  const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
  const visibleCount = reading ? (maxCards ? Math.min(reading.length, maxCards) : reading.length) : 0;
  const hasReading = visibleCount > 0;
  const allCardsRevealed = hasReading && revealedCards.size === visibleCount;
  const hasNarrative = Boolean(personalReading && !personalReading.isError && !personalReading.isStreaming);
  const narrativeInProgress = isGenerating && (!personalReading || personalReading.isStreaming);
  const needsNarrativeGeneration = allCardsRevealed && (!personalReading || personalReading.isError || personalReading.isStreaming);
  const _isPersonalReadingError = Boolean(personalReading?.isError);
  const canShowFollowUp = personalReading && !personalReading.isError && !personalReading.isStreaming && narrativePhase === 'complete';
  const showFollowUpButton = canShowFollowUp;
  const isFollowUpVisible = canShowFollowUp && isFollowUpOpen;
  // Only true overlays (modals/drawers) should hide the action bar - not the small personalization banner
  const isMobileOverlayActive = isIntentionCoachOpen || isMobileSettingsOpen || isOnboardingOpen || onboardingDecisionPending || isFollowUpVisible || isCardModalOpen;
  const isCinematicFocusMode = shouldFocusCinematicFlow && !showSetupInFocusMode;
  const revealFocus = isHandset && newDeckInterface && reading && revealedCards.size < visibleCount
    ? (revealedCards.size === 0 ? 'deck' : 'spread')
    : 'action';
  const connectionTone = connectionBanner?.status === 'offline'
    ? 'border-error/40'
    : 'border-primary/40';
  const connectionText = connectionBanner?.status === 'offline'
    ? 'text-error'
    : 'text-primary';
  const connectionBg = connectionBanner?.status === 'offline'
    ? 'bg-error/10'
    : 'bg-primary/10';
  const mainContentSpacing = isLandscape
    ? 'pt-3 pb-8'
    : isHandset && isCinematicFocusMode
      ? 'pt-4 pb-8 sm:py-8 lg:py-10'
      : 'pt-6 pb-8 sm:py-8 lg:py-10';

  const handleOpenFollowUp = useCallback((event) => {
    if (!canShowFollowUp) return;
    followUpOpenerRef.current = event?.currentTarget || document.activeElement;
    setFollowUpIntent('ask');
    setIsFollowUpOpen(true);
  }, [canShowFollowUp]);

  const handleCloseFollowUp = useCallback(() => {
    setIsFollowUpOpen(false);
  }, []);

  const handleGeneratePersonalReading = useCallback(() => {
    setIsFollowUpOpen(false);
    return generatePersonalReading();
  }, [generatePersonalReading]);

  // Compute the highest milestone achieved (not affected by which panel user views)
  // This ensures the step indicator stays consistent once progress is made
  const { stepIndicatorLabel, stepIndicatorHint, activeStep } = useMemo(() => {
    // Once we have a reading, we're at the table or past it.
    // This prevents the indicator from regressing when users revisit prep panels
    if (hasReading) {
      // Cards drawn, not yet dealt: the optional ritual waits beside the deck
      // and is the current step until the reader knocks three times or cuts.
      if (!isSpreadDealt) {
        return !shouldSkipRitual && !ritualWasPerformed
          ? {
            stepIndicatorLabel: 'Knock, cut or deal',
            stepIndicatorHint: 'The ritual is optional: deal whenever you feel ready.',
            activeStep: 'ritual'
          }
          : {
            stepIndicatorLabel: 'Deal your spread',
            stepIndicatorHint: 'Deal when you feel ready, then turn one card at a time.',
            activeStep: 'reading'
          };
      }
      if (hasNarrative) {
        return {
          stepIndicatorLabel: 'Reflect on your reading',
          stepIndicatorHint: 'Read through the personalized guidance and save anything that resonates.',
          activeStep: 'reading'
        };
      }
      if (narrativeInProgress) {
        return {
          stepIndicatorLabel: 'Interpreting your cards',
          stepIndicatorHint: 'Preparing a written reading from your revealed cards.',
          activeStep: 'reading'
        };
      }
      if (allCardsRevealed) {
        return {
          stepIndicatorLabel: 'Explore your spread',
          stepIndicatorHint: 'Explore each card, or choose “Interpret cards” to connect the whole spread.',
          activeStep: 'reading'
        };
      }
      // Cards drawn but not all revealed
      const remainingCards = visibleCount - revealedCards.size;
      return {
        stepIndicatorLabel: `Reveal your cards`,
        stepIndicatorHint: `${remainingCards} card${remainingCards === 1 ? '' : 's'} remaining to reveal.`,
        activeStep: 'reading'
      };
    }

    // Writing a question also accepts the selected layout, including the
    // default spread. Restored drafts should reflect that progress too.
    if (!hasConfirmedSpread && !hasQuestion) {
      return {
        stepIndicatorLabel: 'Pick a spread',
        stepIndicatorHint: 'Match the layout to the depth of your inquiry.',
        activeStep: 'spread'
      };
    }

    // Spread confirmed - check intention and ritual
    // Show intention step if no question set
    if (!hasQuestion) {
      return {
        stepIndicatorLabel: 'Set your intention',
        stepIndicatorHint: 'A question can guide your reading. You can also draw without one.',
        activeStep: 'intention'
      };
    }

    // Question set. The ritual waits at the table, so preparation stays
    // current until the reader draws.
    return {
      stepIndicatorLabel: 'Your intention is ready',
      stepIndicatorHint: 'When you feel ready, choose “Draw cards” to begin your reading.',
      activeStep: 'intention'
    };
  }, [hasNarrative, narrativeInProgress, hasReading, isSpreadDealt, shouldSkipRitual, ritualWasPerformed, allCardsRevealed, hasQuestion, hasConfirmedSpread, revealedCards, visibleCount]);

  // Canvas progress states derive from flow milestones, not step position alone.
  // The ritual is upcoming until Draw, current at the table, done once the
  // reader knocks three times or cuts, and skipped only when they deal without
  // either or hide ritual steps in Settings.
  const progressCompletedIds = [
    ...(hasConfirmedSpread || hasQuestion || hasReading ? ['spread'] : []),
    ...(hasReading || activeStep === 'ritual' || activeStep === 'reading' ? ['intention'] : []),
    ...(ritualWasPerformed ? ['ritual'] : []),
  ];
  const progressSkippedIds = [
    ...(!ritualWasPerformed && (shouldSkipRitual || isSpreadDealt) ? ['ritual'] : []),
  ];


  // --- Render Helper Wrappers ---

  // Signed-in readers with Reader Memory choose whether it informs this reading:
  // below the spreads on phones, with the deck on wider screens. A confirmed
  // empty memory list makes the choice unnecessary. While the check loads
  // or fails, keep opt-out available before the reader starts generating.
  const showSavedMemoriesOption = Boolean(user) && memoryPresence !== 'none';
  const savedMemoriesOption = showSavedMemoriesOption ? (
    <div className="saved-memories-option">
      <label className="flex min-h-11 items-center gap-3 text-sm text-muted-high">
        <input
          type="checkbox"
          checked={useSavedMemories}
          onChange={event => setUseSavedMemories(event.target.checked)}
          aria-describedby={memoryPresence === 'some' ? memoriesHintId : undefined}
          className="h-4 w-4 accent-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        />
        Use saved memories in this reading.
      </label>
      {memoryPresence === 'some' && (
        <p id={memoriesHintId} className="pl-9 text-xs leading-relaxed text-muted text-pretty">
          Themes and details the reader has kept from your chats.{' '}
          <Link to="/account#practice" className="text-accent underline underline-offset-2">Review Reader Memory</Link>
        </p>
      )}
    </div>
  ) : null;

  return (
    <div data-app-chrome className={`app-shell relative isolate min-h-screen bg-main text-main ${hasReading && !showSetupSection ? 'app-shell--reading' : ''} ${shouldEnableMobileStableMode ? 'mobile-stable-mode' : ''}`}>
      <div id="app-bg" className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />
      <div className="relative z-1">
      {!isOnboardingOpen && <ReadingSkipLinks showSetupSection={showSetupSection} />}
      <Header installInMenu={Boolean(personalReading) || isGenerating} />
      <main
        id="main-content"
        tabIndex={-1}
        className={`max-w-7xl mx-auto pl-[max(1rem,var(--safe-pad-left))] pr-[max(1rem,var(--safe-pad-right))] sm:pl-[max(1.25rem,var(--safe-pad-left))] sm:pr-[max(1.25rem,var(--safe-pad-right))] md:pl-[max(1.5rem,var(--safe-pad-left))] md:pr-[max(1.5rem,var(--safe-pad-right))] ${mainContentSpacing}`}
      >
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {[ttsAnnouncement, srAnnouncement, journalStatus?.message].filter(Boolean).join(' · ')}
        </div>

        <div className="canvas-progress">
          <StepProgress
            canvas
            steps={STEP_PROGRESS_STEPS}
            activeStep={hasReading && viewedProgressStep ? viewedProgressStep : activeStep}
            onSelect={handleStepNav}
            completedIds={progressCompletedIds}
            skippedIds={progressSkippedIds}
          />
          <button
            type="button"
            className="canvas-progress__settings reading-settings"
            aria-label="Reading settings"
            onClick={() => {
              if (isHandset) setIsMobileSettingsOpen(true);
              else navigate('/account');
            }}
          >
            <Gear size={21} aria-hidden="true" />
          </button>
          {isShuffling && (
            <div className="canvas-progress__status" role="status" aria-live="polite">
              <ArrowCounterClockwise className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
              <span>Shuffling the deck...</span>
            </div>
          )}
        </div>

        {apiHealthBanner && showSetupSection && !suppressFocusInterruptions && (
          <div className={`mb-6 p-4 rounded-lg backdrop-blur ${
            apiHealthBanner.status === 'offline'
              ? 'bg-error/10 border border-error/40'
              : 'bg-primary/10 border border-primary/30'
          }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full animate-pulse motion-reduce:animate-none ${
                apiHealthBanner.status === 'offline' ? 'bg-error' : 'bg-primary'
              }`}
              />
              <div className="text-accent text-xs sm:text-sm">
                <span className="font-semibold">Service Status:</span>{' '}
                {apiHealthBanner.status === 'offline' ? (
                  <span>Offline - check your connection</span>
                ) : (
                  <>
                    <span className="sm:hidden">Local fallbacks active</span>
                    <span className="hidden sm:inline">{apiHealthBanner.message}</span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 text-muted text-xs">
              {apiHealthBanner.status === 'offline' ? (
                <div>We will retry automatically when you are back online.</div>
              ) : (
                <>
                  {!apiHealthBanner.anthropic && <div>• Claude AI: Using local composer</div>}
                  {!apiHealthBanner.narration && <div>• Reader voice: Narration temporarily unavailable</div>}
                  <div className="mt-1">All readings remain fully functional with local fallbacks.</div>
                </>
              )}
            </div>
          </div>
        )}

        {minorsDataIncomplete && showSetupSection && !suppressFocusInterruptions && (
          <div className="mb-6 p-4 bg-error/10 border border-error/40 rounded-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-error animate-pulse motion-reduce:animate-none"></div>
              <div className="text-error text-xs sm:text-sm">
                <span className="font-semibold">Deck Data Warning:</span> Minor Arcana data incomplete. Using Major Arcana only.
              </div>
            </div>
            <div className="mt-2 text-muted text-xs">
              <div>• Please check the Minor Arcana dataset for missing or malformed cards</div>
              <div>• Full deck readings will be available once data is restored</div>
            </div>
          </div>
        )}

        {showPersonalizationBanner && showSetupSection && !suppressFocusInterruptions && (
          <PersonalizationBanner
            onDismiss={handlePersonalizationBannerDismiss}
            onPersonalize={handlePersonalizationBannerPersonalize}
          />
        )}

        {/* Step 1–3: Spread + Prepare */}
        {showSetupSection && (
          <section aria-label="Reading setup" className={isLandscape ? 'mb-3' : 'mb-6 xl:mb-4'}>
            {/* On phones the question comes first: the default spread is already
                chosen, and the question field would otherwise start below the fold. */}
            {isHandset && (
              <div className={isLandscape ? 'mb-3' : 'mb-6'}>
                <QuickIntentionCard
                  ref={quickIntentionCardRef}
                  variant={isLandscape ? 'compact' : 'full'}
                  highlight={highlightQuickIntention}
                  userQuestion={userQuestion}
                  onQuestionChange={setUserQuestion}
                  inputRef={quickIntentionInputRef}
                  onInputFocus={handleQuickIntentionFocus}
                  onInputBlur={handleQuestionBlur}
                  onCoachOpen={openIntentionCoach}
                  onMoreOpen={() => setIsMobileSettingsOpen(true)}
                  deckStyleId={deckStyleId}
                  selectedSpread={selectedSpread}
                  onDeckChange={() => setIsMobileSettingsOpen(true)}
                />
              </div>
            )}
            {/* Phones introduce the spreads with the reading step; wider screens
                carry it beside Draw cards (ReadingStart). */}
            {isHandset && (
              <div className={isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}>
                <p className="text-xs-plus sm:text-sm uppercase tracking-widest text-accent">{stepIndicatorLabel}</p>
                {!isLandscape && <p className="mt-1 text-muted-high text-xs sm:text-sm">{stepIndicatorHint}</p>}
                {/* Shown only while short or enlarged views release Draw cards into
                    the page, which can leave it below every spread. */}
                <button type="button" className="setup-actions-jump" onClick={handleSetupActionsJump}>
                  Go to Draw cards
                </button>
              </div>
            )}

            <div className={`max-w-5xl mx-auto ${isLandscape ? 'space-y-3' : 'space-y-6'}`}>
              {/* Wider screens read in the order a reading is made, as phones
                  do: the question first, then the spread, then the deck just
                  before Draw cards. The ritual waits at the table. */}
              {!isHandset && (
                <ReadingPreparation
                  part="question"
                  sectionRef={prepareSectionRef}
                  userQuestion={userQuestion}
                  setUserQuestion={setUserQuestion}
                  onQuestionFocus={handleQuestionFocus}
                  onQuestionBlur={handleQuestionBlur}
                  onLaunchCoach={openIntentionCoach}
                />
              )}

              {/* Step navigation target; the panel inside carries the heading
                  and the named radio group. */}
              <div ref={spreadSectionRef} id="step-spread" tabIndex={-1}>
                <SpreadSelector
                  selectedSpread={selectedSpread}
                  onSelectSpread={handleSpreadSelection}
                  onSpreadConfirm={onSpreadConfirm}
                  showHeader={!isHandset}
                  prioritizeChosenArt={isHandset}
                />
              </div>

              {isHandset && savedMemoriesOption}

              {!isHandset && (
                <ReadingPreparation
                  part="details"
                  deckStyleId={deckStyleId}
                  onDeckChange={handleDeckChange}
                  hasDrawnCards={Boolean(reading?.length)}
                  prepareSectionsOpen={prepareSectionsOpen}
                  togglePrepareSection={togglePrepareSection}
                >
                  {savedMemoriesOption}
                </ReadingPreparation>
              )}

              {/* Wider screens keep Draw cards in reach beside the step; this
                  shortcut serves the tablet layout, where the dock holds it. */}
              {isHandset && !isLandscape && !isSmallScreen && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleStepNav('reading')}
                    className="inline-flex min-h-touch items-center text-sm text-secondary hover:text-main underline underline-offset-4"
                  >
                    Skip ahead to the reading
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Outside the setup section, so hiding the setup cannot leave the
            question pending and bring it back later. */}
        <ConfirmModal
          isOpen={Boolean(pendingSpreadKey)}
          onClose={closeSpreadChange}
          onConfirm={confirmSpreadChange}
          title={`Switch to ${getSpreadInfo(pendingSpreadKey)?.name || 'this spread'}?`}
          message={pendingSpreadHasReading
            ? 'This clears the cards on the table, your notes on them and their reading. Your question stays, and anything already saved to your journal is kept.'
            : 'This clears the cards on the table and your notes on them. Your question stays.'}
          confirmText="Switch spread"
          cancelText="Keep these cards"
          returnFocusRef={spreadChangeReturnRef}
          fallbackFocusSelector='#step-spread [role="radio"][aria-checked="true"]'
          renderInPortal
        />

        {!isOnboardingOpen && !onboardingDecisionPending && (isShuffling || reading?.length || isGenerating || personalReading ? (
          <LazyLoadBoundary title="Your reading table did not load" className="my-6">
            <Suspense fallback={
              <section id="step-reading" ref={readingSectionRef} tabIndex={-1} aria-label="Draw and explore your reading">
                <p role="status" className="py-6 text-sm text-muted">Loading your reading space…</p>
              </section>
            }>
              <ReadingDisplay
                saveController={saveController}
                onCardModalChange={setIsCardModalOpen}
                sectionRef={readingSectionRef}
                onOpenFollowUp={canShowFollowUp ? handleOpenFollowUp : null}
                onSaveReading={saveReading}
                isSaving={isSaving}
                savedEntryId={savedEntryId}
                suppressInterruptions={suppressFocusInterruptions}
                isMobileStableMode={shouldEnableMobileStableMode}
              />
            </Suspense>
          </LazyLoadBoundary>
        ) : (
          // Wider screens pin Draw cards to the bottom edge while the setup
          // scrolls, as the completed reading pins Save and Ask; the page's
          // chrome budget releases it into the flow when space runs short.
          <section
            id="step-reading"
            ref={readingSectionRef}
            tabIndex={-1}
            aria-label="Draw and explore your reading"
            className={isHandset ? undefined : 'setup-draw-row'}
            data-app-secondary={isHandset ? undefined : '3'}
            data-chrome-placement={isHandset ? undefined : 'bottom'}
          >
            <ReadingStart
              displayName={personalization?.displayName?.trim()}
              readingMeta={readingMeta}
              isHandset={isHandset}
              isLandscape={isLandscape}
              shuffle={handleShuffle}
              statusLabel={stepIndicatorLabel}
              spreadKey={selectedSpread}
              deckStyleId={deckStyleId}
            />
          </section>
        ))}
          {/* Handset bottom region owns the contextual actions and destinations. */}
          <AppBottomRegion overlayActive={isMobileOverlayActive}>
          <MobileActionBar
              embedded
              isOverlayActive={isMobileOverlayActive}
              isSettingsOpen={isMobileSettingsOpen}
              showFollowUp={showFollowUpButton}
              isFollowUpOpen={isFollowUpVisible}
              isShuffling={isShuffling}
              reading={reading}
              isSpreadDealt={isSpreadDealt}
              spreadPositions={spreadInfo?.positions}
              onDealSpread={dealSpread}
              revealedCards={revealedCards}
              dealIndex={dealIndex}
              isGenerating={isGenerating}
              personalReading={personalReading}
              needsNarrativeGeneration={needsNarrativeGeneration}
              stepIndicatorLabel={stepIndicatorLabel}
              revealFocus={revealFocus}
              onOpenSettings={() => setIsMobileSettingsOpen(true)}
              onOpenFollowUp={handleOpenFollowUp}
              onShuffle={handleShuffle}
              onDealNext={dealNext}
              onRevealAll={handleRevealAll}
              onGenerateNarrative={handleGeneratePersonalReading}
              saveController={saveController}
              onViewJournalEntry={(entryId) => navigate('/journal', { state: entryId ? { highlightEntryId: entryId, fromReading: true } : null })}
              onSaveReading={saveReading}
              isSaving={isSaving}
              savedEntryId={savedEntryId}
              onViewSavedEntry={() => navigate('/journal', { state: { highlightEntryId: savedEntryId, fromReading: true } })}
              onCancelGeneration={cancelPersonalReading}
              onNewReading={handleShuffle}
              onUpgrade={() => navigate('/pricing')}
            />
          </AppBottomRegion>
        {!isHandset || (!personalReading && !isGenerating) ? <InstallFooter /> : null}
      </main>

      {canShowFollowUp && (
        <Suspense fallback={null}>
          <FollowUpModal
            isOpen={Boolean(isFollowUpVisible)}
            isHandset={isHandset}
            onClose={handleCloseFollowUp}
            returnFocusRef={followUpOpenerRef}
            autoFocusInput={followUpIntent === 'ask'}
          />
        </Suspense>
      )}

      {isHandset && (
        <>

          {connectionBanner && showSetupSection && !suppressFocusInterruptions && !isMobileOverlayActive && (
            <div
              className="fixed left-0 right-0 z-60 flex justify-center pl-safe pr-safe bottom-safe-action"
              aria-live="polite"
            >
              <div className={`pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border ${connectionBg} ${connectionTone} px-3 py-2 text-xs shadow-lg backdrop-blur`}>
                <span className={`${BADGE_LABEL_CLASS} ${connectionText}`}>Connection</span>
                <span className="text-main/90">{connectionBanner.message}</span>
                <button
                  type="button"
                  onClick={checkApiHealth}
                  className={`${BADGE_LABEL_CLASS} ml-auto inline-flex min-h-touch items-center rounded-full border px-2.5 py-1 ${connectionTone} ${connectionText} hover:text-main hover:border-secondary/60 transition`}
                >
                  {connectionBanner.actionLabel || 'Retry'}
                </button>
              </div>
            </div>
          )}
          <MobileSettingsDrawer
            keepMounted={Boolean(personalReading) || isGenerating}
            isOpen={isMobileSettingsOpen}
            onClose={() => setIsMobileSettingsOpen(false)}
            footer={(
              <MobileActionGroup
                isShuffling={isShuffling}
                reading={reading}
                isSpreadDealt={isSpreadDealt}
                spreadPositions={spreadInfo?.positions}
                onDealSpread={dealSpread}
                revealedCards={revealedCards}
                dealIndex={dealIndex}
                isGenerating={isGenerating}
                personalReading={personalReading}
                needsNarrativeGeneration={needsNarrativeGeneration}
                stepIndicatorLabel={stepIndicatorLabel}
                revealFocus={revealFocus}
                showUtilityButtons={false}
                onOpenSettings={() => setIsMobileSettingsOpen(false)}
                onOpenCoach={() => {
                  setIsMobileSettingsOpen(false);
                  openIntentionCoach();
                }}
                onShuffle={handleShuffle}
                onDealNext={dealNext}
                onRevealAll={handleRevealAll}
                onGenerateNarrative={handleGeneratePersonalReading}
                saveController={saveController}
                onSaveReading={saveReading}
                isSaving={isSaving}
                savedEntryId={savedEntryId}
                onViewSavedEntry={() => navigate('/journal', { state: { highlightEntryId: savedEntryId, fromReading: true } })}
                onCancelGeneration={() => {
                  setIsMobileSettingsOpen(false);
                  cancelPersonalReading();
                }}
                onNewReading={handleShuffle}
              />
            )}
          >
            {isMobileSettingsOpen && <ReadingPreparation
              variant="mobile"
              deckStyleId={deckStyleId}
              onDeckChange={handleDeckChange}
              hasDrawnCards={Boolean(reading?.length)}
            />}
            {(personalReading || isGenerating) && <InstallControl key="reading-settings-install" getFallbackFocus={() => document.querySelector('[data-reading-settings-drawer]:not([hidden]) .mobile-drawer__close') || document.querySelector('.reading-settings')} />}
          </MobileSettingsDrawer>
        </>
      )}

      {isIntentionCoachOpen && (
        <DeferredDialog
          component={GuidedIntentionCoach}
          title="question coach"
          isOpen={isIntentionCoachOpen}
          selectedSpread={selectedSpread}
          initialQuestion={userQuestion}
          onClose={handleCoachClose}
          onApply={handleCoachApply}
          prefillRecommendation={pendingCoachPrefill || coachRecommendation}
        />
      )}

      {/* Onboarding wizard for first-time visitors */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onComplete={handleOnboardingComplete}
        onSelectSpread={handleOnboardingSpreadSelect}
        initialSpread={selectedSpread}
        initialQuestion={userQuestion}
      />

      </div>
    </div>
  );
}
