import { emitCueTiming } from '../lib/readingCueTimingProbe.js';
import { useState, useEffect, useRef } from 'react';
import { canonicalVisualCueJSON, sameVisualCueBinding } from '../../shared/contracts/visualCueBatches.js';
import { boundVisualCueLedger, visualJobPresentationStatus } from '../lib/narrativeGestureSource.js';
import { readVisualJobEvents, isVisualJobTerminal } from '../lib/readingVisualStream.js';
import { readingGesturesEnabled } from '../lib/readingGestureSettings.js';

/** Visual delivery outlives narrative completion, but never its authenticated owner/binding.
 * A saved replay subscribes by its fresh `visualJobId`/`attemptId`; original
 * handles keep the result route. Subscribing never submits annotation work. */
export function useReadingVisualJob({ readingResultId, visualJobId = null, attemptId = null, visualBinding, visualJobToken,
  raw = '', enabled = true, onBatch = null, onError = null, onStatus = null } = {}) {
  const subscriptionEnabled = enabled && readingGesturesEnabled();
  const key = visualBinding ? canonicalVisualCueJSON(visualBinding) : '';
  const [snapshot, setSnapshot] = useState(null);
  const latest = useRef({ raw, onBatch, onError, onStatus });
  const received = useRef(null);
  const accepted = useRef(null);
  const apply = useRef(null);

  useEffect(() => {
    latest.current = { raw, onBatch, onError, onStatus };
    apply.current?.();
  }, [raw, onBatch, onError, onStatus]);

  useEffect(() => {
    received.current = null;
    accepted.current = null;
    if (!subscriptionEnabled || !readingResultId || !key || visualBinding.readingResultId !== readingResultId) return;
    const binding = JSON.parse(key);
    const controller = new AbortController();
    let status = 'pending';
    let error = null;
    let publishedStatus = null;
    let publishedPresentationStatus = null;
    const publishStatus = () => {
      if (controller.signal.aborted) return;
      // A terminal job can have no accepted ledger. Publish its state anyway,
      // preserving already accepted cues so fallback inspection can recover.
      if (publishedStatus !== status) {
        publishedStatus = status;
        setSnapshot(previous => ({ ...(previous?.key === key ? previous : {}), key, binding, status, error }));
      }
      const presentationStatus = visualJobPresentationStatus({ status, cueLedger: received.current?.cueLedger,
        runId: readingResultId, sourceRevision: binding.sourceRevision, visualBinding: binding, raw: latest.current.raw });
      if (publishedPresentationStatus !== presentationStatus) {
        publishedPresentationStatus = presentationStatus;
        latest.current.onStatus?.({ binding, status: presentationStatus });
      }
    };
    const adopt = () => {
      if (controller.signal.aborted) return;
      const ledger = boundVisualCueLedger(received.current?.cueLedger, {
        runId: readingResultId, sourceRevision: binding.sourceRevision,
        visualBinding: binding, raw: latest.current.raw
      });
      if (!ledger) { publishStatus(); return; }
      const prior = accepted.current;
      if (prior && ledger.ledgerRevision < prior.ledgerRevision) { publishStatus(); return; }
      const changed = !prior || ledger.ledgerRevision > prior.ledgerRevision;
      // Equal revisions may advance status; they cannot change accepted cue data.
      const cueLedger = changed ? ledger : prior.cueLedger;
      if (!changed && status === prior.status) { publishStatus(); return; }
      const next = { key, binding, cueLedger, ledgerRevision: cueLedger.ledgerRevision, status, error };
      if (changed) for (const cue of cueLedger.cues) emitCueTiming('cue-adoption', {
        runId: readingResultId, sourceRevision: binding.sourceRevision, cueId: cue.id,
        start: cue.passage.start, end: cue.passage.end, ledgerRevision: cueLedger.ledgerRevision
      });
      accepted.current = next;
      setSnapshot(next);
      latest.current.onBatch?.(next);
      publishStatus();
    };
    apply.current = adopt;
    const run = async () => {
      try {
        for await (const { event, data } of readVisualJobEvents({ readingResultId, visualJobId, visualJobToken, signal: controller.signal })) {
          if (controller.signal.aborted || !sameVisualCueBinding(data?.binding, binding)) continue;
          status = data.status || (event === 'done' ? 'complete' : event === 'error' ? 'failed' : 'running');
          error = status === 'failed' ? 'Visual accompaniment is unavailable.' : null;
          if (data.timing) emitCueTiming('cue-server-timing', {
            runId: readingResultId, sourceRevision: binding.sourceRevision, eventId: data.eventId,
            ledgerRevision: data.ledgerRevision, serverAvailableAt: data.timing.availableAt,
            serverAnnotationStartedAt: data.timing.annotationStartedAt,
            serverAnnotationFinishedAt: data.timing.annotationFinishedAt,
            serverLedgerCommittedAt: data.timing.ledgerCommittedAt
          });
          const ledger = data.cueLedger;
          if (sameVisualCueBinding(ledger?.binding, binding)) for (const cue of ledger.cues || []) emitCueTiming('cue-receipt', {
            runId: readingResultId, sourceRevision: binding.sourceRevision, eventId: data.eventId, cueId: cue.id,
            start: cue.passage?.start, end: cue.passage?.end, ledgerRevision: ledger.ledgerRevision
          });
          if (sameVisualCueBinding(ledger?.binding, binding)
            && Number.isSafeInteger(ledger.ledgerRevision)
            && (!received.current || ledger.ledgerRevision >= received.current.cueLedger.ledgerRevision)) {
            received.current = { cueLedger: ledger };
          }
          adopt();
        }
      } catch (err) {
        if (controller.signal.aborted || err.name === 'AbortError') return;
        status = 'failed';
        error = 'Visual accompaniment is unavailable.';
        publishStatus();
        // Terminal 401/403/410 means this capability can never resume; callers may
        // retire the handle. Transient failures leave the handle for a later mount.
        latest.current.onError?.({ terminal: Boolean(err.terminal) });
      }
    };
    run();
    return () => {
      controller.abort();
      if (apply.current === adopt) apply.current = null;
    };
  // The serialized key fixes the binding for this subscription; changing its
  // object identity must not reset accepted revisions or open another stream.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, readingResultId, visualJobId, attemptId, visualJobToken, subscriptionEnabled]);

  const current = subscriptionEnabled && snapshot?.key === key ? snapshot : null;
  return {
    cues: current?.cueLedger?.cues || [], introductions: current?.cueLedger?.introductions || [],
    status: current?.status || (subscriptionEnabled && key ? 'pending' : 'idle'), error: current?.error || null,
    isComplete: current?.status === 'complete', isTerminal: isVisualJobTerminal(current?.status),
    ledgerRevision: current?.cueLedger?.ledgerRevision || 0, cueLedger: current?.cueLedger || null
  };
}
