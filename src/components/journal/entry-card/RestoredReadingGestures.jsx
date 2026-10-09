import { useCallback, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useReadingVisualJob } from '../../../hooks/useReadingVisualJob';
import { buildSpreadCompanionCards } from '../../../hooks/narrativeReadingModelUtils';
import { buildCardLinkCatalog } from '../../../lib/narrativeCardLinks';
import { createGestureSource } from '../../../lib/narrativeGestureSource';
import { hydrateEntryVisuals } from '../../../utils/journalStorage';
import { patchSavedVisualSnapshot, readVisualResume, visualStorageNamespace } from '../../../lib/readingVisualStorage';
import { readingGesturesEnabled } from '../../../lib/readingGestureSettings';
import { NarrativeCardFocusProvider } from '../../reading/narrative/NarrativeCardFocus';
import { SpreadCompanion } from '../../reading/narrative/SpreadCompanion';
import { StreamingNarrative } from '../../StreamingNarrative';

const noop = () => {};

/** Restored cues remain static, including explicit inspection. No arrival replay. */
export function RestoredReadingGestures({ entry }) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const { user } = useAuth();
  const namespace = visualStorageNamespace(user?.id);
  const restored = useMemo(() => hydrateEntryVisuals(entry), [entry]);
  const resume = useMemo(() => gestureStudyEnabled && restored.binding ? readVisualResume({ namespace,
    readingResultId: restored.readingResultId, binding: restored.binding }) : null,
  [gestureStudyEnabled, namespace, restored.binding, restored.readingResultId]);
  const onBatch = useCallback(batch => patchSavedVisualSnapshot({ namespace, binding: restored.binding,
    cueLedger: batch.cueLedger || batch.snapshot || batch.ledger, status: batch.status || 'pending' }), [namespace, restored.binding]);
  useReadingVisualJob({ readingResultId: restored.readingResultId, visualBinding: restored.binding,
    visualJobToken: resume?.visualJobToken, raw: entry.personalReading, enabled: gestureStudyEnabled && Boolean(resume), onBatch });
  const source = useMemo(() => createGestureSource({ runId: restored.readingResultId,
    raw: entry.personalReading, status: 'complete', sourceRevision: restored.binding?.sourceRevision,
    visualBinding: restored.binding, cueLedger: restored.snapshot }), [entry.personalReading, restored]);
  const cards = useMemo(() => buildSpreadCompanionCards({ reading: (entry.cards || []).map(card => ({ ...card,
    name: card.name || card.canonicalName || card.card,
    isReversed: card.isReversed ?? String(card.orientation).toLowerCase() === 'reversed' })),
    visibleCount: entry.cards?.length || 0, spreadPositions: (entry.cards || []).map(card => card.position),
    deckStyleId: entry.deckId || 'rws-1909', runId: source.runId, artworkEdition: restored.binding?.artworkEdition,
    inspectionAvailable: true, reflections: entry.reflections }),
  [entry.cards, entry.deckId, entry.reflections, source.runId, restored.binding?.artworkEdition]);
  const links = useMemo(() => buildCardLinkCatalog({ cards, deckStyle: entry.deckId || 'rws-1909' }), [cards, entry.deckId]);
  const personalContext = useMemo(() => ({ question: entry.question || '',
    reflections: typeof entry.reflections === 'string' ? entry.reflections : '' }),
    [entry.question, entry.reflections]);
  return <NarrativeCardFocusProvider key={`${source.runId}:${source.sourceRevision}`} cards={cards} stable
    gestureStudyEnabled gestureSource={source} personalContext={personalContext}>
    <div className="restored-reading-gestures narrative-panel__layout narrative-panel__layout--with-spread" data-testid="restored-reading-gestures">
      <SpreadCompanion />
      <div className="narrative-panel__column min-w-0">
      <StreamingNarrative text={entry.personalReading} useMarkdown headingBaseLevel={3}
        isStreamingEnabled={false} isReadingStreaming={false} cardLinks={links} gestureSource={source} onDone={noop} />
      </div>
    </div>
  </NarrativeCardFocusProvider>;
}
