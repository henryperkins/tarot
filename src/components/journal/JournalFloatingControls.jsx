/**
 * JournalFloatingControls - Fixed position FAB buttons that appear on scroll
 */

import { X } from '@phosphor-icons/react';
import {
  JournalPlusCircleIcon,
  JournalSlidersIcon
} from '../JournalIcons';

export function JournalFloatingControls({
  hasEntries,
  hasScrolled,
  historyFiltersEl,
  historyFiltersInView,
  filtersActive,
  activeFilterChips,
  onResetFilters,
  onRemoveFilter,
  onScrollToFilters,
  onStartReading,
  isMobileLayout,
  showFiltersShortcut = true,
  showFilterSummary = true
}) {
  // Only show when all conditions are met
  if (!hasEntries || !hasScrolled || !historyFiltersEl || historyFiltersInView) {
    return null;
  }

  const showActiveFilters = showFilterSummary && filtersActive && activeFilterChips.length > 0;
  const showFiltersButton = showFiltersShortcut;
  const showNewReading = isMobileLayout;

  if (!showActiveFilters && !showFiltersButton && !showNewReading) {
    return null;
  }

  return (
    <div
      className="fixed z-40 flex flex-col items-end gap-2 right-[max(var(--safe-pad-right),clamp(1rem,2vw,1.5rem))] bottom-[max(var(--safe-pad-bottom),clamp(1rem,2vw,1.5rem))]"
    >
      {showActiveFilters && (
        <div className="max-w-sm rounded-2xl border border-[color:var(--border-warm-subtle)] bg-[color:var(--surface-92)] px-3 py-2 text-[11px] text-muted shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur">
          <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">Filters</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={`floating-${chip.key}`}
                type="button"
                onClick={() => onRemoveFilter?.(chip.key)}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"
                aria-label={`Remove ${chip.label} filter`}
              >
                {chip.label}
                <X className="h-3 w-3 text-muted" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-main hover:border-[color:var(--border-warm)] hover:bg-[color:var(--accent-25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            >
              Reset
            </button>
          </div>
        </div>
      )}
      {showNewReading && (
        <button
          type="button"
          onClick={() => onStartReading()}
          className="inline-flex min-h-touch items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--brand-primary)] to-[color:var(--brand-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] shadow-[0_22px_55px_-28px_var(--primary-60)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          aria-label="Start a new reading"
        >
          <JournalPlusCircleIcon className="h-4 w-4" aria-hidden="true" />
          New Reading
        </button>
      )}
      {showFiltersButton && (
        <button
          type="button"
          onClick={onScrollToFilters}
          className="inline-flex min-h-touch items-center gap-2 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--surface-92)] px-4 py-3 text-sm font-semibold text-main shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[color:var(--border-warm)] hover:bg-[color:var(--surface-88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          aria-label="Jump to journal filters"
        >
          <JournalSlidersIcon className="h-4 w-4 text-accent" aria-hidden="true" />
          Filters
        </button>
      )}
    </div>
  );
}

export default JournalFloatingControls;
