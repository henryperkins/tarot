/** Raw generation source, independent of formatting and transport credentials. */
function boundDocument(document, raw, status) {
  return document?.version === 1 && typeof document.raw === 'string' && document.raw.length <= 120000
    && document.raw.startsWith(raw) && (status !== 'complete' || document.raw === raw) ? document : undefined;
}

export function createGestureSource({ runId, raw = '', status = 'idle', semanticDocument }) {
  const document = boundDocument(semanticDocument, raw, status);
  return { runId, raw, sourceRevision: 0, kind: status === 'complete' ? 'hydrate' : 'append', status,
    ...(document ? { semanticDocument: document } : {}) };
}

export function advanceGestureSource(frame, update) {
  const { raw = frame.raw, kind = frame.kind, status = frame.status } = update;
  const appended = raw.startsWith(frame.raw);
  const candidate = Object.hasOwn(update, 'semanticDocument') ? update.semanticDocument : appended ? frame.semanticDocument : null;
  const document = boundDocument(candidate, raw, status);
  return {
    runId: frame.runId,
    raw,
    sourceRevision: frame.sourceRevision + (appended ? 0 : 1),
    kind,
    status,
    ...(document ? { semanticDocument: document } : {})
  };
}
