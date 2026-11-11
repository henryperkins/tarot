import { Fragment, useState, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
import {
  CaretDown,
  Check,
  ListBullets,
  Rows,
  X
} from '@phosphor-icons/react';
import { JournalBookmarkIcon, JournalSearchIcon, JournalSlidersIcon } from './JournalIcons';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses';
import { ConfirmModal } from './ConfirmModal';
import { JournalFilterPanel } from './journal/JournalFilterPanel';
import { readSavedViews, writeSavedViews, importLegacySavedViews, hasLegacySavedViews } from '../lib/journal/savedViews.js';
import { normalizeJournalSortOrder } from '../lib/journal/listOrder.js';
import { DEFAULT_FILTERS } from '../lib/journal/constants';

const DISPLAY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable', icon: Rows },
  { value: 'compact', label: 'Compact', icon: ListBullets }
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' }
];
// Buttons keep the 14px control role despite the global mobile button inherit
// rule; native search inputs retain their 16px size to avoid focus zoom.
const OUTLINE_FILTER_BASE = `flex min-h-touch items-center gap-1 whitespace-nowrap rounded-xl border px-1.5 py-2 text-xs-plus! font-medium transition-all sm:gap-2 sm:px-2.5 ${FOCUS_RING_DEFAULT}`;
const OUTLINE_FILTER_IDLE = 'border-(--border-warm-light) text-muted hover:border-(--border-warm) hover:text-main';
const OUTLINE_FILTER_ACTIVE = 'border-(--brand-primary) bg-(--ui-selected-bg) text-main shadow-(--ui-selected-shadow-strong)';

function FilterDropdown({ label, options, value, onChange, fixedLabel = false, multiple = false, quiet = false, icon: Icon, buttonRef: externalButtonRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuLeft, setMenuLeft] = useState(0);
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

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef.current;
    const menu = container.querySelector('[role="listbox"]');
    const position = () => {
      const anchor = container.getBoundingClientRect();
      // Opening scale animations must not make the measured menu seem narrower.
      const width = menu.offsetWidth;
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 16;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 32;
      setMenuLeft(Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)) - anchor.left);
    };
    const observer = new ResizeObserver(position);
    observer.observe(container);
    observer.observe(menu);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    position();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [isOpen]);

  const focusOption = (index) => {
    const items = containerRef.current?.querySelectorAll('[data-dropdown-option="true"]');
    items?.[index]?.focus();
  };

  const openMenu = (preferLast = false) => {
    setIsOpen(true);
    const selectedIndex = options.findIndex(option => isSelected(option.value));
    const nextIndex = selectedIndex >= 0 ? selectedIndex : preferLast ? options.length - 1 : 0;
    setFocusedOptionIndex(nextIndex);
  };

  // Focus during the opening commit. A queued animation frame can otherwise
  // steal focus from a reader who has already moved to a different option.
  useLayoutEffect(() => {
    if (isOpen) focusOption(focusedOptionIndex);
  }, [isOpen, focusedOptionIndex]);

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

  const activeCount = fixedLabel || quiet ? 0 : multiple ? (value || []).length : (value && value !== 'all' ? 1 : 0);

  let displayLabel = label;
  if (!multiple && value && value !== 'all') {
    const selectedOption = options.find(o => o.value === value);
    if (selectedOption) displayLabel = selectedOption.label;
  }
  // The name carries the filter and its current choice, and contains the visible text.
  const accessibleName = multiple
    ? (activeCount > 0 ? `${label}, ${activeCount} selected` : label)
    : (displayLabel !== label ? `${label}: ${displayLabel}` : label);

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
        aria-label={accessibleName}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />}
        {multiple && <span>{label}</span>}
        {!multiple && <span className={!fixedLabel && !quiet && value !== 'all' ? 'text-(--brand-primary)' : ''}>{fixedLabel ? label : displayLabel}</span>}

        {multiple && activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-(--ui-selected-bg-strong) px-1 text-2xs">
            {activeCount}
          </span>
        )}
        <CaretDown className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple || undefined}
          style={{ left: menuLeft }}
          className="absolute top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] origin-top-left rounded-xl border border-(--border-warm) bg-(--ui-overlay-strong) p-1.5 shadow-(--ui-elevated-shadow) ring-1 ring-(--border-warm-light) backdrop-blur-xl backdrop-saturate-150 transition-none animate-in fade-in zoom-in-95 duration-100"
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
                <span className="flex items-center gap-2">
                  {option.icon && <option.icon className="h-4 w-4" aria-hidden="true" />}
                  {option.label}
                </span>
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
  viewMode = 'comfortable', onViewModeChange, resultsLabel,
  sortOrder = 'newest', onSortOrderChange, disabled = false,
  searchCoverageLabel, searchScopeLabel, onSearchRef, ownerId = null, storageReady = true,
  activeFilterChips = [], onRemoveFilter
}) {
  const isCompact = variant === 'compact';
  const loadViews = () => ({ ownerId, ready: storageReady,
    views: storageReady && typeof localStorage !== 'undefined' ? readSavedViews(localStorage, ownerId) : [],
    name: '', saveOpen: false, importOpen: false, filtersOpen: false, error: null });
  const [viewState, setViewState] = useState(loadViews);
  // Reset before painting a new owner; an effect alone would expose the previous query/name.
  if (viewState.ownerId !== ownerId || viewState.ready !== storageReady) setViewState(loadViews());
  const current = viewState.ownerId === ownerId && viewState.ready === storageReady ? viewState : loadViews();
  const updateViews = patch => setViewState(previous => previous.ownerId === ownerId && previous.ready === storageReady
    ? { ...previous, ...patch } : previous);
  // Overlays are opened deliberately, never restored over the journal on load.
  const filtersOpen = current.filtersOpen;
  const closeFilters = useCallback(() => setViewState(previous => ({ ...previous, filtersOpen: false })), []);
  const disclosureKey = JSON.stringify([ownerId, storageReady]);
  const filtersPanelId = useId();
  const searchHelpId = useId();
  const searchInputRef = useRef(null);
  const filtersToggleRef = useRef(null);
  const saveNameInputRef = useRef(null);
  const saveTriggerRef = useRef(null);
  const pendingSaveFocusRef = useRef(false);
  const chipButtonRefs = useRef(new Map());
  const pendingFocusRef = useRef(null);
  const savedFilters = current.views;
  const snapshot = () => ({ ...DEFAULT_FILTERS, ...filters,
    contexts: [...(filters.contexts || [])], spreads: [...(filters.spreads || [])], decks: [...(filters.decks || [])] });
  const panelFiltersActive = Boolean(filters.contexts?.length || filters.spreads?.length
    || filters.decks?.length || filters.timeframe !== 'all' || filters.onlyReversals || filters.journeyFilter);
  const activeFilters = Boolean(filters.query?.trim() || panelFiltersActive);
  const canSaveView = activeFilters || sortOrder !== 'newest';
  // The search box shows its own words, so the chips name everything else.
  const filterChips = (Array.isArray(activeFilterChips) ? activeFilterChips : []).filter(chip => chip.key !== 'query');
  const chipSignature = filterChips.map(chip => chip.key).join('|');
  const legacyAvailable = storageReady && typeof localStorage !== 'undefined' && hasLegacySavedViews(localStorage, ownerId);

  useEffect(() => {
    onSearchRef?.(searchInputRef.current);
    return () => onSearchRef?.(null);
  }, [onSearchRef]);
  useEffect(() => {
    if (current.saveOpen) saveNameInputRef.current?.focus();
    else if (pendingSaveFocusRef.current) {
      pendingSaveFocusRef.current = false;
      (saveTriggerRef.current || searchInputRef.current)?.focus();
    }
  }, [current.saveOpen]);
  // A control that removes itself hands focus on: the next filter chip, else search.
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    (chipButtonRefs.current.get(target) || searchInputRef.current)?.focus();
  }, [chipSignature, activeFilters]);

  const persistSavedFilters = (next, restoreSaveFocus = false) => {
    if (!storageReady || typeof localStorage === 'undefined') return;
    const result = writeSavedViews(localStorage, ownerId, next);
    if (result.success && restoreSaveFocus) pendingSaveFocusRef.current = true;
    updateViews(result.success ? { views: result.views, name: '', saveOpen: false, error: null } : { error: result.error });
  };
  const handleSaveCurrent = () => {
    const name = current.name.trim();
    if (!name || !canSaveView) return;
    const existing = savedFilters.find(view => view.name.toLowerCase() === name.toLowerCase());
    const view = { id: existing?.id || `saved-${Date.now()}`, name, values: snapshot(), sortOrder };
    persistSavedFilters(existing ? savedFilters.map(item => item.id === existing.id ? view : item) : [view, ...savedFilters], true);
  };
  const clearFilters = () => {
    pendingFocusRef.current = 'search';
    updateViews({ name: '', saveOpen: false }); onChange({ ...DEFAULT_FILTERS });
  };
  const removeChip = (key) => {
    const index = filterChips.findIndex(chip => chip.key === key);
    const remaining = filterChips.filter(chip => chip.key !== key);
    pendingFocusRef.current = remaining[index]?.key || remaining[index - 1]?.key || 'search';
    onRemoveFilter?.(key);
  };
  const sortControl = onSortOrderChange ? (
    <FilterDropdown key={`sort-${disclosureKey}`} label="Sort readings" quiet
      options={SORT_OPTIONS} value={sortOrder} onChange={onSortOrderChange} />
  ) : null;
  const filtersControl = (
    <Fragment key="filters">
      <button ref={filtersToggleRef} type="button" onClick={() => updateViews({ filtersOpen: !filtersOpen })}
        aria-haspopup="dialog" aria-expanded={filtersOpen && !disabled} aria-controls={filtersOpen && !disabled ? filtersPanelId : undefined}
        aria-label={filterChips.length > 0 ? `Filters, ${filterChips.length} active` : 'Filters'}
        className={`${OUTLINE_FILTER_BASE} ${filterChips.length > 0 ? OUTLINE_FILTER_ACTIVE : OUTLINE_FILTER_IDLE}`}>
        <JournalSlidersIcon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
        <span>Filters</span>
        {filterChips.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-(--ui-selected-bg-strong) px-1 text-2xs tabular-nums">
            {filterChips.length}
          </span>
        )}
        <CaretDown className={`h-3 w-3 shrink-0 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {/* The first panel control follows its trigger in desktop tab order. */}
      <JournalFilterPanel id={filtersPanelId} isOpen={filtersOpen && !disabled} isCompact={isCompact}
        filters={filters} onChange={onChange} contexts={contexts} spreads={spreads} decks={decks}
        onClose={closeFilters} triggerRef={filtersToggleRef} canClear={panelFiltersActive}
        onClear={() => {
          updateViews({ name: '', saveOpen: false });
          onChange({ ...DEFAULT_FILTERS, query: filters.query });
        }} />
    </Fragment>
  );

  return (
    <section aria-label="Journal filters" className="relative space-y-3">
      <div data-journal-toolbar className="relative flex flex-wrap items-center gap-2">
        <div className={`relative min-w-0 ${isCompact ? 'basis-full' : 'flex-[1_1_14rem]'}`}>
          <JournalSearchIcon className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input ref={searchInputRef} type="search" value={filters.query}
            onChange={event => onChange({ ...filters, query: event.target.value })}
            placeholder="Search readings..." aria-label="Search journal entries" aria-describedby={searchHelpId}
            className={`w-full min-h-touch rounded-xl border border-(--border-warm) bg-(--bg-main) pl-9 pr-3 py-2 text-sm-mobile text-main placeholder:text-muted ${FOCUS_RING_DEFAULT}`} />
          <span id={searchHelpId} className="sr-only">Search questions, card names and positions, reading narratives, reflections, spreads, and contexts.</span>
        </div>
        <div className={`flex min-w-0 flex-wrap items-center gap-2 ${isCompact ? 'basis-full' : ''}`}>
          {/* DOM order follows the visual order, including handset keyboard use. */}
          {isCompact ? [filtersControl, sortControl] : [sortControl, filtersControl]}
          {onViewModeChange && <FilterDropdown key={`view-${disclosureKey}`} label="View" fixedLabel icon={ListBullets}
            options={DISPLAY_OPTIONS} value={viewMode} onChange={onViewModeChange} />}
        </div>
      </div>

      {canSaveView && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={activeFilters ? 'Active filters' : 'Current view'}>
          {filterChips.map(chip => (
            <button key={chip.key} type="button"
              ref={node => { if (node) chipButtonRefs.current.set(chip.key, node); else chipButtonRefs.current.delete(chip.key); }}
              onClick={() => removeChip(chip.key)} aria-label={`Remove ${chip.label} filter`}
              className={`inline-flex min-h-touch max-w-full items-center gap-1.5 rounded-full border border-(--border-warm-light) bg-(--border-warm-subtle) px-3 py-1.5 text-xs font-semibold text-main hover:border-(--border-warm) ${FOCUS_RING_DEFAULT}`}>
              <span className="min-w-0 wrap-anywhere">{chip.label}</span>
              <X className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            </button>
          ))}
          {activeFilters && <button type="button" onClick={clearFilters}
            className={`inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-accent underline-offset-4 hover:underline ${FOCUS_RING_DEFAULT}`}>
            Clear filters
          </button>}
          {!current.saveOpen ? (
            <button ref={saveTriggerRef} type="button" disabled={!storageReady} onClick={() => updateViews({ saveOpen: true })}
              className={`inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-main hover:text-accent disabled:opacity-50 ${FOCUS_RING_DEFAULT}`}>
              <JournalBookmarkIcon className="h-3.5 w-3.5" aria-hidden="true" />Save this view
            </button>
          ) : (
            <div className="flex basis-full flex-wrap items-center gap-2">
              <input ref={saveNameInputRef} value={current.name} onChange={event => updateViews({ name: event.target.value })}
                placeholder="Name this view" aria-label="Name for saved filter view"
                className={`min-h-touch min-w-0 flex-[1_1_12rem] rounded-xl border border-(--border-warm) bg-(--bg-main) px-3 py-2 text-sm-mobile text-main ${FOCUS_RING_DEFAULT}`} />
              <button type="button" disabled={!current.name.trim()} onClick={handleSaveCurrent} className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_ACTIVE} disabled:opacity-50`}>Save current</button>
              <button type="button" onClick={() => { pendingSaveFocusRef.current = true; updateViews({ name: '', saveOpen: false }); }} className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_IDLE}`}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {(resultsLabel || searchCoverageLabel || searchScopeLabel) && (
        <p className="text-sm text-muted">
          {[resultsLabel, searchCoverageLabel, searchScopeLabel].filter(Boolean).join(' · ')}
        </p>
      )}

      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved views">
          {savedFilters.map(saved => (
            <div key={saved.id} className="inline-flex max-w-full items-center rounded-xl border border-(--border-warm-light)">
              <button type="button" onClick={() => {
                updateViews({ name: '', saveOpen: false });
                onChange({ ...DEFAULT_FILTERS, ...saved.values });
                onSortOrderChange?.(normalizeJournalSortOrder(saved.sortOrder));
              }}
                className={`min-h-touch min-w-0 px-3 py-2 text-left text-sm text-main wrap-anywhere ${FOCUS_RING_DEFAULT}`}>{saved.name}</button>
              <button type="button" aria-label={`Delete saved filter ${saved.name}`} onClick={() => persistSavedFilters(savedFilters.filter(item => item.id !== saved.id))}
                className={`min-h-touch min-w-touch rounded-xl text-muted hover:text-error ${FOCUS_RING_DEFAULT}`}><span aria-hidden="true">×</span></button>
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
