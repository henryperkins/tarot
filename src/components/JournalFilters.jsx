import { useState, useRef, useEffect, useId } from 'react';
import { CaretDown, Check, BookmarkSimple } from '@phosphor-icons/react';

const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'This year' }
];

const DEFAULT_FILTERS = { query: '', contexts: [], spreads: [], decks: [], timeframe: 'all', onlyReversals: false };
const SAVED_FILTERS_KEY = 'journal_saved_filters_v1';
const OUTLINE_FILTER_BASE = 'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40';
const OUTLINE_FILTER_IDLE = 'border-secondary/40 text-secondary/80 hover:border-secondary/60';
const OUTLINE_FILTER_ACTIVE = 'border-secondary/60 bg-secondary/10 text-secondary';

function FilterDropdown({ label, options, value, onChange, multiple = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const focusFirstOption = () => {
    if (typeof window === 'undefined') return;
    const schedule = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame
      : (cb) => setTimeout(cb, 0);
    schedule(() => {
      const firstOption = containerRef.current?.querySelector('[data-dropdown-option="true"]');
      if (firstOption instanceof HTMLElement) {
        firstOption.focus();
      }
    });
  };

  const handleButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        focusFirstOption();
      }
    }
  };

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
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
      buttonRef.current?.focus();
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
        ref={buttonRef}
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            focusFirstOption();
          }
        }}
        onKeyDown={handleButtonKeyDown}
        className={`${OUTLINE_FILTER_BASE} ${activeCount > 0 ? OUTLINE_FILTER_ACTIVE : OUTLINE_FILTER_IDLE}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        {multiple && <span>{label}</span>}
        {!multiple && <span className={value !== 'all' ? 'text-secondary' : ''}>{displayLabel}</span>}

        {multiple && activeCount > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-secondary/20 px-1 text-[10px]">
            {activeCount}
          </span>
        )}
        <CaretDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          className="absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-xl border border-secondary/30 bg-main p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                type="button"
                data-dropdown-option="true"
                role="option"
                aria-selected={isSelected(option.value)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-secondary/10 hover:text-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
              >
                <span>{option.label}</span>
                {isSelected(option.value) && <Check className="h-3.5 w-3.5 text-secondary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function JournalFilters({ filters, onChange, contexts = [], spreads = [], decks = [] }) {
  const [savedFilters, setSavedFilters] = useState([]);
  const [newFilterName, setNewFilterName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]');
      if (Array.isArray(stored)) {
        setSavedFilters(stored);
      }
    } catch (error) {
      console.warn('Failed to load saved filters', error);
    }
  }, []);

  const persistSavedFilters = (next) => {
    setSavedFilters(next);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Unable to persist saved filters', error);
    }
  };

  const normalizedFilters = () => ({
    ...DEFAULT_FILTERS,
    query: filters.query || '',
    contexts: Array.isArray(filters.contexts) ? [...filters.contexts] : [],
    spreads: Array.isArray(filters.spreads) ? [...filters.spreads] : [],
    decks: Array.isArray(filters.decks) ? [...filters.decks] : [],
    timeframe: filters.timeframe || 'all',
    onlyReversals: Boolean(filters.onlyReversals)
  });

  const hasActiveFilters = () => {
    const snapshot = normalizedFilters();
    return Boolean(snapshot.query.trim())
      || snapshot.contexts.length > 0
      || snapshot.spreads.length > 0
      || snapshot.decks.length > 0
      || snapshot.timeframe !== 'all'
      || snapshot.onlyReversals;
  };

  const handleSaveCurrent = () => {
    const name = newFilterName.trim();
    if (!name || !hasActiveFilters()) return;
    const snapshot = normalizedFilters();
    const existingIndex = savedFilters.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
    const entry = {
      id: existingIndex >= 0 ? savedFilters[existingIndex].id : `saved-${Date.now()}`,
      name,
      values: snapshot
    };

    const next = existingIndex >= 0
      ? savedFilters.map((item, idx) => (idx === existingIndex ? entry : item))
      : [entry, ...savedFilters].slice(0, 6);

    persistSavedFilters(next);
    setNewFilterName('');
  };

  const handleApplySaved = (saved) => {
    if (!saved?.values) return;
    onChange({ ...DEFAULT_FILTERS, ...saved.values });
  };

  const handleDeleteSaved = (id) => {
    const next = savedFilters.filter(item => item.id !== id);
    persistSavedFilters(next);
  };

  const handleQueryChange = (event) => {
    onChange({ ...filters, query: event.target.value });
  };

  const clearFilters = () => {
    onChange(DEFAULT_FILTERS);
  };

  return (
    <section className="rounded-3xl border border-secondary/30 bg-surface/80 p-5 shadow-lg animate-fade-in">
      <div className="mb-6 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-secondary/80">Filters</p>
          <h2 className="text-xl font-serif text-main">Focus your journal</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="search"
              value={filters.query}
              onChange={handleQueryChange}
              placeholder="Search readings..."
              className="w-full rounded-xl border border-secondary/30 bg-surface/60 px-4 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-secondary/40 placeholder:text-secondary/40"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-secondary/70 underline decoration-dotted decoration-secondary/40 hover:text-secondary"
          >
            Clear filters
          </button>
        </div>
        <div className="rounded-xl border border-secondary/20 bg-surface/60 p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-secondary/80">
            <BookmarkSimple className="h-4 w-4" />
            <span>Saved filters</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {savedFilters.length > 0 ? (
              savedFilters.map((saved) => (
                <div
                  key={saved.id}
                  className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-surface/70 px-3 py-1 text-xs text-secondary"
                >
                  <button
                    type="button"
                    onClick={() => handleApplySaved(saved)}
                    className="flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                  >
                    <span className="font-semibold text-main">{saved.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSaved(saved.id)}
                    className="rounded-full px-1 text-secondary/60 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                    aria-label={`Delete saved filter ${saved.name}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-secondary/60">No saved filters yet—name a view to reuse it.</p>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="text"
              value={newFilterName}
              onChange={(event) => setNewFilterName(event.target.value)}
              placeholder="Name this view"
              className="flex-1 rounded-xl border border-secondary/30 bg-surface/60 px-4 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-secondary/40 placeholder:text-secondary/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCurrent}
                className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_ACTIVE}`}
                disabled={!newFilterName.trim() || !hasActiveFilters()}
              >
                Save current
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_IDLE}`}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown
          label="Timeframe"
          options={TIMEFRAME_OPTIONS}
          value={filters.timeframe}
          onChange={(val) => onChange({ ...filters, timeframe: val })}
          multiple={false}
        />

        {contexts.length > 0 && (
          <FilterDropdown
            label="Context"
            options={contexts}
            value={filters.contexts}
            onChange={(val) => onChange({ ...filters, contexts: val })}
            multiple={true}
          />
        )}

        {spreads.length > 0 && (
          <FilterDropdown
            label="Spread"
            options={spreads}
            value={filters.spreads}
            onChange={(val) => onChange({ ...filters, spreads: val })}
            multiple={true}
          />
        )}

        {decks.length > 0 && (
          <FilterDropdown
            label="Deck"
            options={decks}
            value={filters.decks}
            onChange={(val) => onChange({ ...filters, decks: val })}
            multiple={true}
          />
        )}

        <div className="h-6 w-px bg-surface-muted/50 mx-1" />

        <button
          type="button"
          onClick={() => onChange({ ...filters, onlyReversals: !filters.onlyReversals })}
          className={`${OUTLINE_FILTER_BASE} ${filters.onlyReversals ? OUTLINE_FILTER_ACTIVE : OUTLINE_FILTER_IDLE}`}
        >
          <span>Reversals</span>
          {filters.onlyReversals && <Check className="h-3 w-3" />}
        </button>
      </div>
    </section>
  );
}
