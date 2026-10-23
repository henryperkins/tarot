import { useState, useRef, useEffect, useId } from 'react';
import {
  CaretDown,
  Check,
  ListBullets,
  SquaresFour
} from '@phosphor-icons/react';
import { JournalBookmarkIcon, JournalRefreshIcon, JournalSearchIcon } from './JournalIcons';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses';
import { ConfirmModal } from './ConfirmModal';
import { readSavedViews, writeSavedViews, importLegacySavedViews, hasLegacySavedViews } from '../lib/journal/savedViews.js';
import { DEFAULT_FILTERS } from '../lib/journal/constants';

const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'This year' }
];

const OUTLINE_FILTER_BASE = `flex min-h-touch items-center gap-2 rounded-xl border px-2.5 py-2 text-xs-plus font-medium transition-all ${FOCUS_RING_DEFAULT}`;
const OUTLINE_FILTER_IDLE = 'border-(--border-warm-light) text-muted hover:border-(--border-warm) hover:text-main';
const OUTLINE_FILTER_ACTIVE = 'border-(--brand-primary) bg-(--ui-selected-bg) text-main shadow-(--ui-selected-shadow-strong)';

function FilterDropdown({ label, options, value, onChange, multiple = false, buttonRef: externalButtonRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const containerRef = useRef(null);
  const internalButtonRef = useRef(null);
  const menuId = useId();

  const setButtonRef = (node) => {
    internalButtonRef.current = node;
    if (externalButtonRef && typeof externalButtonRef === 'object') {
      externalButtonRef.current = node;
    }
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handlePointerDown);
    };
  }, []);

  const computeAlignRight = () => {
    if (typeof window === 'undefined') return false;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const menuWidth = 256;
    const margin = 16;
    return rect.left + menuWidth > window.innerWidth - margin;
  };

  const focusOption = (index) => {
    const items = containerRef.current?.querySelectorAll('[data-dropdown-option="true"]');
    items?.[index]?.focus();
  };

  const openMenu = (preferLast = false) => {
    setAlignRight(computeAlignRight());
    setIsOpen(true);
    const selectedIndex = options.findIndex(option => isSelected(option.value));
    const nextIndex = selectedIndex >= 0 ? selectedIndex : preferLast ? options.length - 1 : 0;
    setFocusedOptionIndex(nextIndex);
    if (typeof window === 'undefined') return;
    const schedule = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame
      : (cb) => setTimeout(cb, 0);
    schedule(() => {
      focusOption(nextIndex);
    });
  };

  const handleButtonKeyDown = (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu(event.key === 'ArrowUp');
    }
  };

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      internalButtonRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || options.length === 0) return;
    event.preventDefault();
    const items = [...containerRef.current.querySelectorAll('[data-dropdown-option="true"]')];
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? options.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    setFocusedOptionIndex(nextIndex);
    focusOption(nextIndex);
  };

  const handleSelect = (optionValue) => {
    if (multiple) {
      const current = value || [];
      const next = current.includes(optionValue)
        ? current.filter(v => v !== optionValue)
        : [...current, optionValue];
      onChange(next);
    } else {
      onChange(optionValue);
      setIsOpen(false);
      internalButtonRef.current?.focus();
    }
  };

  const isSelected = (optionValue) => {
    if (multiple) return (value || []).includes(optionValue);
    return value === optionValue;
  };

  const activeCount = multiple ? (value || []).length : (value && value !== 'all' ? 1 : 0);

  let displayLabel = label;
  if (!multiple && value && value !== 'all') {
    const selectedOption = options.find(o => o.value === value);
    if (selectedOption) displayLabel = selectedOption.label;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={setButtonRef}
        type="button"
        onClick={() => isOpen ? setIsOpen(false) : openMenu()}
        onKeyDown={handleButtonKeyDown}
        className={`${OUTLINE_FILTER_BASE} ${activeCount > 0 ? OUTLINE_FILTER_ACTIVE : OUTLINE_FILTER_IDLE}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={label}
        aria-pressed={activeCount > 0}
      >
        {multiple && <span>{label}</span>}
        {!multiple && <span className={value !== 'all' ? 'text-(--brand-primary)' : ''}>{displayLabel}</span>}

        {multiple && activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-(--ui-selected-bg-strong) px-1 text-2xs">
            {activeCount}
          </span>
        )}
        <CaretDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple || undefined}
          className={`absolute top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] ${
            alignRight ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          } rounded-xl border border-(--border-warm) bg-(--ui-overlay-strong) p-1.5 shadow-(--ui-elevated-shadow) ring-1 ring-(--border-warm-light) backdrop-blur-xl backdrop-saturate-150 animate-in fade-in zoom-in-95 duration-100`}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((option, index) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                type="button"
                data-dropdown-option="true"
                role="option"
                aria-selected={isSelected(option.value)}
                tabIndex={focusedOptionIndex === index ? 0 : -1}
                onFocus={() => setFocusedOptionIndex(index)}
                className={`flex min-h-touch w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs-plus text-muted hover:bg-(--ui-selected-bg-subtle) hover:text-accent transition-colors focus:outline-hidden ${FOCUS_RING_DEFAULT}`}
              >
                <span>{option.label}</span>
                {isSelected(option.value) && <Check className="h-3.5 w-3.5 text-(--brand-primary)" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function JournalFilters({
  filters, onChange, contexts = [], spreads = [], decks = [], variant = 'full',
  viewMode = 'comfortable', onViewModeChange, resultCount, totalCount,
  searchCoverageLabel, searchScopeLabel, onSearchRef, ownerId = null, storageReady = true
}) {
  const isCompact = variant === 'compact';
  const loadViews = () => ({ ownerId, ready: storageReady,
    views: storageReady && typeof localStorage !== 'undefined' ? readSavedViews(localStorage, ownerId) : [],
    name: '', saveOpen: false, importOpen: false, error: null });
  const [viewState, setViewState] = useState(loadViews);
  // Reset before painting a new owner; an effect alone would expose the previous query/name.
  if (viewState.ownerId !== ownerId || viewState.ready !== storageReady) setViewState(loadViews());
  const current = viewState.ownerId === ownerId && viewState.ready === storageReady ? viewState : loadViews();
  const updateViews = patch => setViewState(previous => previous.ownerId === ownerId && previous.ready === storageReady
    ? { ...previous, ...patch } : previous);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('journal_filters_advanced_v1');
      return stored === 'true' || (stored !== 'false' && !isCompact);
    } catch { return !isCompact; }
  });
  const searchInputRef = useRef(null);
  const saveNameInputRef = useRef(null);
  const savedFilters = current.views;
  const snapshot = () => ({ ...DEFAULT_FILTERS, ...filters,
    contexts: [...(filters.contexts || [])], spreads: [...(filters.spreads || [])], decks: [...(filters.decks || [])] });
  const activeFilters = Boolean(filters.query?.trim() || filters.contexts?.length || filters.spreads?.length
    || filters.decks?.length || filters.timeframe !== 'all' || filters.onlyReversals || filters.journeyFilter);
  const legacyAvailable = storageReady && typeof localStorage !== 'undefined' && hasLegacySavedViews(localStorage, ownerId);

  useEffect(() => {
    onSearchRef?.(searchInputRef.current);
    return () => onSearchRef?.(null);
  }, [onSearchRef]);
  useEffect(() => {
    if (current.saveOpen) saveNameInputRef.current?.focus();
  }, [current.saveOpen]);

  const persistSavedFilters = next => {
    if (!storageReady || typeof localStorage === 'undefined') return;
    const result = writeSavedViews(localStorage, ownerId, next);
    updateViews(result.success ? { views: next, name: '', saveOpen: false, error: null } : { error: result.error });
  };
  const handleSaveCurrent = () => {
    const name = current.name.trim();
    if (!name || !activeFilters) return;
    const existing = savedFilters.find(view => view.name.toLowerCase() === name.toLowerCase());
    const view = { id: existing?.id || `saved-${Date.now()}`, name, values: snapshot() };
    persistSavedFilters(existing ? savedFilters.map(item => item.id === existing.id ? view : item) : [view, ...savedFilters]);
  };
  const clearFilters = () => {
    updateViews({ name: '', saveOpen: false }); onChange({ ...DEFAULT_FILTERS });
  };

  return (
    <section aria-label="Journal filters" className="relative rounded-2xl border border-(--border-warm-light) bg-(--bg-surface) p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_14rem]">
          <JournalSearchIcon className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input ref={searchInputRef} type="search" value={filters.query}
            onChange={event => onChange({ ...filters, query: event.target.value })}
            placeholder="Search readings..." aria-label="Search journal entries"
            className={`w-full min-h-touch rounded-xl border border-(--border-warm) bg-(--bg-main) pl-9 pr-3 py-2 text-sm-mobile text-main placeholder:text-muted ${FOCUS_RING_DEFAULT}`} />
        </div>
        {activeFilters && <button type="button" onClick={clearFilters}
          className={`inline-flex min-h-touch items-center gap-2 rounded-xl border border-(--border-warm) px-3 py-2 text-xs-plus font-semibold text-main ${FOCUS_RING_DEFAULT} disabled:opacity-50 disabled:cursor-not-allowed`}>
          <JournalRefreshIcon className="h-4 w-4" aria-hidden="true" />Reset view
        </button>}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <details open={filtersOpen} className={`min-w-0 ${filtersOpen ? 'basis-full sm:flex-[1_1_10rem]' : 'flex-[1_1_4rem]'}`} onToggle={event => {
          const open = event.currentTarget.open; setFiltersOpen(open);
          try { localStorage.setItem('journal_filters_advanced_v1', String(open)); } catch { /* Optional presentation preference. */ }
        }}>
          <summary className={`min-h-touch content-center cursor-pointer rounded-xl px-2.5 text-sm font-medium text-main ${FOCUS_RING_DEFAULT}`}>Filters</summary>
          <div className="flex flex-wrap items-center gap-2 pt-2">
        <FilterDropdown label="Timeframe" options={TIMEFRAME_OPTIONS} value={filters.timeframe} onChange={value => onChange({ ...filters, timeframe: value })} />
        {contexts.length > 0 && <FilterDropdown label="Context" options={contexts} value={filters.contexts} multiple onChange={value => onChange({ ...filters, contexts: value })} />}
        {spreads.length > 0 && <FilterDropdown label="Spread" options={spreads} value={filters.spreads} multiple onChange={value => onChange({ ...filters, spreads: value })} />}
        {decks.length > 0 && <FilterDropdown label="Deck" options={decks} value={filters.decks} multiple onChange={value => onChange({ ...filters, decks: value })} />}
        <button type="button" aria-pressed={filters.onlyReversals} onClick={() => onChange({ ...filters, onlyReversals: !filters.onlyReversals })}
          className={`${OUTLINE_FILTER_BASE} ${filters.onlyReversals ? OUTLINE_FILTER_ACTIVE : OUTLINE_FILTER_IDLE}`}>Reversals</button>
          </div>
          <details className="mt-2 text-xs text-muted">
            <summary className={`min-h-touch content-center cursor-pointer rounded-lg ${FOCUS_RING_DEFAULT}`}>What fields are searched?</summary>
            <p className="pt-1 leading-relaxed">Search your questions, card names and positions, reading narratives, reflections, spreads, and contexts.</p>
          </details>
        </details>
        {onViewModeChange && (
          <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-(--border-warm-light) p-1" role="group" aria-label="List view mode">
            {[['comfortable', SquaresFour, isCompact ? 'Cards' : 'Comfortable'], ['compact', ListBullets, isCompact ? 'List' : 'Compact']].map(([mode, Icon, label]) => (
              <button key={mode} type="button" onClick={() => onViewModeChange(mode)} aria-pressed={viewMode === mode}
                title={mode === 'compact' ? 'Compact view - shows more entries' : 'Comfortable view - shows more details'}
                className={`inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs-plus text-main ${viewMode === mode ? 'bg-(--ui-selected-bg)' : ''} ${FOCUS_RING_DEFAULT}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        )}
      </div>
      {filters.query?.trim() && typeof resultCount === 'number' && (
        <p className="text-sm text-muted" role="status">Found {resultCount} in {totalCount} readings{resultCount === 0 ? ' — try different keywords.' : '.'}</p>
      )}
      {(searchCoverageLabel || searchScopeLabel) && <p className="text-xs text-muted">{[searchCoverageLabel, searchScopeLabel].filter(Boolean).join(' · ')}</p>}
      {(savedFilters.length > 0 || activeFilters) && (
        <div className="space-y-2 border-t border-(--border-warm-light) pt-3">
          {savedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved views">
              {savedFilters.map(saved => (
                <div key={saved.id} className="inline-flex max-w-full items-center rounded-xl border border-(--border-warm-light)">
                  <button type="button" onClick={() => { updateViews({ name: '', saveOpen: false }); onChange({ ...DEFAULT_FILTERS, ...saved.values }); }}
                    className={`min-h-touch min-w-0 px-3 py-2 text-left text-sm text-main wrap-anywhere ${FOCUS_RING_DEFAULT}`}>{saved.name}</button>
                  <button type="button" aria-label={`Delete saved filter ${saved.name}`} onClick={() => persistSavedFilters(savedFilters.filter(item => item.id !== saved.id))}
                    className={`min-h-touch min-w-touch rounded-xl text-muted hover:text-error ${FOCUS_RING_DEFAULT}`}><span aria-hidden="true">×</span></button>
                </div>
              ))}
            </div>
          )}
          {activeFilters && (!current.saveOpen ? (
            <button type="button" disabled={!storageReady} onClick={() => updateViews({ saveOpen: true })}
              className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_IDLE}`}><JournalBookmarkIcon className="h-4 w-4" aria-hidden="true" />Save this view</button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={saveNameInputRef} value={current.name} onChange={event => updateViews({ name: event.target.value })}
                placeholder="Name this view" aria-label="Name for saved filter view"
                className={`min-h-touch min-w-0 flex-[1_1_12rem] rounded-xl border border-(--border-warm) bg-(--bg-main) px-3 py-2 text-sm-mobile text-main ${FOCUS_RING_DEFAULT}`} />
              <button type="button" disabled={!current.name.trim()} onClick={handleSaveCurrent} className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_ACTIVE} disabled:opacity-50`}>Save current</button>
              <button type="button" onClick={() => updateViews({ name: '', saveOpen: false })} className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_IDLE}`}>Cancel</button>
            </div>
          ))}
        </div>
      )}
      {legacyAvailable && <button type="button" onClick={() => updateViews({ importOpen: true })}
        className={`min-h-touch text-left text-sm text-accent underline underline-offset-4 ${FOCUS_RING_DEFAULT}`}>Import older saved views</button>}
      {current.error && <p role="alert" className="text-sm text-error">{current.error}</p>}
      <ConfirmModal isOpen={current.importOpen} onClose={() => updateViews({ importOpen: false })} title="Import saved views"
        message="These older views were saved on this browser without an account owner. Import them only if they belong to you."
        confirmText="Import views" cancelText="Keep separate" onConfirm={() => {
          const result = importLegacySavedViews(localStorage, ownerId);
          updateViews(result.success ? { views: result.views, importOpen: false, error: null } : { importOpen: false, error: result.error });
        }} />
    </section>
  );
}
