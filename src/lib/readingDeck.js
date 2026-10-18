import { DECK_CATALOG } from '../../shared/vision/deckCatalog.js';

// An unknown legacy edition stays unknown; catalog defaults are for rendering,
// not evidence that a saved reading was drawn with the current preference.
export function getKnownDeckStyleId(...candidates) {
  return candidates.find(value => typeof value === 'string' && Object.hasOwn(DECK_CATALOG, value)) ?? null;
}

export function getSnapshotDeckStyleId(snapshot) {
  return getKnownDeckStyleId(snapshot?.drawDeckStyleId,
    snapshot?.analysis?.readingMeta?.deckStyle, snapshot?.analysis?.themes?.deckStyle);
}
