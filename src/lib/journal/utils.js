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
 * Get current month's date window
 */
export function getCurrentMonthWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Parse date input string to Date object
 */
export function parseDateInput(value) {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Get date window for predefined timeframe filters
 */
export function getTimeframeWindow(timeframe) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
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
