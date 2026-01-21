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
      className="fixed z-40 flex flex-col items-end gap-2"
      style={{
        right: 'max(env(safe-area-inset-right, 0px), clamp(1rem, 2vw, 1.5rem))',
        bottom: 'max(env(safe-area-inset-bottom, 0px), clamp(1rem, 2vw, 1.5rem))'
      }}
    >
      {showActiveFilters && (
        <div className="max-w-sm rounded-2xl border border-amber-300/15 bg-[#0b0c1d]/90 px-3 py-2 text-[11px] text-amber-100/75 shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur">
          <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-amber-100/60">Filters</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={`floating-${chip.key}`}
                type="button"
                onClick={() => onRemoveFilter?.(chip.key)}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/80"
                aria-label={`Remove ${chip.label} filter`}
              >
                {chip.label}
                <X className="h-3 w-3 text-amber-200/70" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200/25 bg-amber-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-50 hover:border-amber-200/40 hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
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
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_22px_55px_-28px_rgba(251,191,36,0.8)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
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
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-300/25 bg-[#0b0c1d]/90 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-[#0b0c1d]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
          aria-label="Jump to journal filters"
        >
          <JournalSlidersIcon className="h-4 w-4 text-amber-200" aria-hidden="true" />
          Filters
        </button>
      )}
    </div>
  );
}

export default JournalFloatingControls;
