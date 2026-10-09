/** Raw generation source, independent of formatting and transport credentials. */
export function createGestureSource({ runId, raw = '', status = 'idle' }) {
  return { runId, raw, sourceRevision: 0, kind: status === 'complete' ? 'hydrate' : 'append', status };
}

export function advanceGestureSource(frame, { raw = frame.raw, kind = frame.kind, status = frame.status }) {
  return {
    runId: frame.runId,
    raw,
    sourceRevision: frame.sourceRevision + (raw.startsWith(frame.raw) ? 0 : 1),
    kind,
    status
  };
}
