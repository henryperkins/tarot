/** Presentation opt-in is independent of annotation requests and server admission. */
export function readingGesturesEnabled(env = import.meta.env) {
  return env?.VITE_READING_ALIGNER_ENABLED === 'true'
    || ((env?.DEV === true || env?.MODE === 'reading-cue-validation') && env?.VITE_READING_GESTURES === 'true');
}

/** Viewing accepted cues never implies consent to request model annotations. */
export function readingVisualRequestsEnabled(env = import.meta.env) {
  return readingGesturesEnabled(env) && env?.VITE_READING_MODEL_ANNOTATIONS === 'true';
}

export function readingGestureEdition({ enabled, deckStyleId, artworkEdition = null }) {
  if (artworkEdition) return artworkEdition;
  if (!enabled) return null;
  return deckStyleId === 'rws-1909' ? 'rws-immanuelle-vector' : `identity:${deckStyleId}`;
}
