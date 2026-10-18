import { safeJsonParse } from '../../shared/journal/utils.js';
import { normalizeContextKey } from './journalInsights.js';

const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

// Navigation carries source data, never prose parsed from a display caption.
export function getCoachSuggestionJournalState(suggestion) {
  return { focusJournal: true, journeyFilter: suggestion?.journalFilter || null };
}

export function matchesJourneyFilter(entry, filter) {
  if (!filter) return true;
  if (filter.type === 'entries') return filter.entryIds?.includes(String(entry?.id)) || false;
  const value = normalize(filter.value);
  if (!value) return false;
  if (filter.type === 'context') return normalizeContextKey(entry?.context) === normalizeContextKey(value);
  if (filter.type === 'card') return (entry?.cards || []).some(card => normalize(card?.name) === value);
  if (filter.type === 'theme') {
    const themes = safeJsonParse(entry?.themes || entry?.themes_json, {});
    return [themes?.archetypeDescription, themes?.suitFocus, themes?.elementalBalance, themes?.reversalDescription?.name]
      .some(theme => normalize(theme) === value);
  }
  return false;
}
