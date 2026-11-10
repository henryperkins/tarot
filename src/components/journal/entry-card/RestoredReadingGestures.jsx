import { useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { buildSpreadCompanionCards } from '../../../hooks/narrativeReadingModelUtils';
import { useReadingGestureRuntime } from '../../../hooks/useReadingGestureRuntime';
import { reconcileSavedGestureSource } from '../../../lib/savedReadingGestureSource';
import { hydrateEntryVisuals } from '../../../utils/journalStorage';
import { visualStorageNamespace } from '../../../lib/readingVisualStorage';
import { readingGestureEdition, readingGesturesEnabled } from '../../../lib/readingGestureSettings';
import { NarrativeGestureGate, GatedSpreadCompanion as SpreadCompanion } from '../../reading/narrative/NarrativeGestureGate';
import { StreamingNarrative } from '../../StreamingNarrative';
export { SavedVisualRecovery } from './SavedVisualRecovery';

const noop = () => {};

/** Restored cues remain static, including explicit inspection. No arrival replay. */
export function RestoredReadingGestures({ entry }) {
  const { user } = useAuth();
  const namespace = visualStorageNamespace(user?.id);
  return <SavedReadingCompanion key={`${namespace}:${entry.id}`} entry={entry} />;
}

function SavedReadingCompanion({ entry }) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const restored = useMemo(() => hydrateEntryVisuals(entry), [entry]);
  const [fallbackRunId] = useState(() => `saved:${crypto.randomUUID()}`);
  const [previous, setPrevious] = useState(null);
  const source = reconcileSavedGestureSource({ previous, entry, restored, fallbackRunId });
  if (source !== previous) setPrevious(source);
  const artworkEdition = readingGestureEdition({ enabled: gestureStudyEnabled,
    deckStyleId: entry.deckId || 'rws-1909', artworkEdition: source.visualBinding?.artworkEdition });
  const cards = useMemo(() => buildSpreadCompanionCards({ reading: (entry.cards || []).map(card => card ? ({ ...card,
    name: card.name || card.canonicalName || card.card,
    isReversed: card.isReversed ?? String(card.orientation).toLowerCase() === 'reversed' }) : null),
    visibleCount: entry.cards?.length || 0, spreadPositions: (entry.cards || []).map(card => card?.position),
    deckStyleId: entry.deckId || 'rws-1909', runId: source.runId, artworkEdition,
    inspectionAvailable: true, reflections: entry.reflections }),
  [entry.cards, entry.deckId, entry.reflections, source.runId, artworkEdition]);
  const gestureRuntime = useReadingGestureRuntime(gestureStudyEnabled);
  const links = useMemo(() => gestureRuntime?.buildCardLinkCatalog({ cards, deckStyle: entry.deckId || 'rws-1909' }) || null, [gestureRuntime, cards, entry.deckId]);
  const personalContext = useMemo(() => ({ question: entry.question || '',
    reflections: typeof entry.reflections === 'string' ? entry.reflections : '' }),
    [entry.question, entry.reflections]);
  const originalContext = useMemo(() => ({ question: entry.question ?? entry.userQuestion ?? '',
    reflections: entry.reflections ?? entry.reflectionsText, cards: entry.cards || [] }),
  [entry.question, entry.userQuestion, entry.reflections, entry.reflectionsText, entry.cards]);
  return <NarrativeGestureGate cards={cards} stable
    gestureStudyEnabled={gestureStudyEnabled} gestureSource={source} personalContext={personalContext} originalContext={originalContext}>
    <div className="restored-reading-gestures narrative-panel__layout narrative-panel__layout--with-spread" data-testid="restored-reading-gestures">
      <SpreadCompanion />
      <div className="narrative-panel__column min-w-0">
      <StreamingNarrative text={entry.personalReading} useMarkdown headingBaseLevel={4}
        isStreamingEnabled={false} isReadingStreaming={false} cardLinks={links} gestureSource={source} onDone={noop} />
      </div>
    </div>
  </NarrativeGestureGate>;
}
