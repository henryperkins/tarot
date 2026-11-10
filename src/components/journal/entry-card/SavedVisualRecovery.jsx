import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useReadingVisualJob } from '../../../hooks/useReadingVisualJob';
import { hydrateEntryVisuals } from '../../../utils/journalStorage';
import { adoptSavedVisualReplay, patchSavedVisualSnapshot, publicVisualRetryState, readVisualResume, removeVisualResume,
  replayOwnsVisual, savedVisualRecovery, visualStorageNamespace } from '../../../lib/readingVisualStorage';
import { isVisualJobTerminal } from '../../../lib/readingVisualStream';
import { readingGesturesEnabled, readingVisualRequestsEnabled } from '../../../lib/readingGestureSettings';
import { reconcileSavedGestureSource } from '../../../lib/savedReadingGestureSource';
import { styles, cn } from './EntryCard.primitives';

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
const readHandles = ({ namespace, entryId, binding, enabled }, _revision) => enabled ? {
  replay: readVisualResume({ namespace, entryId }),
  original: binding ? readVisualResume({ namespace, readingResultId: binding.readingResultId, binding }) : null
} : { replay: null, original: null };

/** Saved-visual transport and status stay independent of rich rendering.
 * Subscribing to originals or replays never submits work; private handles never render. */
export function SavedVisualRecovery({ entry, onRetry = null, handleRevision = 0, onHandlesChanged = null }) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const requestsEnabled = readingVisualRequestsEnabled();
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
  const [previous, setPrevious] = useState(null);
  const source = reconcileSavedGestureSource({ previous, entry, restored, fallbackRunId: `recovery:${namespace}:${entry.id}` });
  if (source !== previous) setPrevious(source);
  const activeBinding = source.visualBinding;
  const handles = useMemo(() => readHandles({ namespace, entryId: entry.id, binding: activeBinding, enabled: requestsEnabled }, handleRevision),
    [namespace, entry.id, activeBinding, requestsEnabled, handleRevision]);
  const replay = handles.replay;
  // A claimed replay supersedes the original transport, even if its handle is gone.
  const original = !replay && !replayOwnsVisual(entry) ? handles.original : null;
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
    enabled: requestsEnabled && Boolean(replay) && pendingReplay, onBatch, onError });

  const onOriginalBatch = useCallback(batch => {
    if (!original) return;
    patchSavedVisualSnapshot({ namespace, binding: original.visualBinding,
      cueLedger: batch.cueLedger, status: batch.status || 'pending' });
  }, [namespace, original]);
  const onOriginalError = useCallback(({ terminal }) => {
    if (!terminal || !original) return;
    // Expired/revoked capabilities cannot resume. Retire them even when the
    // optional renderer failed, so local entries can offer their explicit retry.
    removeVisualResume({ namespace, readingResultId: original.readingResultId, binding: original.visualBinding });
    onHandlesChanged?.();
  }, [namespace, original, onHandlesChanged]);
  useReadingVisualJob({ readingResultId: original?.readingResultId, visualBinding: original?.visualBinding,
    visualJobToken: original?.visualJobToken, raw: entry.personalReading,
    enabled: requestsEnabled && Boolean(original), onBatch: onOriginalBatch, onError: onOriginalError });

  const retry = useCallback(async () => {
    if (!requestsEnabled || busy || !onRetry) return;
    setBusy(true);
    setNotice(null);
    setRetried(true);
    focusStatus.current = true;
    // A failure notice describes the phase it happened in; a later phase replaces it.
    try { await onRetry(); } catch (error) { setNotice({ text: NOTICE_COPY[error?.code] || NOTICE_COPY.server, phase: recovery.phase }); }
    finally { setBusy(false); onHandlesChanged?.(); }
  }, [requestsEnabled, busy, onRetry, onHandlesChanged, recovery.phase]);

  // When an action becomes status, keep keyboard focus on it. A failure left on
  // the button ends this intent, so a later background update never moves focus.
  useEffect(() => {
    if (!focusStatus.current || busy) return;
    if (!(recovery.canRetry && onRetry)) {
      focusStatus.current = false;
      statusRef.current?.focus();
    } else if (notice?.phase === recovery.phase) focusStatus.current = false;
  });

  const showReady = recovery.phase === 'complete' && (sawPending || retried);
  const visibleNotice = notice?.phase === recovery.phase ? notice.text : null;
  if (!gestureStudyEnabled || !requestsEnabled || recovery.phase === 'none' || (recovery.phase === 'complete' && !showReady && !visibleNotice)) return null;
  const message = visibleNotice || RECOVERY_COPY[recovery.phase];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-(--border-warm-subtle) bg-(--panel-dark-2) px-3 py-2"
      data-testid="saved-visual-recovery" data-recovery-phase={recovery.phase}>
      <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite"
        className="min-w-0 flex-1 text-sm leading-relaxed text-(--text-muted) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
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
