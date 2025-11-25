import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Gear, Sparkle, Lightning } from '@phosphor-icons/react';
import { SPREADS } from './data/spreads';
import { EXAMPLE_QUESTIONS } from './data/exampleQuestions';
import { SpreadSelector } from './components/SpreadSelector';
import { ReadingPreparation } from './components/ReadingPreparation';
import { ReadingDisplay } from './components/ReadingDisplay';
import { GuidedIntentionCoach } from './components/GuidedIntentionCoach';
import { loadCoachRecommendation, saveCoachRecommendation } from './lib/journalInsights';
import { DeckSelector } from './components/DeckSelector';
import { MobileSettingsDrawer } from './components/MobileSettingsDrawer';
import { MobilePrepSummary } from './components/MobilePrepSummary';
import { Header } from './components/Header';
import { useNavigate, useLocation } from 'react-router-dom';
import './styles/tarot.css';

// Hooks & Contexts
import { usePreferences } from './contexts/PreferencesContext';
import { useReading } from './contexts/ReadingContext';
import { useSaveReading } from './hooks/useSaveReading';
import { useReducedMotion } from './hooks/useReducedMotion';

const STEP_PROGRESS_STEPS = [
  { id: 'spread', label: 'Spread' },
  { id: 'intention', label: 'Question' },
  { id: 'ritual', label: 'Ritual (optional)' },
  { id: 'reading', label: 'Reading' }
];

export default function TarotReading() {
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
    togglePrepareSection
  } = usePreferences();

  // Accessibility: reduced motion preference
  const prefersReducedMotion = useReducedMotion();

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
    isShuffling,
    revealedCards,
    dealIndex,
    hasKnocked,
    knockCount,
    hasCut,
    cutIndex,
    setCutIndex,
    hasConfirmedSpread,
    userQuestion,
    setUserQuestion,
    deckAnnouncement,
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
    isGenerating,
    setIsGenerating,
    setAnalyzingText,
    journalStatus,
    setJournalStatus,
    setReflections,
    setShowAllHighlights,
    generatePersonalReading
  } = useReading();

  // --- 3. Local View State & Wiring ---
  // UI Specifics
  const [minorsFallbackWarning, setMinorsFallbackWarning] = useState(false);
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [coachRecommendation, setCoachRecommendation] = useState(null);
  const [pendingCoachPrefill, setPendingCoachPrefill] = useState(null);
  const [isIntentionCoachOpen, setIsIntentionCoachOpen] = useState(false);
  const [allowPlaceholderCycle, setAllowPlaceholderCycle] = useState(true);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [shouldFocusSpread, setShouldFocusSpread] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const spreadSectionRef = useRef(null);
  const prepareSectionRef = useRef(null);
  const readingSectionRef = useRef(null);

  // --- Effects & Helpers ---

  // Reset analysis state when Shuffle is triggered
  // (Handled in ReadingContext now, but we might need to clear local UI state if any)
  const handleShuffle = useCallback(() => {
    shuffle(); // Context handles the resets
  }, [shuffle]);

  // Quick Start state - triggers shuffle after spread is set
  const [quickStartPending, setQuickStartPending] = useState(false);

  // Quick Start: Auto-select three-card spread and draw immediately
  const handleQuickStart = useCallback(() => {
    // Select three-card spread
    selectSpread('threeCard');
    // Confirm the spread selection
    onSpreadConfirm();
    // Reset narrative/analysis state
    setPersonalReading(null);
    setJournalStatus(null);
    setReflections({});
    setAnalyzingText('');
    setIsGenerating(false);
    // Mark quick start as pending - effect will trigger shuffle
    setQuickStartPending(true);
  }, [selectSpread, onSpreadConfirm, setPersonalReading, setJournalStatus, setReflections, setAnalyzingText, setIsGenerating]);

  // Effect to complete quick start after state is set
  useEffect(() => {
    if (quickStartPending && hasConfirmedSpread && selectedSpread === 'threeCard') {
      setQuickStartPending(false);
      shuffle();
    }
  }, [quickStartPending, hasConfirmedSpread, selectedSpread, shuffle]);

  // Sync Minor Arcana dataset warning
  useEffect(() => {
    setMinorsFallbackWarning(minorsDataIncomplete);
  }, [minorsDataIncomplete]);

  // Check API health
  useEffect(() => {
    async function checkApiHealth() {
      try {
        const [tarotHealth, ttsHealth] = await Promise.all([
          fetch('/api/health/tarot-reading', { method: 'GET', cache: 'no-store' }).catch(() => null),
          fetch('/api/health/tts', { method: 'GET', cache: 'no-store' }).catch(() => null)
        ]);
        const anthropicAvailable = tarotHealth?.ok ?? false;
        const azureAvailable = ttsHealth?.ok ?? false;
        if (!anthropicAvailable || !azureAvailable) {
          setApiHealthBanner({
            anthropic: anthropicAvailable,
            azure: azureAvailable,
            message: 'Using local services' +
              (!anthropicAvailable ? ' (Claude unavailable)' : '') +
              (!azureAvailable ? ' (Azure TTS unavailable)' : '')
          });
        } else {
          setApiHealthBanner(null);
        }
      } catch (err) {
        console.debug('API health check failed:', err);
      }
    }
    checkApiHealth();
  }, []);

  // Coach Recommendation Loading
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (location.state?.initialQuestion) {
      setUserQuestion(location.state.initialQuestion);
      setAllowPlaceholderCycle(false);
      const nextState = { ...location.state };
      delete nextState.initialQuestion;
      const cleanedState = Object.keys(nextState).length > 0 ? nextState : null;
      navigate(location.pathname, { replace: true, state: cleanedState });
    }

    const rec = loadCoachRecommendation();
    if (rec?.question) {
      setCoachRecommendation(rec);
    }
  }, [location.pathname, location.state, navigate, setUserQuestion]);

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
        setPendingCoachPrefill(null);
        setIsIntentionCoachOpen(true);
      }
    }
    window.addEventListener('keydown', handleCoachShortcut);
    return () => {
      window.removeEventListener('keydown', handleCoachShortcut);
    };
  }, [isIntentionCoachOpen, setPendingCoachPrefill]);

  // Placeholder Cycle
  useEffect(() => {
    const trimmedQuestion = userQuestion.trim();
    if (!allowPlaceholderCycle || trimmedQuestion) {
      return undefined;
    }
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [allowPlaceholderCycle, userQuestion]);

  useEffect(() => {
    if (!userQuestion.trim() && !allowPlaceholderCycle) {
      setAllowPlaceholderCycle(true);
    }
  }, [allowPlaceholderCycle, userQuestion]);

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

  const handleDeckChange = (newDeckId) => {
    setDeckStyleId(newDeckId);
    setVisionResults([]);
    setVisionConflicts([]);
    resetVisionProof();
  };

  const handleSpreadSelection = (key) => {
    // Use the centralized selectSpread from useTarotState
    selectSpread(key);
    // Reset narrative/analysis state
    setPersonalReading(null);
    setJournalStatus(null);
    setReflections({});
    setAnalyzingText('');
    setIsGenerating(false);
  };

  const handleCoachClose = useCallback(() => {
    setIsIntentionCoachOpen(false);
    setPendingCoachPrefill(null);
  }, []);

  const handleCoachApply = (guidedQuestion) => {
    if (!guidedQuestion) return;
    setUserQuestion(guidedQuestion);
    setAllowPlaceholderCycle(false);
    handleCoachClose();
  };

  const applyCoachRecommendation = useCallback(() => {
    if (!coachRecommendation) return;
    setUserQuestion(coachRecommendation.question || '');
    if (coachRecommendation.spreadKey && SPREADS[coachRecommendation.spreadKey]) {
      selectSpread(coachRecommendation.spreadKey);
    }
    setPendingCoachPrefill(coachRecommendation);
    setIsIntentionCoachOpen(true);
    saveCoachRecommendation(null);
    setCoachRecommendation(null);
  }, [coachRecommendation, selectSpread, setPendingCoachPrefill, setUserQuestion]);

  const dismissCoachRecommendation = useCallback(() => {
    saveCoachRecommendation(null);
    setCoachRecommendation(null);
  }, []);

  const handleStepNav = useCallback((stepId) => {
    // On mobile (< 640px), open the settings drawer for intention/ritual steps
    // since the prep section is hidden on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    if (isMobile && (stepId === 'intention' || stepId === 'ritual')) {
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
  }, [prefersReducedMotion]);

  // Handle navigation requests passed via router state (e.g., from Journal empty state)
  useEffect(() => {
    if (!location.state?.focusSpread) {
      return;
    }

    setShouldFocusSpread(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!shouldFocusSpread) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleStepNav('spread');
      setShouldFocusSpread(false);
    }, 40);

    return () => window.clearTimeout(timeoutId);
  }, [shouldFocusSpread, handleStepNav]);

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
    const ritualSummary = knockCount === 0 && !hasCut
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
  }, [userQuestion, voiceOn, ambienceOn, theme, deckSize, minorsDataIncomplete, knockCount, hasCut, cutIndex]);

  const prepareSectionLabels = {
    intention: { title: 'Intention', helper: 'Optional guiding prompt before you draw.' },
    audio: { title: 'Audio', helper: 'Voice narration and ambient soundscape.' },
    experience: { title: 'Experience', helper: 'Theme, deck scope, and reversal interpretation lens.' },
    ritual: { title: 'Ritual (optional)', helper: 'Knock, cut, or skip if that is not part of your practice.' }
  };

  // Determine Active Step for StepProgress
  // These are milestone-based flags that represent permanent progress through the flow
  const hasQuestion = Boolean(userQuestion && userQuestion.trim().length > 0);
  const hasReading = Boolean(reading && reading.length > 0);
  const allCardsRevealed = hasReading && revealedCards.size === reading.length;
  const hasNarrative = Boolean(personalReading && !personalReading.isError);
  const narrativeInProgress = isGenerating && !personalReading;
  const needsNarrativeGeneration = allCardsRevealed && (!personalReading || personalReading.isError);
  const isPersonalReadingError = Boolean(personalReading?.isError);

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
        stepIndicatorLabel: 'Choose your spread',
        stepIndicatorHint: 'Select a spread that matches the depth of your inquiry.',
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
        stepIndicatorHint: `${3 - knockCount} more knock${3 - knockCount === 1 ? '' : 's'} to clear the deck, or skip to draw.`,
        activeStep: 'ritual'
      };
    }

    // Ready to draw - either ritual complete/skipped or no ritual started
    return {
      stepIndicatorLabel: 'Draw your cards',
      stepIndicatorHint: 'When you feel ready, draw the cards to begin your reading.',
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
      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 pt-6 pb-28 sm:py-8 lg:py-10">
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
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
              <div className="text-accent text-xs sm:text-sm">
                <span className="font-semibold">Service Status:</span>{' '}
                <span className="sm:hidden">Local fallbacks active</span>
                <span className="hidden sm:inline">{apiHealthBanner.message}</span>
              </div>
            </div>
            <div className="mt-2 text-muted text-xs">
              {!apiHealthBanner.anthropic && <div>• Claude AI: Using local composer</div>}
              {!apiHealthBanner.azure && <div>• Azure TTS: Using local audio</div>}
              <div className="mt-1">All readings remain fully functional with local fallbacks.</div>
            </div>
          </div>
        )}

        {minorsFallbackWarning && (
          <div className="mb-6 p-4 bg-error/10 border border-error/40 rounded-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-error animate-pulse"></div>
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

        {/* Quick Start CTA - only show when no reading is in progress */}
        {!reading && !isShuffling && (
          <div className="mb-6 text-center">
            <button
              type="button"
              onClick={handleQuickStart}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary/20 border border-secondary/40 text-secondary hover:bg-secondary/30 transition-all text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary touch-manipulation"
            >
              <Lightning className="w-4 h-4" weight="fill" />
              <span>Quick three-card reading</span>
            </button>
            <p className="mt-2 text-xs text-muted">Skip setup and draw immediately</p>
          </div>
        )}

        {/* Step 1–3: Spread + Prepare */}
        <section className="mb-6 xl:mb-4" aria-label="Reading setup">
          <div className="mb-4 sm:mb-5">
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent">{stepIndicatorLabel}</p>
            <p className="mt-1 text-muted-high text-xs sm:text-sm">{stepIndicatorHint}</p>
          </div>

          <div className="max-w-5xl mx-auto space-y-6">
            <div className="modern-surface p-4 sm:p-6" aria-label="Choose your physical deck">
              <DeckSelector selectedDeck={deckStyleId} onDeckChange={handleDeckChange} />
            </div>

            {/* Mobile-only prep summary - visible inline to address UX finding */}
            <MobilePrepSummary
              userQuestion={userQuestion}
              knockCount={knockCount}
              hasCut={hasCut}
              cutIndex={cutIndex}
              onOpenSettings={() => setIsMobileSettingsOpen(true)}
            />

            <div aria-label="Choose your spread" ref={spreadSectionRef} id="step-spread" tabIndex={-1} className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]">
              <div className="mb-3 sm:mb-4">
                <h2 className="text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent">Spread</h2>
                <p className="mt-1 text-muted-high text-xs sm:text-sm">Choose a spread to shape the depth and focus of your reading.</p>
              </div>
              <SpreadSelector
                selectedSpread={selectedSpread}
                onSelectSpread={handleSpreadSelection}
                onSpreadConfirm={onSpreadConfirm}
              />
            </div>

            <ReadingPreparation
              sectionRef={prepareSectionRef}
              userQuestion={userQuestion}
              setUserQuestion={setUserQuestion}
              placeholderIndex={placeholderIndex}
              onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
              setAllowPlaceholderCycle={setAllowPlaceholderCycle}
              coachRecommendation={coachRecommendation}
              applyCoachRecommendation={applyCoachRecommendation}
              dismissCoachRecommendation={dismissCoachRecommendation}
              onLaunchCoach={() => {
                setPendingCoachPrefill(null);
                setIsIntentionCoachOpen(true);
              }}
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
            />

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => handleStepNav('reading')}
                className="text-sm text-secondary hover:text-main underline underline-offset-4"
              >
                Ready? Jump to draw cards
              </button>
            </div>
          </div>
        </section>

        <ReadingDisplay sectionRef={readingSectionRef} />
      </main>

      {/* Mobile Nav - Hidden when full-screen surfaces (coach or settings drawer) are open */}
      {!isIntentionCoachOpen && !isMobileSettingsOpen && (
        <nav
          className="mobile-action-bar sm:hidden"
          aria-label="Primary mobile actions"
          style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
        >
          <div className="flex flex-wrap gap-2">
            {isShuffling && <button disabled className="flex-1 min-w-[7.5rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg flex-col gap-0.5 opacity-50 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Shuffling...</span></button>}

            {!isShuffling && !reading && (
              <>
                <button onClick={() => setIsMobileSettingsOpen(true)} className="flex-none w-[3rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-0 py-2.5 text-sm font-semibold transition bg-surface-muted text-accent border border-accent/30 hover:bg-surface touch-manipulation" aria-label="Settings">
                  <Gear className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setPendingCoachPrefill(null);
                    setIsIntentionCoachOpen(true);
                  }}
                  className="flex-none min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-secondary/20 text-secondary border border-secondary/40 hover:bg-secondary/30 touch-manipulation"
                  aria-label="Open guided intention coach"
                >
                  <Sparkle className="w-4 h-4" weight="fill" />
                  <span className="text-xs font-semibold">Coach</span>
                </button>
                <button onClick={handleShuffle} className="flex-1 min-w-[6rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Draw cards</span></button>
              </>
            )}

            {reading && revealedCards.size < reading.length && (
              <>
                <button onClick={dealNext} className="flex-1 min-w-[7.5rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Reveal next ({Math.min(dealIndex + 1, reading.length)}/{reading.length})</span></button>
                {reading.length > 1 && <button onClick={() => {
                  revealAll();
                  const behavior = prefersReducedMotion ? 'auto' : 'smooth';
                  readingSectionRef.current?.scrollIntoView({ behavior, block: 'start' });
                }} className="flex-1 min-w-[7.5rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 flex-col gap-0.5 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Reveal all</span></button>}
              </>
            )}

            {reading && revealedCards.size === reading.length && (
              <>
                {needsNarrativeGeneration && <button onClick={generatePersonalReading} disabled={isGenerating} className="flex-1 min-w-[7.5rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">{isGenerating ? 'Weaving...' : 'Create narrative'}</span></button>}
                {hasNarrative && !isPersonalReadingError && <button onClick={saveReading} className="flex-1 min-w-[7.5rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Save to journal</span></button>}
                <button onClick={handleShuffle} className="flex-1 min-w-[7.5rem] min-h-[44px] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-surface-muted text-accent border border-accent/30 hover:bg-surface flex-col gap-0.5 touch-manipulation"><span className="text-xs uppercase tracking-wider opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">New reading</span></button>
              </>
            )}
          </div>
        </nav>
      )}

      <MobileSettingsDrawer isOpen={isMobileSettingsOpen} onClose={() => setIsMobileSettingsOpen(false)}>
        <ReadingPreparation
          variant="mobile"
          userQuestion={userQuestion}
          setUserQuestion={setUserQuestion}
          placeholderIndex={placeholderIndex}
          onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
          setAllowPlaceholderCycle={setAllowPlaceholderCycle}
          coachRecommendation={coachRecommendation}
          applyCoachRecommendation={() => { applyCoachRecommendation(); setIsMobileSettingsOpen(false); }}
          dismissCoachRecommendation={dismissCoachRecommendation}
          onLaunchCoach={() => {
            setIsMobileSettingsOpen(false);
            setPendingCoachPrefill(null);
            setIsIntentionCoachOpen(true);
          }}
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
        />
      </MobileSettingsDrawer>

      {isIntentionCoachOpen && (
        <GuidedIntentionCoach
          isOpen={isIntentionCoachOpen}
          selectedSpread={selectedSpread}
          onClose={handleCoachClose}
          onApply={handleCoachApply}
          prefillRecommendation={pendingCoachPrefill || coachRecommendation}
        />
      )}
    </div>
  );
}
