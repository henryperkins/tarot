import { getOrientationMeaning } from '../lib/cardLookup.js';
import { getNarrationLabels } from '../components/reading/narrative/narrationLabels.js';

export function getResolvedQuestion(userQuestion) {
  if (typeof userQuestion !== 'string') return 'General guidance';
  const trimmed = userQuestion.trim();
  return trimmed.length > 0 ? trimmed : 'General guidance';
}

export function buildNarrativeText(personalReading) {
  if (!personalReading) return '';
  if (personalReading.hasMarkdown) {
    return personalReading.raw || personalReading.normalized || '';
  }
  if (Array.isArray(personalReading.paragraphs) && personalReading.paragraphs.length > 0) {
    return personalReading.paragraphs.join('\n\n');
  }
  return personalReading.normalized || personalReading.raw || '';
}

export function buildNarrativeHighlightPhrases({ reading, visibleCount }) {
  if (!Array.isArray(reading) || visibleCount === 0) return [];

  const names = reading
    .slice(0, visibleCount)
    .map((card) => (typeof card?.name === 'string' ? card.name.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(names));
}

export function buildStoryArtCards({ reading, visibleCount, spreadPositions = [] }) {
  if (!Array.isArray(reading) || visibleCount === 0) return [];

  return reading
    .slice(0, visibleCount)
    .map((card, index) => ({
      name: card?.name,
      number: card?.number ?? null,
      suit: card?.suit ?? null,
      rank: card?.rank ?? null,
      rankValue: card?.rankValue ?? null,
      position: spreadPositions[index] || `Position ${index + 1}`,
      reversed: Boolean(card?.isReversed),
      meaning: getOrientationMeaning(card)
    }))
    .filter((card) => Boolean(card.name));
}

export function selectCinematicCard({ reading, visibleCount, spreadPositions = [] }) {
  if (!Array.isArray(reading) || visibleCount === 0) {
    return {
      cinematicCardIndex: -1,
      cinematicCard: null,
      cinematicPosition: ''
    };
  }

  const positions = spreadPositions.slice(0, visibleCount);
  const preferredLabels = ['present', 'core', 'heart', 'outcome'];
  const cinematicCardIndex = positions.findIndex((label) => {
    if (!label) return false;
    const normalized = String(label).toLowerCase();
    return preferredLabels.some((token) => normalized.includes(token));
  });
  const resolvedIndex = cinematicCardIndex >= 0 ? cinematicCardIndex : Math.floor(visibleCount / 2);

  return {
    cinematicCardIndex: resolvedIndex,
    cinematicCard: reading[resolvedIndex] || null,
    cinematicPosition: spreadPositions[resolvedIndex] || `Position ${resolvedIndex + 1}`
  };
}

export function getTraditionalPassages(themes) {
  return themes?.knowledgeGraph?.graphRAGPayload?.passages
    || themes?.knowledgeGraph?.retrievedPassages
    || [];
}

export function deriveNarrativeVisibility({
  personalReading,
  isPersonalReadingError,
  isReadingStreaming,
  narrativePhase,
  themes,
  highlightItems = [],
  visibleCount,
  revealedCardsSize,
  isShuffling,
  isNarrativeFocus,
  canShowVisionPanel,
  effectiveTier,
  isAuthenticated,
  autoGenerateVisualsEnabled,
  isGenerating,
  storyArtCards = [],
  cinematicCard,
  isHandset
}) {
  const traditionalPassages = getTraditionalPassages(themes);
  const hasPatternHighlights = Boolean(!isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length);
  const hasTraditionalInsights = traditionalPassages.length > 0;
  const hasHighlightPanel = Boolean(highlightItems.length && visibleCount > 0 && revealedCardsSize === visibleCount);
  const cardsFullyRevealed = Boolean(visibleCount > 0 && revealedCardsSize >= visibleCount);
  const hasInsightPanels = hasPatternHighlights || hasTraditionalInsights || hasHighlightPanel || canShowVisionPanel;
  const focusToggleAvailable = hasInsightPanels && !isHandset;
  const shouldShowSpreadInsights = cardsFullyRevealed
    && !isShuffling
    && !isNarrativeFocus
    && (hasPatternHighlights || hasHighlightPanel || hasTraditionalInsights);
  const canAutoGenerateVisuals = effectiveTier === 'plus' || effectiveTier === 'pro';
  const canUseMediaGallery = Boolean(isAuthenticated && canAutoGenerateVisuals);
  const autoGenerateVisuals = Boolean(
    autoGenerateVisualsEnabled
    && canAutoGenerateVisuals
    && personalReading
    && !isPersonalReadingError
    && narrativePhase === 'complete'
    && !isReadingStreaming
    && !isGenerating
  );
  const shouldShowStoryIllustration = Boolean(
    personalReading
    && !isPersonalReadingError
    && storyArtCards.length > 0
  );
  const shouldShowCinematicReveal = Boolean(
    cinematicCard
    && personalReading
    && !isPersonalReadingError
    && canAutoGenerateVisuals
  );
  const shouldShowVisualCompanion = shouldShowStoryIllustration || shouldShowCinematicReveal;

  return {
    traditionalPassages,
    hasPatternHighlights,
    hasTraditionalInsights,
    hasHighlightPanel,
    cardsFullyRevealed,
    hasInsightPanels,
    focusToggleAvailable,
    shouldShowSpreadInsights,
    canAutoGenerateVisuals,
    canUseMediaGallery,
    autoGenerateVisuals,
    shouldShowStoryIllustration,
    shouldShowCinematicReveal,
    shouldShowVisualCompanion,
    cinematicRevealMessage: autoGenerateVisuals
      ? 'Auto-generating a short cinematic reveal from your completed reading.'
      : 'Generate a short cinematic reveal of this card.',
    visualCompanionMessage: autoGenerateVisuals
      ? 'Visual generation is running from your completed narrative.'
      : 'Generate artwork and cinematic motion that stay anchored to this reading.',
    visualCompanionModeLabel: autoGenerateVisuals ? 'Auto generation on' : 'Generate on demand'
  };
}

export function buildNarrativePanelModel({
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
  focusToggleAvailable,
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
}) {
  const hasNarrativeContext = Boolean(personalReading && !isPersonalReadingError);
  const narrationState = ttsState?.status || 'idle';
  const isNarrationLoading = narrationState === 'loading';
  const isNarrationPlaying = narrationState === 'playing';
  const isNarrationPaused = narrationState === 'paused';
  const isNarrationActive = isNarrationLoading || isNarrationPlaying || isNarrationPaused;
  const canNarrate = Boolean(fullReadingText) && !isNarrationLoading;
  const showNarrationStop = Boolean(fullReadingText && isNarrationActive);
  const showSaveButton = hasNarrativeContext && !isHandset && narrativePhase === 'complete';
  const showJournalNudge = Boolean(
    shouldShowJournalNudge
    && personalReading
    && !personalReading.isError
    && !journalStatus
  );
  const panelClassName = `bg-surface/95 ${isMobileStableMode ? 'narrative-panel--stable' : 'backdrop-blur-xl'} rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto min-h-[6rem] xxs:min-h-[7.5rem] md:min-h-[10rem] ${isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'}`;
  const question = typeof userQuestion === 'string' ? userQuestion.trim() : '';
  const { full: narrationLabel, compact: narrationLabelCompact } = getNarrationLabels(narrationState);

  return {
    panelClassName,
    question,
    isHandset,
    personalReading,
    shouldStreamNarrative,
    narrativeText,
    canAutoNarrate,
    displayName,
    narrativeHighlightPhrases,
    emotionalTone,
    activeWordBoundary,
    narrativeAtmosphereClassName,
    hasHeroStoryArt,
    focusToggleAvailable,
    isNarrativeFocus,
    ttsState,
    journalStatus,
    controlsModel: {
      show: hasNarrativeContext,
      canNarrate,
      narrationLabel,
      narrationLabelCompact,
      showNarrationStop,
      showSaveButton,
      isSaving
    },
    statusModel: {
      showNarrationStatus: hasNarrativeContext && narrationState !== 'idle' && narrationState !== 'completed',
      showNarrationProgress: hasNarrativeContext && ttsProvider === 'azure' && (isNarrationPlaying || isNarrationPaused),
      showNarrationTierLimit: ttsState?.status === 'error' && ttsState?.errorCode === 'TIER_LIMIT',
      showVoicePrompt: Boolean(showVoicePrompt),
      showJournalStatus: Boolean(journalStatus),
      showJournalNudge
    }
  };
}

export function buildNarrativeSurfaceModel({
  shouldShowVisualCompanion,
  shouldShowCinematicReveal,
  shouldShowStoryIllustration,
  visualCompanionModeLabel,
  visualCompanionMessage,
  cinematicPosition,
  cinematicRevealMessage,
  readingIdentity,
  cinematicCard,
  resolvedQuestion,
  effectiveTier,
  autoGenerateVisuals,
  storyArtCards,
  fullReadingText,
  narrativeText,
  personalReading,
  isGenerating,
  isHandset,
  shouldShowSpreadInsights,
  themes,
  highlightItems,
  traditionalPassages,
  isLandscape
}) {
  return {
    shouldShowVisualCompanion,
    shouldShowCinematicReveal,
    shouldShowStoryIllustration,
    visualCompanionModeLabel,
    visualCompanionMessage,
    cinematicPosition,
    cinematicRevealMessage,
    readingIdentity,
    cinematicCard,
    resolvedQuestion,
    effectiveTier,
    autoGenerateVisuals,
    storyArtCards,
    fullReadingText,
    narrativeText,
    personalReading,
    isGenerating,
    isHandset,
    shouldShowSpreadInsights,
    themes,
    highlightItems,
    traditionalPassages,
    layoutClassName: isLandscape ? 'space-y-4' : 'space-y-8'
  };
}
