import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sparkle, ArrowCounterClockwise, Star, CheckCircle, BookmarkSimple } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { getSpreadInfo, normalizeSpreadKey } from '../data/spreads';
import { ReadingGrid } from './ReadingGrid';
import { StreamingNarrative } from './StreamingNarrative';
import { HelperToggle } from './HelperToggle';
import { SpreadPatterns } from './SpreadPatterns';
import { VisionValidationPanel } from './VisionValidationPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { CardModal } from './CardModal';
import { DeckPile } from './DeckPile';
import { DeckRitual } from './DeckRitual';
import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSaveReading } from '../hooks/useSaveReading';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';

const NARRATIVE_STEPS = [
    { id: 'analyzing', label: 'Analyzing spread' },
    { id: 'drafting', label: 'Drafting narrative' },
    { id: 'polishing', label: 'Final polishing' }
];

export function ReadingDisplay({ sectionRef }) {
    const navigate = useNavigate();
    const { saveReading } = useSaveReading();

    // --- Contexts ---
    const {
        // Audio
        ttsState,
        showVoicePrompt,
        setShowVoicePrompt,
        handleNarrationButtonClick,
        handleNarrationStop,
        handleVoicePromptEnable,

        // Tarot State
        selectedSpread,
        reading,
        isShuffling,
        revealedCards,
        setRevealedCards,
        dealIndex: _dealIndex,
        setDealIndex,
        sessionSeed,
        userQuestion,
        shuffle,
        dealNext,
        revealCard,
        revealAll,

        // Ritual State (for DeckRitual)
        knockCount,
        hasKnocked: _hasKnocked,
        hasCut,
        cutIndex,
        setCutIndex,
        handleKnock,
        applyCut,

        // Vision
        visionResults,
        visionConflicts,
        isVisionReady,
        hasVisionData,
        handleVisionResults,
        handleRemoveVisionResult,
        handleClearVisionResults,
        feedbackVisionSummary,

        // Reading Generation & UI
        personalReading,
        isGenerating,
        analyzingText,
        narrativePhase,
        themes,
        emotionalTone,
        readingMeta,
        journalStatus,
        setJournalStatus: _setJournalStatus,
        reflections,
        setReflections,
        lastCardsForFeedback,
        generatePersonalReading,
        highlightItems
    } = useReading();

    const readingIdentity = useMemo(() => {
        const spreadKey = selectedSpread || 'unset-spread';
        const seed = sessionSeed || 'no-seed';
        const length = reading?.length ?? 0;
        return `${spreadKey}:${seed}:${length}`;
    }, [selectedSpread, sessionSeed, reading]);

    const [selectionState, setSelectionState] = useState({ key: readingIdentity, value: null });
    const [isNarrativeFocus, setIsNarrativeFocus] = useState(false);
    const selectedCardData = selectionState.key === readingIdentity ? selectionState.value : null;
    const setSelectedCardData = useCallback((value) => {
        setSelectionState({ key: readingIdentity, value });
    }, [readingIdentity]);

    const {
        voiceOn,
        autoNarrate,
        deckStyleId
    } = usePreferences();
    const { isAuthenticated } = useAuth();

    const { visionResearch: visionResearchEnabled, newDeckInterface } = useFeatureFlags();
    const isCompactScreen = useSmallScreen(768);
    const isLandscape = useLandscape();
    const safeSpreadKey = normalizeSpreadKey(selectedSpread);
    const spreadInfo = getSpreadInfo(safeSpreadKey);
    const canShowVisionPanel = visionResearchEnabled && isAuthenticated;

    // --- Derived State ---
    const isPersonalReadingError = Boolean(personalReading?.isError);
    const fullReadingText = !isPersonalReadingError ? personalReading?.raw || personalReading?.normalized || '' : '';
    const narrativeText = useMemo(() => {
        if (!personalReading) return '';
        if (personalReading.hasMarkdown) return personalReading.raw || personalReading.normalized || '';
        if (Array.isArray(personalReading.paragraphs) && personalReading.paragraphs.length > 0) {
            return personalReading.paragraphs.join('\n\n');
        }
        return personalReading.normalized || personalReading.raw || '';
    }, [personalReading]);
    const shouldStreamNarrative = Boolean(personalReading && !personalReading.isError);
    const phaseOrder = ['idle', 'analyzing', 'drafting', 'polishing', 'complete', 'error'];
    const currentPhaseIndex = phaseOrder.indexOf(narrativePhase);
    const hasPatternHighlights = Boolean(!isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length);
    const hasTraditionalInsights = Boolean(readingMeta?.graphContext?.retrievedPassages?.length);
    const hasHighlightPanel = Boolean(highlightItems?.length && revealedCards.size === reading?.length);
    const hasInsightPanels = hasPatternHighlights || hasTraditionalInsights || hasHighlightPanel || canShowVisionPanel;
    const focusToggleAvailable = hasInsightPanels && (isCompactScreen || isNarrativeFocus);
    const shouldShowSpreadInsights = !isNarrativeFocus && (hasPatternHighlights || hasHighlightPanel || hasTraditionalInsights);

    useEffect(() => {
        if (!hasInsightPanels && isNarrativeFocus) {
            setIsNarrativeFocus(false);
        }
    }, [hasInsightPanels, isNarrativeFocus]);

    // Memoize step states to avoid indexOf in render loop
    const stepStates = useMemo(() => {
        return NARRATIVE_STEPS.map((step, index) => {
            const stepIndex = phaseOrder.indexOf(step.id);
            const isDone = currentPhaseIndex > stepIndex && currentPhaseIndex !== -1;
            const isCurrent = currentPhaseIndex === stepIndex || (currentPhaseIndex === -1 && index === 0 && isGenerating);
            return { ...step, index, isDone, isCurrent };
        });
    }, [currentPhaseIndex, isGenerating]);

    // --- Handlers ---
    const handleNarrationWrapper = useCallback(() => {
        // Extract emotion from GraphRAG-derived emotional tone for TTS acting instructions
        const emotion = emotionalTone?.emotion || null;
        handleNarrationButtonClick(fullReadingText, isPersonalReadingError, emotion);
    }, [handleNarrationButtonClick, fullReadingText, isPersonalReadingError, emotionalTone]);

    const handleVoicePromptWrapper = useCallback(() => {
        const emotion = emotionalTone?.emotion || null;
        handleVoicePromptEnable(fullReadingText, emotion);
    }, [handleVoicePromptEnable, fullReadingText, emotionalTone]);

    const handleRevealAllWithScroll = useCallback(() => {
        revealAll();
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [revealAll, sectionRef]);

    const handleResetReveals = useCallback(() => {
        setRevealedCards(new Set());
        setDealIndex(0);
    }, [setRevealedCards, setDealIndex]);

    const handleCardClick = useCallback((card, position, index) => {
        setSelectedCardData({ card, position, index });
    }, [setSelectedCardData]);

    // Memoize next label computation to avoid IIFE in render
    const nextLabel = useMemo(() => {
        if (!reading) return null;
        const nextIndex = reading.findIndex((_, i) => !revealedCards.has(i));
        if (nextIndex === -1) return null;
        const pos = spreadInfo?.positions?.[nextIndex];
        return pos ? pos.split('—')[0].trim() : `Card ${nextIndex + 1}`;
    }, [reading, revealedCards, spreadInfo]);

    return (
        <section ref={sectionRef} id="step-reading" tabIndex={-1} className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]" aria-label="Draw and explore your reading">
            <div className={isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}>
                <p className="text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent">Reading</p>
                {!isLandscape && <p className="mt-1 text-muted-high text-xs sm:text-sm">Draw and reveal your cards, explore the spread, and weave your narrative.</p>}
            </div>
            {/* Primary CTA */}
            {!reading && (
                <div className="hidden sm:block text-center mb-8 sm:mb-10">
                    <button onClick={shuffle} disabled={isShuffling} className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                        <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                        <span>{isShuffling ? 'Shuffling the cards...' : 'Draw cards'}</span>
                    </button>
                </div>
            )}

            {canShowVisionPanel && !isNarrativeFocus && (
                <div className="mb-6">
                    <VisionValidationPanel
                        deckStyle={deckStyleId}
                        onResults={handleVisionResults}
                        onRemoveResult={handleRemoveVisionResult}
                        onClearResults={handleClearVisionResults}
                        conflicts={visionConflicts}
                        results={visionResults}
                    />
                </div>
            )}

            {/* Reading Display */}
            {reading && (
                <div className={isLandscape ? 'space-y-4' : 'space-y-8'}>
                    {userQuestion && !isLandscape && (<div className="text-center"><p className="text-muted text-sm italic">Intention: {userQuestion}</p></div>)}
                    <div className={`text-center text-accent font-serif mb-2 ${isLandscape ? 'text-lg' : 'text-2xl'}`}>{spreadInfo?.name || 'Tarot Spread'}</div>
                    {reading.length > 1 && !isLandscape && (<p className="text-center text-muted text-xs-plus sm:text-sm mb-4">Reveal in order for a narrative flow, or follow your intuition and reveal randomly.</p>)}

                    {revealedCards.size < reading.length && (
                        <div className="hidden sm:block text-center">
                            <button type="button" onClick={handleRevealAllWithScroll} className="bg-primary hover:bg-primary/90 text-surface font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-primary/30 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base">
                                <Star className="w-4 h-4 sm:w-5 sm:h-5" /><span>Reveal All Cards</span>
                            </button>
                            <p className="text-accent/80 text-xs sm:text-sm mt-2 sm:mt-3">{revealedCards.size} of {reading.length} cards revealed</p>
                        </div>
                    )}
                    {revealedCards.size > 0 && (
                        <div className="text-center mt-3 sm:mt-4">
                            <button type="button" onClick={handleResetReveals} className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-accent/50 text-muted text-xs sm:text-sm hover:text-main hover:border-accent/70 transition">
                                <span className="hidden xs:inline">Reset reveals (keep this spread)</span><span className="xs:hidden">Reset reveals</span>
                            </button>
                        </div>
                    )}
                    {reading && revealedCards.size < reading.length && (
                        newDeckInterface ? (
                            <DeckRitual
                                // Ritual state
                                knockCount={knockCount}
                                onKnock={handleKnock}
                                hasCut={hasCut}
                                cutIndex={cutIndex}
                                onCutChange={setCutIndex}
                                onCutConfirm={applyCut}
                                deckSize={78}
                                // Deal state
                                isShuffling={isShuffling}
                                onShuffle={shuffle}
                                cardsRemaining={reading.length - revealedCards.size}
                                nextPosition={nextLabel}
                                spreadPositions={spreadInfo?.positions || []}
                                revealedCount={revealedCards.size}
                                totalCards={reading.length}
                                // Deal action
                                onDeal={dealNext}
                            />
                        ) : (
                            <DeckPile
                                cardsRemaining={reading.length - revealedCards.size}
                                onDraw={dealNext}
                                isShuffling={isShuffling}
                                nextLabel={nextLabel}
                            />
                        )
                    )}

                    <ReadingGrid
                        selectedSpread={selectedSpread}
                        reading={reading}
                        revealedCards={revealedCards}
                        revealCard={revealCard}
                        reflections={reflections}
                        setReflections={setReflections}
                        onCardClick={handleCardClick}
                    />

                    {!personalReading && revealedCards.size === reading.length && (
                        <div className="text-center">
                            <button onClick={generatePersonalReading} disabled={isGenerating} className="bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-5 sm:px-8 py-3 sm:py-4 rounded-xl shadow-xl shadow-accent/20 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base md:text-lg">
                                <Sparkle className={`w-4 h-4 sm:w-5 sm:h-5 ${isGenerating ? 'motion-safe:animate-pulse' : ''}`} />
                                {isGenerating ? <span className="text-sm sm:text-base">Weaving your personalized reflection from this spread...</span> : <span>Create Personal Narrative</span>}
                            </button>
                            {hasVisionData && !isVisionReady && <p className="mt-3 text-sm text-muted">⚠️ Vision data has conflicts - research telemetry may be incomplete.</p>}
                            <HelperToggle className="mt-3 max-w-xl mx-auto"><p>Reveal all cards to unlock a tailored reflection that weaves positions, meanings, and your notes into one coherent story.</p></HelperToggle>
                        </div>
                    )}

                    {(isGenerating || (personalReading && !isPersonalReadingError)) && (
                        <div className="max-w-3xl mx-auto text-center">
                            <nav aria-label="Narrative generation progress" className={isLandscape ? 'mb-2' : 'mb-3'}>
                                <ol className={`flex items-center justify-center ${isLandscape ? 'gap-1' : 'gap-2 sm:gap-3'}`} role="list">
                                    {stepStates.map((step) => {
                                        const statusClass = step.isDone
                                            ? 'bg-primary/20 border-primary/70 text-main'
                                            : step.isCurrent
                                                ? 'bg-accent/20 border-accent/70 text-main'
                                                : 'bg-surface-muted/80 border-secondary/40 text-muted';
                                        return (
                                            <li
                                                key={step.id}
                                                className={`flex-1 rounded-full border font-semibold uppercase ${statusClass} ${isLandscape ? 'min-w-[4rem] px-1 py-1 text-[0.6rem] tracking-[0.04em]' : 'min-w-[5rem] px-1.5 sm:px-2 py-1.5 text-xs tracking-[0.06em]'}`}
                                                aria-current={step.isCurrent ? 'step' : undefined}
                                            >
                                                <span aria-hidden="true">{step.index + 1}</span>
                                                <span className="sr-only">Step {step.index + 1} of {stepStates.length}: </span>
                                                {!isLandscape && <span className="ml-1">{step.label}</span>}
                                                <span className="sr-only">
                                                    {step.isDone ? ' (completed)' : step.isCurrent ? ' (in progress)' : ' (pending)'}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </nav>
                            {isGenerating && (
                                <div className="ai-panel-modern">
                                    <div className="ai-panel-text" aria-live="polite">
                                        {analyzingText || 'Weaving your personalized narrative from this spread...'}
                                    </div>
                                    <HelperToggle className="mt-3">
                                        <p>This reflection is generated from your spread and question to support insight, not to decide for you.</p>
                                    </HelperToggle>
                                </div>
                            )}
                        </div>
                    )}

                    {personalReading && (
                        <div className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-5xl mx-auto ${isLandscape ? 'p-3' : 'p-5 sm:p-8'}`}>
                            {/* Narrative completion banner - shown when complete */}
                            {narrativePhase === 'complete' && !isPersonalReadingError && (
                                <div className="mb-5 p-4 bg-gradient-to-r from-primary/20 via-secondary/15 to-accent/20 border border-primary/30 rounded-xl animate-fade-in" role="status" aria-live="polite">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" weight="fill" />
                                            <div>
                                                <p className="text-sm font-semibold text-main">Your narrative is ready</p>
                                                <p className="text-xs text-muted">Save to your journal. Use controls below for narration.</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={saveReading}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/30 transition touch-manipulation"
                                        >
                                            <BookmarkSimple className="w-3.5 h-3.5" weight="fill" />
                                            <span>Save to Journal</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            <h3 className="text-xl sm:text-2xl font-serif text-accent mb-2 flex items-center gap-2"><Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />Your Personalized Narrative</h3>
                            <HelperToggle className="mt-3 max-w-2xl mx-auto"><p>This narrative braids together your spread positions, card meanings, and reflections into a single through-line. Read slowly, notice what resonates, and treat it as a mirror—not a script.</p></HelperToggle>
                            {userQuestion && (<div className="bg-surface/85 rounded-lg p-4 mb-4 border border-secondary/40"><p className="text-accent/85 text-xs sm:text-sm italic">Anchor: {userQuestion}</p></div>)}
                            {focusToggleAvailable && (
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        aria-pressed={isNarrativeFocus}
                                        onClick={() => setIsNarrativeFocus(prev => !prev)}
                                        className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-3 py-1.5 text-xs font-semibold text-muted hover:text-main hover:border-secondary/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
                                    >
                                        {isNarrativeFocus ? 'Show insight panels' : 'Focus on narrative'}
                                    </button>
                                </div>
                            )}
                            <StreamingNarrative
                                text={narrativeText}
                                useMarkdown={Boolean(personalReading?.hasMarkdown)}
                                isStreamingEnabled={shouldStreamNarrative}
                                autoNarrate={voiceOn && autoNarrate}
                                onNarrationStart={handleNarrationWrapper}
                            />
                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                                {reading && personalReading && !isPersonalReadingError && (
                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                        <button type="button" onClick={handleNarrationWrapper} className="px-3 sm:px-4 py-2 rounded-lg border border-secondary/40 bg-surface/85 hover:bg-surface/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main text-xs sm:text-sm" disabled={!fullReadingText || ttsState.status === 'loading'}>
                                            <span className="hidden xs:inline">{ttsState.status === 'loading' ? 'Preparing narration...' : ttsState.status === 'playing' ? 'Pause narration' : ttsState.status === 'paused' ? 'Resume narration' : 'Read this aloud'}</span>
                                            <span className="xs:hidden">{ttsState.status === 'loading' ? 'Loading...' : ttsState.status === 'playing' ? 'Pause' : ttsState.status === 'paused' ? 'Resume' : 'Play'}</span>
                                        </button>
                                        {(voiceOn && fullReadingText && (ttsState.status === 'playing' || ttsState.status === 'paused' || ttsState.status === 'loading')) && (
                                            <button type="button" onClick={handleNarrationStop} className="px-2 sm:px-3 py-2 rounded-lg border border-secondary/40 bg-surface/70 hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm">Stop</button>
                                        )}
                                        <button type="button" onClick={saveReading} className="inline-flex px-3 sm:px-4 py-2 rounded-lg bg-accent/15 border border-accent/40 text-accent text-xs sm:text-sm hover:bg-accent/25 hover:text-accent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="hidden xs:inline">Save this narrative to your journal</span><span className="xs:hidden">Save</span></button>
                                        <button type="button" onClick={() => navigate('/journal')} className="px-3 sm:px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs sm:text-sm hover:bg-primary/25 hover:text-primary transition">View Journal</button>
                                    </div>
                                )}
                                {showVoicePrompt && (
                                    <div className="text-xs text-muted bg-surface/70 border border-accent/30 rounded-lg px-3 py-2 text-center space-y-2" aria-live="polite">
                                        <p>Voice narration is disabled. Turn it on?</p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <button type="button" onClick={handleVoicePromptWrapper} className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/30 text-xs">Enable voice & play</button>
                                            <button type="button" onClick={() => setShowVoicePrompt(false)} className="px-3 py-1.5 rounded-full border border-accent/50 text-muted hover:text-main text-xs">Maybe later</button>
                                        </div>
                                    </div>
                                )}
                                {journalStatus && <p role="status" aria-live="polite" className={`text-xs text-center max-w-sm ${journalStatus.type === 'success' ? 'text-success' : 'text-error'}`}>{journalStatus.message}</p>}
                            </div>
                            <div className="mt-6 w-full max-w-2xl">
                                <FeedbackPanel
                                    requestId={readingMeta.requestId}
                                    spreadKey={readingMeta.spreadKey || selectedSpread}
                                    spreadName={readingMeta.spreadName || spreadInfo?.name}
                                    deckStyle={readingMeta.deckStyle || deckStyleId}
                                    provider={readingMeta.provider}
                                    userQuestion={readingMeta.userQuestion || userQuestion}
                                    cards={lastCardsForFeedback}
                                    visionSummary={feedbackVisionSummary}
                                />
                            </div>
                        </div>
                    )}

                    {shouldShowSpreadInsights && (
                        <div className="w-full max-w-5xl mx-auto">
                            <SpreadPatterns
                                themes={themes}
                                spreadHighlights={highlightItems}
                                passages={readingMeta?.graphContext?.retrievedPassages}
                            />
                        </div>
                    )}

                    {!personalReading && !isGenerating && (
                        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-secondary/40 max-w-2xl mx-auto">
                            <h3 className="text-lg sm:text-xl font-serif text-accent mb-2 sm:mb-3 flex items-center gap-2"><Star className="w-4 h-4 sm:w-5 sm:h-5" />Interpretation Guidance</h3>
                            <HelperToggle className="mt-2">
                                <p>Notice how the cards speak to one another. Consider themes, repetitions, contrasts, and where your attention is drawn. Trust your intuition as much as any description.</p>
                                <p className="mt-2">This reading offers reflective guidance only. It is not a substitute for medical, mental health, legal, financial, or safety advice. If your situation involves health, legal risk, abuse, or crisis, consider reaching out to qualified professionals or trusted support services.</p>
                            </HelperToggle>
                        </div>
                    )}

                    <div className="hidden sm:block text-center mt-6 sm:mt-8">
                        <button onClick={shuffle} disabled={isShuffling} className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                            <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                            <span className="hidden xs:inline">{isShuffling ? 'Shuffling the cards...' : 'Draw new reading'}</span>
                            <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'New reading'}</span>
                        </button>
                    </div>
                </div>
            )}

            {!reading && !isShuffling && (
                <div className="text-center py-16 px-4">
                    <p className="text-muted text-lg font-serif">Focus on your question, then draw your cards when you&apos;re ready.</p>
                </div>
            )}

            <AnimatePresence>
                {selectedCardData && (
                    <CardModal
                        card={selectedCardData.card}
                        position={selectedCardData.position}
                        isOpen={!!selectedCardData}
                        onClose={() => setSelectedCardData(null)}
                        layoutId={`card-${selectedCardData.index}`}
                    />
                )}
            </AnimatePresence>
        </section>
    );
}
