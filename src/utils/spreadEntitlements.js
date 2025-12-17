import { DEFAULT_SPREAD_KEY, normalizeSpreadKey } from '../data/spreads.js';

const SPREAD_FALLBACK_MAP = {
  relationship: 'threeCard',
  decision: 'fiveCard',
  celtic: 'fiveCard'
};

export function resolveFallbackSpreadKey(requestedKey, spreadsConfig) {
  const preferredFallback = SPREAD_FALLBACK_MAP[requestedKey] || DEFAULT_SPREAD_KEY;

  if (spreadsConfig === 'all' || spreadsConfig === 'all+custom') {
    return normalizeSpreadKey(requestedKey);
  }

  if (Array.isArray(spreadsConfig)) {
    if (spreadsConfig.includes(preferredFallback)) return preferredFallback;
    if (spreadsConfig.includes(DEFAULT_SPREAD_KEY)) return DEFAULT_SPREAD_KEY;
    return spreadsConfig[0] || DEFAULT_SPREAD_KEY;
  }

  return DEFAULT_SPREAD_KEY;
}
