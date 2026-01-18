/**
 * Journal constants - filter configs, CSS classes, layout data
 */

import { SPREADS } from '../../data/spreads';
import { DECK_OPTIONS } from '../../components/DeckSelector';

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
  onlyReversals: false
};

// Scope/analytics options
export const SCOPE_OPTIONS = [
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'filters', label: 'Current filters' },
  { value: 'custom', label: 'Custom' }
];

export const TIMEFRAME_LABELS = {
  '30d': 'Last 30d',
  '90d': 'Last 90d',
  ytd: 'Year to date'
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
  recentThemes: []
};

// Pagination
export const VISIBLE_ENTRY_BATCH = 10;

// Layout breakpoints
export const MOBILE_LAYOUT_MAX = 1023;

// Constellation card positions for summary band
export const CARD_NODE_POSITIONS = {
  entries: { x: 50, y: 50 },
  reversal: { x: 78, y: 38 },
  context: { x: 24, y: 36 },
  'last-entry': { x: 52, y: 74 }
};

export const CARD_NODE_FALLBACK = [
  { x: 24, y: 36 },
  { x: 78, y: 38 },
  { x: 50, y: 50 },
  { x: 52, y: 74 }
];

export const CARD_CONNECTORS = [
  ['entries', 'reversal'],
  ['entries', 'context'],
  ['entries', 'last-entry'],
  ['reversal', 'context'],
  ['reversal', 'last-entry'],
  ['context', 'last-entry']
];

// CSS class constants for amber-themed cards
export const AMBER_SHELL_CLASS = 'relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)]';
export const AMBER_CARD_CLASS = 'relative overflow-hidden rounded-[28px] border border-amber-200/15 bg-[radial-gradient(circle_at_top,rgba(244,209,148,0.18),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(120,141,255,0.16),transparent_45%),linear-gradient(160deg,rgba(14,12,22,0.98),rgba(9,9,16,0.98))] ring-1 ring-amber-200/10 shadow-[0_28px_74px_-36px_rgba(0,0,0,0.9)]';
export const AMBER_SHELL_MOBILE_CLASS = 'relative overflow-hidden rounded-3xl border border-amber-300/10 bg-[#0d1020] shadow-[0_18px_48px_-34px_rgba(0,0,0,0.78)]';
export const AMBER_CARD_MOBILE_CLASS = 'relative overflow-hidden rounded-[24px] border border-amber-200/12 bg-[radial-gradient(circle_at_20%_0%,rgba(244,209,148,0.16),transparent_55%),linear-gradient(160deg,rgba(14,15,30,0.98),rgba(10,11,20,0.98))] ring-1 ring-amber-200/10 shadow-[0_22px_58px_-34px_rgba(0,0,0,0.85)]';
