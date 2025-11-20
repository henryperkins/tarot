import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'This year' }
];

function FilterDropdown({ label, options, value, onChange, multiple = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${activeCount > 0
          ? 'border-secondary bg-secondary/10 text-secondary'
          : 'border-accent/20 text-muted hover:border-secondary/50 hover:text-secondary'
          }`}
      >
        {multiple && <span>{label}</span>}
        {!multiple && <span className={value !== 'all' ? 'text-secondary' : ''}>{displayLabel}</span>}

        {multiple && activeCount > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-secondary/20 px-1 text-[10px]">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-xl border border-secondary/30 bg-main p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-secondary/10 hover:text-secondary transition-colors"
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
  const handleQueryChange = (event) => {
    onChange({ ...filters, query: event.target.value });
  };

  const clearFilters = () => {
    onChange({ query: '', contexts: [], spreads: [], decks: [], timeframe: 'all', onlyReversals: false });
  };

  return (
    <section className="rounded-3xl border border-secondary/30 bg-surface/70 p-5 shadow-lg animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary/80">Filters</p>
          <h2 className="text-xl font-serif text-main">Focus your journal</h2>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="search"
              value={filters.query}
              onChange={handleQueryChange}
              placeholder="Search..."
              className="w-full rounded-full border border-secondary/30 bg-surface-muted/70 px-4 py-1.5 text-sm text-main focus:outline-none focus:ring-2 focus:ring-secondary/50 placeholder:text-secondary/30"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="whitespace-nowrap rounded-full border border-accent/20 px-3 py-1.5 text-xs text-muted hover:border-secondary/60 hover:text-secondary transition-colors"
          >
            Clear
          </button>
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
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${filters.onlyReversals
            ? 'border-secondary bg-secondary/10 text-secondary'
            : 'border-accent/20 text-muted hover:border-secondary/50 hover:text-secondary'
            }`}
        >
          <span>Reversals</span>
          {filters.onlyReversals && <Check className="h-3 w-3" />}
        </button>
      </div>
    </section>
  );
}
