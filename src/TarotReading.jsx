import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EXAMPLE_QUESTIONS } from './data/exampleQuestions';
import { SpreadSelector } from './components/SpreadSelector';
import { ReadingPreparation } from './components/ReadingPreparation';
import { ReadingDisplay } from './components/ReadingDisplay';
import { GuidedIntentionCoach } from './components/GuidedIntentionCoach';
import { DeckSelector } from './components/DeckSelector';
import { MobileSettingsDrawer } from './components/MobileSettingsDrawer';
import { MobileActionBar, MobileActionGroup } from './components/MobileActionBar';
import { formatReading } from './lib/formatting';
import FollowUpDrawer from './components/FollowUpDrawer';
import { QuickIntentionCard } from './components/QuickIntentionCard';
import { Header } from './components/Header';
import { OnboardingWizard } from './components/onboarding';
import { PersonalizationBanner } from './components/PersonalizationBanner';
import { GestureCoachOverlay } from './components/GestureCoachOverlay';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { loadCoachRecommendation, saveCoachRecommendation } from './lib/journalInsights';

const STEP_PROGRESS_STEPS = [
  { id: 'spread', label: 'Spread' },
  { id: 'intention', label: 'Question' },
  { id: 'ritual', label: 'Ritual (optional)' },
  { id: 'reading', label: 'Reading' }
];

export default function TarotReading() {
  const { user } = useAuth();
  const userId = user?.id || null;

  // --- 1. Global Preferences (Context) ---
  const {
    // Theme
    theme,
    // Audio
    voiceOn,
    ambienceOn,
    // Deck & Reversals
    deckStyleId,
    setDeckStyleId,
    deckSize,
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
    // Gesture coach
    shouldShowGestureCoach,
    markGestureCoachSeen
  } = usePreferences();

  // Accessibility: reduced motion preference
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen();
  const isLandscape = useLandscape();
  const isHandsetLayout = useHandsetLayout();
  const { newDeckInterface } = useFeatureFlags();
  // Handset mode should include:
  // - narrow portrait phones (width-constrained)
  // - height-constrained landscape phones ("small landscape")
  // - touch-first layouts that report tablet widths
  // This keeps mobile patterns (bottom action bar + settings drawer + quick intention) available.
  const isHandset = isSmallScreen || isLandscape || isHandsetLayout;

  // --- 2. Reading Context ---
  const {
    // Audio
    ttsAnnouncement,
    srAnnouncement,

    // Tarot State
    selectedSpread,
    setSelectedSpread: _setSelectedSpread,
    selectSpread,
    reading,
    setReading,
    isShuffling,
    revealedCards,
    setRevealedCards,
    dealIndex,
    setDealIndex,
    hasKnocked,
    knockCount,
    hasCut,
    cutIndex,
    setCutIndex,
    hasConfirmedSpread,
    setHasConfirmedSpread,
    userQuestion,
    setUserQuestion,
    setSessionSeed,
    deckAnnouncement,
    shouldSkipRitual,
    shuffle,
    handleKnock,
    applyCut,
    dealNext,
    revealAll,
    onSpreadConfirm,

    // Vision (only what's needed for deck change)
    resetVisionProof,
    setVisionResults,
    setVisionConflicts,

    // Reading Generation & UI
    personalReading,
    setPersonalReading,
    setThemes,
    setNarrativePhase,
    narrativePhase,
    isGenerating,
    setIsGenerating,
    setAnalysisContext,
    setReadingMeta,
    journalStatus,
    setJournalStatus,
    setFollowUps,
    setReflections,
    setShowAllHighlights,
    generatePersonalReading,

  } = useReading();

  // --- 3. Local View State & Wiring ---
  // UI Specifics
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [connectionBanner, setConnectionBanner] = useState(null);
  const [pendingCoachPrefill, setPendingCoachPrefill] = useState(null);
  const [coachRecommendationVersion, setCoachRecommendationVersion] = useState(0);
  const [isIntentionCoachOpen, setIsIntentionCoachOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [mobileSettingsTab, setMobileSettingsTab] = useState('intention');
  const [highlightQuickIntention, setHighlightQuickIntention] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [onboardingDeferred, setOnboardingDeferred] = useState(false);
  const isOnboardingOpen = !onboardingComplete && !showPersonalizationBanner && !onboardingDeferred;
  const shouldShowGestureCoachOverlay = shouldShowGestureCoach && hasConfirmedSpread && !reading && !isOnboardingOpen;

  const navigate = useNavigate();
  const location = useLocation();
  const spreadSectionRef = useRef(null);
  const prepareSectionRef = useRef(null);
  const readingSectionRef = useRef(null);
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
    setIsFollowUpOpen(false);
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
      const azureAvailable = ttsHealth?.ok ?? false;
      if (!anthropicAvailable || !azureAvailable) {
        setApiHealthBanner({
          status: 'degraded',
          anthropic: anthropicAvailable,
          azure: azureAvailable,
          message: 'Using local services' +
            (!anthropicAvailable ? ' (Claude unavailable)' : '') +
            (!azureAvailable ? ' (Azure TTS unavailable)' : '')
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
    } catch (err) {
      console.debug('API health check failed:', err);
      setApiHealthBanner({ status: 'offline', message: 'Offline mode' });
      setConnectionBanner({
        status: 'offline',
        message: 'Connection issue. Check your network, then retry.',
        actionLabel: 'Retry'
      });
    }
  }, []);

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

    const {
      cards = [],
      question = '',
      personalReading: entryNarrative = '',
      themes: entryThemes = null,
      spreadKey,
      spreadName,
      context: entryContext,
      deckId,
      followUps = [],
      sessionSeed: entrySessionSeed,
      requestId,
      provider
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

    setReading(normalizedCards);
    setRevealedCards(new Set(normalizedCards.map((_, index) => index)));
    setDealIndex(normalizedCards.length);
    setSessionSeed(entrySessionSeed || null);
    setUserQuestion(question || '');
    setThemes(entryThemes || null);
    setAnalysisContext(entryContext || null);
    setPersonalReading(formatReading(entryNarrative || ''));
    setNarrativePhase('complete');
    setIsGenerating(false);
    setJournalStatus(null);
    setFollowUps(Array.isArray(followUps) ? followUps : []);
    setReadingMeta((prev) => ({
      ...prev,
      requestId: requestId || prev.requestId,
      spreadKey: normalizedSpread || prev.spreadKey,
      spreadName: spreadName || prev.spreadName,
      deckStyle: deckId || prev.deckStyle,
      userQuestion: question || prev.userQuestion,
      provider: provider || prev.provider
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncing UI state from router state
    setIsFollowUpOpen(true);

    const nextState = { ...location.state };
    delete nextState.followUpEntry;
    delete nextState.openFollowUp;
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
    setNarrativePhase,
    setPersonalReading,
    setReading,
    setReadingMeta,
    setRevealedCards,
    setSessionSeed,
    setThemes,
    setUserQuestion,
    setJournalStatus,
    setIsFollowUpOpen
  ]);

  // Mobile keyboard avoidance for the bottom action bar
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;

    const updateKeyboardOffset = () => {
      const heightDiff = window.innerHeight - viewport.height - viewport.offsetTop;
      const isKeyboardOpen = heightDiff > 120;
      setKeyboardOffset(isKeyboardOpen ? Math.max(heightDiff, 0) : 0);
    };

    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);
    updateKeyboardOffset();

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, []);

  // Coach Shortcut
  useEffect(() => {
    function handleCoachShortcut(event) {
      if (event.defaultPrevented) return;
      if (isIntentionCoachOpen) return;
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
  }, [isIntentionCoachOpen, openIntentionCoach]);

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

  const handleGestureCoachDismiss = useCallback(() => {
    markGestureCoachSeen();
  }, [markGestureCoachSeen]);

  // --- Handlers ---

  const handleDeckChange = useCallback((newDeckId) => {
    setDeckStyleId(newDeckId);
    setVisionResults([]);
    setVisionConflicts([]);
    resetVisionProof();
  }, [setDeckStyleId, setVisionResults, setVisionConflicts, resetVisionProof]);

  const scrollQuickIntentionIntoView = useCallback(() => {
    if (!isHandset) return;
    const target = quickIntentionCardRef.current || quickIntentionInputRef.current;
    if (!target) return;

    window.requestAnimationFrame(() => {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // Silently ignore scroll failures (e.g., Safari quirks)
      }
    });
  }, [isHandset]);

  const handleQuestionFocus = useCallback(() => {
  }, []);

  const handleQuestionBlur = useCallback(() => {
  }, []);

  const handleQuickIntentionFocus = useCallback(() => {
    scrollQuickIntentionIntoView();
  }, [scrollQuickIntentionIntoView]);

  const handleSpreadSelection = useCallback((key) => {
    const shouldPromptQuickIntention = isHandset && !hasConfirmedSpread;
    // Use the centralized selectSpread from useTarotState
    selectSpread(key);
    // Reset narrative/analysis state
    setPersonalReading(null);
    setJournalStatus(null);
    setReflections({});
    setIsGenerating(false);
    if (shouldPromptQuickIntention) {
      scrollQuickIntentionIntoView();
      setHighlightQuickIntention(true);
      if (quickIntentionHighlightTimeoutRef.current) {
        window.clearTimeout(quickIntentionHighlightTimeoutRef.current);
      }
      quickIntentionHighlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightQuickIntention(false);
        quickIntentionHighlightTimeoutRef.current = null;
      }, 1500);
    }
  }, [hasConfirmedSpread, isHandset, scrollQuickIntentionIntoView, selectSpread, setIsGenerating, setJournalStatus, setPersonalReading, setReflections]);

  const handleCoachClose = useCallback(() => {
    setIsIntentionCoachOpen(false);
    setPendingCoachPrefill(null);
  }, []);

  const clearCoachRecommendation = useCallback(() => {
    saveCoachRecommendation(null, userId);
    refreshCoachRecommendation();
  }, [refreshCoachRecommendation, userId]);

  const applyCoachRecommendation = useCallback(() => {
    const nextQuestion = coachRecommendation?.question || coachRecommendation?.customFocus;
    if (!nextQuestion) return;
    setUserQuestion(nextQuestion);
    clearCoachRecommendation();
  }, [clearCoachRecommendation, coachRecommendation, setUserQuestion]);

  const dismissCoachRecommendation = useCallback(() => {
    clearCoachRecommendation();
  }, [clearCoachRecommendation]);

  const handleCoachApply = (guidedQuestion) => {
    if (!guidedQuestion) return;
    setUserQuestion(guidedQuestion);
    handleCoachClose();
  };

  const handleStepNav = useCallback((stepId) => {
    // On mobile (< 640px), open the settings drawer for intention/ritual steps
    // since the prep section is hidden on mobile
    if (isHandset && (stepId === 'intention' || stepId === 'ritual')) {
      setMobileSettingsTab(stepId === 'ritual' ? 'ritual' : 'intention');
      setIsMobileSettingsOpen(true);
      return;
    }

    const refs = {
      spread: spreadSectionRef,
      intention: prepareSectionRef,
      ritual: prepareSectionRef,
      reading: readingSectionRef
    };
    const target = refs[stepId]?.current;
    if (target && typeof target.scrollIntoView === 'function') {
      const behavior = prefersReducedMotion ? 'auto' : 'smooth';
      target.scrollIntoView({
        behavior,
        block: 'start'
      });
    }
  }, [isHandset, prefersReducedMotion]);

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
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';
    readingSectionRef.current?.scrollIntoView({ behavior, block: 'start' });
  }, [prefersReducedMotion, revealAll]);

  const handlePersonalizationBannerDismiss = useCallback(() => {
    setShowPersonalizationBanner(false);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('tarot-personalization-banner', 'dismissed');
      } catch (error) {
        console.debug('Unable to persist personalization banner dismissal', error);
      }
    }
  }, [setShowPersonalizationBanner]);

  const handlePersonalizationBannerPersonalize = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('tarot-personalization-banner');
      } catch (error) {
        console.debug('Unable to reset personalization banner state', error);
      }
    }
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

  const { saveReading } = useSaveReading();

  // --- Logic: UI State Builders ---

  const prepareSummaries = useMemo(() => {
    const trimmedQuestion = userQuestion.trim();
    const questionSummary = trimmedQuestion
      ? `Intention: ${trimmedQuestion.length > 60 ? `${trimmedQuestion.slice(0, 57)}…` : trimmedQuestion}`
      : 'Intention: Blank';
    const knockSummary = knockCount >= 3 ? 'Knocks ready' : `Knocks ${knockCount}/3`;
    const cutSummary = hasCut ? `Cut ${cutIndex}` : 'Cut pending';
    const ritualSummary = shouldSkipRitual
      ? 'Ritual: Personalized off'
      : knockCount === 0 && !hasCut
        ? 'Ritual: Skipped'
        : `Ritual: ${knockSummary} · ${cutSummary}`;
    const deckSummaryLabel = `${deckSize}${minorsDataIncomplete ? ' (Major Arcana only)' : ''}`;
    const audioSummary = `Voice: ${voiceOn ? 'On' : 'Off'} · Ambience: ${ambienceOn ? 'On' : 'Off'}`;
    const experienceSummary = `Theme: ${theme === 'light' ? 'Light' : 'Dark'} · Deck: ${deckSummaryLabel}`;

    return {
      intention: questionSummary,
      audio: audioSummary,
      experience: experienceSummary,
      ritual: ritualSummary
    };
  }, [userQuestion, voiceOn, ambienceOn, theme, deckSize, minorsDataIncomplete, knockCount, hasCut, cutIndex, shouldSkipRitual]);

  const prepareSectionLabels = {
    intention: { title: 'Intention', helper: 'Optional guiding prompt before you draw.' },
    audio: { title: 'Audio', helper: 'Voice narration and ambient soundscape.' },
    experience: { title: 'Experience', helper: 'Theme, deck scope, and reversal interpretation lens.' },
    ritual: { title: 'Ritual (optional)', helper: 'Shape the ritual steps so they match your practice.' }
  };

  // Determine Active Step for StepProgress
  // These are milestone-based flags that represent permanent progress through the flow
  const hasQuestion = Boolean(userQuestion && userQuestion.trim().length > 0);
  const hasReading = Boolean(reading && reading.length > 0);
  const allCardsRevealed = hasReading && revealedCards.size === reading.length;
  const hasNarrative = Boolean(personalReading && !personalReading.isError && !personalReading.isStreaming);
  const narrativeInProgress = isGenerating && (!personalReading || personalReading.isStreaming);
  const needsNarrativeGeneration = allCardsRevealed && (!personalReading || personalReading.isError || personalReading.isStreaming);
  const _isPersonalReadingError = Boolean(personalReading?.isError);
  const showFollowUpButton = isHandset && personalReading && !personalReading.isError && !personalReading.isStreaming && narrativePhase === 'complete';
  const isFollowUpVisible = showFollowUpButton && isFollowUpOpen;
  // Only true overlays (modals/drawers) should hide the action bar - not the small personalization banner
  const isMobileOverlayActive = isIntentionCoachOpen || isMobileSettingsOpen || isOnboardingOpen || isFollowUpVisible;
  const revealFocus = isHandset && newDeckInterface && reading && revealedCards.size < reading.length
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

  const handleOpenFollowUp = useCallback(() => {
    if (!showFollowUpButton) return;
    setIsFollowUpOpen(true);
  }, [showFollowUpButton]);

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
    // Once we have a reading, we're always in the "reading" phase
    // This prevents the indicator from regressing when users revisit prep panels
    if (hasReading) {
      if (hasNarrative) {
        return {
          stepIndicatorLabel: 'Reflect on your narrative',
          stepIndicatorHint: 'Read through the personalized guidance and save anything that resonates.',
          activeStep: 'reading'
        };
      }
      if (narrativeInProgress) {
        return {
          stepIndicatorLabel: 'Weaving your narrative',
          stepIndicatorHint: 'Hang tight while we compose your personalized reading.',
          activeStep: 'reading'
        };
      }
      if (allCardsRevealed) {
        return {
          stepIndicatorLabel: 'Explore your spread',
          stepIndicatorHint: 'Review the card insights below or generate a personalized narrative.',
          activeStep: 'reading'
        };
      }
      // Cards drawn but not all revealed
      const remainingCards = reading.length - revealedCards.size;
      return {
        stepIndicatorLabel: `Reveal your cards`,
        stepIndicatorHint: `${remainingCards} card${remainingCards === 1 ? '' : 's'} remaining to reveal.`,
        activeStep: 'reading'
      };
    }

    // No reading yet - check preparation milestones
    if (!hasConfirmedSpread) {
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
        stepIndicatorHint: 'A focused question helps guide the narrative (optional but recommended).',
        activeStep: 'intention'
      };
    }

    // Question set - check ritual or ready to draw
    // Note: Ritual is optional, so we show "ready to draw" as soon as question is set
    // unless they've started but not finished the ritual
    if (knockCount > 0 && knockCount < 3 && !hasCut) {
      // User started ritual but hasn't finished - prompt to continue or skip
      return {
        stepIndicatorLabel: 'Complete your ritual',
        stepIndicatorHint: `${3 - knockCount} more knock${3 - knockCount === 1 ? '' : 's'} to clear the deck before drawing.`,
        activeStep: 'ritual'
      };
    }

    // Ready to draw - either ritual complete/skipped or no ritual started
    return {
      stepIndicatorLabel: 'Begin your draw',
      stepIndicatorHint: 'When you feel ready, deal the cards to begin your reading.',
      activeStep: 'reading'
    };
  }, [hasNarrative, narrativeInProgress, hasReading, allCardsRevealed, hasQuestion, hasConfirmedSpread, knockCount, hasCut, reading, revealedCards]);


  // --- Render Helper Wrappers ---

  return (
    <div className="app-shell min-h-screen bg-main text-main">
      <div className="skip-links">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <a href="#step-spread" className="skip-link">Skip to spreads</a>
        <a href="#step-reading" className="skip-link">Skip to reading</a>
      </div>
      <main id="main-content" tabIndex={-1} className={`max-w-7xl mx-auto px-4 sm:px-5 md:px-6 ${isLandscape ? 'pt-3 pb-24' : 'pt-6 pb-28 sm:py-8 lg:py-10'}`}>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {[ttsAnnouncement, srAnnouncement, journalStatus?.message].filter(Boolean).join(' · ')}
        </div>

        {/* Header */}
        <Header
          steps={STEP_PROGRESS_STEPS}
          activeStep={activeStep}
          onStepSelect={handleStepNav}
          isShuffling={isShuffling}
        />

        {apiHealthBanner && (
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
                  {!apiHealthBanner.azure && <div>• Azure TTS: Using local audio</div>}
                  <div className="mt-1">All readings remain fully functional with local fallbacks.</div>
                </>
              )}
            </div>
          </div>
        )}

        {minorsDataIncomplete && (
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

        {showPersonalizationBanner && (
          <PersonalizationBanner
            onDismiss={handlePersonalizationBannerDismiss}
            onPersonalize={handlePersonalizationBannerPersonalize}
          />
        )}

        {/* Step 1–3: Spread + Prepare */}
        <section aria-label="Reading setup" className={isLandscape ? 'mb-3' : 'mb-6 xl:mb-4'}>
          <div className={isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}>
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent">{stepIndicatorLabel}</p>
            {!isLandscape && <p className="mt-1 text-muted-high text-xs sm:text-sm">{stepIndicatorHint}</p>}
          </div>

          <div className={`max-w-5xl mx-auto ${isLandscape ? 'space-y-3' : 'space-y-6'}`}>
            <div aria-label="Choose your physical deck">
              {!isHandset && (
                <DeckSelector selectedDeck={deckStyleId} onDeckChange={handleDeckChange} />
              )}
            </div>

            <div aria-label="Spread selection" ref={spreadSectionRef} id="step-spread" tabIndex={-1} className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]">
              <SpreadSelector
                selectedSpread={selectedSpread}
                onSelectSpread={handleSpreadSelection}
                onSpreadConfirm={onSpreadConfirm}
              />
            </div>

            {/* Mobile quick intention entry keeps the question visible without opening the drawer */}
            {isHandset && (
              <QuickIntentionCard
                ref={quickIntentionCardRef}
                variant={isLandscape ? 'compact' : 'full'}
                highlight={highlightQuickIntention}
                userQuestion={userQuestion}
                onQuestionChange={setUserQuestion}
                placeholderQuestion={EXAMPLE_QUESTIONS[placeholderIndex]}
                onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
                inputRef={quickIntentionInputRef}
                onInputFocus={handleQuickIntentionFocus}
                onInputBlur={handleQuestionBlur}
                onCoachOpen={openIntentionCoach}
                onMoreOpen={() => {
                  setMobileSettingsTab('intention');
                  setIsMobileSettingsOpen(true);
                }}
                deckStyleId={deckStyleId}
                selectedSpread={selectedSpread}
                onDeckChange={() => {
                  setMobileSettingsTab('deck');
                  setIsMobileSettingsOpen(true);
                }}
              />
            )}

            {!isHandset && (
              <ReadingPreparation
                sectionRef={prepareSectionRef}
                userQuestion={userQuestion}
                setUserQuestion={setUserQuestion}
                placeholderIndex={placeholderIndex}
                onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
                onQuestionFocus={handleQuestionFocus}
                onQuestionBlur={handleQuestionBlur}
                onLaunchCoach={openIntentionCoach}
                prepareSectionsOpen={prepareSectionsOpen}
                togglePrepareSection={togglePrepareSection}
                prepareSummaries={prepareSummaries}
                prepareSectionLabels={prepareSectionLabels}
                hasKnocked={hasKnocked}
                handleKnock={handleKnock}
                cutIndex={cutIndex}
                setCutIndex={setCutIndex}
                hasCut={hasCut}
                applyCut={applyCut}
                knockCount={knockCount}
                onSkipRitual={handleShuffle}
                deckAnnouncement={deckAnnouncement}
                shouldSkipRitual={shouldSkipRitual}
              />
            )}

            {!isLandscape && !isSmallScreen && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => handleStepNav('reading')}
                  className="text-sm text-secondary hover:text-main underline underline-offset-4"
                >
                  Skip ahead to the reading
                </button>
              </div>
            )}
          </div>
        </section>

        <ReadingDisplay
          sectionRef={readingSectionRef}
          onOpenFollowUp={showFollowUpButton ? handleOpenFollowUp : null}
        />
      </main>

      {isHandset && (
        <>
          {/* Mobile Nav - visually obscured when full-screen surfaces are open */}
          <MobileActionBar
            isOverlayActive={isMobileOverlayActive}
            isSettingsOpen={isMobileSettingsOpen}
            isCoachOpen={isIntentionCoachOpen}
            showFollowUp={showFollowUpButton}
            isFollowUpOpen={isFollowUpVisible}
            isShuffling={isShuffling}
            reading={reading}
            revealedCards={revealedCards}
            dealIndex={dealIndex}
            isGenerating={isGenerating}
            personalReading={personalReading}
            needsNarrativeGeneration={needsNarrativeGeneration}
            stepIndicatorLabel={stepIndicatorLabel}
            activeStep={activeStep}
            revealFocus={revealFocus}
            keyboardOffset={keyboardOffset}
            onOpenSettings={() => {
              setMobileSettingsTab(activeStep === 'ritual' ? 'ritual' : 'intention');
              setIsMobileSettingsOpen(true);
            }}
            onOpenCoach={openIntentionCoach}
            onOpenFollowUp={handleOpenFollowUp}
            onShuffle={handleShuffle}
            onDealNext={dealNext}
            onRevealAll={handleRevealAll}
            onGenerateNarrative={handleGeneratePersonalReading}
            onSaveReading={saveReading}
            onNewReading={handleShuffle}
          />
          {connectionBanner && !isMobileOverlayActive && (
            <div
              className="fixed left-0 right-0 z-[60] flex justify-center px-3"
              style={{
                bottom: 'calc(var(--mobile-action-bar-height, 0px) + var(--mobile-action-bar-offset, 0px) + 0.75rem)'
              }}
              aria-live="polite"
            >
              <div className={`pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border ${connectionBg} ${connectionTone} px-3 py-2 text-xs shadow-lg backdrop-blur`}>
                <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${connectionText}`}>Connection</span>
                <span className="text-main/90">{connectionBanner.message}</span>
                <button
                  type="button"
                  onClick={checkApiHealth}
                  className={`ml-auto inline-flex min-h-[32px] items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${connectionTone} ${connectionText} hover:text-main hover:border-secondary/60 transition`}
                >
                  {connectionBanner.actionLabel || 'Retry'}
                </button>
              </div>
            </div>
          )}
          <FollowUpDrawer
            isOpen={isFollowUpVisible}
            onClose={handleCloseFollowUp}
          />

          <MobileSettingsDrawer
            isOpen={isMobileSettingsOpen}
            onClose={() => setIsMobileSettingsOpen(false)}
            footer={(
              <MobileActionGroup
                isShuffling={isShuffling}
                reading={reading}
                revealedCards={revealedCards}
                dealIndex={dealIndex}
                isGenerating={isGenerating}
                personalReading={personalReading}
                needsNarrativeGeneration={needsNarrativeGeneration}
                stepIndicatorLabel={stepIndicatorLabel}
                activeStep={activeStep}
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
                onSaveReading={saveReading}
                onNewReading={handleShuffle}
              />
            )}
          >
            <ReadingPreparation
              variant="mobile"
              userQuestion={userQuestion}
              setUserQuestion={setUserQuestion}
              placeholderIndex={placeholderIndex}
              onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
              onQuestionFocus={handleQuestionFocus}
              onQuestionBlur={handleQuestionBlur}
              coachRecommendation={coachRecommendation}
              applyCoachRecommendation={() => { applyCoachRecommendation(); setIsMobileSettingsOpen(false); }}
              dismissCoachRecommendation={dismissCoachRecommendation}
              onLaunchCoach={() => {
                setIsMobileSettingsOpen(false);
                openIntentionCoach();
              }}
              deckStyleId={deckStyleId}
              onDeckChange={handleDeckChange}
              initialMobileTab={mobileSettingsTab}
              hasKnocked={hasKnocked}
              handleKnock={handleKnock}
              cutIndex={cutIndex}
              setCutIndex={setCutIndex}
              hasCut={hasCut}
              applyCut={applyCut}
              knockCount={knockCount}
              onSkipRitual={() => {
                handleShuffle();
                setIsMobileSettingsOpen(false);
              }}
              deckAnnouncement={deckAnnouncement}
              shouldSkipRitual={shouldSkipRitual}
            />
          </MobileSettingsDrawer>
        </>
      )}

      {isIntentionCoachOpen && (
        <GuidedIntentionCoach
          isOpen={isIntentionCoachOpen}
          selectedSpread={selectedSpread}
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

      {/* Gesture coach for first-time ritual education */}
      <GestureCoachOverlay
        isOpen={shouldShowGestureCoachOverlay}
        onDismiss={handleGestureCoachDismiss}
      />
    </div>
  );
}
