import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowCounterClockwise, Gear } from '@phosphor-icons/react';
import { SPREADS } from './data/spreads';
import { EXAMPLE_QUESTIONS } from './data/exampleQuestions';
import { SpreadSelector } from './components/SpreadSelector';
import { ReadingPreparation } from './components/ReadingPreparation';
import { ReadingDisplay } from './components/ReadingDisplay';
import { StepProgress } from './components/StepProgress';
import { GuidedIntentionCoach } from './components/GuidedIntentionCoach';
import { loadCoachRecommendation, saveCoachRecommendation } from './lib/journalInsights';
import { GlobalNav } from './components/GlobalNav';
import { UserMenu } from './components/UserMenu';
import { DeckSelector } from './components/DeckSelector';
import { MobileSettingsDrawer } from './components/MobileSettingsDrawer';
import { TableuLogo } from './components/TableuLogo';
import { useNavigate, useLocation } from 'react-router-dom';
import './styles/tarot.css';

// Hooks & Contexts
import { usePreferences } from './contexts/PreferencesContext';
import { useReading } from './contexts/ReadingContext';
import { useSaveReading } from './hooks/useSaveReading';

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
    includeMinors,
    deckSize,
    minorsDataIncomplete,
    reversalFramework,
    // UI State
    prepareSectionsOpen,
    togglePrepareSection
  } = usePreferences();

  // --- 2. Reading Context ---
  const {
    // Audio
    ttsState,
    ttsAnnouncement,
    showVoicePrompt,
    setShowVoicePrompt,
    speak,
    handleNarrationButtonClick,
    handleNarrationStop,
    handleVoicePromptEnable,

    // Tarot State
    selectedSpread,
    setSelectedSpread,
    reading,
    setReading,
    isShuffling,
    revealedCards,
    setRevealedCards,
    dealIndex,
    setDealIndex,
    hasKnocked,
    setHasKnocked,
    knockCount,
    setKnockCount,
    hasCut,
    setHasCut,
    cutIndex,
    setCutIndex,
    hasConfirmedSpread,
    setHasConfirmedSpread,
    sessionSeed,
    setSessionSeed,
    userQuestion,
    setUserQuestion,
    deckAnnouncement,
    shuffle,
    handleKnock,
    applyCut,
    dealNext,
    revealCard,
    revealAll,
    onSpreadConfirm,
    resetReadingState,
    knockTimesRef,

    // Vision
    visionResults,
    visionConflicts,
    isVisionReady,
    hasVisionData,
    handleVisionResults,
    handleRemoveVisionResult,
    handleClearVisionResults,
    ensureVisionProof,
    resetVisionProof,
    setVisionResults,
    setVisionConflicts,
    feedbackVisionSummary,
    getVisionConflictsForCards,

    // Reading Generation & UI
    personalReading, setPersonalReading,
    isGenerating, setIsGenerating,
    analyzingText, setAnalyzingText,
    spreadAnalysis, setSpreadAnalysis,
    themes, setThemes,
    analysisContext, setAnalysisContext,
    readingMeta, setReadingMeta,
    journalStatus, setJournalStatus,
    reflections, setReflections,
    lastCardsForFeedback, setLastCardsForFeedback,
    showAllHighlights, setShowAllHighlights,
    generatePersonalReading,
    highlightItems
  } = useReading();

  // --- 3. Local View State & Wiring ---
  // UI Specifics
  const [minorsFallbackWarning, setMinorsFallbackWarning] = useState(false);
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [coachRecommendation, setCoachRecommendation] = useState(null);
  const [isIntentionCoachOpen, setIsIntentionCoachOpen] = useState(false);
  const [allowPlaceholderCycle, setAllowPlaceholderCycle] = useState(true);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [shouldFocusSpread, setShouldFocusSpread] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const spreadSectionRef = useRef(null);
  const prepareSectionRef = useRef(null);
  const readingSectionRef = useRef(null);

  const stepSectionRefs = {
    spread: spreadSectionRef,
    intention: prepareSectionRef,
    ritual: prepareSectionRef,
    reading: readingSectionRef
  };

  // --- Effects & Helpers ---

  // Reset analysis state when Shuffle is triggered
  // (Handled in ReadingContext now, but we might need to clear local UI state if any)
  const handleShuffle = useCallback(() => {
    shuffle(); // Context handles the resets
  }, [shuffle]);

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

    // Check for passed state from Journal (Saved Intentions)
    if (location.state?.initialQuestion) {
      setUserQuestion(location.state.initialQuestion);
      setAllowPlaceholderCycle(false);
      // Clear state so it doesn't persist on refresh/nav
      window.history.replaceState({}, document.title);
    }

    const rec = loadCoachRecommendation();
    if (rec?.question) {
      setCoachRecommendation(rec);
    }
  }, [location.state, setUserQuestion]);

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
        setIsIntentionCoachOpen(true);
      }
    }
    window.addEventListener('keydown', handleCoachShortcut);
    return () => {
      window.removeEventListener('keydown', handleCoachShortcut);
    };
  }, [isIntentionCoachOpen]);

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
  }, [journalStatus]);

  // Reset Highlights on Spread Change
  useEffect(() => {
    setShowAllHighlights(false);
  }, [selectedSpread, reading]);

  // --- Handlers ---

  const handleDeckChange = (newDeckId) => {
    setDeckStyleId(newDeckId);
    setVisionResults([]);
    setVisionConflicts([]);
    resetVisionProof();
  };

  const handleSpreadSelection = (key) => {
    setSelectedSpread(key);
    // Reset Reading State driven by SpreadSelector
    // Note: SpreadSelector component currently does this via individual props
    // We will update SpreadSelector next to use cleaner props or context
    // For now, we are passing setters to SpreadSelector in the return below
    // but we need manual resets here if we change how SpreadSelector works
    resetReadingState(false); // Keep question
    setPersonalReading(null);
    setJournalStatus(null);
    setReflections({});
    setAnalyzingText('');
    setIsGenerating(false);
  };

  const handleCoachApply = (guidedQuestion) => {
    if (!guidedQuestion) return;
    setUserQuestion(guidedQuestion);
    setAllowPlaceholderCycle(false);
    setIsIntentionCoachOpen(false);
  };

  const applyCoachRecommendation = useCallback(() => {
    if (!coachRecommendation) return;
    setUserQuestion(coachRecommendation.question || '');
    if (coachRecommendation.spreadKey && SPREADS[coachRecommendation.spreadKey]) {
      setSelectedSpread(coachRecommendation.spreadKey);
    }
    setIsIntentionCoachOpen(true);
    saveCoachRecommendation(null);
    setCoachRecommendation(null);
  }, [coachRecommendation, setSelectedSpread, setUserQuestion]);

  const dismissCoachRecommendation = useCallback(() => {
    saveCoachRecommendation(null);
    setCoachRecommendation(null);
  }, []);

  const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const handleStepNav = (stepId) => {
    const target = stepSectionRefs[stepId]?.current;
    if (target && typeof target.scrollIntoView === 'function') {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      target.scrollIntoView({
        behavior,
        block: 'start'
      });
    }
  };

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

    return {
      intention: questionSummary,
      experience: `Voice: ${voiceOn ? 'On' : 'Off'} · Ambience: ${ambienceOn ? 'On' : 'Off'} · Deck: ${deckSummaryLabel}`,
      ritual: ritualSummary
    };
  }, [userQuestion, voiceOn, ambienceOn, deckSize, minorsDataIncomplete, knockCount, hasCut, cutIndex]);

  const prepareSectionLabels = {
    intention: { title: 'Intention', helper: 'Optional guiding prompt before you draw.' },
    experience: { title: 'Experience & preferences', helper: 'Voice, ambience, theme, reversals, and deck scope.' },
    ritual: { title: 'Ritual (optional)', helper: 'Knock, cut, or skip if that is not part of your practice.' }
  };

  // Determine Active Step for StepProgress
  const hasQuestion = Boolean(userQuestion && userQuestion.trim().length > 0);
  const hasRitualProgress = hasKnocked || hasCut || knockCount > 0;
  const hasReading = Boolean(reading && reading.length > 0);
  const allCardsRevealed = hasReading && revealedCards.size === reading.length;
  const hasNarrative = Boolean(personalReading && !personalReading.isError);
  const narrativeInProgress = isGenerating && !personalReading;
  const needsNarrativeGeneration = allCardsRevealed && (!personalReading || personalReading.isError);
  const isPersonalReadingError = Boolean(personalReading?.isError);

  const { stepIndicatorLabel, stepIndicatorHint, activeStep } = useMemo(() => {
    if (hasNarrative) return { stepIndicatorLabel: 'Reflect on your narrative', stepIndicatorHint: 'Read through the personalized guidance and save anything that resonates.', activeStep: 'reading' };
    if (narrativeInProgress) return { stepIndicatorLabel: 'Weaving your narrative', stepIndicatorHint: 'Hang tight while we compose your personalized reading.', activeStep: 'reading' };
    if (hasReading) {
      if (allCardsRevealed) return { stepIndicatorLabel: 'Explore your spread', stepIndicatorHint: 'Review the card insights below or generate a personalized narrative.', activeStep: 'reading' };
      return { stepIndicatorLabel: 'Reveal your cards', stepIndicatorHint: 'Flip each card to unfold the story of your spread.', activeStep: 'reading' };
    }
    if (!hasConfirmedSpread) return { stepIndicatorLabel: 'Choose your spread', stepIndicatorHint: 'Tap a spread that matches your focus to begin shaping the reading.', activeStep: 'spread' };
    if (!hasQuestion || !hasRitualProgress) return { stepIndicatorLabel: 'Prepare your reading', stepIndicatorHint: 'Set an intention, tune experience preferences, or complete the optional ritual.', activeStep: !hasQuestion ? 'intention' : 'ritual' };
    return { stepIndicatorLabel: 'Draw your cards', stepIndicatorHint: 'When you feel ready, draw the cards to begin your reading.', activeStep: 'reading' };
  }, [hasNarrative, narrativeInProgress, hasReading, allCardsRevealed, hasQuestion, hasRitualProgress, hasConfirmedSpread]);


  // --- Render Helper Wrappers ---

  return (
    <div className="app-shell min-h-screen bg-main text-main">
      <main className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 pt-6 pb-28 sm:py-8 lg:py-10">
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {[ttsAnnouncement, journalStatus?.message].filter(Boolean).join(' ')}
        </div>
 
        {/* Header */}
        <header aria-labelledby="tableau-heading">
          <div className="text-center mb-6 sm:mb-8 mystic-heading-wrap flex flex-col items-center">
            <TableuLogo
              variant="full"
              size={120}
              className="mb-3 opacity-90 hover:opacity-100 transition-opacity"
              ariaLabel="Tableu - Tarot Reading Application"
            />
            <h1 id="tableau-heading" className="sr-only">
              Tableu
            </h1>
            <p className="mt-2 text-muted text-sm sm:text-base md:text-lg">
              A picturesque grouping, analyzing many cards at once to reveal an artistic composition.
            </p>
          </div>
        </header>

        <div className="full-bleed sticky top-0 z-30 py-3 sm:py-4 mb-6 bg-surface/95 backdrop-blur border-y border-accent/20 px-4 sm:px-5 md:px-6">
          <div className="absolute right-4 top-3 sm:right-6 sm:top-4 z-50">
            <UserMenu />
          </div>
          <GlobalNav />
          <StepProgress steps={STEP_PROGRESS_STEPS} activeStep={activeStep} onSelect={handleStepNav} />
          {isShuffling && (
            <div className="mt-2 flex items-center gap-2 text-muted text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug" role="status" aria-live="polite">
              <ArrowCounterClockwise className="w-3.5 h-3.5 animate-spin text-accent" aria-hidden="true" />
              <span>Shuffling the deck...</span>
            </div>
          )}
        </div>

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

        {/* Step 1–3: Spread + Prepare */}
        <section className="mb-6 xl:mb-4" aria-label="Reading setup">
          <div className="mb-4 sm:mb-5">
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-accent/90">{stepIndicatorLabel}</p>
            <p className="mt-1 text-muted text-xs sm:text-sm">{stepIndicatorHint}</p>
          </div>

          <div className="max-w-5xl mx-auto space-y-6">
            <div className="modern-surface p-4 sm:p-6" aria-label="Choose your physical deck">
              <DeckSelector selectedDeck={deckStyleId} onDeckChange={handleDeckChange} />
            </div>

            <div aria-label="Choose your spread" ref={spreadSectionRef} id="step-spread" className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]">
              <div className="mb-3 sm:mb-4">
                <h2 className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-accent/90">Spread</h2>
                <p className="mt-1 text-muted text-xs sm:text-sm">Choose a spread to shape the depth and focus of your reading.</p>
              </div>
              <SpreadSelector
                selectedSpread={selectedSpread}
                setSelectedSpread={handleSpreadSelection}
                setReading={setReading}
                setRevealedCards={setRevealedCards}
                setPersonalReading={setPersonalReading}
                setJournalStatus={setJournalStatus}
                setAnalyzingText={setAnalyzingText}
                setIsGenerating={setIsGenerating}
                setDealIndex={setDealIndex}
                setReflections={setReflections}
                setHasKnocked={setHasKnocked}
                setHasCut={setHasCut}
                setCutIndex={setCutIndex}
                knockTimesRef={knockTimesRef}
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
              onLaunchCoach={() => setIsIntentionCoachOpen(true)}
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

      {/* Mobile Nav - Keeping internal logic simple for now */}
      {!isIntentionCoachOpen && (
        <nav className="mobile-action-bar sm:hidden" aria-label="Primary mobile actions">
          <div className="flex flex-wrap gap-2">
            {isShuffling && <button disabled className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg flex-col gap-0.5 opacity-50"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Shuffling...</span></button>}

            {!isShuffling && !reading && (
              <>
                <button onClick={() => setIsMobileSettingsOpen(true)} className="flex-none w-[3.5rem] inline-flex items-center justify-center rounded-xl px-0 py-2.5 text-sm font-semibold transition bg-surface-muted text-accent border border-accent/30 hover:bg-surface flex-col gap-0.5" aria-label="Settings">
                  <Gear className="w-5 h-5" />
                </button>
                <button onClick={handleShuffle} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Draw cards</span></button>
              </>
            )}

            {reading && revealedCards.size < reading.length && (
              <>
                <button onClick={dealNext} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Reveal next ({Math.min(dealIndex + 1, reading.length)}/{reading.length})</span></button>
                {reading.length > 1 && <button onClick={() => {
                  revealAll();
                  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
                  readingSectionRef.current?.scrollIntoView({ behavior, block: 'start' });
                }} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Reveal all</span></button>}
              </>
            )}

            {reading && revealedCards.size === reading.length && (
              <>
                {needsNarrativeGeneration && <button onClick={generatePersonalReading} disabled={isGenerating} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">{isGenerating ? 'Weaving...' : 'Create narrative'}</span></button>}
                {hasNarrative && !isPersonalReadingError && <button onClick={saveReading} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-accent text-surface shadow-lg hover:opacity-90 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Save to journal</span></button>}
                <button onClick={handleShuffle} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-surface-muted text-accent border border-accent/30 hover:bg-surface flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] opacity-70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">New reading</span></button>
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
          onClose={() => setIsIntentionCoachOpen(false)}
          onApply={handleCoachApply}
        />
      )}
    </div>
  );
}
