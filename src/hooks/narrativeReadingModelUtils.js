import { getCardForDeck, getOrientationMeaning } from '../lib/cardLookup.js';
import { getNarrationLabels } from '../components/reading/narrative/narrationLabels.js';
import { extractShortLabel } from '../components/readingBoardUtils.js';
import { getGestureArtworkAsset } from '../data/cardGestureAssets.js';
import { isServerNarrationProvider } from '../../shared/narrationProviders.js';
import { getReadingSections } from '../lib/narrativeSections.js';
import { getVisibleTraditionalPassages } from '../lib/spreadInsights.js';

export function getResolvedQuestion(userQuestion) {
  if (typeof userQuestion !== 'string') return 'General guidance';
  const trimmed = userQuestion.trim();
  return trimmed.length > 0 ? trimmed : 'General guidance';
}

export function buildNarrativeText(personalReading) {
  if (!personalReading) return '';
  if (personalReading.hasMarkdown || getReadingSections(personalReading.raw).some(section => section.depth !== null)) {
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

// Each deck prints its cards at its own proportions, and some Thoth scans are
// loose crops, so the reading frames card art at the deck's card shape.
const CARD_FRAMES = { 'rws-1909': '100 / 172', 'thoth-a1': '3 / 5', 'marseille-classic': '16 / 31' };

/**
 * The revealed spread as the reading surface shows it beside the narrative:
 * the selected deck's names and art, with canonical identity kept for matching.
 */
export function buildSpreadCompanionCards({ reading, visibleCount, spreadPositions = [], deckStyleId, revealedCards = null, runId = null, artworkEdition = null, inspectionAvailable = false, reflections = null }) {
  if (!Array.isArray(reading) || visibleCount === 0) return [];

  return reading
    .slice(0, visibleCount)
    .map((card, index) => {
      if (!card || (revealedCards && typeof revealedCards.has === 'function' && !revealedCards.has(index))) return null;
      const deckCard = getCardForDeck(card, deckStyleId);
      const position = spreadPositions[index] || `Position ${index + 1}`;
      const vectorImage = deckStyleId === 'rws-1909' && artworkEdition === 'rws-immanuelle-vector'
        ? getGestureArtworkAsset(deckCard.canonicalName, artworkEdition) : null;
      // A visual binding cannot change the selected deck or attach RWS geometry
      // to a scan from another edition. Unsupported editions remain whole-card.
      const edition = artworkEdition === 'rws-immanuelle-vector' && !vectorImage
        ? `identity:${deckStyleId}` : artworkEdition || (deckStyleId === 'rws-1909' ? 'rws-1909-scan' : null);
      // Live and saved reflections are keyed by the original spread position,
      // even when unrevealed cards are omitted. General notes cannot prove a
      // card-specific reference, and duplicate card names never share notes.
      const indexedReflection = reflections && typeof reflections === 'object' && Object.hasOwn(reflections, index)
        ? reflections[index] : '';
      const reflection = card.userReflection || card.reflection || indexedReflection;
      return {
        index,
        occurrenceId: runId ? `${runId}:${index}` : null,
        artworkEdition: edition,
        inspectionAvailable: Boolean(inspectionAvailable),
        userReflection: typeof reflection === 'string' ? reflection.trim() : '',
        name: deckCard.name,
        canonicalName: deckCard.canonicalName,
        image: vectorImage || deckCard.image,
        frame: vectorImage ? '3 / 5' : CARD_FRAMES[deckStyleId] || CARD_FRAMES['rws-1909'],
        isReversed: Boolean(card.isReversed),
        number: deckCard.number ?? null,
        suit: deckCard.suit ?? null,
        rank: deckCard.rank ?? null,
        rankValue: deckCard.rankValue ?? null,
        positionLabel: extractShortLabel(position, 40) || position,
        shortLabel: extractShortLabel(position, 28) || `Card ${index + 1}`
      };
    })
    .filter(Boolean);
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

export function buildReadingDisplayCards({ reading, visibleCount, spreadPositions = [], deckStyleId = 'rws-1909' }) {
  if (!Array.isArray(reading)) return [];
  return reading.slice(0, visibleCount).map((card, index) => {
    const deckCard = getCardForDeck(card, deckStyleId);
    const position = spreadPositions[index] || 'Position ' + (index + 1);
    return {
      ...deckCard,
      index,
      isReversed: Boolean(card.isReversed),
      positionLabel: extractShortLabel(position, 40) || position,
      fullPositionLabel: position,
      frame: { 'rws-1909': '100 / 172', 'thoth-a1': '3 / 5', 'marseille-classic': '16 / 31' }[deckStyleId] || '100 / 172'
    };
  });
}

export function getTraditionalPassages(themes, readingMeta) {
  if (readingMeta?.provider === 'safe-fallback') return [];
  const candidates = themes?.knowledgeGraph?.graphRAGPayload?.passages
    || themes?.knowledgeGraph?.retrievedPassages
    || [];
  if (!Array.isArray(candidates)) return [];
  const usage = readingMeta?.sourceUsage?.graphRAG;
  if (usage?.used === false || usage?.mode === 'none' || usage?.mode === 'summary' || usage?.passagesUsedInPrompt === 0) return [];
  if (Array.isArray(usage?.passageIndices)) {
    return getVisibleTraditionalPassages([...new Set(usage.passageIndices)]
      .filter(index => Number.isInteger(index) && index >= 0 && index < candidates.length)
      .map(index => candidates[index]));
  }
  // Older trimmed snapshots record only a count, which cannot identify the
  // retained references after ranking. Do not guess which candidates survived.
  if (Number.isFinite(usage?.passagesUsedInPrompt) && usage.passagesUsedInPrompt !== candidates.length) return [];
  return getVisibleTraditionalPassages(candidates);
}

export function deriveNarrativeVisibility({
  personalReading,
  isPersonalReadingError,
  isReadingStreaming,
  narrativePhase,
  themes,
  readingMeta,
  highlightItems = [],
  visibleCount,
  revealedCardsSize,
  isShuffling,
  canShowVisionPanel,
  effectiveTier,
  isAuthenticated,
  cardVideoEnabled = false,
  isGenerating,
  storyArtCards = [],
  cinematicCard
}) {
  const traditionalPassages = getTraditionalPassages(themes, readingMeta);
  const hasPatternHighlights = Boolean(!isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length);
  const hasTraditionalInsights = traditionalPassages.length > 0;
  const hasHighlightPanel = Boolean(highlightItems.length && visibleCount > 0 && revealedCardsSize === visibleCount);
  const cardsFullyRevealed = Boolean(visibleCount > 0 && revealedCardsSize >= visibleCount);
  const hasInsightPanels = hasPatternHighlights || hasTraditionalInsights || hasHighlightPanel || canShowVisionPanel;
  const focusToggleAvailable = hasInsightPanels;
  const shouldShowSpreadInsights = cardsFullyRevealed
    && !isShuffling
    && (hasPatternHighlights || hasHighlightPanel || hasTraditionalInsights);
  const canAutoGenerateVisuals = effectiveTier === 'plus' || effectiveTier === 'pro';
  const canUseMediaGallery = Boolean(isAuthenticated && canAutoGenerateVisuals);
  const isReadingComplete = Boolean(
    personalReading && !isPersonalReadingError
    && narrativePhase === 'complete' && !isReadingStreaming && !isGenerating
  );
  // Media generation starts only from an explicit studio action. Legacy build
  // flags must not advertise or enable background generation.
  const autoGenerateVisuals = false;
  const shouldShowStoryIllustration = Boolean(
    isReadingComplete
    && storyArtCards.length > 0
  );
  const shouldShowCinematicReveal = Boolean(
    cardVideoEnabled
    && cinematicCard
    && isReadingComplete
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
    cinematicRevealMessage: 'Generate a short cinematic reveal of this card.',
    visualCompanionMessage: shouldShowCinematicReveal
      ? 'Generate artwork and cinematic motion that stay anchored to this reading.'
      : 'Generate artwork that stays anchored to this reading.',
    visualCompanionModeLabel: 'Generate on demand'
  };
}

export function buildNarrativePanelModel({
  reflections = null,
  personalReading,
  isPersonalReadingError,
  isReadingStreaming,
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
  isMobileStableMode,
  spreadCards = [],
  cardLinkCatalog = null,
  gestureSource = null,
  gestureStudyEnabled = false,
  gestureSidecar = null,
  personalContext = null,
  manualInspectionStatus = null
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
  const panelClassName = `narrative-panel bg-surface/95 ${isMobileStableMode ? 'narrative-panel--stable' : 'backdrop-blur-xl'} rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto min-h-24 xxs:min-h-30 md:min-h-40 ${isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'}`;
  const question = typeof userQuestion === 'string' ? userQuestion : '';
  const { full: narrationLabel, compact: narrationLabelCompact } = getNarrationLabels(narrationState);

  return {
    panelClassName,
    gestureSource,
    gestureStudyEnabled,
    gestureSidecar,
    personalContext,
    manualInspectionStatus,
    question,
    reflections,
    isHandset,
    personalReading,
    shouldStreamNarrative,
    isReadingStreaming,
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
    spreadCards,
    cardLinkCatalog,
    isMobileStableMode: Boolean(isMobileStableMode),
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
      showNarrationProgress: hasNarrativeContext && isServerNarrationProvider(ttsProvider) && (isNarrationPlaying || isNarrationPaused),
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
  insightCards,
  isLandscape
}) {
  const shouldShowSafetyNotice = !personalReading && !isGenerating;

  return {
    hasSecondaryContent: Boolean(shouldShowVisualCompanion || shouldShowSpreadInsights || shouldShowSafetyNotice),
    shouldShowSafetyNotice,
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
    insightCards,
    layoutClassName: isLandscape ? 'space-y-4' : 'space-y-8'
  };
}
