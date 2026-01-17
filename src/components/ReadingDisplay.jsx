import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkle, ArrowCounterClockwise, Star, BookmarkSimple, ChatCircle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { getSpreadInfo, normalizeSpreadKey } from '../data/spreads';
import { ReadingBoard } from './ReadingBoard';
import { StreamingNarrative } from './StreamingNarrative';
import { HelperToggle } from './HelperToggle';
import { MobileInfoSection } from './MobileInfoSection';
import { SpreadPatterns } from './SpreadPatterns';
import { VisionValidationPanel } from './VisionValidationPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { CardModal } from './CardModal';
import { NarrativeSkeleton } from './NarrativeSkeleton';
import { DeckPile } from './DeckPile';
import { DeckRitual } from './DeckRitual';
import { RitualNudge, JournalNudge } from './nudges';
import { MoonPhaseIndicator } from './MoonPhaseIndicator';
import FollowUpModal from './FollowUpModal';
import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSaveReading } from '../hooks/useSaveReading';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext.jsx';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Ghost card component for deck-to-slot fly animation.
 * Renders via portal to animate in screen space above all other content.
 */
function GhostCard({ startRect, endRect, onComplete }) {
  const duration = 0.35; // 350ms
    const safeStartWidth = Math.max(1, startRect?.width || 0);
    const safeStartHeight = Math.max(1, startRect?.height || 0);
    const endScaleX = Math.max(0.01, (endRect?.width || 0) / safeStartWidth);
    const endScaleY = Math.max(0.01, (endRect?.height || 0) / safeStartHeight);

  return createPortal(
    <motion.div
            className="fixed left-0 top-0 pointer-events-none z-[200]"
            style={{
                width: safeStartWidth,
                height: safeStartHeight,
                transformOrigin: '0 0',
                willChange: 'transform, opacity'
            }}
            initial={{
                x: startRect.left,
                y: startRect.top,
                opacity: 1,
                scaleX: 1,
                scaleY: 1
            }}
            animate={{
                x: endRect.left,
                y: endRect.top,
                opacity: 0,
                scaleX: endScaleX * 0.95,
                scaleY: endScaleY * 0.95
            }}
      transition={{
        duration,
        ease: [0.32, 0.72, 0, 1], // Custom ease-out curve
        opacity: { duration: duration * 0.4, delay: duration * 0.6 },
                scaleX: { duration: duration * 0.3, delay: duration * 0.7 },
                scaleY: { duration: duration * 0.3, delay: duration * 0.7 }
      }}
      onAnimationComplete={onComplete}
    >
      {/* Card back visual */}
      <div
        className="w-full h-full rounded-xl border-2 border-primary/40 overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 30px color-mix(in srgb, var(--brand-primary) 15%, transparent)',
        }}
      >
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, var(--brand-secondary) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />
        {/* Center glow */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(var(--brand-primary-rgb), 0.15), transparent 70%)',
          }}
        />
      </div>
    </motion.div>,
    document.body
  );
}

function NarrativeGuidancePanel({ toneLabel, frameLabel, isHandset, isNewbie, compact = false, className = '' }) {
  const guidanceContent = (
    <div className="space-y-2">
      <p className="text-sm text-muted leading-relaxed">
        This narrative braids together your spread positions, card meanings, and reflections into a single through-line. Read slowly, notice echoes and contrasts between cards, and trust what resonates more than any script.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        {`Style: a ${toneLabel.toLowerCase()} tone with a ${frameLabel.toLowerCase()} lens. Let your own sense of meaning carry as much weight as any description.`}
      </p>
      <p className="text-xs sm:text-sm text-muted/90 leading-relaxed">
        Reflective guidance only—not medical, mental health, legal, financial, or safety advice.
      </p>
    </div>
  );

  const headingClass = compact
    ? 'text-sm sm:text-base font-serif text-accent/90 flex items-center gap-2'
    : 'text-base sm:text-lg font-serif text-accent flex items-center gap-2';

  return (
    <div className={`${compact ? 'space-y-1.5 sm:space-y-2' : 'space-y-2 sm:space-y-3'} ${className}`}>
      {!isHandset && (
        <h3 className={headingClass}>
          <Star className={compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} />
          Narrative style & guidance
        </h3>
      )}
      {isHandset ? (
        <MobileInfoSection
          title="Narrative style & guidance"
          variant="block"
          defaultOpen={isNewbie}
          buttonClassName={compact ? 'border-secondary/25 bg-surface/40 text-sm' : ''}
          contentClassName={compact ? 'bg-transparent border-transparent px-0 py-0 text-sm' : ''}
        >
          {guidanceContent}
        </MobileInfoSection>
      ) : (
        <HelperToggle
          className={compact ? 'mt-1' : 'mt-2'}
          defaultOpen={isNewbie}
          buttonClassName={compact ? 'px-0 text-xs sm:text-sm' : ''}
          contentClassName={compact ? 'bg-transparent border-transparent p-0' : ''}
        >
          {guidanceContent}
        </HelperToggle>
      )}
    </div>
  );
}

export function ReadingDisplay({
    sectionRef,
    onOpenFollowUp,
    followUpOpen,
    onFollowUpOpenChange,
    followUpAutoFocus = true
}) {
    const navigate = useNavigate();
    const { saveReading, isSaving } = useSaveReading();
    const { publish: publishToast } = useToast();

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
        isReadingStreamActive,
        narrativePhase,
        themes,
        emotionalTone,
        reasoningSummary,
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
    const [isFollowUpOpenLocal, setIsFollowUpOpenLocal] = useState(false);
    const isFollowUpOpen = typeof followUpOpen === 'boolean' ? followUpOpen : isFollowUpOpenLocal;
    const setIsFollowUpOpen = onFollowUpOpenChange || setIsFollowUpOpenLocal;
    const selectedCardData = selectionState.key === readingIdentity ? selectionState.value : null;
    const setSelectedCardData = useCallback((value) => {
        setSelectionState({ key: readingIdentity, value });
    }, [readingIdentity]);
    const [focusedCardData, setFocusedCardData] = useState(null);
    const [recentlyClosedIndex, setRecentlyClosedIndex] = useState(-1);
    const activeFocusedCardData = useMemo(() => {
        if (!focusedCardData) return null;
        if (focusedCardData.readingKey && focusedCardData.readingKey !== readingIdentity) return null;
        if (!revealedCards.has(focusedCardData.index)) return null;
        return focusedCardData;
    }, [focusedCardData, readingIdentity, revealedCards]);


    // Ghost card animation state for deck-to-slot fly animation
    const deckRef = useRef(null);
    const [ghostAnimation, setGhostAnimation] = useState(null);

    const {
        voiceOn,
        autoNarrate,
        deckStyleId,
        personalization,
        // Nudge state (contextual discovery)
        shouldShowRitualNudge,
        shouldShowJournalNudge,
        markRitualNudgeSeen,
        markJournalNudgeSeen,
        incrementReadingCount,
        nudgeState
    } = usePreferences();
    const displayName = personalization?.displayName?.trim();
    const _isExperienced = personalization?.tarotExperience === 'experienced';
    const isNewbie = personalization?.tarotExperience === 'newbie';
    const readingTone = personalization?.readingTone || 'balanced';
    const spiritualFrame = personalization?.spiritualFrame || 'mixed';
    const { isAuthenticated } = useAuth();

    // Labels for narrative styling
    const TONE_LABELS = { gentle: 'Gentle', balanced: 'Balanced', blunt: 'Direct' };
    const FRAME_LABELS = { psychological: 'Psychological', spiritual: 'Spiritual', mixed: 'Balanced', playful: 'Playful' };
    const toneLabel = TONE_LABELS[readingTone] || 'Balanced';
    const frameLabel = FRAME_LABELS[spiritualFrame] || 'Balanced';

    const { visionResearch: visionResearchEnabled, newDeckInterface } = useFeatureFlags();
    const isCompactScreen = useSmallScreen(768);
    const isLandscape = useLandscape();
    const isHandsetLayout = useHandsetLayout();
    const isHandset = isCompactScreen || isLandscape || isHandsetLayout;
    const prefersReducedMotion = useReducedMotion();
    const safeSpreadKey = normalizeSpreadKey(selectedSpread);
    const spreadInfo = getSpreadInfo(safeSpreadKey);
    const canShowVisionPanel = visionResearchEnabled && isAuthenticated;

    // --- Derived State ---
    const isPersonalReadingError = Boolean(personalReading?.isError);
    const isReadingStreaming = Boolean(isReadingStreamActive || personalReading?.isStreaming);
    const isServerStreamed = Boolean(personalReading?.isServerStreamed);
    const fullReadingText = !isPersonalReadingError && !isReadingStreaming
        ? personalReading?.raw || personalReading?.normalized || ''
        : '';
    const narrativeText = useMemo(() => {
        if (!personalReading) return '';
        if (personalReading.hasMarkdown) return personalReading.raw || personalReading.normalized || '';
        if (Array.isArray(personalReading.paragraphs) && personalReading.paragraphs.length > 0) {
            return personalReading.paragraphs.join('\n\n');
        }
        return personalReading.normalized || personalReading.raw || '';
    }, [personalReading]);

    const narrativeHighlightPhrases = useMemo(() => {
        if (!Array.isArray(reading) || reading.length === 0) return [];
        const names = reading
            .map(card => (typeof card?.name === 'string' ? card.name.trim() : ''))
            .filter(Boolean);
        return Array.from(new Set(names));
    }, [reading]);
    const revealStage = useMemo(() => {
        if (!isHandset || !newDeckInterface || !reading || reading.length === 0) return 'action';
        if (revealedCards.size === 0) return 'deck';
        if (revealedCards.size < reading.length) return 'spread';
        return 'action';
    }, [isHandset, newDeckInterface, reading, revealedCards]);
    const shouldStreamNarrative = Boolean(personalReading && !personalReading.isError && !isReadingStreaming && !isServerStreamed);
    const hasPatternHighlights = Boolean(!isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length);
    const hasTraditionalInsights = Boolean(readingMeta?.graphContext?.retrievedPassages?.length);
    const hasHighlightPanel = Boolean(highlightItems?.length && revealedCards.size === reading?.length);
    const hasInsightPanels = hasPatternHighlights || hasTraditionalInsights || hasHighlightPanel || canShowVisionPanel;
    // Only show focus toggle on desktop; on mobile, panels are below the narrative so users can scroll past them
    const focusToggleAvailable = hasInsightPanels && !isHandset;
    const shouldShowSpreadInsights = !isNarrativeFocus && (hasPatternHighlights || hasHighlightPanel || hasTraditionalInsights);
    const canAutoNarrate = voiceOn && autoNarrate && narrativePhase === 'complete' && !isReadingStreaming;

    // Track previous hasInsightPanels for render-time state adjustment
    const [prevHasInsightPanels, setPrevHasInsightPanels] = useState(hasInsightPanels);

    // Reset narrative focus when insight panels become unavailable.
    // This pattern (adjusting state during render) is React-recommended over useEffect
    // for syncing derived state. See: https://react.dev/learn/you-might-not-need-an-effect
    if (hasInsightPanels !== prevHasInsightPanels) {
        setPrevHasInsightPanels(hasInsightPanels);
        if (!hasInsightPanels && isNarrativeFocus) {
            setIsNarrativeFocus(false);
        }
    }


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

    // Ghost card animation handlers for deck-to-slot fly effect
    const handleAnimatedDeal = useCallback(() => {
        // Skip animation if reduced motion is preferred
        if (prefersReducedMotion) {
            dealNext();
            return;
        }

        // Find next slot index
        const nextIndex = reading?.findIndex((_, i) => !revealedCards.has(i)) ?? -1;
        if (nextIndex < 0) {
            dealNext();
            return;
        }

        // Get deck position from ref
        const deckEl = deckRef.current;
        const deckRect = deckEl?.getBoundingClientRect();

        // Get target slot position
        const slotEl = document.getElementById(`spread-slot-${nextIndex}`);
        const slotRect = slotEl?.getBoundingClientRect();

        // Fallback to immediate deal if we can't get positions
        if (!deckRect || !slotRect) {
            dealNext();
            return;
        }

        // Start ghost animation
        setGhostAnimation({
            startRect: deckRect,
            endRect: slotRect,
            targetIndex: nextIndex
        });
    }, [dealNext, reading, revealedCards, prefersReducedMotion]);

    const handleGhostComplete = useCallback(() => {
        setGhostAnimation(null);
        dealNext();
    }, [dealNext]);

    const handleCardClick = useCallback((card, position, index) => {
        if (!revealedCards.has(index)) return;
        const payload = { card, position, index, readingKey: readingIdentity };
        setFocusedCardData(payload);
    }, [readingIdentity, revealedCards]);

    const handleOpenModalFromPanel = useCallback((cardData) => {
        if (!cardData) return;
        setSelectedCardData(cardData);
    }, [setSelectedCardData]);
    const handleCloseDetail = useCallback(() => {
        if (!focusedCardData) {
            setSelectedCardData(null);
            return;
        }
        const idx = focusedCardData.index;
        setFocusedCardData(null);
        setSelectedCardData(null);
        setRecentlyClosedIndex(idx);
        const target = document.getElementById(`spread-slot-${idx}`);
        if (target?.scrollIntoView) {
            target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'center' });
        }
        window.setTimeout(() => setRecentlyClosedIndex(-1), 900);
    }, [focusedCardData, prefersReducedMotion, setSelectedCardData]);

    // --- Card Navigation Logic ---
    // Compute revealed indices sorted by position order for navigation
    const revealedIndicesSorted = useMemo(() => {
        if (!reading || !revealedCards) return [];
        return Array.from(revealedCards).sort((a, b) => a - b);
    }, [reading, revealedCards]);

    // Navigation state computed from focused/selected card
    const navigationData = useMemo(() => {
        const currentIndex = activeFocusedCardData?.index ?? selectedCardData?.index ?? -1;
        if (currentIndex < 0 || revealedIndicesSorted.length === 0) {
            return { canPrev: false, canNext: false, label: '', currentPos: -1 };
        }
        const posInList = revealedIndicesSorted.indexOf(currentIndex);
        if (posInList < 0) {
            return { canPrev: false, canNext: false, label: '', currentPos: -1 };
        }
        const canPrev = posInList > 0;
        const canNext = posInList < revealedIndicesSorted.length - 1;
        const label = `${posInList + 1} of ${revealedIndicesSorted.length}`;
        return { canPrev, canNext, label, currentPos: posInList };
    }, [activeFocusedCardData, selectedCardData, revealedIndicesSorted]);

    // Handler for navigation (used by both CardFocusOverlay and CardModal)
    const handleNavigateCard = useCallback((direction) => {
        const { currentPos, canPrev, canNext } = navigationData;
        if (currentPos < 0) return;

        let nextPos = currentPos;
        if (direction === 'prev' && canPrev) {
            nextPos = currentPos - 1;
        } else if (direction === 'next' && canNext) {
            nextPos = currentPos + 1;
        } else {
            return;
        }

        const nextIndex = revealedIndicesSorted[nextPos];
        if (nextIndex == null || !reading?.[nextIndex]) return;

        const card = reading[nextIndex];
        const position = spreadInfo?.positions?.[nextIndex] || `Position ${nextIndex + 1}`;
        const payload = { card, position, index: nextIndex, readingKey: readingIdentity };

        // Update both focused and selected to handle both sheet and modal
        if (activeFocusedCardData) {
            setFocusedCardData(payload);
        }
        if (selectedCardData) {
            setSelectedCardData(payload);
        }
    }, [navigationData, revealedIndicesSorted, reading, spreadInfo, readingIdentity, activeFocusedCardData, selectedCardData, setSelectedCardData]);

    // Memoize next label computation to avoid IIFE in render
    const nextLabel = useMemo(() => {
        if (!reading) return null;
        const nextIndex = reading.findIndex((_, i) => !revealedCards.has(i));
        if (nextIndex === -1) return null;
        const pos = spreadInfo?.positions?.[nextIndex];
        return pos ? pos.split('—')[0].trim() : `Card ${nextIndex + 1}`;
    }, [reading, revealedCards, spreadInfo]);
    const nextRevealCount = reading ? Math.min(revealedCards.size + 1, reading.length) : 0;
    const guidedRevealLabel = reading
        ? `${revealStage === 'deck' ? 'Draw next' : 'Reveal next'} (${nextRevealCount}/${reading.length})`
        : '';

    useEffect(() => {
        if (!personalReading || personalReading.isError) return;
        if (narrativePhase !== 'complete') return;

        const requestId = readingMeta?.requestId || personalReading?.requestId || null;
        if (!requestId) return;

        // Persist dedupe to PreferencesContext so navigating away/back doesn’t re-count.
        if (nudgeState?.lastCountedReadingRequestId === requestId) return;

        const currentCount = Number(nudgeState?.readingCount) || 0;
        const nextCount = currentCount + 1;

        incrementReadingCount(requestId);

        const milestoneCopy = {
            1: {
                title: 'Your first reading is complete',
                description: 'Trust what resonated. If you’d like to revisit later, save it to your journal.'
            },
            10: {
                title: '10 readings ✨',
                description: 'A pattern is forming. Your intuition is getting louder.'
            },
            25: {
                title: '25 readings',
                description: 'Consistency is magic. You’re building real self-knowledge.'
            },
            50: {
                title: '50 readings',
                description: 'You’ve developed a strong relationship with the cards—keep following the thread.'
            },
            100: {
                title: '100 readings',
                description: 'Centennial insight unlocked. Your inner compass is well-trained.'
            }
        };

        const copy = milestoneCopy[nextCount];
        if (copy) {
            publishToast({
                type: 'success',
                title: copy.title,
                description: copy.description,
                duration: nextCount === 1 ? 5200 : 4200
            });
        }
    }, [personalReading, personalReading?.requestId, readingMeta?.requestId, narrativePhase, nudgeState?.readingCount, nudgeState?.lastCountedReadingRequestId, incrementReadingCount, publishToast]);

    return (
        <section ref={sectionRef} id="step-reading" tabIndex={-1} className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]" aria-label="Draw and explore your reading">
            <div className={isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}>
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent">
                        {displayName ? `Reading for ${displayName}` : 'Reading'}
                    </p>
                    <MoonPhaseIndicator
                        ephemeris={readingMeta?.ephemeris}
                        variant={isHandset ? 'icon' : 'compact'}
                    />
                </div>
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
                    <div className={`text-center text-accent font-serif mb-2 ${isLandscape ? 'text-lg' : 'text-2xl'}`}>{spreadInfo?.name || 'Tarot Spread'}</div>
                    {reading.length > 1 && !isLandscape && (<p className="text-center text-muted text-xs-plus sm:text-sm mb-4">Reveal in order for a narrative flow, or follow your intuition and reveal randomly.</p>)}

                    {revealedCards.size < reading.length && (
                        <div className={`${isHandset ? 'hidden' : 'hidden sm:block'} text-center space-y-2`}>
                            <div className="flex items-center justify-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleAnimatedDeal}
                                    className="min-h-[44px] px-4 sm:px-5 py-2.5 sm:py-3 rounded-full border border-secondary/40 text-sm sm:text-base text-muted hover:text-main hover:border-secondary/60 transition"
                                >
                                    {guidedRevealLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRevealAllWithScroll}
                                    aria-label="Reveal all cards"
                                    className="min-h-[44px] px-4 sm:px-5 py-2.5 sm:py-3 rounded-full border border-secondary/40 text-sm sm:text-base text-muted hover:text-main hover:border-secondary/60 transition"
                                >
                                    Reveal instantly
                                </button>
                            </div>
                            <p className="text-accent/80 text-xs sm:text-sm">{revealedCards.size} of {reading.length} cards revealed</p>
                        </div>
                    )}
                    {revealedCards.size > 0 && (
                        <div className="text-center mt-3 sm:mt-4">
                            <button type="button" onClick={handleResetReveals} className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-full border border-accent/50 text-muted text-xs sm:text-sm hover:text-main hover:border-accent/70 transition touch-manipulation">
                                <span className="hidden xs:inline">Reset reveals (keep this spread)</span><span className="xs:hidden">Reset reveals</span>
                            </button>
                        </div>
                    )}
                    {/* RitualNudge - contextual education for first-time users */}
                    {reading && revealedCards.size < reading.length && shouldShowRitualNudge && knockCount === 0 && !hasCut && (
                        <div className="mb-4 max-w-md mx-auto">
                            <RitualNudge
                                onEnableRitual={markRitualNudgeSeen}
                                onSkip={markRitualNudgeSeen}
                            />
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
                                // Deal action with ghost card animation
                                onDeal={handleAnimatedDeal}
                                // Minimap suit coloring (revealed cards)
                                cards={reading}
                                revealedIndices={revealedCards}
                                // Ref for ghost card animation coordination
                                externalDeckRef={deckRef}
                                revealStage={revealStage}
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

                    <ReadingBoard
                        spreadKey={safeSpreadKey}
                        reading={reading}
                        revealedCards={revealedCards}
                        revealCard={revealCard}
                        onCardClick={handleCardClick}
                        focusedCardData={activeFocusedCardData}
                        onCloseDetail={handleCloseDetail}
                        recentlyClosedIndex={recentlyClosedIndex}
                        reflections={reflections}
                        setReflections={setReflections}
                        onOpenModal={handleOpenModalFromPanel}
                        onNavigateCard={handleNavigateCard}
                        canNavigatePrev={navigationData.canPrev}
                        canNavigateNext={navigationData.canNext}
                        navigationLabel={navigationData.label}
                        revealStage={revealStage}
                    />

                    {!personalReading && !isGenerating && revealedCards.size === reading.length && (
                        <div className="text-center space-y-3">
                            {isHandset ? (
                                <p className="text-xs text-muted">Use the action bar below to create your narrative.</p>
                            ) : (
                                <button onClick={generatePersonalReading} className="bg-accent hover:bg-accent/90 text-surface font-semibold px-5 sm:px-8 py-3 sm:py-4 rounded-xl shadow-xl shadow-accent/20 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base md:text-lg">
                                    <Sparkle className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span>Create Personal Narrative</span>
                                </button>
                            )}
                            {hasVisionData && !isVisionReady && <p className="mt-3 text-sm text-muted">⚠️ Vision data has conflicts - research telemetry may be incomplete.</p>}
                        </div>
                    )}

                    {/* Skeleton loading state during narrative generation */}
                    <AnimatePresence mode="wait">
                        {isGenerating && !personalReading && (
                            <motion.div
                                key="narrative-skeleton"
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: 'easeOut' }}
                                className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto ${isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'}`}
                            >
                                <NarrativeSkeleton
                                    hasQuestion={Boolean(userQuestion)}
                                    displayName={displayName}
                                    spreadName={spreadInfo?.name}
                                    cardCount={reading?.length || 3}
                                    reasoningSummary={reasoningSummary}
                                    narrativePhase={narrativePhase}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {personalReading && (
                        <div className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto ${isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'}`}>
                            <div className="space-y-3 sm:space-y-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <h3 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight">
                                        <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                                        Your Personalized Narrative
                                    </h3>
                                    {focusToggleAvailable && (
                                        <button
                                            type="button"
                                            aria-pressed={isNarrativeFocus}
                                            onClick={() => setIsNarrativeFocus(prev => !prev)}
                                            className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-3 xxs:px-4 py-1.5 text-xs-plus sm:text-sm font-semibold text-muted hover:text-main hover:border-secondary/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 sm:ml-auto"
                                        >
                                            {isNarrativeFocus ? 'Show insight panels' : 'Focus on narrative'}
                                        </button>
                                    )}
                                </div>
                                {userQuestion && (
                                    <div className="bg-surface/85 rounded-lg px-3 xxs:px-4 py-3 border border-secondary/40">
                                        <p className="text-accent/85 text-xs sm:text-sm italic">Anchor: {userQuestion}</p>
                                    </div>
                                )}
                                <NarrativeGuidancePanel
                                    toneLabel={toneLabel}
                                    frameLabel={frameLabel}
                                    isHandset={isHandset}
                                    isNewbie={isNewbie}
                                    compact
                                    className="max-w-3xl mx-auto"
                                />
                            </div>
                            <StreamingNarrative
                                className="max-w-3xl mx-auto mt-4 sm:mt-5"
                                text={narrativeText}
                                useMarkdown={Boolean(personalReading?.hasMarkdown)}
                                isStreamingEnabled={shouldStreamNarrative}
                                autoNarrate={canAutoNarrate}
                                onNarrationStart={handleNarrationWrapper}
                                displayName={displayName}
                                highlightPhrases={narrativeHighlightPhrases}
                                withAtmosphere
                            />
                            {isHandset && onOpenFollowUp && personalReading && !isPersonalReadingError && narrativePhase === 'complete' && (
                                <div className="max-w-3xl mx-auto mt-4">
                                    <div className="rounded-2xl border border-secondary/35 bg-surface/85 px-4 py-3 text-center shadow-lg shadow-secondary/25">
                                        <p className="text-sm font-semibold text-main">Continue with a follow-up chat</p>
                                        <p className="text-xs text-muted mt-1">Ask deeper questions and explore what resonates.</p>
                                        <button
                                            type="button"
                                            onClick={onOpenFollowUp}
                                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/40 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                                        >
                                            <ChatCircle className="w-4 h-4" weight="fill" aria-hidden="true" />
                                            <span>Open follow-up chat</span>
                                        </button>
                                    </div>
                                </div>
                            )}
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
                                        {!isHandset && narrativePhase === 'complete' && (
                                            <button
                                                type="button"
                                                onClick={saveReading}
                                                disabled={isSaving}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/20 border border-accent/40 text-accent text-xs sm:text-sm font-semibold hover:bg-accent/30 transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <BookmarkSimple className="w-3.5 h-3.5" weight="fill" />
                                                <span>{isSaving ? 'Saving...' : 'Save to Journal'}</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => navigate('/journal', { state: { fromReading: true } })}
                                            className="px-3 sm:px-4 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs sm:text-sm hover:bg-primary/25 hover:text-primary transition"
                                        >
                                            View Journal
                                        </button>
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

                                {/* JournalNudge - contextual prompt for first-time users after narrative */}
                                {shouldShowJournalNudge && personalReading && !personalReading.isError && !journalStatus && (
                                    <div className="mt-4 max-w-md mx-auto">
                                        <JournalNudge
                                            onSave={() => {
                                                saveReading();
                                                markJournalNudgeSeen();
                                            }}
                                            onDismiss={markJournalNudgeSeen}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {!personalReading && !isGenerating && (
                        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-secondary/40 max-w-full sm:max-w-5xl mx-auto">
                            <NarrativeGuidancePanel
                                toneLabel={toneLabel}
                                frameLabel={frameLabel}
                                isHandset={isHandset}
                                isNewbie={isNewbie}
                                className="max-w-3xl mx-auto"
                            />
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

                    {/* Follow-Up Chat - modal trigger (desktop only) */}
                    {personalReading && !isPersonalReadingError && narrativePhase === 'complete' && !isHandset && (
                        <div className="w-full max-w-2xl mx-auto">
                            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-main">Continue the conversation</p>
                                        <p className="text-xs text-muted">Open a private chat window to explore this reading.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsFollowUpOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                                    >
                                        <ChatCircle className="w-4 h-4" weight="fill" aria-hidden="true" />
                                        <span>Open chat</span>
                                    </button>
                                </div>
                            </div>
                            <FollowUpModal
                                isOpen={isFollowUpOpen}
                                onClose={() => setIsFollowUpOpen(false)}
                                autoFocusInput={followUpAutoFocus}
                            />
                        </div>
                    )}

                    <div className="hidden sm:block text-center mt-6 sm:mt-8">
                        <button
                            onClick={shuffle}
                            disabled={isShuffling}
                            aria-label={isShuffling ? 'Shuffling a new reading' : 'Start a new reading and reset this spread'}
                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg"
                        >
                            <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                            <span className="hidden xs:inline">{isShuffling ? 'Shuffling the cards...' : 'Draw new reading'}</span>
                            <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'Reset spread'}</span>
                        </button>
                    </div>

                    {personalReading && (
                        <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-8">
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
                    )}
                </div>
            )}

            <AnimatePresence>
                {selectedCardData && (
                    <CardModal
                        card={selectedCardData.card}
                        position={selectedCardData.position}
                        isOpen={!!selectedCardData}
                        onClose={handleCloseDetail}
                        layoutId={`card-${selectedCardData.index}`}
                        onNavigate={handleNavigateCard}
                        canNavigatePrev={navigationData.canPrev}
                        canNavigateNext={navigationData.canNext}
                        navigationLabel={navigationData.label}
                    />
                )}
            </AnimatePresence>

            {/* Ghost card animation - deck to slot fly effect */}
            {ghostAnimation && (
                <GhostCard
                    startRect={ghostAnimation.startRect}
                    endRect={ghostAnimation.endRect}
                    onComplete={handleGhostComplete}
                />
            )}
        </section>
    );
}
