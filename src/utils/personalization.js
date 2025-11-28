import { DEFAULT_SPREAD_KEY } from '../data/spreads';

export function getSpreadFromDepth(depth) {
  switch (depth) {
    case 'short':
      return 'single';
    case 'standard':
      return 'threeCard';
    case 'deep':
      return 'celtic';
    default:
      return DEFAULT_SPREAD_KEY;
  }
}
