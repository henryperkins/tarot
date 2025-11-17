let payloadPromise = null;
const deckCache = new Map();
let fsModulePromise = null;
let pathModulePromise = null;

function getFsModule() {
  if (!fsModulePromise) {
    if (typeof process === 'undefined' || process.release?.name !== 'node') {
      fsModulePromise = Promise.resolve(null);
    } else {
      fsModulePromise = import('node:fs/promises')
        .then((mod) => mod.default || mod)
        .catch(() => null);
    }
  }
  return fsModulePromise;
}

function getPathModule() {
  if (!pathModulePromise) {
    if (typeof process === 'undefined' || process.release?.name !== 'node') {
      pathModulePromise = Promise.resolve(null);
    } else {
      pathModulePromise = import('node:path')
        .then((mod) => mod.default || mod)
        .catch(() => null);
    }
  }
  return pathModulePromise;
}

async function resolveAdapterPath() {
  if (typeof process === 'undefined' || typeof process.cwd !== 'function') {
    return null;
  }
  if (process.env.VISION_ADAPTER_PATH) {
    return process.env.VISION_ADAPTER_PATH;
  }
  const path = await getPathModule();
  const cwd = process.cwd();
  if (path) {
    return path.resolve(cwd, 'data/vision/fine-tuned/prototypes.json');
  }
  return `${cwd}/data/vision/fine-tuned/prototypes.json`;
}

async function loadPayload() {
  if (payloadPromise) {
    return payloadPromise;
  }
  payloadPromise = (async () => {
    const fs = await getFsModule();
    if (!fs) {
      return null;
    }
    const adapterPath = await resolveAdapterPath();
    if (!adapterPath) {
      return null;
    }
    try {
      const raw = await fs.readFile(adapterPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        console.warn('[fineTuneCache] Unable to read fine-tuned prototypes:', err.message || err);
      }
      return null;
    }
  })();
  return payloadPromise;
}

export async function loadFineTunedPrototypes(deckStyle) {
  if (!deckStyle) {
    return null;
  }
  if (deckCache.has(deckStyle)) {
    return deckCache.get(deckStyle);
  }
  const payload = await loadPayload();
  const entry = payload?.deckStyles?.[deckStyle] || null;
  deckCache.set(deckStyle, entry);
  return entry;
}
