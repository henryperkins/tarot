const SPREAD_ART_ASSETS = import.meta.glob(
  '../../selectorimages/{onecard,3card,5card,decision,relationshipsnapshot,celticcross}*.{png,avif,webp}',
  {
    eager: true,
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

const getSpreadAsset = (fileName) => SPREAD_ART_ASSETS[`../../selectorimages/${fileName}`];

const buildSourceEntries = (baseName, format) => ([
  { src: getSpreadAsset(`${baseName}-640.${format}`), width: 640 },
  { src: getSpreadAsset(`${baseName}-1280.${format}`), width: 1280 }
]).filter((item) => item?.src);

export function buildSpreadArt({
  baseName,
  alt,
  width = 4096,
  height = 4096,
  aspectRatio = '16 / 9'
} = {}) {
  if (!baseName) return null;
  const src = getSpreadAsset(`${baseName}.png`);
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

export function getSpreadArt(spreadKey, options = {}) {
  const baseName = SPREAD_ART_BASE_NAMES[spreadKey];
  if (!baseName) return null;
  return buildSpreadArt({ baseName, ...options });
}
