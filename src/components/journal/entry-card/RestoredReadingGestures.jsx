import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useReadingVisualJob } from '../../../hooks/useReadingVisualJob';
import { buildSpreadCompanionCards } from '../../../hooks/narrativeReadingModelUtils';
import { useReadingGestureRuntime } from '../../../hooks/useReadingGestureRuntime';
import { createGestureSource } from '../../../lib/narrativeGestureSource';
import { hydrateEntryVisuals } from '../../../utils/journalStorage';
import { adoptSavedVisualReplay, patchSavedVisualSnapshot, publicVisualRetryState, readVisualResume, removeVisualResume,
  replayOwnsVisual, savedVisualRecovery, visualStorageNamespace } from '../../../lib/readingVisualStorage';
import { isVisualJobTerminal } from '../../../lib/readingVisualStream';
import { readingGesturesEnabled } from '../../../lib/readingGestureSettings';
import { NarrativeGestureGate, GatedSpreadCompanion as SpreadCompanion } from '../../reading/narrative/NarrativeGestureGate';
import { StreamingNarrative } from '../../StreamingNarrative';
import { styles, cn } from './EntryCard.primitives';

const noop = () => {};

/** Restored cues remain static, including explicit inspection. No arrival replay. */
export function RestoredReadingGestures({ entry, onHandlesChanged = null }) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const { user } = useAuth();
  const namespace = visualStorageNamespace(user?.id);
  const restored = useMemo(() => hydrateEntryVisuals(entry), [entry]);
  // A claimed saved replay supersedes the original transport for this entry.
  const superseded = replayOwnsVisual(entry);
  const resume = useMemo(() => gestureStudyEnabled && restored.binding && !superseded
    && !readVisualResume({ namespace, entryId: entry.id }) ? readVisualResume({ namespace,
      readingResultId: restored.readingResultId, binding: restored.binding }) : null,
  [gestureStudyEnabled, namespace, entry.id, superseded, restored.binding, restored.readingResultId]);
  const onBatch = useCallback(batch => patchSavedVisualSnapshot({ namespace, binding: restored.binding,
    cueLedger: batch.cueLedger || batch.snapshot || batch.ledger, status: batch.status || 'pending' }), [namespace, restored.binding]);
  // An expired/revoked original capability can never resume: retire it so the
  // saved entry offers its explicit recovery action instead of waiting.
  const onError = useCallback(({ terminal }) => {
    if (!terminal || !restored.binding) return;
    removeVisualResume({ namespace, readingResultId: restored.readingResultId, binding: restored.binding });
    onHandlesChanged?.();
  }, [namespace, restored.binding, restored.readingResultId, onHandlesChanged]);
  useReadingVisualJob({ readingResultId: restored.readingResultId, visualBinding: restored.binding,
    visualJobToken: resume?.visualJobToken, raw: entry.personalReading, enabled: gestureStudyEnabled && Boolean(resume), onBatch, onError });
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
  const gestureRuntime = useReadingGestureRuntime(gestureStudyEnabled);
  const links = useMemo(() => gestureRuntime?.buildCardLinkCatalog({ cards, deckStyle: entry.deckId || 'rws-1909' }) || null, [gestureRuntime, cards, entry.deckId]);
  const personalContext = useMemo(() => ({ question: entry.question || '',
    reflections: typeof entry.reflections === 'string' ? entry.reflections : '' }),
    [entry.question, entry.reflections]);
  return <NarrativeGestureGate cards={cards} stable
    gestureStudyEnabled={gestureStudyEnabled} gestureSource={source} personalContext={personalContext}>
    <div className="restored-reading-gestures narrative-panel__layout narrative-panel__layout--with-spread" data-testid="restored-reading-gestures">
      <SpreadCompanion />
      <div className="narrative-panel__column min-w-0">
      <StreamingNarrative text={entry.personalReading} useMarkdown headingBaseLevel={3}
        isStreamingEnabled={false} isReadingStreaming={false} cardLinks={links} gestureSource={source} onDone={noop} />
      </div>
    </div>
  </NarrativeGestureGate>;
}

const RECOVERY_COPY = {
  eligible: 'Your reading is saved. Card connections are unavailable.',
  unavailable: 'Your reading is saved. Card connections are unavailable.',
  pending: 'Your reading is saved. Card connections are being prepared.',
  complete: 'Card connections are ready.'
};
const NOTICE_COPY = {
  offline: 'Your reading is saved. Card connections could not be reached. Try again when you are online.',
  server: 'Your reading is saved. Card connections could not be reached right now.',
  storage: 'Your reading is saved, but this device could not store card connection progress.',
  stale: 'Your reading changed while card connections were being checked.',
  'not-found': 'This reading is no longer in your journal.',
  ineligible: 'Your reading is saved. Card connections are unavailable.'
};
// The revision argument re-reads private storage after a handle changes.
const readHandles = ({ namespace, entryId, restored, enabled }, _revision) => enabled ? {
  replay: readVisualResume({ namespace, entryId }),
  original: restored.binding ? readVisualResume({ namespace, readingResultId: restored.readingResultId, binding: restored.binding }) : null
} : { replay: null, original: null };

/** Plain saved-visual status beside readable prose, with one explicit retry
 * action only for eligible failed/expired/missing visuals. Subscribing to a
 * pending replay transport never submits work; private handles never render. */
export function SavedVisualRecovery({ entry, onRetry = null, handleRevision = 0, onHandlesChanged = null }) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const { user, isAuthenticated } = useAuth();
  const { canUseCloudJournal } = useSubscription();
  const cloud = Boolean(isAuthenticated && canUseCloudJournal);
  const namespace = visualStorageNamespace(isAuthenticated ? user?.id : null);
  const ownerRef = useRef(namespace);
  useLayoutEffect(() => { ownerRef.current = namespace; }, [namespace]);
  // Unmounted settlements are discarded; the private handle resumes on remount.
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const restored = useMemo(() => hydrateEntryVisuals(entry), [entry]);
  const handles = useMemo(() => readHandles({ namespace, entryId: entry.id, restored, enabled: gestureStudyEnabled }, handleRevision),
    [namespace, entry.id, restored, gestureStudyEnabled, handleRevision]);
  const replay = handles.replay;
  const recovery = savedVisualRecovery(entry, { cloud, originalResume: handles.original, replayResume: replay });
  const pendingReplay = recovery.phase === 'pending' && publicVisualRetryState(entry.visualState)?.retryStatus === 'pending';
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [sawPending, setSawPending] = useState(false);
  // A retry can complete without ever rendering "pending" (an immediate cloud
  // repair or an already finished claim); it still owes the reader a status.
  const [retried, setRetried] = useState(false);
  if (recovery.phase === 'pending' && !sawPending) setSawPending(true);
  const statusRef = useRef(null);
  const focusStatus = useRef(false);

  const settle = useCallback(({ status, cueLedger = null }) => {
    if (!replay) return;
    const isCurrent = () => mountedRef.current && ownerRef.current === namespace;
    adoptSavedVisualReplay({ namespace, entryId: entry.id, resume: replay, cueLedger, status, cloud, isCurrent })
      .catch(() => ({ adopted: false }))
      .then(() => onHandlesChanged?.());
  }, [replay, namespace, entry.id, cloud, onHandlesChanged]);
  const onBatch = useCallback(batch => {
    if (isVisualJobTerminal(batch.status)) settle({ status: batch.status, cueLedger: batch.cueLedger });
  }, [settle]);
  const onError = useCallback(({ terminal }) => { if (terminal) settle({ status: 'revoked' }); }, [settle]);
  useReadingVisualJob({ readingResultId: replay?.readingResultId, visualJobId: replay?.visualJobId, attemptId: replay?.attemptId,
    visualBinding: replay?.visualBinding, visualJobToken: replay?.visualJobToken, raw: entry.personalReading,
    enabled: gestureStudyEnabled && Boolean(replay) && pendingReplay, onBatch, onError });

  const retry = useCallback(async () => {
    if (busy || !onRetry) return;
    setBusy(true);
    setNotice(null);
    setRetried(true);
    focusStatus.current = true;
    // A failure notice describes the phase it happened in; a later phase replaces it.
    try { await onRetry(); } catch (error) { setNotice({ text: NOTICE_COPY[error?.code] || NOTICE_COPY.server, phase: recovery.phase }); }
    finally { setBusy(false); onHandlesChanged?.(); }
  }, [busy, onRetry, onHandlesChanged, recovery.phase]);

  // When the action gives way to status, keep keyboard focus on that status. A
  // failure shown in place leaves focus on the button and ends the intent, so a
  // later background change never moves focus without the reader acting.
  useEffect(() => {
    if (!focusStatus.current || busy) return;
    if (!(recovery.canRetry && onRetry)) {
      focusStatus.current = false;
      statusRef.current?.focus();
    } else if (notice?.phase === recovery.phase) focusStatus.current = false;
  });

  const showReady = recovery.phase === 'complete' && (sawPending || retried);
  const visibleNotice = notice?.phase === recovery.phase ? notice.text : null;
  if (!gestureStudyEnabled || recovery.phase === 'none' || (recovery.phase === 'complete' && !showReady && !visibleNotice)) return null;
  const message = visibleNotice || RECOVERY_COPY[recovery.phase];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border-warm-subtle)] bg-[color:var(--panel-dark-2)] px-3 py-2"
      data-testid="saved-visual-recovery" data-recovery-phase={recovery.phase}>
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite"
        className="min-w-0 flex-1 text-sm leading-relaxed text-[color:var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]">
        {message}
      </p>
      {recovery.canRetry && onRetry ? (
        <button type="button" onClick={retry} aria-disabled={busy || undefined} aria-busy={busy || undefined}
          className={cn(styles.actionButton, busy ? styles.actionButtonDisabled : styles.actionButtonEnabled, 'min-h-touch justify-center')}>
          Retry card connections
        </button>
      ) : null}
    </div>
  );
}
