import { displayEntryVisual, publicVisualSnapshot } from '../lib/readingVisualStorage.js';

/** Validate restored metadata against the immutable saved prose before use. */
export function hydrateEntryVisuals(entry) {
  const visual = displayEntryVisual(entry);
  const snapshot = visual?.snapshot || null;
  return { hasVisuals: Boolean(snapshot?.cues?.length || snapshot?.introductions?.length),
    readingResultId: visual?.readingResultId || null, binding: visual?.binding || null,
    status: visual?.status || 'idle', ledgerRevision: visual?.ledgerRevision || 0,
    cues: snapshot?.cues || [], introductions: snapshot?.introductions || [], snapshot };
}

export function attachVisualSnapshotToEntry(entry, candidate) {
  if (!entry) return entry;
  const binding = entry.visualBinding || candidate?.binding || candidate?.snapshot?.binding;
  const visual = publicVisualSnapshot({ binding, cueLedger: candidate?.snapshot || candidate?.cueLedger || candidate,
    status: candidate?.status || 'complete', raw: entry.personalReading });
  return visual ? { ...entry, readingResultId: visual.readingResultId, visualBinding: binding, visualSnapshot: visual, visual } : entry;
}
