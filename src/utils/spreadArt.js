// Resolve asset URLs at build time so the first <picture> already has its
// responsive sources. Importing URLs does not fetch image bytes; the browser
// still selects one format/size and honors each image's loading priority.
const SPREAD_ART_URLS = import.meta.glob(
  '../../selectorimages/{onecard,3card,5card,decision,relationshipsnapshot,celticcross}*.{png,avif,webp}',
  {
    eager: true,
    query: '?url',
    import: 'default'
  }
);

const SPREAD_ART_BASE_NAMES = {
  single: 'onecard',
  threeCard: '3card',
  fiveCard: '5card',
  decision: 'decision',
  relationship: 'relationshipsnapshot',
  celtic: 'celticcross'
};

const getAssetUrl = (fileName) => SPREAD_ART_URLS[`../../selectorimages/${fileName}`];

/**
 * Build source entries for responsive images.
 */
const buildSourceEntries = (baseName, format) => ([
  { src: getAssetUrl(`${baseName}-640.${format}`), width: 640 },
  { src: getAssetUrl(`${baseName}-1280.${format}`), width: 1280 }
]).filter((item) => item?.src);

/**
 * Build spread art with responsive sources available on the first render.
 * Returns null when the requested artwork does not exist.
 */
export function buildSpreadArt({
  baseName,
  alt,
  width = 1280,
  height = 720,
  aspectRatio = '16 / 9'
} = {}) {
  if (!baseName) return null;
  const src = getAssetUrl(`${baseName}.png`);
  if (!src) return null;

  return {
    src,
    width,
    height,
    aspectRatio,
    alt,
    sources: {
      avif: buildSourceEntries(baseName, 'avif'),
      webp: buildSourceEntries(baseName, 'webp')
    }
  };
}

/**
 * Get spread art for a spread key.
 */
export function getSpreadArt(spreadKey, options = {}) {
  const baseName = SPREAD_ART_BASE_NAMES[spreadKey];
  if (!baseName) return null;
  return buildSpreadArt({ baseName, ...options });
}
