import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { getSpreadInfo, normalizeSpreadKey } from '../data/spreads';
import { ParticleLayer } from './ParticleLayer';
import { VisionValidationPanel } from './VisionValidationPanel';
import { CardModal } from './CardModal';
import { NarrativePanel } from './NarrativePanel';
import { NarrativeReadingSurface } from './NarrativeReadingSurface';
import { MoonPhaseIndicator } from './MoonPhaseIndicator';
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
import { getCardImage, getOrientationMeaning } from '../lib/cardLookup';
import {
    getNarrativeBiasClass,
    getNarrativeSuitClass,
    getNarrativePhaseClass
} from '../lib/narrativeAtmosphere';
import { determineColorScript } from '../lib/colorScript';
import {
    STREAM_AUTO_NARRATE_DEBOUNCE_MS,
    shouldScheduleAutoNarration
} from '../lib/narrationStream.js';
import {
    SceneShell,
    IdleScene,
    RitualScene,
    RevealScene,
    InterludeScene,
    NarrativeScene,
    CompleteScene
} from './scenes';
const COLOR_SCRIPT_OWNER = 'reading-display';
const SCENE_COMPONENTS = {
    idle: ({ children }) => (
        <IdleScene showTitle={false}>
            {children}
        </IdleScene>
    ),
    ritual: (props) => (
        <RitualScene
            {...props}
            showTitle={false}
        />
    ),
    reveal: (props) => (
        <RevealScene
            {...props}
            showTitle={false}
        />
    ),
    interlude: (props) => (
        <InterludeScene
            {...props}
            showTitle={false}
        />
    ),
    narrative: (props) => (
        <NarrativeScene {...props} />
    ),
    complete: (props) => (
        <CompleteScene {...props} />
    )
};

function inferElementFromSuit(suit) {
    const normalizedSuit = typeof suit === 'string' ? suit.trim().toLowerCase() : '';
    if (normalizedSuit === 'wands') return 'fire';
    if (normalizedSuit === 'cups') return 'water';
    if (normalizedSuit === 'swords') return 'air';
    if (normalizedSuit === 'pentacles') return 'earth';
    return 'spirit';
}

/**
 * Ghost card component for deck-to-slot fly animation.
 * Renders via portal to animate in screen space above all other content.
 */
function GhostCard({ startRect, endRect, suit = null, onComplete }) {
    const prefersReducedMotion = useReducedMotion();
    const nodeRef = useRef(null);
    const completedRef = useRef(false);
    const mountedRef = useRef(true);
    const trailFrameRef = useRef(null);
    const trailBurstIdRef = useRef(0);
    const trailTimersRef = useRef([]);
    const [trailBursts, setTrailBursts] = useState([]);
    const durationMs = 350;
    const startX = Number.isFinite(startRect?.left) ? startRect.left : 0;
    const startY = Number.isFinite(startRect?.top) ? startRect.top : 0;
    const endX = Number.isFinite(endRect?.left) ? endRect.left : startX;
    const endY = Number.isFinite(endRect?.top) ? endRect.top : startY;
    const safeStartWidth = Math.max(1, startRect?.width || 0);
    const safeStartHeight = Math.max(1, startRect?.height || 0);
    const endScaleX = Math.max(0.01, (endRect?.width || 0) / safeStartWidth);
    const endScaleY = Math.max(0.01, (endRect?.height || 0) / safeStartHeight);
    const suitKey = typeof suit === 'string' ? suit.toLowerCase() : '';
    const suitClass = suitKey ? `ghost-card--${suitKey}` : '';

    const clearTrailTimers = useCallback(() => {
        trailTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
        trailTimersRef.current = [];
    }, []);

    const emitTrailBurst = useCallback((x, y) => {
        if (!mountedRef.current) return;
        trailBurstIdRef.current += 1;
        const burstId = `ghost-${trailBurstIdRef.current}`;
        setTrailBursts((prev) => [...prev, { id: burstId, x, y }]);
        const removeTimer = window.setTimeout(() => {
            setTrailBursts((prev) => prev.filter((burst) => burst.id !== burstId));
            trailTimersRef.current = trailTimersRef.current.filter((timer) => timer !== removeTimer);
        }, prefersReducedMotion ? 220 : 420);
        trailTimersRef.current.push(removeTimer);
    }, [prefersReducedMotion]);

    const complete = useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        if (!mountedRef.current) return;
        onComplete?.();
    }, [onComplete]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (trailFrameRef.current) {
                window.cancelAnimationFrame(trailFrameRef.current);
                trailFrameRef.current = null;
            }
            clearTrailTimers();
        };
    }, [clearTrailTimers]);

    useEffect(() => {
        const node = nodeRef.current;
        if (!node) return undefined;

        completedRef.current = false;
        const startTransform = `translate3d(${startX}px, ${startY}px, 0) scale(1, 1)`;
        const endTransform = `translate3d(${endX}px, ${endY}px, 0) scale(${endScaleX}, ${endScaleY})`;
        node.style.transform = startTransform;
        node.style.opacity = '1';

        const failSafeId = window.setTimeout(complete, durationMs + 200);
        let fallbackId = null;
        let animation = null;

        if (!prefersReducedMotion) {
            const startedAt = performance.now();
            let lastEmitMs = -Infinity;
            emitTrailBurst(startX, startY);
            const step = (now) => {
                if (completedRef.current || !mountedRef.current) return;
                const elapsed = now - startedAt;
                const progress = Math.min(1, Math.max(0, elapsed / durationMs));
                if (elapsed - lastEmitMs >= 100 || progress >= 1) {
                    lastEmitMs = elapsed;
                    const nextX = startX + ((endX - startX) * progress);
                    const nextY = startY + ((endY - startY) * progress);
                    emitTrailBurst(nextX, nextY);
                }
                if (progress < 1) {
                    trailFrameRef.current = window.requestAnimationFrame(step);
                }
            };
            trailFrameRef.current = window.requestAnimationFrame(step);
        }

        if (typeof node.animate === 'function') {
            animation = node.animate(
                [
                    { transform: startTransform, opacity: 1, offset: 0 },
                    { transform: startTransform, opacity: 1, offset: 0.68 },
                    { transform: endTransform, opacity: 0, offset: 1 }
                ],
                {
                    duration: durationMs,
                    easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)',
                    fill: 'forwards'
                }
            );
            animation.onfinish = () => complete();
            animation.oncancel = () => complete();
        } else {
            fallbackId = window.setTimeout(complete, durationMs);
        }

        return () => {
            window.clearTimeout(failSafeId);
            if (fallbackId) {
                window.clearTimeout(fallbackId);
            }
            if (trailFrameRef.current) {
                window.cancelAnimationFrame(trailFrameRef.current);
                trailFrameRef.current = null;
            }
            clearTrailTimers();
            animation?.cancel();
        };
    }, [startX, startY, endX, endY, endScaleX, endScaleY, complete, prefersReducedMotion, durationMs, emitTrailBurst, clearTrailTimers]);

    return createPortal(
        <>
            <div
                ref={nodeRef}
                className={`ghost-card fixed left-0 top-0 pointer-events-none z-[200] ${suitClass}`}
                style={{
                    width: safeStartWidth,
                    height: safeStartHeight,
                    transformOrigin: '0 0',
                    transform: 'translate3d(0, 0, 0)',
                    willChange: 'transform, opacity',
                    contain: 'layout paint style',
                    backfaceVisibility: 'hidden'
                }}
            >
                <div
                    className="w-full h-full rounded-xl border-2 border-primary/40 overflow-hidden"
                    style={{
                        background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))',
                        boxShadow: '0 12px 22px rgba(0, 0, 0, 0.35)'
                    }}
                >
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 50% 50%, var(--brand-secondary) 1px, transparent 1px)',
                            backgroundSize: '12px 12px'
                        }}
                    />
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                            background: 'radial-gradient(circle at 50% 50%, rgba(var(--brand-primary-rgb) / 0.12), transparent 70%)'
                        }}
                    />
                </div>
            </div>
            {!prefersReducedMotion && trailBursts.map((burst) => (
                <div
                    key={burst.id}
                    className="pointer-events-none fixed left-0 top-0 z-[195]"
                    style={{
                        width: 42,
                        height: 42,
                        transform: `translate3d(${burst.x - 21}px, ${burst.y - 21}px, 0)`
                    }}
                    aria-hidden="true"
                >
                    <ParticleLayer
                        id={`ghost-deal-trail-${burst.id}`}
                        preset="deal-trail"
                        suit={suit}
                        intensity={0.45}
                        zIndex={1}
                    />
                </div>
            ))}
        </>,
        document.body
    );
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

    const [selectionState, setSelectionState] = useState({ key: readingIdentity, value: null });
    const [isNarrativeFocus, setIsNarrativeFocus] = useState(false);
    const [autoNarrationTriggered, setAutoNarrationTriggered] = useState(false);
    const autoNarrationTriggeredRef = useRef(false);
    const autoNarrationTimeoutRef = useRef(null);
    const autoNarrationStartRef = useRef(null);
    const [mentionPulseState, setMentionPulseState] = useState({ key: readingIdentity, value: null });
    const mentionPulseRef = useRef(0);
    const mentionPulseTimeoutRef = useRef(null);
    const [isFollowUpOpenLocal, setIsFollowUpOpenLocal] = useState(false);
    const isFollowUpOpen = typeof followUpOpen === 'boolean' ? followUpOpen : isFollowUpOpenLocal;
    const setIsFollowUpOpen = onFollowUpOpenChange || setIsFollowUpOpenLocal;
    const selectedCardData = selectionState.key === readingIdentity ? selectionState.value : null;
    const setSelectedCardData = useCallback((value) => {
        setSelectionState({ key: readingIdentity, value });
    }, [readingIdentity]);
    const narrativeMentionPulse = mentionPulseState.key === readingIdentity ? mentionPulseState.value : null;
    const setNarrativeMentionPulse = useCallback((value) => {
        setMentionPulseState({ key: readingIdentity, value });
    }, [readingIdentity]);
    const [focusedCardData, setFocusedCardData] = useState(null);
    const [recentlyClosedIndex, setRecentlyClosedIndex] = useState(-1);
    const recentlyClosedTimeoutRef = useRef(null);
    const [heroStoryState, setHeroStoryState] = useState({ key: readingIdentity, value: false });
    const [mediaItems, setMediaItems] = useState([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaError, setMediaError] = useState(null);
    const mediaRequestTokenRef = useRef(0);
    const activeFocusedCardData = useMemo(() => {
        if (!focusedCardData) return null;
        if (focusedCardData.readingKey && focusedCardData.readingKey !== readingIdentity) return null;
        if (!revealedCards.has(focusedCardData.index)) return null;
        return focusedCardData;
    }, [focusedCardData, readingIdentity, revealedCards]);

    const hasHeroStoryArt = heroStoryState.key === readingIdentity ? heroStoryState.value : false;
    const setHasHeroStoryArt = useCallback((value) => {
        setHeroStoryState({ key: readingIdentity, value });
    }, [readingIdentity]);

    const narrativeAtmosphereClasses = useMemo(() => {
        const classes = [
            getNarrativePhaseClass(isGenerating ? narrativePhase : null),
            getNarrativeBiasClass(reasoning?.narrativeArc?.templateBias),
            getNarrativeSuitClass(themes?.dominantSuit)
        ];
        return classes.filter(Boolean).join(' ');
    }, [isGenerating, narrativePhase, reasoning?.narrativeArc?.templateBias, themes?.dominantSuit]);

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

    const { shouldShowInterlude } = sceneOrchestrator;

    useEffect(() => {
        const isNarrativeDeliveryActive = Boolean(isReadingStreamActive || personalReading?.isStreaming);
        const shouldClearBeat = sceneOrchestrator.currentScene === 'idle'
            || sceneOrchestrator.currentScene === 'shuffling'
            || sceneOrchestrator.currentScene === 'drawing'
            || (sceneOrchestrator.currentScene === 'interlude' && !isNarrativeDeliveryActive);
        if (shouldClearBeat) {
            clearBeat();
        }
    }, [sceneOrchestrator.currentScene, isReadingStreamActive, personalReading?.isStreaming, clearBeat]);

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

    const narrativeAtmosphereClassName = useMemo(() => (
        [narrativeAtmosphereClasses, beatClassName].filter(Boolean).join(' ')
    ), [narrativeAtmosphereClasses, beatClassName]);


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
    const resolvedQuestion = userQuestion && userQuestion.trim().length > 0
        ? userQuestion.trim()
        : 'General guidance';

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

    const storyArtCards = useMemo(() => {
        if (!Array.isArray(reading) || visibleCount === 0) return [];
        return reading
            .slice(0, visibleCount)
            .map((card, index) => ({
                name: card?.name,
                number: card?.number ?? null,
                suit: card?.suit ?? null,
                rank: card?.rank ?? null,
                rankValue: card?.rankValue ?? null,
                position: spreadInfo?.positions?.[index] || `Position ${index + 1}`,
                reversed: Boolean(card?.isReversed),
                meaning: getOrientationMeaning(card)
            }))
            .filter(card => Boolean(card.name));
    }, [reading, spreadInfo, visibleCount]);

    const cinematicCardIndex = useMemo(() => {
        if (!Array.isArray(reading) || visibleCount === 0) return -1;
        const positions = spreadInfo?.positions?.slice(0, visibleCount) || [];
        const preferredLabels = ['present', 'core', 'heart', 'outcome'];
        const matchIndex = positions.findIndex((label) => {
            if (!label) return false;
            const normalized = label.toLowerCase();
            return preferredLabels.some((token) => normalized.includes(token));
        });
        if (matchIndex >= 0) return matchIndex;
        return Math.floor(visibleCount / 2);
    }, [reading, spreadInfo, visibleCount]);

    const cinematicCard = cinematicCardIndex >= 0 ? reading?.[cinematicCardIndex] : null;
    const cinematicPosition = cinematicCardIndex >= 0
        ? (spreadInfo?.positions?.[cinematicCardIndex] || `Position ${cinematicCardIndex + 1}`)
        : '';

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
        if (!Array.isArray(reading) || visibleCount === 0) return [];
        const names = reading
            .slice(0, visibleCount)
            .map(card => (typeof card?.name === 'string' ? card.name.trim() : ''))
            .filter(Boolean);
        return Array.from(new Set(names));
    }, [reading, visibleCount]);
    const revealStage = useMemo(() => {
        if (!isHandset || !newDeckInterface || !reading || visibleCount === 0) return 'action';
        if (revealedCards.size === 0) return 'deck';
        if (revealedCards.size < visibleCount) return 'spread';
        return 'action';
    }, [isHandset, newDeckInterface, reading, revealedCards, visibleCount]);
    const shouldStreamNarrative = Boolean(personalReading && !personalReading.isError && !isReadingStreaming && !isServerStreamed);
    const hasPatternHighlights = Boolean(!isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length);
    const traditionalPassages = themes?.knowledgeGraph?.graphRAGPayload?.passages
        || themes?.knowledgeGraph?.retrievedPassages
        || [];
    const hasTraditionalInsights = Boolean(traditionalPassages.length);
    const hasHighlightPanel = Boolean(highlightItems?.length && visibleCount > 0 && revealedCards.size === visibleCount);
    const cardsFullyRevealed = Boolean(reading && visibleCount > 0 && revealedCards.size >= visibleCount);
    const hasInsightPanels = hasPatternHighlights || hasTraditionalInsights || hasHighlightPanel || canShowVisionPanel;
    // Only show focus toggle on desktop; on mobile, panels are below the narrative so users can scroll past them
    const focusToggleAvailable = hasInsightPanels && !isHandset;
    const shouldShowSpreadInsights = cardsFullyRevealed && !isShuffling && !isNarrativeFocus && (hasPatternHighlights || hasHighlightPanel || hasTraditionalInsights);
    const canAutoGenerateVisuals = effectiveTier === 'plus' || effectiveTier === 'pro';
    const canUseMediaGallery = isAuthenticated && canAutoGenerateVisuals;
    const autoGenerateVisuals = Boolean(
        autoGenerateVisualsEnabled &&
        canAutoGenerateVisuals &&
        personalReading &&
        !isPersonalReadingError &&
        narrativePhase === 'complete' &&
        !isReadingStreaming &&
        !isGenerating
    );
    const shouldShowStoryIllustration = Boolean(
        personalReading &&
        !isPersonalReadingError &&
        storyArtCards.length > 0
    );
    const cinematicRevealMessage = autoGenerateVisuals
        ? 'Auto-generating a short cinematic reveal from your completed reading.'
        : 'Generate a short cinematic reveal of this card.';
    const shouldShowCinematicReveal = Boolean(
        cinematicCard &&
        personalReading &&
        !isPersonalReadingError &&
        canAutoGenerateVisuals
    );
    const shouldShowVisualCompanion = shouldShowStoryIllustration || shouldShowCinematicReveal;
    const visualCompanionMessage = autoGenerateVisuals
        ? 'Visual generation is running from your completed narrative.'
        : 'Generate artwork and cinematic motion that stay anchored to this reading.';
    const visualCompanionModeLabel = autoGenerateVisuals ? 'Auto generation on' : 'Generate on demand';
    const canAutoNarrate = voiceOn &&
        autoNarrate &&
        narrativePhase === 'complete' &&
        !isReadingStreaming &&
        !autoNarrationTriggered &&
        ttsProvider !== 'azure';

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
    if (!personalReading && autoNarrationTriggered) {
        setAutoNarrationTriggered(false);
    }

    // --- Handlers ---
    const handleNarrationWrapper = useCallback(() => {
        // Extract emotion from GraphRAG-derived emotional tone for TTS acting instructions
        const emotion = emotionalTone?.emotion || null;
        const narrationText = fullReadingText || narrativeText;
        handleNarrationButtonClick(narrationText, isPersonalReadingError, emotion);
    }, [handleNarrationButtonClick, fullReadingText, narrativeText, isPersonalReadingError, emotionalTone]);

    useEffect(() => {
        autoNarrationStartRef.current = handleNarrationWrapper;
    }, [handleNarrationWrapper]);

    const handleNarrativeHighlight = useCallback((phrase) => {
        if (!phrase || !Array.isArray(reading) || visibleCount === 0) return;
        const normalized = phrase.toLowerCase();
        const matchIndex = reading.findIndex((card) => (
            typeof card?.name === 'string' && card.name.toLowerCase() === normalized
        ));
        if (matchIndex < 0 || matchIndex >= visibleCount) return;

        mentionPulseRef.current += 1;
        setNarrativeMentionPulse({ id: mentionPulseRef.current, index: matchIndex });
        notifyCardMention(matchIndex);

        if (mentionPulseTimeoutRef.current) {
            window.clearTimeout(mentionPulseTimeoutRef.current);
        }
        mentionPulseTimeoutRef.current = window.setTimeout(() => {
            setNarrativeMentionPulse(null);
            mentionPulseTimeoutRef.current = null;
        }, 1100);
    }, [reading, visibleCount, setNarrativeMentionPulse, notifyCardMention]);

    const handleVoicePromptWrapper = useCallback(() => {
        const emotion = emotionalTone?.emotion || null;
        const narrationText = fullReadingText || narrativeText;
        handleVoicePromptEnable(narrationText, emotion);
    }, [handleVoicePromptEnable, fullReadingText, narrativeText, emotionalTone]);

    const shouldHighlightTtsWord = ttsProvider === 'azure-sdk' && ttsState?.status === 'playing';
    const activeWordBoundary = shouldHighlightTtsWord ? wordBoundary : null;
    const narrativePanelProps = {
        personalReading,
        isPersonalReadingError,
        narrativePhase,
        narrativeText,
        fullReadingText,
        shouldStreamNarrative,
        emotionalTone,
        displayName,
        userQuestion,
        reading,
        isHandset,
        isLandscape,
        focusToggleAvailable,
        isNarrativeFocus,
        setIsNarrativeFocus,
        canAutoNarrate,
        handleNarrationWrapper,
        handleNarrationStop,
        notifyCompletion,
        narrativeHighlightPhrases,
        narrativeAtmosphereClassName,
        handleNarrativeHighlight,
        notifySectionEnter,
        activeWordBoundary,
        voiceOn,
        ttsState,
        ttsProvider,
        showVoicePrompt,
        setShowVoicePrompt,
        handleVoicePromptWrapper,
        saveReading,
        isSaving,
        journalStatus,
        shouldShowJournalNudge,
        markJournalNudgeSeen,
        hasHeroStoryArt,
        isMobileStableMode
    };
    const narrativePanel = personalReading ? (
        <NarrativePanel {...narrativePanelProps} />
    ) : null;

    useEffect(() => {
        if (!personalReading) {
            autoNarrationTriggeredRef.current = false;
            if (autoNarrationTimeoutRef.current) {
                window.clearTimeout(autoNarrationTimeoutRef.current);
                autoNarrationTimeoutRef.current = null;
            }
        }
    }, [personalReading]);

    useEffect(() => {
        autoNarrationTriggeredRef.current = autoNarrationTriggered;
    }, [autoNarrationTriggered]);

    useEffect(() => () => {
        if (mentionPulseTimeoutRef.current) {
            window.clearTimeout(mentionPulseTimeoutRef.current);
        }
        if (autoNarrationTimeoutRef.current) {
            window.clearTimeout(autoNarrationTimeoutRef.current);
            autoNarrationTimeoutRef.current = null;
        }
        if (recentlyClosedTimeoutRef.current) {
            window.clearTimeout(recentlyClosedTimeoutRef.current);
            recentlyClosedTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        const shouldDebounceAutoNarrate = shouldScheduleAutoNarration({
            voiceOn,
            autoNarrate,
            isReadingStreaming,
            isPersonalReadingError,
            autoNarrationTriggered: autoNarrationTriggeredRef.current,
            narrativeText,
            ttsProvider,
            ttsStatus: ttsState?.status
        });

        if (!shouldDebounceAutoNarrate) {
            if (autoNarrationTimeoutRef.current) {
                window.clearTimeout(autoNarrationTimeoutRef.current);
                autoNarrationTimeoutRef.current = null;
            }
            return;
        }

        if (autoNarrationTimeoutRef.current) {
            return;
        }

        autoNarrationTimeoutRef.current = window.setTimeout(() => {
            autoNarrationTimeoutRef.current = null;
            if (autoNarrationTriggeredRef.current) return;
            autoNarrationTriggeredRef.current = true;
            setAutoNarrationTriggered(true);
            autoNarrationStartRef.current?.();
        }, STREAM_AUTO_NARRATE_DEBOUNCE_MS);
    }, [
        autoNarrate,
        isPersonalReadingError,
        isReadingStreaming,
        narrativeText,
        ttsState?.status,
        ttsProvider,
        voiceOn
    ]);

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

    const handleCardClick = useCallback((card, position, index) => {
        if (!revealedCards.has(index)) return;
        const payload = { card, position, index, readingKey: readingIdentity };
        setFocusedCardData(payload);
    }, [readingIdentity, revealedCards]);

    const loadMediaGallery = useCallback(async () => {
        if (!canUseMediaGallery) {
            setMediaItems([]);
            setMediaError(null);
            return;
        }

        const requestToken = mediaRequestTokenRef.current + 1;
        mediaRequestTokenRef.current = requestToken;
        setMediaLoading(true);
        setMediaError(null);

        try {
            const response = await fetch('/api/media?limit=36', {
                credentials: 'include'
            });
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (requestToken !== mediaRequestTokenRef.current) return;

            if (!response.ok) {
                setMediaError(data?.error || 'Unable to load media gallery.');
                setMediaLoading(false);
                return;
            }

            const nextItems = Array.isArray(data?.media) ? data.media : [];
            setMediaItems(nextItems);
            setMediaError(null);
            setMediaLoading(false);
        } catch (_err) {
            if (requestToken !== mediaRequestTokenRef.current) return;
            setMediaLoading(false);
            setMediaError('Unable to load media gallery.');
        }
    }, [canUseMediaGallery]);

    const persistMediaRecord = useCallback(async ({
        mediaType,
        source,
        storageKey,
        mimeType,
        title,
        question,
        cardName,
        positionLabel,
        styleId,
        formatId,
        bytes,
        metadata
    }) => {
        if (!canUseMediaGallery || !storageKey || !mediaType || !source || !mimeType) return;

        try {
            const response = await fetch('/api/media', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mediaType,
                    source,
                    storageKey,
                    mimeType,
                    title,
                    question,
                    cardName,
                    positionLabel,
                    styleId,
                    formatId,
                    bytes,
                    metadata
                })
            });
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (!response.ok) {
                setMediaError(data?.error || 'Unable to save generated media.');
                return;
            }

            const next = data?.media;
            if (next?.id) {
                setMediaItems((prev) => {
                    const withoutCurrent = prev.filter((item) => item.id !== next.id);
                    return [next, ...withoutCurrent];
                });
            }
            setMediaError(null);
        } catch (_err) {
            setMediaError('Unable to save generated media.');
        }
    }, [canUseMediaGallery]);

    const handleDeleteMedia = useCallback(async (id) => {
        if (!canUseMediaGallery || !id) return;
        const response = await fetch(`/api/media?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }
        if (!response.ok) {
            throw new Error(data?.error || 'Unable to remove media.');
        }
        setMediaItems((prev) => prev.filter((item) => item.id !== id));
    }, [canUseMediaGallery]);

    const handleCinematicMediaReady = useCallback((_videoBase64, meta = {}) => {
        if (!meta?.cacheKey) return;
        const cardName = meta?.card?.name || cinematicCard?.name || null;
        const positionLabel = meta?.position || cinematicPosition || null;
        const title = cardName
            ? `${cardName}${positionLabel ? ` • ${positionLabel}` : ''}`
            : 'Cinematic reveal';

        void persistMediaRecord({
            mediaType: 'video',
            source: 'card-reveal',
            storageKey: meta.cacheKey,
            mimeType: meta.mimeType || 'video/mp4',
            title,
            question: resolvedQuestion,
            cardName,
            positionLabel,
            styleId: meta.style || null,
            formatId: 'single',
            metadata: {
                seconds: meta.seconds || 4,
                reversed: Boolean(meta?.card?.reversed)
            }
        });
    }, [cinematicCard?.name, cinematicPosition, persistMediaRecord, resolvedQuestion]);

    const handleStoryArtMediaReady = useCallback((_imageBase64, meta = {}) => {
        setHasHeroStoryArt(true);
        if (!meta?.cacheKey) return;
        const title = meta?.format === 'triptych'
            ? 'Story illustration triptych'
            : 'Story illustration';
        void persistMediaRecord({
            mediaType: 'image',
            source: 'story-art',
            storageKey: meta.cacheKey,
            mimeType: meta.mimeType || 'image/jpeg',
            title,
            question: resolvedQuestion,
            styleId: meta.style || null,
            formatId: meta.format || null,
            metadata: {
                cardCount: Array.isArray(storyArtCards) ? storyArtCards.length : 0,
                format: meta.format || null
            }
        });
    }, [persistMediaRecord, resolvedQuestion, setHasHeroStoryArt, storyArtCards]);

    useEffect(() => {
        if (!canUseMediaGallery) return;
        const timerId = window.setTimeout(() => {
            void loadMediaGallery();
        }, 0);
        return () => window.clearTimeout(timerId);
    }, [canUseMediaGallery, loadMediaGallery]);

    const handleOpenModalFromPanel = useCallback((cardData) => {
        if (!cardData) return;
        setSelectedCardData(cardData);
    }, [setSelectedCardData]);
    const handleCloseDetail = useCallback(() => {
        if (!focusedCardData) {
            if (recentlyClosedTimeoutRef.current) {
                window.clearTimeout(recentlyClosedTimeoutRef.current);
                recentlyClosedTimeoutRef.current = null;
            }
            setSelectedCardData(null);
            return;
        }
        const idx = focusedCardData.index;
        setFocusedCardData(null);
        setSelectedCardData(null);
        setRecentlyClosedIndex(idx);
        if (recentlyClosedTimeoutRef.current) {
            window.clearTimeout(recentlyClosedTimeoutRef.current);
        }
        const target = document.getElementById(`spread-slot-${idx}`);
        if (target?.scrollIntoView) {
            target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'center' });
        }
        recentlyClosedTimeoutRef.current = window.setTimeout(() => {
            setRecentlyClosedIndex(-1);
            recentlyClosedTimeoutRef.current = null;
        }, 900);
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

    const sceneData = {
        dominantSuit,
        dominantElement,
        particleIntensity: sceneIntensity[sceneOrchestrator.activeScene] || 0.8,
        isGenerating,
        personalReading,
        isPersonalReadingError,
        reasoningSummary,
        narrativePhase,
        narrativeAtmosphereClasses,
        shouldShowInterlude,
        spreadName: spreadInfo?.name,
        displayName,
        userQuestion,
        readingCount: reading?.length || 0,
        reasoning,
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
        nextLabel,
        spreadPositions: spreadInfo?.positions || [],
        handleAnimatedDeal,
        deckRef,
        revealStage,
        dealNext,
        isLandscape,
        guidedRevealLabel,
        handleRevealAllWithScroll,
        handleResetReveals,
        safeSpreadKey,
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
        narrativeMentionPulse,
        generatePersonalReading,
        hasVisionData,
        isVisionReady,
        isHandset,
        isShuffling,
        shuffle,
        readingMeta,
        selectedSpread,
        deckStyleId,
        lastCardsForFeedback,
        feedbackVisionSummary,
        canUseMediaGallery,
        mediaItems,
        mediaLoading,
        mediaError,
        onRefreshMedia: loadMediaGallery,
        onDeleteMedia: handleDeleteMedia,
        followUpOpen: isFollowUpOpen,
        setFollowUpOpen: setIsFollowUpOpen,
        followUpAutoFocus,
        narrativePanel,
        isMobileStableMode
    };

    const sceneShellClassName = sceneOrchestrator.activeScene === 'interlude'
        ? ''
        : 'scene-shell';

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
                <SceneShell
                    orchestrator={sceneOrchestrator}
                    scenes={SCENE_COMPONENTS}
                    sceneData={sceneData}
                    colorScript={activeColorScript}
                    colorScriptOwner={COLOR_SCRIPT_OWNER}
                    isMobileStableMode={isMobileStableMode}
                    className={sceneShellClassName}
                >
                    <div className={isLandscape ? 'space-y-4' : 'space-y-8'}>
                        <NarrativeReadingSurface
                            shouldShowVisualCompanion={shouldShowVisualCompanion}
                            shouldShowCinematicReveal={shouldShowCinematicReveal}
                            shouldShowStoryIllustration={shouldShowStoryIllustration}
                            visualCompanionModeLabel={visualCompanionModeLabel}
                            visualCompanionMessage={visualCompanionMessage}
                            cinematicPosition={cinematicPosition}
                            cinematicRevealMessage={cinematicRevealMessage}
                            readingIdentity={readingIdentity}
                            cinematicCard={cinematicCard}
                            resolvedQuestion={resolvedQuestion}
                            effectiveTier={effectiveTier}
                            autoGenerateVisuals={autoGenerateVisuals}
                            onCinematicMediaReady={handleCinematicMediaReady}
                            storyArtCards={storyArtCards}
                            fullReadingText={fullReadingText}
                            narrativeText={narrativeText}
                            onStoryArtMediaReady={handleStoryArtMediaReady}
                            personalReading={personalReading}
                            isGenerating={isGenerating}
                            isHandset={isHandset}
                            shouldShowSpreadInsights={shouldShowSpreadInsights}
                            themes={themes}
                            highlightItems={highlightItems}
                            traditionalPassages={traditionalPassages}
                        />

                    </div>
                </SceneShell>
            )}

            {selectedCardData && (
                <CardModal
                    card={selectedCardData.card}
                    position={selectedCardData.position}
                    question={resolvedQuestion}
                    userTier={effectiveTier}
                    enableCinematic
                    isOpen={!!selectedCardData}
                    onClose={handleCloseDetail}
                    layoutId={`card-${selectedCardData.index}`}
                    onNavigate={handleNavigateCard}
                    canNavigatePrev={navigationData.canPrev}
                    canNavigateNext={navigationData.canNext}
                    navigationLabel={navigationData.label}
                />
            )}

            {/* Ghost card animation - deck to slot fly effect */}
            {ghostAnimation && (
                <GhostCard
                    startRect={ghostAnimation.startRect}
                    endRect={ghostAnimation.endRect}
                    suit={ghostAnimation.suit}
                    onComplete={handleGhostComplete}
                />
            )}
        </section>
    );
}
