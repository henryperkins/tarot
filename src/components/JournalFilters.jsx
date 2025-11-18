import React from 'react';

const TIMEFRAME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'This year' }
];

export function JournalFilters({ filters, onChange, contexts = [], spreads = [] }) {
  const handleQueryChange = (event) => {
    onChange({ ...filters, query: event.target.value });
  };

  const toggleValue = (type, value) => {
    const current = filters[type] || [];
    const exists = current.includes(value);
    const next = exists ? current.filter((entry) => entry !== value) : [...current, value];
    onChange({ ...filters, [type]: next });
  };

  const clearFilters = () => {
    onChange({ query: '', contexts: [], spreads: [], timeframe: 'all', onlyReversals: false });
  };

  return (
    <section className="rounded-3xl border border-emerald-400/30 bg-slate-950/70 p-5 shadow-lg animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Filters</p>
          <h2 className="text-xl font-serif text-amber-100">Focus your journal</h2>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="self-start rounded-full border border-slate-700/70 px-3 py-1 text-xs text-amber-100/80 hover:border-emerald-300/60"
        >
          Clear filters
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Search</label>
          <input
            type="search"
            value={filters.query}
            onChange={handleQueryChange}
            placeholder="Search questions, spreads, reflections"
            className="mt-2 w-full rounded-2xl border border-emerald-400/30 bg-slate-900/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>

        {contexts.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Contexts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {contexts.map((context) => (
                <button
                  key={context.value}
                  type="button"
                  onClick={() => toggleValue('contexts', context.value)}
                  className={`rounded-full border px-3 py-1 text-xs ${filters.contexts.includes(context.value)
                      ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-700/70 text-amber-100/70 hover:border-emerald-300/50'
                    }`}
                >
                  {context.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {spreads.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Spreads</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {spreads.map((spread) => (
                <button
                  key={spread.value}
                  type="button"
                  onClick={() => toggleValue('spreads', spread.value)}
                  className={`rounded-full border px-3 py-1 text-xs ${filters.spreads.includes(spread.value)
                      ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-700/70 text-amber-100/70 hover:border-emerald-300/50'
                    }`}
                >
                  {spread.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Timeframe</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ ...filters, timeframe: option.value })}
                className={`rounded-full border px-3 py-1 text-xs ${filters.timeframe === option.value
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                    : 'border-slate-700/70 text-amber-100/70 hover:border-emerald-300/50'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-slate-900/60 px-3 py-2 text-sm text-amber-100/80">
          <input
            type="checkbox"
            checked={filters.onlyReversals}
            onChange={(event) => onChange({ ...filters, onlyReversals: event.target.checked })}
            className="h-4 w-4 rounded border-slate-600 text-emerald-400 focus:ring-emerald-400"
          />
          Focus on spreads with reversal moments
        </label>
      </div>
    </section>
  );
}
