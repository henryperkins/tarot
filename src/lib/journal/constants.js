/**
 * Journal constants - filter configs, CSS classes, layout data
 */

import { SPREADS } from '../../data/spreads';
import { DECK_OPTIONS } from '../../components/deckOptions';

// Filter option definitions
export const CONTEXT_FILTERS = [
  { value: 'love', label: 'Love' },
  { value: 'career', label: 'Career' },
  { value: 'self', label: 'Self' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'decision', label: 'Decision' }
];

export const SPREAD_FILTERS = Object.entries(SPREADS || {}).map(([value, config]) => ({
  value,
  label: config?.name || value
}));

export const DECK_FILTERS = DECK_OPTIONS.map(d => ({ value: d.id, label: d.label }));

export const DEFAULT_FILTERS = {
  query: '',
  contexts: [],
  spreads: [],
  decks: [],
  timeframe: 'all',
  onlyReversals: false,
  journeyFilter: null
};

// Scope/analytics options
export const SCOPE_OPTIONS = [
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'filters', label: 'Current filters' },
  { value: 'custom', label: 'Custom' }
];

// Chips name a timeframe the way the Timeframe filter does.
export const TIMEFRAME_LABELS = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  ytd: 'This year'
};

// Card metadata
export const SUIT_ELEMENTS = {
  Wands: { element: 'Fire', quality: 'passion, action, creativity' },
  Cups: { element: 'Water', quality: 'emotions, relationships, intuition' },
  Swords: { element: 'Air', quality: 'thoughts, communication, conflict' },
  Pentacles: { element: 'Earth', quality: 'material, practical, grounded' }
};

// Fallback stats object when journal is empty or stats cannot be computed
export const EMPTY_STATS = {
  totalReadings: 0,
  totalCards: 0,
  reversalRate: 0,
  frequentCards: [],
  contextBreakdown: [],
  monthlyCadence: [],
  recentThemes: [],
  themeSignals: [],
  topTheme: null,
  reversalRateReliable: false,
  reversalRateSample: 0,
  cardFrequencyReliable: false,
  cardFrequencySample: 0,
};

// Pagination
export const VISIBLE_ENTRY_BATCH = 10;

// Layout breakpoints
export const MOBILE_LAYOUT_MAX = 1023;

// Constellation card positions for the summary band (percent of the 340px stage).
// One row in reading order (entries, reversal, context, last entry): the 160px
// hero and three 140px cards keep about 10px apart at the stage's 40em minimum,
// and the tallest card (256px) stays inside the stage height.
export const CARD_NODE_POSITIONS = {
  entries: { x: 14.8, y: 48 },
  reversal: { x: 39.7, y: 52 },
  context: { x: 63.2, y: 48 },
  'last-entry': { x: 86.6, y: 52 }
};

export const CARD_NODE_FALLBACK = [
  { x: 14.8, y: 48 },
  { x: 39.7, y: 52 },
  { x: 63.2, y: 48 },
  { x: 86.6, y: 52 }
];

export const CARD_CONNECTORS = [
  ['entries', 'reversal'],
  ['entries', 'context'],
  ['entries', 'last-entry'],
  ['reversal', 'context'],
  ['reversal', 'last-entry'],
  ['context', 'last-entry']
];

// CSS class constants for journal surfaces
// Uses semantic theme panel and surface tokens from src/styles/theme.css.
export const AMBER_SHELL_CLASS = 'panel-mystic rounded-3xl';
export const AMBER_CARD_CLASS = 'relative overflow-hidden rounded-2xl border border-(--border-warm-light) bg-(--bg-surface)';
export const AMBER_SHELL_MOBILE_CLASS = 'panel-mystic rounded-3xl';
export const AMBER_CARD_MOBILE_CLASS = 'relative overflow-hidden rounded-2xl border border-(--border-warm-light) bg-(--bg-surface)';
