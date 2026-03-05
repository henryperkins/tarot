import { createElement, useCallback, useEffect, useMemo } from 'react';
import { NarrativePanel } from '../components/NarrativePanel';
import { NarrativeReadingSurface } from '../components/NarrativeReadingSurface';
import { useNarrationAutomation } from './useNarrationAutomation';
import {
  getNarrativeBiasClass,
  getNarrativePhaseClass,
  getNarrativeSuitClass
} from '../lib/narrativeAtmosphere';
import {
  buildNarrativeHighlightPhrases,
  buildNarrativePanelModel,
  buildNarrativeSurfaceModel,
  buildNarrativeText,
  buildStoryArtCards,
  deriveNarrativeVisibility,
  getResolvedQuestion,
  selectCinematicCard
} from './narrativeReadingModelUtils.js';

export function useNarrativeReadingController({
  reading,
  visibleCount,
  spreadPositions,
  personalReading,
  isReadingStreamActive,
  narrativePhase,
  themes,
  reasoning,
  emotionalTone,
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
  userQuestion,
  displayName,
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
  beatClassName = '',
  isMobileStableMode = false
}) {
  const resolvedQuestion = useMemo(() => getResolvedQuestion(userQuestion), [userQuestion]);
  const isPersonalReadingError = Boolean(personalReading?.isError);
  const isReadingStreaming = Boolean(isReadingStreamActive || personalReading?.isStreaming);
  const isServerStreamed = Boolean(personalReading?.isServerStreamed);
  const fullReadingText = !isPersonalReadingError && !isReadingStreaming
    ? personalReading?.raw || personalReading?.normalized || ''
    : '';
  const narrativeText = useMemo(() => buildNarrativeText(personalReading), [personalReading]);
  const narrativeHighlightPhrases = useMemo(() => (
    buildNarrativeHighlightPhrases({ reading, visibleCount })
  ), [reading, visibleCount]);
  const storyArtCards = useMemo(() => (
    buildStoryArtCards({ reading, visibleCount, spreadPositions })
  ), [reading, spreadPositions, visibleCount]);
  const { cinematicCard, cinematicPosition } = useMemo(() => (
    selectCinematicCard({ reading, visibleCount, spreadPositions })
  ), [reading, spreadPositions, visibleCount]);

  const narrativeAtmosphereClasses = useMemo(() => {
    const classes = [
      getNarrativePhaseClass(isGenerating ? narrativePhase : null),
      getNarrativeBiasClass(reasoning?.narrativeArc?.templateBias),
      getNarrativeSuitClass(themes?.dominantSuit)
    ];
    return classes.filter(Boolean).join(' ');
  }, [isGenerating, narrativePhase, reasoning?.narrativeArc?.templateBias, themes?.dominantSuit]);

  const visibilityState = useMemo(() => deriveNarrativeVisibility({
    personalReading,
    isPersonalReadingError,
    isReadingStreaming,
    narrativePhase,
    themes,
    highlightItems,
    visibleCount,
    revealedCardsSize: revealedCards?.size ?? revealedCards?.length ?? 0,
    isShuffling,
    isNarrativeFocus,
    canShowVisionPanel,
    effectiveTier,
    isAuthenticated,
    autoGenerateVisualsEnabled,
    isGenerating,
    storyArtCards,
    cinematicCard,
    isHandset
  }), [
    autoGenerateVisualsEnabled,
    canShowVisionPanel,
    cinematicCard,
    effectiveTier,
    highlightItems,
    isAuthenticated,
    isGenerating,
    isHandset,
    isNarrativeFocus,
    isPersonalReadingError,
    isReadingStreaming,
    isShuffling,
    narrativePhase,
    personalReading,
    revealedCards,
    storyArtCards,
    themes,
    visibleCount
  ]);

  const shouldStreamNarrative = Boolean(
    personalReading
    && !personalReading.isError
    && !isReadingStreaming
    && !isServerStreamed
  );
  const {
    canAutoNarrate,
    handleNarration,
    handleVoicePrompt
  } = useNarrationAutomation({
    voiceOn,
    autoNarrate,
    narrativePhase,
    isReadingStreaming,
    isPersonalReadingError,
    fullReadingText,
    narrativeText,
    emotionalTone,
    ttsProvider,
    ttsStatus: ttsState?.status,
    readingIdentity,
    personalReading,
    handleNarrationButtonClick,
    handleVoicePromptEnable
  });
  const activeWordBoundary = ttsProvider === 'azure-sdk' && ttsState?.status === 'playing'
    ? wordBoundary
    : null;
  const narrativeAtmosphereClassName = useMemo(() => (
    [narrativeAtmosphereClasses, beatClassName].filter(Boolean).join(' ')
  ), [beatClassName, narrativeAtmosphereClasses]);

  useEffect(() => {
    if (!visibilityState.hasInsightPanels && isNarrativeFocus) {
      setIsNarrativeFocus(false);
    }
  }, [isNarrativeFocus, setIsNarrativeFocus, visibilityState.hasInsightPanels]);

  const handleToggleNarrativeFocus = useCallback(() => {
    setIsNarrativeFocus((prev) => !prev);
  }, [setIsNarrativeFocus]);

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

  const panelModel = useMemo(() => buildNarrativePanelModel({
    personalReading,
    isPersonalReadingError,
    narrativePhase,
    narrativeText,
    fullReadingText,
    shouldStreamNarrative,
    emotionalTone,
    displayName,
    userQuestion,
    isHandset,
    isLandscape,
    focusToggleAvailable: visibilityState.focusToggleAvailable,
    isNarrativeFocus,
    canAutoNarrate,
    narrativeHighlightPhrases,
    narrativeAtmosphereClassName,
    activeWordBoundary,
    ttsState,
    ttsProvider,
    showVoicePrompt,
    isSaving,
    journalStatus,
    shouldShowJournalNudge,
    hasHeroStoryArt,
    isMobileStableMode
  }), [
    activeWordBoundary,
    canAutoNarrate,
    displayName,
    emotionalTone,
    fullReadingText,
    hasHeroStoryArt,
    isHandset,
    isLandscape,
    isMobileStableMode,
    isNarrativeFocus,
    isPersonalReadingError,
    isSaving,
    journalStatus,
    narrativeAtmosphereClassName,
    narrativeHighlightPhrases,
    narrativePhase,
    narrativeText,
    personalReading,
    shouldShowJournalNudge,
    shouldStreamNarrative,
    showVoicePrompt,
    ttsProvider,
    ttsState,
    userQuestion,
    visibilityState.focusToggleAvailable
  ]);

  const surfaceModel = useMemo(() => buildNarrativeSurfaceModel({
    shouldShowVisualCompanion: visibilityState.shouldShowVisualCompanion,
    shouldShowCinematicReveal: visibilityState.shouldShowCinematicReveal,
    shouldShowStoryIllustration: visibilityState.shouldShowStoryIllustration,
    visualCompanionModeLabel: visibilityState.visualCompanionModeLabel,
    visualCompanionMessage: visibilityState.visualCompanionMessage,
    cinematicPosition,
    cinematicRevealMessage: visibilityState.cinematicRevealMessage,
    readingIdentity,
    cinematicCard,
    resolvedQuestion,
    effectiveTier,
    autoGenerateVisuals: visibilityState.autoGenerateVisuals,
    storyArtCards,
    fullReadingText,
    narrativeText,
    personalReading,
    isGenerating,
    isHandset,
    shouldShowSpreadInsights: visibilityState.shouldShowSpreadInsights,
    themes,
    highlightItems,
    traditionalPassages: visibilityState.traditionalPassages,
    isLandscape
  }), [
    cinematicCard,
    cinematicPosition,
    effectiveTier,
    fullReadingText,
    highlightItems,
    isGenerating,
    isHandset,
    isLandscape,
    narrativeText,
    personalReading,
    readingIdentity,
    resolvedQuestion,
    storyArtCards,
    themes,
    visibilityState
  ]);

  const panelCallbacks = useMemo(() => ({
    onToggleNarrativeFocus: handleToggleNarrativeFocus,
    onNarrationStart: handleNarration,
    onStopNarration: handleNarrationStop,
    onNarrativeComplete: notifyCompletion,
    onHighlightPhrase: handleNarrativeHighlight,
    onSectionEnter: notifySectionEnter,
    onEnableVoice: handleVoicePrompt,
    onDismissVoicePrompt: () => setShowVoicePrompt?.(false),
    onSaveReading: saveReading,
    onOpenJournal: handleOpenJournal,
    onViewJournalEntry: handleOpenJournalEntry,
    onUpgradeTier: handleOpenSubscriptionSettings,
    onSaveFromNudge: () => {
      saveReading?.();
      markJournalNudgeSeen?.();
    },
    onDismissNudge: markJournalNudgeSeen
  }), [
    handleNarration,
    handleNarrationStop,
    handleNarrativeHighlight,
    handleOpenJournal,
    handleOpenJournalEntry,
    handleOpenSubscriptionSettings,
    handleToggleNarrativeFocus,
    handleVoicePrompt,
    markJournalNudgeSeen,
    notifyCompletion,
    notifySectionEnter,
    saveReading,
    setShowVoicePrompt
  ]);

  const surfaceCallbacks = useMemo(() => ({
    onCinematicMediaReady: handleCinematicMediaReady,
    onStoryArtMediaReady: handleStoryArtMediaReady
  }), [handleCinematicMediaReady, handleStoryArtMediaReady]);

  const narrativePanel = personalReading
    ? createElement(NarrativePanel, { panelModel, callbacks: panelCallbacks })
    : null;
  const secondaryContent = createElement(
    'div',
    { className: surfaceModel.layoutClassName },
    createElement(NarrativeReadingSurface, { surfaceModel, callbacks: surfaceCallbacks })
  );

  return {
    resolvedQuestion,
    isPersonalReadingError,
    isReadingStreaming,
    fullReadingText,
    narrativeText,
    narrativeAtmosphereClasses,
    canUseMediaGallery: visibilityState.canUseMediaGallery,
    narrativeModel: {
      narrativePanel,
      secondaryContent,
      personalReading
    }
  };
}
