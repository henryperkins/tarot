/**
 * Journal utility functions - date formatting, window calculations, stats helpers
 */

import { getTimestamp } from '../../../shared/journal/utils.js';

/**
 * Get month header label for journal entry grouping
 */
export function getMonthHeader(timestamp) {
  if (!timestamp) return 'Undated';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Format timestamp for summary display (e.g., "Wed, Jan 15")
 */
export function formatSummaryDate(timestamp) {
  if (!timestamp) return 'No entries yet';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'No entries yet';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get the top context from stats breakdown
 */
export function getTopContext(stats) {
  if (!stats?.contextBreakdown?.length) return null;
  return stats.contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
}

/**
 * Get the current local calendar month, including the entire last day.
 * All journal windows use inclusive instants; callers must not add another day.
 */
export function getCurrentMonthWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1);
  return { start, end };
}

/**
 * Parse an HTML date input as a local calendar date, never UTC midnight.
 */
export function parseDateInput(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  // Date constructors silently roll invalid inputs such as February 30 forward.
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * Get inclusive instants for predefined timeframe filters. 30/90-day windows
 * are rolling elapsed days, so their boundaries keep the same meaning at DST.
 */
export function getTimeframeWindow(timeframe, now = new Date()) {
  const end = new Date(now);
  switch (timeframe) {
    case '30d': {
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case '90d': {
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end };
    }
    default:
      return null;
  }
}

/**
 * Filter entries to a specific date window
 */
export function filterEntriesToWindow(entries, window) {
  if (!Array.isArray(entries)) return [];
  if (!window?.start || !window?.end) return entries;
  const start = window.start.getTime();
  const end = window.end.getTime();
  return entries.filter((entry) => {
    const ts = getTimestamp(entry);
    if (!ts) return false;
    return ts >= start && ts <= end;
  });
}

/**
 * Format date window for display (e.g., "Jan 1, 2025 – Jan 31, 2025")
 */
export function formatWindowLabel(window) {
  if (!window?.start || !window?.end) return '';
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatter.format(window.start)} – ${formatter.format(window.end)}`;
}

/**
 * Get all-time window from entries array
 */
export function getAllTimeWindow(entries) {
  if (!entries || entries.length === 0) return null;
  const timestamps = entries
    .map((entry) => getTimestamp(entry))
    .filter(Boolean);
  if (!timestamps.length) return null;
  return {
    start: new Date(Math.min(...timestamps)),
    end: new Date(Math.max(...timestamps))
  };
}

/**
 * Get latest entry timestamp from entries array
 */
export function getLatestEntryTimestamp(entries) {
  if (!entries || entries.length === 0) return null;
  return entries.reduce((latest, entry) => {
    const ts = getTimestamp(entry);
    if (!ts) return latest;
    if (!latest || ts > latest) return ts;
    return latest;
  }, null);
}
