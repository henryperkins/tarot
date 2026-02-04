import { useState, useRef, useEffect, useId } from 'react';
import {
  CaretDown,
  Check,
  ListBullets,
  SquaresFour
} from '@phosphor-icons/react';
import {
  JournalBookIcon,
  JournalBookmarkIcon,
  JournalCardAddIcon,
  JournalCardsAddIcon,
  JournalPercentCircleIcon,
  JournalRefreshIcon,
  JournalSearchIcon
} from './JournalIcons';

const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'This year' }
];

const DEFAULT_FILTERS = { query: '', contexts: [], spreads: [], decks: [], timeframe: 'all', onlyReversals: false };
const SAVED_FILTERS_KEY = 'journal_saved_filters_v1';
const ADVANCED_FILTERS_KEY = 'journal_filters_advanced_v1';
const OUTLINE_FILTER_BASE = 'flex min-h-touch items-center gap-2 rounded-xl border px-2.5 py-2 text-xs-plus font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]';
const OUTLINE_FILTER_IDLE = 'border-[color:var(--border-warm-light)] text-muted hover:border-[color:var(--border-warm)] hover:text-main';
const OUTLINE_FILTER_ACTIVE = 'border-[color:var(--brand-primary)] bg-[color:rgba(212,184,150,0.15)] text-main shadow-[0_12px_30px_-18px_rgba(212,184,150,0.75)]';

function FilterDropdown({ label, options, value, onChange, multiple = false, buttonRef: externalButtonRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
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
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const computeAlignRight = () => {
    if (typeof window === 'undefined') return false;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const menuWidth = 256;
    const margin = 16;
    return rect.left + menuWidth > window.innerWidth - margin;
  };

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
        setAlignRight(computeAlignRight());
        setIsOpen(true);
        focusFirstOption();
      }
    }
  };

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      internalButtonRef.current?.focus();
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
        onClick={() => {
          const next = !isOpen;
          if (next) {
            setAlignRight(computeAlignRight());
          }
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
        aria-label={!multiple ? label : undefined}
        aria-pressed={activeCount > 0}
      >
        {multiple && <span>{label}</span>}
        {!multiple && <span className={value !== 'all' ? 'text-[color:var(--brand-primary)]' : ''}>{displayLabel}</span>}

        {multiple && activeCount > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:rgba(212,184,150,0.20)] px-1 text-2xs">
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
          className={`absolute top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] ${
            alignRight ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          } rounded-xl border border-[color:var(--border-warm)] bg-[color:rgba(15,14,19,0.96)] p-1.5 shadow-[0_20px_48px_-24px_rgba(0,0,0,0.75)] ring-1 ring-[color:var(--border-warm-light)] backdrop-blur-xl backdrop-saturate-150 animate-in fade-in zoom-in-95 duration-100`}
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
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs-plus text-muted hover:bg-[color:rgba(212,184,150,0.10)] hover:text-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
              >
                <span>{option.label}</span>
                {isSelected(option.value) && <Check className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function JournalFilters({
  filters,
  onChange,
  contexts = [],
  spreads = [],
  decks = [],
  variant = 'full',
  viewMode = 'comfortable',
  onViewModeChange,
  resultCount,
  totalCount,
  searchCoverageLabel,
  searchScopeLabel,
  onSearchRef
}) {
  const isCompact = variant === 'compact';
  const [savedFilters, setSavedFilters] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      console.warn('Failed to load saved filters', error);
      return [];
    }
  });
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    if (typeof window === 'undefined') return !isCompact;
    const stored = localStorage.getItem(ADVANCED_FILTERS_KEY);
    if (stored === 'true' || stored === 'false') {
      return stored === 'true';
    }
    return !isCompact;
  });
  const [newFilterName, setNewFilterName] = useState('');
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const saveNameInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const timeframeButtonRef = useRef(null);
  const contextsButtonRef = useRef(null);
  const spreadsButtonRef = useRef(null);
  const decksButtonRef = useRef(null);
  const reversalsButtonRef = useRef(null);

  const persistSavedFilters = (next) => {
    setSavedFilters(next);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Unable to persist saved filters', error);
    }
  };

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ADVANCED_FILTERS_KEY, advancedOpen.toString());
    } catch (error) {
      console.warn('Unable to persist advanced filter state', error);
    }
  }, [advancedOpen]);

  // Note: shouldShowAdvanced handles the display logic, so we don't need
  // an effect to sync advancedOpen state when switching between compact modes.

  const normalizedFilters = () => ({
    ...DEFAULT_FILTERS,
    query: filters.query || '',
    contexts: Array.isArray(filters.contexts) ? [...filters.contexts] : [],
    spreads: Array.isArray(filters.spreads) ? [...filters.spreads] : [],
    decks: Array.isArray(filters.decks) ? [...filters.decks] : [],
    timeframe: filters.timeframe || 'all',
    onlyReversals: Boolean(filters.onlyReversals)
  });

  const hasActiveFilters = (snapshot = normalizedFilters()) => (
    Boolean(snapshot.query.trim())
      || snapshot.contexts.length > 0
      || snapshot.spreads.length > 0
      || snapshot.decks.length > 0
      || snapshot.timeframe !== 'all'
      || snapshot.onlyReversals
  );

  const countActiveFilters = (snapshot = normalizedFilters()) => {
    let count = 0;
    if (snapshot.query.trim()) count += 1;
    if (snapshot.timeframe !== 'all') count += 1;
    if (snapshot.onlyReversals) count += 1;
    count += snapshot.contexts.length;
    count += snapshot.spreads.length;
    count += snapshot.decks.length;
    return count;
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
    setSavePanelOpen(false);
  };

  const handleApplySaved = (saved) => {
    if (!saved?.values) return;
    setNewFilterName('');
    setSavePanelOpen(false);
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
    setNewFilterName('');
    setSavePanelOpen(false);
    onChange(DEFAULT_FILTERS);
  };

  const shouldShowAdvanced = !isCompact || advancedOpen;
  const filterSnapshot = normalizedFilters();
  const activeFilters = hasActiveFilters(filterSnapshot);
  const activeFilterCount = countActiveFilters(filterSnapshot);
  const showSavedFiltersPanel = shouldShowAdvanced && (savedFilters.length > 0 || activeFilters);

  useEffect(() => {
    if (typeof onSearchRef !== 'function') return undefined;
    onSearchRef(searchInputRef.current);
    return () => {
      onSearchRef(null);
    };
  }, [onSearchRef]);

  useEffect(() => {
    if (!savePanelOpen) return;
    saveNameInputRef.current?.focus();
  }, [savePanelOpen]);

  const scrollToControl = (element) => {
    if (!element) return;
    if (typeof element.scrollIntoView === 'function') {
      try {
        element.scrollIntoView({ block: 'center' });
      } catch {
        element.scrollIntoView();
      }
    }
  };

  const handleMapAction = (id) => {
    if (id === 'query') {
      const el = searchInputRef.current;
      scrollToControl(el);
      el?.focus();
      return;
    }

    if (id === 'timeframe') {
      const el = timeframeButtonRef.current;
      scrollToControl(el);
      el?.click();
      el?.focus();
      return;
    }

    if (id === 'contexts') {
      const el = contextsButtonRef.current;
      scrollToControl(el);
      el?.click();
      el?.focus();
      return;
    }

    if (id === 'spreads') {
      const el = spreadsButtonRef.current;
      scrollToControl(el);
      el?.click();
      el?.focus();
      return;
    }

    if (id === 'decks') {
      const el = decksButtonRef.current;
      scrollToControl(el);
      el?.click();
      el?.focus();
      return;
    }

    if (id === 'reversals') {
      const el = reversalsButtonRef.current;
      scrollToControl(el);
      el?.click();
      el?.focus();
      return;
    }
  };

  const containerClass = isCompact
    ? 'panel-mystic rounded-3xl p-4 lg:p-5 animate-fade-in'
    : 'panel-mystic rounded-3xl p-4 lg:p-6 animate-fade-in';

  return (
    <section
      className={containerClass}
      aria-label="Journal filters"
    >
      {/* Starfield + glows */}
      {!isCompact && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div
            className="absolute inset-0 opacity-60 mix-blend-screen"
            aria-hidden="true"
            style={{
              backgroundImage:
                'radial-gradient(circle at 10% 20%, var(--glow-gold), transparent 32%), radial-gradient(circle at 82% 24%, var(--glow-blue), transparent 30%), radial-gradient(circle at 55% 78%, var(--glow-pink), transparent 32%)'
            }}
          />
          <div className="absolute inset-0" aria-hidden="true">
            {[
              { x: 6, y: 14, s: 1.4, o: 0.8 },
              { x: 18, y: 26, s: 1, o: 0.5 },
              { x: 34, y: 10, s: 1.6, o: 0.7 },
              { x: 52, y: 8, s: 1.2, o: 0.5 },
              { x: 68, y: 18, s: 1, o: 0.4 },
              { x: 84, y: 12, s: 1.5, o: 0.7 },
              { x: 12, y: 78, s: 1.2, o: 0.5 },
              { x: 28, y: 64, s: 1, o: 0.4 },
              { x: 46, y: 86, s: 1.6, o: 0.7 },
              { x: 64, y: 74, s: 1.2, o: 0.6 },
              { x: 82, y: 82, s: 1, o: 0.4 },
              { x: 92, y: 66, s: 1.3, o: 0.5 }
            ].map((star, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-[color:var(--color-gold-soft)]"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.s,
                  height: star.s,
                  opacity: star.o,
                  boxShadow: `0 0 ${star.s * 4}px ${star.s}px rgba(212,184,150,${star.o * 0.45})`
                }}
              />
            ))}
          </div>
          <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-[color:var(--glow-gold)] blur-[110px]" aria-hidden="true" />
          <div className="absolute right-[-120px] top-1/3 h-72 w-72 rounded-full bg-[color:var(--glow-blue)] blur-[110px]" aria-hidden="true" />
        </div>
      )}

      {/* Foreground */}
      <div className="relative z-10 space-y-4">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xs uppercase tracking-[0.3em] text-[color:var(--color-gray-light)]">Filters</p>
            <h2 className="text-lg sm:text-xl font-serif text-[color:var(--text-main)]">Journal filters</h2>
            <p className="text-xs text-[color:var(--text-muted)]">Refine your history.</p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!activeFilters}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-warm)] bg-[color:rgba(212,184,150,0.10)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-main)] shadow-[0_12px_30px_-18px_rgba(212,184,150,0.6)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.50)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <JournalRefreshIcon className="h-4 w-4" aria-hidden="true" />
            Reset view
          </button>
        </div>

        {isCompact && (
          <button
            type="button"
            onClick={() => setAdvancedOpen(prev => !prev)}
            aria-expanded={advancedOpen}
            className="flex min-h-touch w-full items-center justify-between rounded-xl border border-[color:var(--border-warm-light)] bg-[color:rgba(212,184,150,0.05)] px-3 py-2.5 text-xs-plus font-semibold text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
          >
            <span className="flex items-center gap-2">
              <span>More filters</span>
              {activeFilterCount > 0 && (
                <span className="text-2xs text-[color:var(--color-gray-light)]">
                  ({activeFilterCount} active)
                </span>
              )}
            </span>
            <CaretDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}

        {shouldShowAdvanced && (() => {
          const timeframeLabel = TIMEFRAME_OPTIONS.find((opt) => opt.value === filters.timeframe)?.label || 'All time';
          const ctxCount = (filters.contexts || []).length;
          const spreadCount = (filters.spreads || []).length;
          const deckCount = (filters.decks || []).length;
          const reversedOn = Boolean(filters.onlyReversals);
          const query = (filters.query || '').trim();
          const truncatedQuery = query.length > 22 ? `${query.slice(0, 22)}...` : query;
          const positions = {
            query: { x: 50, y: 46 },
            timeframe: { x: 50, y: 16 },
            contexts: { x: 24, y: 30 },
            spreads: { x: 76, y: 30 },
            decks: { x: 22, y: 72 },
            reversals: { x: 78, y: 70 }
          };
          const connections = [
            ['query', 'timeframe'],
            ['query', 'contexts'],
            ['query', 'spreads'],
            ['query', 'decks'],
            ['query', 'reversals'],
            ['contexts', 'timeframe'],
            ['spreads', 'timeframe'],
            ['decks', 'reversals']
          ];
          const nodes = [
            {
              id: 'query',
              label: 'Search',
              value: query ? truncatedQuery : 'All readings',
              hint: query ? 'Keyword active' : 'Type to filter',
              icon: <JournalSearchIcon className="h-5 w-5" aria-hidden />,
              isHero: true,
              active: Boolean(query),
              disabled: false
            },
            {
              id: 'timeframe',
              label: 'Timeframe',
              value: timeframeLabel,
              hint: filters.timeframe !== 'all' ? 'Scoped' : 'Any date',
              icon: <JournalRefreshIcon className="h-5 w-5" aria-hidden />,
              active: filters.timeframe !== 'all',
              disabled: false
            },
            {
              id: 'contexts',
              label: 'Contexts',
              value: ctxCount > 0 ? `${ctxCount} selected` : 'Any',
              hint: ctxCount > 0 ? 'Focused themes' : 'All themes',
              icon: <JournalBookIcon className="h-5 w-5" aria-hidden />,
              active: ctxCount > 0,
              disabled: contexts.length === 0
            },
            {
              id: 'spreads',
              label: 'Spreads',
              value: spreadCount > 0 ? `${spreadCount} chosen` : 'Any',
              hint: spreadCount > 0 ? 'Specific layouts' : 'All layouts',
              icon: <JournalCardAddIcon className="h-5 w-5" aria-hidden />,
              active: spreadCount > 0,
              disabled: spreads.length === 0
            },
            {
              id: 'decks',
              label: 'Decks',
              value: deckCount > 0 ? `${deckCount} deck${deckCount === 1 ? '' : 's'}` : 'Any',
              hint: deckCount > 0 ? 'Curated decks' : 'All decks',
              icon: <JournalCardsAddIcon className="h-5 w-5" aria-hidden />,
              active: deckCount > 0,
              disabled: decks.length === 0
            },
            {
              id: 'reversals',
              label: 'Reversals',
              value: reversedOn ? 'Only reversed' : 'Include all',
              hint: reversedOn ? 'Focused' : 'Upright + reversed',
              icon: <JournalPercentCircleIcon className="h-5 w-5" aria-hidden />,
              active: reversedOn,
              disabled: false
            }
          ];

          return (
            <>
              <p className={`text-2xs text-[color:var(--color-gray-light)] ${isCompact ? 'mb-2' : 'mb-3'}`}>
                {isCompact ? 'Tap any card to edit filters.' : 'Tap any node to edit filters.'}
              </p>
              {/* Desktop constellation */}
              {!isCompact && (
              <div className="relative hidden h-[240px] xl:block">
                <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="filters-line-1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(212,184,150,0.48)" />
                      <stop offset="100%" stopColor="rgba(212,184,150,0.12)" />
                    </linearGradient>
                    <radialGradient id="filters-node" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(212,184,150,0.9)" />
                      <stop offset="60%" stopColor="rgba(212,184,150,0.35)" />
                      <stop offset="100%" stopColor="rgba(212,184,150,0)" />
                    </radialGradient>
                    <filter id="filters-glow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {connections.map(([from, to], idx) => {
                    const start = positions[from];
                    const end = positions[to];
                    if (!start || !end) return null;
                    return (
                      <line
                        key={idx}
                        x1={`${start.x}%`}
                        y1={`${start.y}%`}
                        x2={`${end.x}%`}
                        y2={`${end.y}%`}
                        stroke="url(#filters-line-1)"
                        strokeWidth="1"
                        strokeLinecap="round"
                        opacity="0.55"
                      />
                    );
                  })}
                  {nodes.map((node) => (
                    <g key={node.id}>
                      {node.active && (
                        <circle
                          cx={`${positions[node.id].x}%`}
                          cy={`${positions[node.id].y}%`}
                          r={node.isHero ? 7.2 : 6}
                          fill="rgba(212,184,150,0.32)"
                          filter="url(#filters-glow)"
                          opacity="0.75"
                        />
                      )}
                      <circle cx={`${positions[node.id].x}%`} cy={`${positions[node.id].y}%`} r="3.8" fill="url(#filters-node)" />
                      <circle
                        cx={`${positions[node.id].x}%`}
                        cy={`${positions[node.id].y}%`}
                        r={node.isHero ? 4.2 : 3.4}
                        fill="rgba(212,184,150,0.6)"
                        filter="url(#filters-glow)"
                      />
                    </g>
                  ))}
                </svg>

                {nodes.map((node) => {
                  const pos = positions[node.id] || { x: 50, y: 50 };
                  const isHero = node.isHero;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => handleMapAction(node.id)}
                      disabled={node.disabled}
                      aria-label={`Edit ${node.label} filter`}
                      className={`group absolute text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.50)] ${
                        node.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div
                        className={`relative w-[160px] overflow-hidden rounded-xl border ${
                          isHero ? 'border-[color:var(--border-warm)] shadow-[0_20px_60px_-24px_rgba(212,184,150,0.7)]' : 'border-[color:var(--border-warm-light)] shadow-[0_16px_40px_-26px_rgba(212,184,150,0.45)]'
                        } bg-gradient-to-b from-[var(--bg-surface-muted)] via-[var(--bg-surface)] to-[var(--bg-main)] p-[1px] transition-transform ${node.disabled ? '' : 'group-hover:-translate-y-0.5'}`}
                      >
                        <div className="relative h-full rounded-[11px] bg-gradient-to-b from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--bg-main)]">
                          <div className="pointer-events-none absolute inset-0 opacity-10">
                            <svg className="h-full w-full" aria-hidden="true">
                              <defs>
                                <pattern id={`filters-card-${node.id}`} width="18" height="18" patternUnits="userSpaceOnUse">
                                  <path d="M9 0L18 9L9 18L0 9Z" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-[color:var(--brand-primary)]" />
                                  <circle cx="9" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-[color:var(--brand-primary)]" />
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill={`url(#filters-card-${node.id})`} />
                            </svg>
                          </div>
                          <div className={`relative flex flex-col items-center gap-1 px-4 py-4 text-center ${isHero ? 'bg-[color:rgba(212,184,150,0.01)]' : ''}`}>
                            <div
                              className={`mb-1 flex h-10 w-10 items-center justify-center rounded-full ${
                                node.active
                                  ? 'bg-[color:rgba(212,184,150,0.20)] text-[color:var(--brand-accent)] ring-1 ring-[color:var(--border-warm)]'
                                  : 'bg-[color:rgba(232,218,195,0.10)] text-[color:var(--text-muted)] ring-1 ring-[color:var(--border-warm-light)]'
                              }`}
                            >
                              {node.icon}
                            </div>
                            <p className={`text-2xs uppercase tracking-[0.24em] ${isHero ? 'text-[color:var(--brand-accent)]' : 'text-[color:var(--text-muted)]'}`}>{node.label}</p>
                            <p className={`font-serif leading-tight ${isHero ? 'text-[color:var(--text-main)] text-xl' : 'text-[color:var(--text-main)] text-lg'}`}>{node.value}</p>
                            <p className="text-2xs text-[color:var(--color-gray-light)]">{node.hint}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}

              {/* Mobile horizontal cards */}
              <div className="flex gap-3 overflow-x-auto pb-1 pr-2 xl:hidden snap-x snap-mandatory">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => handleMapAction(node.id)}
                    disabled={node.disabled}
                    aria-label={`Edit ${node.label} filter`}
                    className={`min-w-[150px] flex-1 rounded-xl border px-4 py-3 text-left backdrop-blur-md snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)] ${
                      node.isHero
                        ? 'border-[color:var(--border-warm)] bg-[color:rgba(212,184,150,0.10)] shadow-[0_14px_36px_-20px_rgba(212,184,150,0.6)]'
                        : 'border-[color:var(--border-warm-light)] bg-[color:rgba(255,255,255,0.05)] shadow-[0_10px_30px_-24px_rgba(212,184,150,0.5)]'
                    } ${node.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-2xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                      {node.icon}
                      <span>{node.label}</span>
                    </div>
                    <p className="font-serif text-lg text-[color:var(--text-main)] leading-tight">{node.value}</p>
                    <p className="text-2xs text-[color:var(--color-gray-light)]">{node.hint}</p>
                  </button>
                ))}
              </div>
            </>
          );
        })()}

        <div className={isCompact ? 'flex flex-col gap-4' : 'grid gap-4 lg:grid-cols-[1.05fr_0.95fr]'}>
          {/* Search + saved filters */}
          <div className="rounded-2xl border border-[color:var(--border-warm-light)] bg-gradient-to-br from-[var(--panel-dark-1)] via-[var(--panel-dark-2)] to-[var(--panel-dark-3)] p-3 ring-1 ring-[color:var(--border-warm-light)] shadow-[0_18px_45px_-30px_rgba(0,0,0,0.8)]">
            <div className="space-y-1.5">
              <div className="relative min-w-[220px]">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[color:var(--text-muted)]">
                  <JournalSearchIcon className="h-4 w-4" aria-hidden />
                </div>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={filters.query}
                  onChange={handleQueryChange}
                  placeholder="Search readings..."
                  aria-label="Search journal entries"
                  className="w-full min-h-touch rounded-xl border border-[color:var(--border-warm-light)] bg-[color:rgba(15,14,19,0.80)] px-8 py-2 text-sm-mobile text-main placeholder:text-gray-light focus:outline-none focus:ring-2 focus:ring-[color:rgba(232,218,195,0.50)]"
                />
              </div>

              {/* Search feedback: result count */}
              {filters.query.trim() && typeof resultCount === 'number' && typeof totalCount === 'number' && (
                <div className="text-xs text-[color:var(--text-muted)]">
                  Found <span className="font-semibold text-[color:var(--text-main)]">{resultCount}</span> in {totalCount} loaded readings
                  {resultCount === 0 && ' - try different keywords'}
                </div>
              )}

              {(searchCoverageLabel || searchScopeLabel) && (
                <div className="flex flex-wrap items-center gap-2 text-2xs text-[color:var(--color-gray-light)]">
                  {searchCoverageLabel && (
                    <span>{searchCoverageLabel}</span>
                  )}
                  {searchScopeLabel && (
                    <span>{searchScopeLabel}</span>
                  )}
                </div>
              )}

              {/* Search scope help */}
              <details className="text-2xs text-[color:var(--color-gray-light)]">
                <summary className="cursor-pointer hover:text-[color:var(--text-muted)] transition-colors">
                  What fields are searched?
                </summary>
                <ul className="mt-1.5 space-y-0.5 pl-4 text-[color:var(--text-muted)]">
                  <li>Questions you asked</li>
                  <li>Cards drawn (names, positions)</li>
                  <li>AI reading narratives</li>
                  <li>Your reflections and notes</li>
                  <li>Spread and context types</li>
                </ul>
              </details>
            </div>

            {showSavedFiltersPanel && (
              <div className="mt-3 rounded-xl border border-[color:var(--border-warm-light)] bg-[color:rgba(15,14,19,0.70)] p-2.5">
                <div className="flex items-center gap-2 text-2xs uppercase tracking-[0.25em] text-[color:var(--text-muted)]">
                  <JournalBookmarkIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Saved views</span>
                  {savedFilters.length > 0 && (
                    <span className="ml-auto text-2xs text-[color:var(--color-gray-light)]">{savedFilters.length} saved</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {savedFilters.length > 0 ? (
                    savedFilters.map((saved) => (
                      <div
                        key={saved.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-warm-light)] bg-[color:rgba(232,218,195,0.05)] px-2.5 py-0.5 text-2xs text-[color:var(--text-muted)]"
                      >
                        <button
                          type="button"
                          onClick={() => handleApplySaved(saved)}
                          className="flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
                        >
                          <span className="font-semibold text-[color:var(--text-main)]">{saved.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSaved(saved.id)}
                          className="rounded-full px-1 text-[color:var(--color-gray-light)] hover:text-[color:var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
                          aria-label={`Delete saved filter ${saved.name}`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[color:var(--color-gray-light)]">No saved views yet.</p>
                  )}
                </div>

                {activeFilters && (
                  <div className="mt-3">
                    {!savePanelOpen ? (
                      <button
                        type="button"
                        onClick={() => setSavePanelOpen(true)}
                        className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-[color:var(--border-warm)] bg-[color:rgba(212,184,150,0.10)] px-3 py-2 text-xs-plus font-semibold text-main shadow-[0_12px_30px_-18px_rgba(212,184,150,0.55)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.50)]"
                      >
                        <JournalBookmarkIcon className="h-4 w-4 text-[color:var(--brand-accent)]" aria-hidden="true" />
                        Save this view
                      </button>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <input
                          ref={saveNameInputRef}
                          type="text"
                          value={newFilterName}
                          onChange={(event) => setNewFilterName(event.target.value)}
                          placeholder="Name this view"
                          aria-label="Name for saved filter view"
                          className="flex-1 min-h-touch rounded-xl border border-[color:var(--border-warm-light)] bg-[color:rgba(15,14,19,0.70)] px-3 py-2 text-sm-mobile text-main placeholder:text-gray-light focus:outline-none focus:ring-2 focus:ring-[color:rgba(232,218,195,0.50)]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveCurrent}
                            className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_ACTIVE} disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
                            disabled={!newFilterName.trim() || !activeFilters}
                          >
                            Save current
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSavePanelOpen(false);
                              setNewFilterName('');
                            }}
                            className={`${OUTLINE_FILTER_BASE} ${OUTLINE_FILTER_IDLE}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filter toggles */}
          <div className="rounded-2xl border border-[color:var(--border-warm-light)] bg-gradient-to-br from-[var(--panel-dark-1)] via-[var(--panel-dark-2)] to-[var(--panel-dark-3)] p-3 ring-1 ring-[color:var(--border-warm-light)] shadow-[0_18px_45px_-30px_rgba(0,0,0,0.8)]">
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown
                label="Timeframe"
                options={TIMEFRAME_OPTIONS}
                value={filters.timeframe}
                buttonRef={timeframeButtonRef}
                onChange={(val) => onChange({ ...filters, timeframe: val })}
                multiple={false}
              />

              {contexts.length > 0 && (
                <FilterDropdown
                  label="Context"
                  options={contexts}
                  value={filters.contexts}
                  buttonRef={contextsButtonRef}
                  onChange={(val) => onChange({ ...filters, contexts: val })}
                  multiple={true}
                />
              )}

              {spreads.length > 0 && (
                <FilterDropdown
                  label="Spread"
                  options={spreads}
                  value={filters.spreads}
                  buttonRef={spreadsButtonRef}
                  onChange={(val) => onChange({ ...filters, spreads: val })}
                  multiple={true}
                />
              )}

              {decks.length > 0 && (
                <FilterDropdown
                  label="Deck"
                  options={decks}
                  value={filters.decks}
                  buttonRef={decksButtonRef}
                  onChange={(val) => onChange({ ...filters, decks: val })}
                  multiple={true}
                />
              )}

              <div className="hidden h-6 w-px bg-[color:var(--border-warm-light)] sm:block" />

              <button
                ref={reversalsButtonRef}
                type="button"
                onClick={() => onChange({ ...filters, onlyReversals: !filters.onlyReversals })}
                aria-pressed={filters.onlyReversals}
                className={`${OUTLINE_FILTER_BASE} ${filters.onlyReversals ? OUTLINE_FILTER_ACTIVE : OUTLINE_FILTER_IDLE}`}
              >
                <span>Reversals</span>
                {filters.onlyReversals && <Check className="h-3 w-3" />}
              </button>

              {onViewModeChange && (
                <>
                  <div className="hidden h-6 w-px bg-[color:var(--border-warm-light)] sm:block" />

                  {/* View mode toggle */}
                  <div
                    className="inline-flex rounded-xl border border-[color:var(--border-warm-light)] bg-[color:rgba(15,14,19,0.5)] p-0.5"
                    role="group"
                    aria-label="List view mode"
                  >
                    <button
                      type="button"
                      onClick={() => onViewModeChange('comfortable')}
                      aria-pressed={viewMode === 'comfortable'}
                      title="Comfortable view - shows more details"
                    className={`flex min-h-touch items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs-plus font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)] ${
                      viewMode === 'comfortable'
                        ? 'bg-[color:rgba(212,184,150,0.15)] text-[color:var(--text-main)] shadow-[0_4px_12px_-6px_rgba(212,184,150,0.5)]'
                        : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-main)]'
                    }`}
                  >
                      <SquaresFour className="h-4 w-4" aria-hidden="true" />
                      <span className="sm:hidden">Cards</span>
                      <span className="hidden sm:inline">Comfortable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewModeChange('compact')}
                      aria-pressed={viewMode === 'compact'}
                      title="Compact view - shows more entries"
                    className={`flex min-h-touch items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs-plus font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)] ${
                      viewMode === 'compact'
                        ? 'bg-[color:rgba(212,184,150,0.15)] text-[color:var(--text-main)] shadow-[0_4px_12px_-6px_rgba(212,184,150,0.5)]'
                        : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-main)]'
                    }`}
                  >
                      <ListBullets className="h-4 w-4" aria-hidden="true" />
                      <span className="sm:hidden">List</span>
                      <span className="hidden sm:inline">Compact</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <p className="mt-3 text-2xs uppercase tracking-[0.22em] text-[color:var(--color-gray-light)]">
              Tip: combine filters to surface exact readings you want.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
