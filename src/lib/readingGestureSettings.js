/** The normal reading and journal opt in together, in development or the explicitly identified local validation build. */
export function readingGesturesEnabled(env = import.meta.env) {
  return (env?.DEV === true || env?.MODE === 'reading-cue-validation') && env?.VITE_READING_GESTURES === 'true';
}

export function readingGestureEdition({ enabled, deckStyleId, artworkEdition = null }) {
  if (artworkEdition) return artworkEdition;
  if (!enabled) return null;
  return deckStyleId === 'rws-1909' ? 'rws-immanuelle-vector' : `identity:${deckStyleId}`;
}
