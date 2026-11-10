/**
 * Journal actions stay in document flow so saved writing remains unobscured.
 */

import { X } from '@phosphor-icons/react';
import {
  JournalPlusCircleIcon,
  JournalSlidersIcon
} from '../JournalIcons';
import { BADGE_LABEL_CLASS, META_LABEL_CLASS } from '../../styles/labelClasses';

export function JournalFloatingControls({
  hasEntries,
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
  const showActiveFilters = showFilterSummary && filtersActive && activeFilterChips.length > 0;
  const showFiltersButton = showFiltersShortcut;
  const showNewReading = isMobileLayout;
  const visible = hasEntries && (showActiveFilters || showFiltersButton || showNewReading);

  if (!visible) return null;

  return (
    <div
      role="group" aria-label="Journal actions"
      className="relative flex flex-wrap items-center justify-end gap-3 border-t border-(--border-warm-light) pt-4"
    >
      {showActiveFilters && (
        <div className="pointer-events-auto max-w-sm rounded-2xl border border-(--border-warm-subtle) bg-(--surface-92) px-3 py-2 text-2xs text-muted shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur">
          <p className={`${META_LABEL_CLASS} mb-1 text-muted`}>Filters</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterChips.map((chip) => (
              <button
                key={`floating-${chip.key}`}
                type="button"
                onClick={() => onRemoveFilter?.(chip.key)}
                className={`${BADGE_LABEL_CLASS} inline-flex min-h-touch items-center gap-1 rounded-full border border-(--border-warm-light) bg-(--border-warm-subtle) px-2 py-0.5 text-muted`}
                aria-label={`Remove ${chip.label} filter`}
              >
                {chip.label}
                <X className="h-3 w-3 text-muted" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={onResetFilters}
              className={`${BADGE_LABEL_CLASS} inline-flex min-h-touch items-center gap-1 rounded-full border border-(--border-warm-light) bg-(--border-warm-subtle) px-2 py-0.5 text-main hover:border-(--border-warm) hover:bg-(--accent-25) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)`}
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
          className="pointer-events-auto inline-flex min-h-touch items-center gap-2 rounded-full bg-linear-to-r from-(--brand-primary) to-(--brand-accent) px-4 py-3 text-sm font-semibold text-(--text-on-brand) shadow-[0_22px_55px_-28px_var(--primary-60)] transition hover:-translate-y-0.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
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
          className="pointer-events-auto inline-flex min-h-touch items-center gap-2 rounded-full border border-(--border-warm-light) bg-(--surface-92) px-4 py-3 text-sm font-semibold text-main shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur transition hover:-translate-y-0.5 hover:border-(--border-warm) hover:bg-(--surface-88) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
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
