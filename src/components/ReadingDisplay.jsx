import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSpreadInfo, normalizeSpreadKey } from '../data/spreads';
import { useReading } from '../contexts/ReadingContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSaveReading } from '../hooks/useSaveReading';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext.jsx';
import { useLandscape } from '../hooks/useLandscape';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useCinematicBeat } from '../hooks/useCinematicBeat';
import { useSceneOrchestrator } from '../hooks/useSceneOrchestrator';
import { useReadingSelection } from '../hooks/useReadingSelection';
import { useReadingMediaGallery } from '../hooks/useReadingMediaGallery';
import { useNarrativeReadingController } from '../hooks/useNarrativeReadingController';
import { getCardImage } from '../lib/cardLookup';
import { determineColorScript } from '../lib/colorScript';
import { ReadingChrome } from './reading/ReadingChrome';
import { ReadingSceneRouter } from './reading/ReadingSceneRouter';
import { ReadingOverlays } from './reading/ReadingOverlays';

const COLOR_SCRIPT_OWNER = 'reading-display';

function inferElementFromSuit(suit) {
    const normalizedSuit = typeof suit === 'string' ? suit.trim().toLowerCase() : '';
    if (normalizedSuit === 'wands') return 'fire';
    if (normalizedSuit === 'cups') return 'water';
    if (normalizedSuit === 'swords') return 'air';
    if (normalizedSuit === 'pentacles') return 'earth';
    return 'spirit';
}
export function ReadingDisplay({
    sectionRef,
    followUpOpen,
    onFollowUpOpenChange,
    followUpAutoFocus = true,
    suppressInterruptions = false,
    isMobileStableMode = false
}) {
    const { saveReading, isSaving } = useSaveReading();
    const { publish: publishToast } = useToast();
    const { effectiveTier } = useSubscription();
    const navigate = useNavigate();

    // --- Contexts ---
    const {
        // Audio
        ttsState,
        wordBoundary,
        triggerCinematicSwell,
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
        knockCadenceResetAt,
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
        reasoning,
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

    const [isNarrativeFocus, setIsNarrativeFocus] = useState(false);
    const [isFollowUpOpenLocal, setIsFollowUpOpenLocal] = useState(false);
    const isFollowUpOpen = typeof followUpOpen === 'boolean' ? followUpOpen : isFollowUpOpenLocal;
    const setIsFollowUpOpen = onFollowUpOpenChange || setIsFollowUpOpenLocal;
    const [heroStoryState, setHeroStoryState] = useState({ key: readingIdentity, value: false });

    const hasHeroStoryArt = heroStoryState.key === readingIdentity ? heroStoryState.value : false;
    const setHasHeroStoryArt = useCallback((value) => {
        setHeroStoryState({ key: readingIdentity, value });
    }, [readingIdentity]);

    const { beatClassName, notifyCardMention, notifyCompletion, notifySectionEnter, clearBeat } = useCinematicBeat({
        reasoning,
        totalCards: reading?.length ?? 0,
        onBeat: triggerCinematicSwell,
        resetKey: readingIdentity
    });

    // Scene orchestrator for cinematic state management
    const sceneOrchestrator = useSceneOrchestrator({
        isShuffling,
        hasConfirmedSpread: !!reading,
        revealedCards,
        totalCards: reading?.length ?? 0,
        isGenerating,
        isReadingStreamActive,
        personalReading,
        reading
    });

    useEffect(() => {
        const isNarrativeDeliveryActive = Boolean(isReadingStreamActive || personalReading?.isStreaming);
        const shouldClearBeat = sceneOrchestrator.activeScene === 'idle'
            || sceneOrchestrator.activeScene === 'ritual'
            || sceneOrchestrator.activeScene === 'reveal'
            || (sceneOrchestrator.activeScene === 'interlude' && !isNarrativeDeliveryActive);
        if (shouldClearBeat) {
            clearBeat();
        }
    }, [sceneOrchestrator.activeScene, isReadingStreamActive, personalReading?.isStreaming, clearBeat]);

    // Apply color script based on narrative arc
    const hasNarrativeSurface = Boolean(personalReading)
        || isGenerating
        || Boolean(isReadingStreamActive || personalReading?.isStreaming);
    const emotionalToneKey = emotionalTone?.emotion || '';
    const narrativeArcKey = reasoning?.narrativeArc?.key || '';
    const activeColorScript = useMemo(() => {
        if (!hasNarrativeSurface || !emotionalToneKey) return null;
        const stableTone = { emotion: emotionalToneKey };
        const stableReasoning = narrativeArcKey
            ? { narrativeArc: { key: narrativeArcKey } }
            : null;
        return determineColorScript(narrativePhase, stableTone, stableReasoning);
    }, [hasNarrativeSurface, emotionalToneKey, narrativeArcKey, narrativePhase]);

    // Ghost card animation state for deck-to-slot fly animation
    const deckRef = useRef(null);
    const ghostInFlightRef = useRef(false);
    const [ghostAnimation, setGhostAnimation] = useState(null);

    useEffect(() => {
        if (!ghostAnimation) {
            ghostInFlightRef.current = false;
        }
    }, [ghostAnimation]);

    const {
        voiceOn,
        autoNarrate,
        deckStyleId,
        personalization,
        ttsProvider,
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
    const { isAuthenticated } = useAuth();

    const {
        visionResearch: visionResearchEnabled,
        newDeckInterface,
        autoGenerateVisuals: autoGenerateVisualsEnabled
    } = useFeatureFlags();
    const isLandscape = useLandscape();
    const isHandsetLayout = useHandsetLayout();
    const isHandset = isHandsetLayout;
    const prefersReducedMotion = useReducedMotion();
    const safeSpreadKey = normalizeSpreadKey(selectedSpread);
    const spreadInfo = getSpreadInfo(safeSpreadKey);
    const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
    const visibleCount = reading ? (maxCards ? Math.min(reading.length, maxCards) : reading.length) : 0;
    const canShowVisionPanel = visionResearchEnabled && isAuthenticated;
    const canAutoGenerateVisuals = effectiveTier === 'plus' || effectiveTier === 'pro';
    const canUseMediaGallery = isAuthenticated && canAutoGenerateVisuals;

    const {
        selectedCardData,
        narrativeMentionPulse,
        activeFocusedCardData,
        recentlyClosedIndex,
        handleNarrativeHighlight,
        handleCardClick,
        handleOpenModalFromPanel,
        handleCloseDetail,
        navigationData,
        handleNavigateCard
    } = useReadingSelection({
        readingIdentity,
        reading,
        revealedCards,
        visibleCount,
        spreadPositions: spreadInfo?.positions || [],
        prefersReducedMotion,
        notifyCardMention
    });

    useEffect(() => {
        if (!Array.isArray(reading) || visibleCount === 0 || typeof document === 'undefined') return undefined;
        const head = document.head;
        const created = [];
        const sources = new Set(
            reading
                .slice(0, visibleCount)
                .map((card) => getCardImage(card))
                .filter((src) => typeof src === 'string' && src.length > 0)
        );

        sources.forEach((src) => {
            const escapedSrc = CSS.escape(src);
            const existing = head.querySelector(`link[rel="preload"][as="image"][href="${escapedSrc}"]`);
            if (existing) return;
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            link.setAttribute('data-reading-preload', 'true');
            head.appendChild(link);
            created.push(link);
        });

        return () => {
            created.forEach((node) => {
                if (node?.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });
        };
    }, [reading, visibleCount]);

    const revealStage = useMemo(() => {
        if (!isHandset || !newDeckInterface || !reading || visibleCount === 0) return 'action';
        if (revealedCards.size === 0) return 'deck';
        if (revealedCards.size < visibleCount) return 'spread';
        return 'action';
    }, [isHandset, newDeckInterface, reading, revealedCards, visibleCount]);
    const {
        mediaItems,
        mediaTotal,
        mediaLoading,
        mediaError,
        loadMediaGallery,
        persistMediaRecord,
        deleteMediaById
    } = useReadingMediaGallery({
        canUseMediaGallery
    });

    const handleOpenJournal = useCallback(() => {
        navigate('/journal', { state: { fromReading: true } });
    }, [navigate]);

    const handleOpenJournalEntry = useCallback((entryId) => {
        if (!entryId) {
            handleOpenJournal();
            return;
        }
        navigate('/journal', {
            state: {
                highlightEntryId: entryId,
                fromReading: true
            }
        });
    }, [handleOpenJournal, navigate]);

    const handleOpenSubscriptionSettings = useCallback(() => {
        navigate('/settings', { state: { section: 'subscription' } });
    }, [navigate]);

    const {
        resolvedQuestion,
        isPersonalReadingError,
        narrativeAtmosphereClasses,
        narrativeModel
    } = useNarrativeReadingController({
        reading,
        visibleCount,
        spreadPositions: spreadInfo?.positions || [],
        personalReading,
        isReadingStreamActive,
        narrativePhase,
        themes,
        reasoning,
        emotionalTone,
        displayName,
        userQuestion,
        highlightItems,
        isGenerating,
        voiceOn,
        autoNarrate,
        ttsProvider,
        ttsState,
        wordBoundary,
        effectiveTier,
        isAuthenticated,
        autoGenerateVisualsEnabled,
        isHandset,
        isLandscape,
        isShuffling,
        isNarrativeFocus,
        setIsNarrativeFocus,
        showVoicePrompt,
        setShowVoicePrompt,
        journalStatus,
        shouldShowJournalNudge,
        markJournalNudgeSeen,
        saveReading,
        isSaving,
        hasHeroStoryArt,
        handleNarrationStop,
        notifyCompletion,
        notifySectionEnter,
        handleOpenJournal,
        handleOpenJournalEntry,
        handleOpenSubscriptionSettings,
        handleNarrativeHighlight,
        handleNarrationButtonClick,
        handleVoicePromptEnable,
        readingIdentity,
        persistMediaRecord,
        setHasHeroStoryArt,
        canShowVisionPanel,
        revealedCards,
        beatClassName,
        isMobileStableMode
    });

    const handleRevealAllWithScroll = useCallback(() => {
        revealAll();
        sectionRef.current?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
        });
    }, [revealAll, prefersReducedMotion, sectionRef]);

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

        if (ghostInFlightRef.current) {
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

        // Get target slot position. Prefer the actual slot card element to avoid
        // wrapper offsets from decorative layers.
        const slotEl = document.getElementById(`spread-slot-${nextIndex}`);
        const targetEl = slotEl?.querySelector?.('[data-layout-card]') || slotEl;
        const slotRect = targetEl?.getBoundingClientRect();

        // Fallback to immediate deal if we can't get positions
        if (!deckRect || !slotRect) {
            dealNext();
            return;
        }

        // Start ghost animation
        const suit = reading?.[nextIndex]?.suit || null;
        ghostInFlightRef.current = true;
        setGhostAnimation({
            startRect: deckRect,
            endRect: slotRect,
            targetIndex: nextIndex,
            suit
        });
    }, [dealNext, reading, revealedCards, prefersReducedMotion]);

    const handleGhostComplete = useCallback(() => {
        ghostInFlightRef.current = false;
        setGhostAnimation(null);
        dealNext();
    }, [dealNext]);

    // Memoize next label computation to avoid IIFE in render
    const nextLabel = useMemo(() => {
        if (!reading) return null;
        const nextIndex = reading.findIndex((_, i) => !revealedCards.has(i));
        if (nextIndex === -1 || (maxCards && nextIndex >= maxCards)) return null;
        const pos = spreadInfo?.positions?.[nextIndex];
        return pos ? pos.split('—')[0].trim() : `Card ${nextIndex + 1}`;
    }, [reading, revealedCards, spreadInfo, maxCards]);
    const nextRevealCount = reading ? Math.min(revealedCards.size + 1, visibleCount) : 0;
    const guidedRevealLabel = reading
        ? `${revealStage === 'deck' ? 'Draw next' : 'Reveal next'} (${nextRevealCount}/${visibleCount})`
        : '';

    useEffect(() => {
        if (suppressInterruptions) return;
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
    }, [personalReading, personalReading?.requestId, readingMeta?.requestId, narrativePhase, nudgeState?.readingCount, nudgeState?.lastCountedReadingRequestId, incrementReadingCount, publishToast, suppressInterruptions]);

    useEffect(() => {
        if (suppressInterruptions) return;
        if (!isShuffling || newDeckInterface) return;
        const timerId = setTimeout(() => {
            publishToast({
                type: 'info',
                title: 'Cards ready',
                description: 'Tap to draw when you feel set.',
                duration: 800
            });
        }, 800);
        return () => clearTimeout(timerId);
    }, [isShuffling, newDeckInterface, publishToast, suppressInterruptions]);

    const dominantSuit = themes?.dominantSuit
        || reading?.find?.((card) => Boolean(card?.suit))?.suit
        || null;
    const dominantElement = themes?.dominantElement || inferElementFromSuit(dominantSuit);
    const sceneIntensity = {
        idle: 0.35,
        ritual: 1.15,
        reveal: 0.95,
        interlude: 0.78,
        narrative: 1,
        complete: 0.62
    };

    const sceneVisuals = {
        dominantSuit,
        dominantElement,
        particleIntensity: sceneIntensity[sceneOrchestrator.activeScene] || 0.8
    };

    const ritualModel = {
        reading,
        revealedCards,
        visibleCount,
        newDeckInterface,
        shouldShowRitualNudge,
        knockCount,
        hasCut,
        markRitualNudgeSeen,
        handleKnock,
        cutIndex,
        setCutIndex,
        applyCut,
        knockCadenceResetAt,
        isShuffling,
        shuffle,
        nextLabel,
        spreadPositions: spreadInfo?.positions || [],
        handleAnimatedDeal,
        deckRef,
        revealStage,
        dealNext
    };

    const revealModel = {
        spreadName: spreadInfo?.name,
        visibleCount,
        revealedCards,
        isLandscape,
        isHandset,
        guidedRevealLabel,
        handleAnimatedDeal,
        handleRevealAllWithScroll,
        handleResetReveals,
        safeSpreadKey,
        reading,
        revealCard,
        handleCardClick,
        activeFocusedCardData,
        handleCloseDetail,
        recentlyClosedIndex,
        reflections,
        setReflections,
        handleOpenModalFromPanel,
        handleNavigateCard,
        navigationData,
        revealStage,
        narrativeMentionPulse,
        personalReading,
        isGenerating,
        generatePersonalReading,
        hasVisionData,
        isVisionReady
    };

    const interludeModel = {
        isGenerating,
        personalReading,
        reasoningSummary,
        narrativePhase,
        narrativeAtmosphereClasses,
        spreadName: spreadInfo?.name,
        displayName,
        userQuestion,
        readingCount: reading?.length || 0,
        reasoning
    };

    const completionModel = {
        personalReading,
        isPersonalReadingError,
        narrativePhase,
        isHandset,
        userQuestion,
        isShuffling,
        shuffle,
        readingMeta,
        selectedSpread,
        spreadName: spreadInfo?.name,
        deckStyleId,
        lastCardsForFeedback,
        feedbackVisionSummary,
        canUseMediaGallery,
        mediaItems,
        mediaTotal,
        mediaLoading,
        mediaError,
        onRefreshMedia: loadMediaGallery,
        onDeleteMedia: deleteMediaById,
        followUpOpen: isFollowUpOpen,
        setFollowUpOpen: setIsFollowUpOpen,
        followUpAutoFocus,
        isMobileStableMode
    };
    const sceneModels = {
        sceneVisuals,
        ritualModel,
        revealModel,
        interludeModel,
        narrativeModel,
        completionModel
    };

    return (
        <section ref={sectionRef} id="step-reading" tabIndex={-1} className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]" aria-label="Draw and explore your reading">
            <ReadingChrome
                displayName={displayName}
                readingMeta={readingMeta}
                isHandset={isHandset}
                isLandscape={isLandscape}
                reading={reading}
                shuffle={shuffle}
                isShuffling={isShuffling}
                canShowVisionPanel={canShowVisionPanel}
                isNarrativeFocus={isNarrativeFocus}
                deckStyleId={deckStyleId}
                handleVisionResults={handleVisionResults}
                handleRemoveVisionResult={handleRemoveVisionResult}
                handleClearVisionResults={handleClearVisionResults}
                visionConflicts={visionConflicts}
                visionResults={visionResults}
            />

            {reading ? (
                <ReadingSceneRouter
                    orchestrator={sceneOrchestrator}
                    sceneModels={sceneModels}
                    colorScript={activeColorScript}
                    colorScriptOwner={COLOR_SCRIPT_OWNER}
                    isMobileStableMode={isMobileStableMode}
                />
            ) : null}

            <ReadingOverlays
                selectedCardData={selectedCardData}
                resolvedQuestion={resolvedQuestion}
                effectiveTier={effectiveTier}
                onCloseDetail={handleCloseDetail}
                onNavigateCard={handleNavigateCard}
                navigationData={navigationData}
                ghostAnimation={ghostAnimation}
                onGhostComplete={handleGhostComplete}
            />
        </section>
    );
}
