/** The normal reading and journal opt in together, only in a development build. */
export function readingGesturesEnabled(env = import.meta.env) {
  return env?.DEV === true && env?.VITE_READING_GESTURES === 'true';
}

export function readingGestureEdition({ enabled, deckStyleId, artworkEdition = null }) {
  if (artworkEdition) return artworkEdition;
  if (!enabled) return null;
  return deckStyleId === 'rws-1909' ? 'rws-immanuelle-vector' : `identity:${deckStyleId}`;
}
