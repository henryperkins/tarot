import manifest from '../../public/images/cards/rws-vector/manifest.json';

const normalize = name => String(name || '').replace(/^the /i, '').toLowerCase();
const cards = new Map(manifest.cards.map(card => [normalize(card.name), card]));

/** Same edition and coordinate plane; compact raster delivery of its vector art. */
export function getGestureArtworkAsset(canonicalName, artworkEdition = 'rws-immanuelle-vector') {
  if (artworkEdition !== manifest.edition) return null;
  const card = cards.get(normalize(canonicalName));
  return card ? `/images/cards/rws-vector/${card.filename}` : null;
}
