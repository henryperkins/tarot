// Lazy load spread art - these are large images that shouldn't block initial render
// The glob returns functions that load the asset on demand
const SPREAD_ART_LOADERS = import.meta.glob(
  '../../selectorimages/{onecard,3card,5card,decision,relationshipsnapshot,celticcross}*.{png,avif,webp}',
  {
    eager: false,
    import: 'default'
  }
);

// Cache for resolved asset URLs (sync access after first load)
const assetCache = new Map();

// Preload tracking to avoid duplicate requests
const preloadPromises = new Map();

const SPREAD_ART_BASE_NAMES = {
  single: 'onecard',
  threeCard: '3card',
  fiveCard: '5card',
  decision: 'decision',
  relationship: 'relationshipsnapshot',
  celtic: 'celticcross'
};

/**
 * Get the loader function for a spread asset (returns undefined if not found)
 */
const getAssetLoader = (fileName) => SPREAD_ART_LOADERS[`../../selectorimages/${fileName}`];

/**
 * Get a cached asset URL synchronously (returns undefined if not loaded yet)
 */
const getCachedAsset = (fileName) => assetCache.get(fileName);

/**
 * Load an asset and cache it. Returns the URL or undefined.
 */
async function loadAsset(fileName) {
  if (assetCache.has(fileName)) {
    return assetCache.get(fileName);
  }
  
  const loader = getAssetLoader(fileName);
  if (!loader) return undefined;
  
  // Avoid duplicate in-flight requests
  if (!preloadPromises.has(fileName)) {
    preloadPromises.set(fileName, loader().then(url => {
      assetCache.set(fileName, url);
      preloadPromises.delete(fileName);
      return url;
    }).catch(() => {
      preloadPromises.delete(fileName);
      return undefined;
    }));
  }
  
  return preloadPromises.get(fileName);
}

/**
 * Build source entries for responsive images (sync, uses cache)
 */
const buildSourceEntries = (baseName, format) => ([
  { src: getCachedAsset(`${baseName}-640.${format}`), width: 640 },
  { src: getCachedAsset(`${baseName}-1280.${format}`), width: 1280 }
]).filter((item) => item?.src);

/**
 * Build spread art object with responsive sources (sync, uses cache)
 * Returns null if base PNG not yet loaded
 */
export function buildSpreadArt({
  baseName,
  alt,
  width = 4096,
  height = 4096,
  aspectRatio = '16 / 9'
} = {}) {
  if (!baseName) return null;
  const src = getCachedAsset(`${baseName}.png`);
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
 * Get spread art for a spread key (sync, uses cache)
 */
export function getSpreadArt(spreadKey, options = {}) {
  const baseName = SPREAD_ART_BASE_NAMES[spreadKey];
  if (!baseName) return null;
  return buildSpreadArt({ baseName, ...options });
}

/**
 * Preload all assets for a spread (call this on hover or mount)
 * Returns a promise that resolves when all assets are loaded
 */
export async function preloadSpreadArt(spreadKey) {
  const baseName = SPREAD_ART_BASE_NAMES[spreadKey];
  if (!baseName) return;
  
  const files = [
    `${baseName}.png`,
    `${baseName}-640.avif`,
    `${baseName}-1280.avif`,
    `${baseName}-640.webp`,
    `${baseName}-1280.webp`
  ];
  
  await Promise.all(files.map(f => loadAsset(f)));
}

/**
 * Preload all spread art (call this after initial render)
 */
export async function preloadAllSpreadArt() {
  const spreads = Object.keys(SPREAD_ART_BASE_NAMES);
  // Load in sequence to avoid overwhelming the browser
  for (const spread of spreads) {
    await preloadSpreadArt(spread);
  }
}
