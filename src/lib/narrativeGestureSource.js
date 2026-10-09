import { sameVisualCueBinding, visualCueBindingSchema } from '../../shared/contracts/visualCueBatches.js';

/** Raw generation source, independent of formatting and transport credentials. */
function boundDocument(document, raw, status) {
  return document?.version === 1 && typeof document.raw === 'string' && document.raw.length <= 120000
    && document.raw.startsWith(raw) && (status !== 'complete' || document.raw === raw) ? document : undefined;
}

function boundVisualIdentity(binding, runId, sourceRevision) {
  return visualCueBindingSchema.safeParse(binding).success && binding.readingResultId === runId
    && binding.sourceRevision === sourceRevision ? binding : undefined;
}

/**
 * Only an application-bound cumulative snapshot can trail delivered prose.
 * The caller obtains visualBinding independently from the accepted reading job;
 * a model response or a snapshot cannot establish its own source ownership.
 * Exact prefix comparison also protects against source replacement that retained
 * an opening sentence. Batch hashes/receipts are checked by the ledger writer.
 */
export function boundVisualCueLedger(ledger, { runId, sourceRevision, raw, visualBinding } = {}) {
  if (!boundVisualIdentity(visualBinding, runId, sourceRevision)
    || !sameVisualCueBinding(ledger?.binding, visualBinding)
    || ledger?.version !== 1 || !Number.isSafeInteger(ledger.ledgerRevision) || ledger.ledgerRevision < 0
    || typeof ledger.raw !== 'string' || ledger.raw.length > 120000
    || ledger.analyzedEnd !== ledger.raw.length || typeof raw !== 'string' || !raw.startsWith(ledger.raw)
    || !Array.isArray(ledger.cues) || !Array.isArray(ledger.introductions)) return undefined;
  return ledger;
}

export function createGestureSource({ runId, raw = '', status = 'idle', semanticDocument,
  sourceRevision = 0, visualBinding, cueLedger }) {
  const document = boundDocument(semanticDocument, raw, status);
  const binding = boundVisualIdentity(visualBinding, runId, sourceRevision);
  const frame = { runId, raw, sourceRevision, kind: status === 'complete' ? 'hydrate' : 'append', status,
    ...(document ? { semanticDocument: document } : {}), ...(binding ? { visualBinding: binding } : {}) };
  const ledger = boundVisualCueLedger(cueLedger, frame);
  return { ...frame, ...(ledger ? { cueLedger: ledger } : {}) };
}

export function advanceGestureSource(frame, update) {
  const { raw = frame.raw, kind = frame.kind, status = frame.status } = update;
  const appended = raw.startsWith(frame.raw);
  const sourceRevision = frame.sourceRevision + (appended ? 0 : 1);
  const candidate = Object.hasOwn(update, 'semanticDocument') ? update.semanticDocument : appended ? frame.semanticDocument : null;
  const document = boundDocument(candidate, raw, status);
  const binding = boundVisualIdentity(Object.hasOwn(update, 'visualBinding') ? update.visualBinding : appended ? frame.visualBinding : null,
    frame.runId, sourceRevision);
  const next = {
    runId: frame.runId, raw, sourceRevision, kind, status,
    ...(document ? { semanticDocument: document } : {}), ...(binding ? { visualBinding: binding } : {})
  };
  const prior = boundVisualCueLedger(frame.cueLedger, next);
  const incoming = boundVisualCueLedger(update.cueLedger, next);
  // Reconnects and stale callbacks cannot roll back the accepted registry.
  const ledger = incoming && (!prior || incoming.ledgerRevision > prior.ledgerRevision) ? incoming : prior;
  return { ...next, ...(ledger ? { cueLedger: ledger } : {}) };
}
