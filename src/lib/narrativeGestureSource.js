import { sameVisualCueBinding, isVisualCueBinding } from '../../shared/contracts/visualCueBinding.js';

/** Raw generation source, independent of formatting and transport credentials. */
function boundDocument(document, raw, status) {
  return document?.version === 1 && typeof document.raw === 'string' && document.raw.length <= 120000
    && document.raw.startsWith(raw) && (status !== 'complete' || document.raw === raw) ? document : undefined;
}

function boundVisualIdentity(binding, runId, sourceRevision) {
  return isVisualCueBinding(binding) && binding.readingResultId === runId
    && binding.sourceRevision === sourceRevision ? binding : undefined;
}

const VISUAL_JOB_STATUSES = new Set(['idle', 'pending', 'running', 'complete', 'failed', 'cancelled', 'expired', 'revoked']);
const visualJobState = (binding, status) => binding && VISUAL_JOB_STATUSES.has(status) ? { visualJobStatus: status } : {};

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

/** Terminal transport state cannot release fallback playback before a valid
 * ahead-of-prose ledger can replace it. Empty or mismatched ledgers add no
 * forthcoming connection; already accepted prefixes stay usable meanwhile. */
export function visualJobPresentationStatus({ status, cueLedger, ...source }) {
  const future = boundVisualCueLedger(cueLedger, { ...source, raw: cueLedger?.raw });
  return future?.cues.length && typeof source.raw === 'string'
    && future.raw.length > source.raw.length && future.raw.startsWith(source.raw)
    ? 'pending' : status;
}

export function createGestureSource({ runId, raw = '', status = 'idle', semanticDocument,
  sourceRevision = 0, visualBinding, cueLedger, visualJobStatus }) {
  const document = boundDocument(semanticDocument, raw, status);
  const binding = boundVisualIdentity(visualBinding, runId, sourceRevision);
  const frame = { runId, raw, sourceRevision, kind: status === 'complete' ? 'hydrate' : 'append', status,
    ...(document ? { semanticDocument: document } : {}), ...(binding ? { visualBinding: binding } : {}),
    ...visualJobState(binding, visualJobStatus) };
  const ledger = boundVisualCueLedger(cueLedger, frame);
  return { ...frame, ...(ledger ? { cueLedger: ledger } : {}) };
}

export function advanceGestureSource(frame, update) {
  const { raw = frame.raw, kind = frame.kind, status = frame.status } = update;
  const appended = raw.startsWith(frame.raw);
  const inferredRevision = frame.sourceRevision + (appended ? 0 : 1);
  // Accepted narrative snapshots can replace text the throttled renderer never
  // saw. Only that independently established binding may advance its revision;
  // a cue ledger cannot establish identity or manufacture a source revision.
  const authoritative = update.visualBinding;
  const authoritativeRevision = authoritative?.sourceRevision;
  const acceptsRevision = Number.isSafeInteger(authoritativeRevision) && authoritativeRevision >= inferredRevision
    && sameVisualCueBinding({ ...frame.visualBinding, sourceRevision: authoritativeRevision }, authoritative);
  const sourceRevision = acceptsRevision ? authoritativeRevision : inferredRevision;
  const sameSource = appended && sourceRevision === frame.sourceRevision;
  const candidate = Object.hasOwn(update, 'semanticDocument') ? update.semanticDocument : sameSource ? frame.semanticDocument : null;
  const document = boundDocument(candidate, raw, status);
  const binding = boundVisualIdentity(Object.hasOwn(update, 'visualBinding') ? update.visualBinding : sameSource ? frame.visualBinding : null,
    frame.runId, sourceRevision);
  const visualStatus = VISUAL_JOB_STATUSES.has(update.visualJobStatus) ? update.visualJobStatus
    : sameSource && sameVisualCueBinding(binding, frame.visualBinding) ? frame.visualJobStatus : undefined;
  const next = {
    runId: frame.runId, raw, sourceRevision, kind, status,
    ...(document ? { semanticDocument: document } : {}), ...(binding ? { visualBinding: binding } : {}),
    ...visualJobState(binding, visualStatus)
  };
  const prior = boundVisualCueLedger(frame.cueLedger, next);
  const incoming = boundVisualCueLedger(update.cueLedger, next);
  // Reconnects and stale callbacks cannot roll back the accepted registry.
  const ledger = incoming && (!prior || incoming.ledgerRevision > prior.ledgerRevision) ? incoming : prior;
  return { ...next, ...(ledger ? { cueLedger: ledger } : {}) };
}
