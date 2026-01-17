/**
 * JournalSummaryBand - The "Journal Pulse" constellation section
 * Displays scope selector, hero cards, stats constellation, and mobile layout
 */

import { useEffect, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { getCanonicalCard } from '../../lib/cardLookup';
import {
  SCOPE_OPTIONS,
  SUIT_ELEMENTS,
  CARD_CONNECTORS
} from '../../lib/journal/constants';
import {
  JournalBookIcon,
  JournalCardsAddIcon,
  JournalPercentCircleIcon,
  JournalPlusCircleIcon,
  JournalRefreshIcon
} from '../JournalIcons';

export function JournalSummaryBand({
  summaryRef,
  isMobileLayout,
  summaryInView,
  analyticsScope,
  onScopeSelect,
  customScope,
  onCustomScopeChange,
  scopeError,
  scopeLabel,
  scopeEntryCount,
  summaryCardData,
  statNodes,
  statNodeMap,
  heroEntry,
  heroCards,
  heroDateLabel,
  expandedCardIndex,
  onExpandedCardChange,
  onStartReading,
  filtersActive,
  dataSource = 'client'
}) {
  const [isExpanded, setIsExpanded] = useState(!isMobileLayout);
  const scopeChipLabel = analyticsScope === 'filters' && filtersActive ? 'Filtered' : (scopeLabel || 'Scope');
  const sourceLabel = dataSource === 'server' ? 'D1' : 'Journal';

  useEffect(() => {
    if (!isMobileLayout) {
      if (typeof window === 'undefined') return undefined;
      const frameId = window.requestAnimationFrame(() => setIsExpanded(true));
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [isMobileLayout]);

  return (
    <section
      ref={summaryRef}
      className={`relative mb-6 overflow-hidden rounded-3xl border border-amber-300/10 ${
        isMobileLayout
          ? 'bg-[#0c0f1d]'
          : 'bg-gradient-to-br from-[#07091a] via-[#0a0c1a] to-[#050714]'
      } shadow-[0_24px_64px_-24px_rgba(0,0,0,0.95)]`}
    >
      {summaryInView && (
        <>
          {/* Dense star field */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {[
              { x: 5, y: 12, s: 1, o: 0.6 }, { x: 12, y: 8, s: 1.5, o: 0.8 }, { x: 18, y: 25, s: 1, o: 0.4 },
              { x: 25, y: 5, s: 2, o: 0.7 }, { x: 32, y: 18, s: 1, o: 0.5 }, { x: 38, y: 10, s: 1.5, o: 0.6 },
              { x: 45, y: 22, s: 1, o: 0.4 }, { x: 52, y: 6, s: 1, o: 0.7 }, { x: 58, y: 15, s: 2, o: 0.5 },
              { x: 65, y: 8, s: 1, o: 0.6 }, { x: 72, y: 20, s: 1.5, o: 0.4 }, { x: 78, y: 12, s: 1, o: 0.8 },
              { x: 85, y: 5, s: 1, o: 0.5 }, { x: 92, y: 18, s: 2, o: 0.6 }, { x: 95, y: 8, s: 1, o: 0.4 },
              { x: 8, y: 88, s: 1, o: 0.5 }, { x: 15, y: 92, s: 1.5, o: 0.6 }, { x: 22, y: 85, s: 1, o: 0.4 },
              { x: 35, y: 90, s: 2, o: 0.7 }, { x: 48, y: 95, s: 1, o: 0.5 }, { x: 62, y: 88, s: 1, o: 0.6 },
              { x: 75, y: 92, s: 1.5, o: 0.4 }, { x: 88, y: 86, s: 1, o: 0.7 }, { x: 95, y: 90, s: 1, o: 0.5 },
              { x: 3, y: 45, s: 1, o: 0.3 }, { x: 97, y: 55, s: 1, o: 0.3 }, { x: 50, y: 3, s: 1.5, o: 0.4 },
            ].map((star, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-amber-100"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.s,
                  height: star.s,
                  opacity: star.o,
                  boxShadow: star.o > 0.6 ? `0 0 ${star.s * 4}px ${star.s}px rgba(251,191,36,${star.o * 0.4})` : 'none'
                }}
              />
            ))}
          </div>

          {/* Nebula glows */}
          <div className="pointer-events-none absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-indigo-600/[0.07] blur-[100px]" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-32 top-1/3 h-64 w-64 rounded-full bg-amber-500/[0.05] blur-[80px]" aria-hidden="true" />
          <div className="pointer-events-none absolute left-1/4 -bottom-24 h-56 w-56 rounded-full bg-purple-600/[0.06] blur-[90px]" aria-hidden="true" />
          <div className="pointer-events-none absolute right-1/4 top-0 h-48 w-48 rounded-full bg-cyan-500/[0.04] blur-[70px]" aria-hidden="true" />
        </>
      )}

      <div className="relative p-5 sm:p-6 lg:p-8">
        {/* Header - Clean and simple */}
        <div className="mb-5 lg:mb-4 space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300/50 mb-1">Journal Pulse</p>
              <h2 className="text-xl sm:text-2xl font-serif text-amber-50/90">Your practice at a glance</h2>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-amber-100/60">Scope</span>
                {SCOPE_OPTIONS.map((option) => {
                  const isActive = analyticsScope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onScopeSelect(option.value)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 ${
                        isActive
                          ? 'border-amber-300/60 bg-amber-300/15 text-amber-50 shadow-[0_8px_26px_-16px_rgba(251,191,36,0.45)]'
                          : 'border-amber-300/20 bg-amber-200/5 text-amber-100/75 hover:border-amber-300/35 hover:bg-amber-200/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-amber-100/60">
                Active: {scopeLabel} · {scopeEntryCount} entr{scopeEntryCount === 1 ? 'y' : 'ies'}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/15 bg-amber-200/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/70">
                {scopeChipLabel} · {sourceLabel}
              </span>
              {filtersActive && analyticsScope !== 'filters' && (
                <div className="flex flex-wrap items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] text-amber-100/80">
                  <span>Filters not applied to insights</span>
                  <button
                    type="button"
                    onClick={() => onScopeSelect('filters')}
                    className="font-semibold text-amber-50 underline underline-offset-2 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                  >
                    Apply filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {analyticsScope === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-amber-100/80">
              <label className="flex items-center gap-1">
                From
                <input
                  type="date"
                  value={customScope.start}
                  onChange={(event) => onCustomScopeChange('start', event.target.value)}
                  className="rounded border border-amber-200/30 bg-amber-200/5 px-2 py-1 text-xs text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                />
              </label>
              <label className="flex items-center gap-1">
                To
                <input
                  type="date"
                  value={customScope.end}
                  onChange={(event) => onCustomScopeChange('end', event.target.value)}
                  className="rounded border border-amber-200/30 bg-amber-200/5 px-2 py-1 text-xs text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                />
              </label>
              {scopeError && (
                <span className="text-[11px] text-red-200">{scopeError}</span>
              )}
            </div>
          )}
        </div>

        {/* Mobile: Clean organized layout */}
        <div className="lg:hidden space-y-4">
          {isExpanded && (
            <>
              {/* Stats row - 2 clean cards */}
              <div className="grid grid-cols-2 gap-3">
                {summaryCardData.slice(0, 2).map((stat) => {
                  const icon = stat.id === 'entries'
                    ? <JournalCardsAddIcon className="h-4 w-4" aria-hidden />
                    : <JournalPercentCircleIcon className="h-4 w-4" aria-hidden />;
                  return (
                    <div
                      key={stat.id}
                      className="rounded-xl border border-amber-300/15 bg-gradient-to-b from-[#0f0d18] to-[#0a0912] p-3 text-center"
                    >
                      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-200/10 text-amber-200/70">
                        {icon}
                      </div>
                      <p className="text-2xl font-serif text-amber-50">{stat.value}</p>
                      <p className="text-xs uppercase tracking-wide text-amber-100/50 mt-1">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Hero card - Latest reading with clear tap affordance */}
              {heroEntry && heroCards.length > 0 && (() => {
                const card = heroCards[0];
                const canonical = getCanonicalCard(card);
                const isReversed = (card.orientation || '').toLowerCase().includes('reversed');
                const meaning = isReversed ? canonical?.reversed : canonical?.upright;
                const isCardExpanded = expandedCardIndex === 0;

                return (
                  <button
                    type="button"
                    onClick={() => onExpandedCardChange(isCardExpanded ? null : 0)}
                    aria-expanded={isCardExpanded}
                    aria-label={`${card.name}, ${card.orientation}. Tap for insight.`}
                    className="w-full rounded-xl border border-amber-300/15 bg-gradient-to-b from-[#0f0d18] to-[#0a0912] p-3 text-left transition-all hover:border-amber-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  >
                    <div className="flex items-center gap-3">
                      {/* Card thumbnail */}
                      <div className="relative w-14 h-20 flex-shrink-0 overflow-hidden rounded-lg border border-amber-300/20">
                        <img
                          src={card.image}
                          alt={card.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {/* Card info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wide text-amber-100/50 mb-0.5">Latest card</p>
                        <p className="font-serif text-base text-amber-50 truncate">{card.name}</p>
                        <p className="text-xs text-amber-100/60">{card.orientation} · {heroDateLabel}</p>
                      </div>
                      {/* Chevron indicator */}
                      <div className={`flex-shrink-0 text-amber-200/50 transition-transform ${isCardExpanded ? 'rotate-180' : ''}`}>
                        <CaretDown className="h-5 w-5" aria-hidden />
                      </div>
                    </div>
                    {/* Expandable insight */}
                    {isCardExpanded && meaning && (
                      <div className="mt-3 pt-3 border-t border-amber-200/10">
                        <p className="text-xs text-amber-100/80 leading-relaxed">{meaning}</p>
                      </div>
                    )}
                  </button>
                );
              })()}
            </>
          )}

          {/* CTAs - Clear actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onStartReading()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-400/20 transition hover:shadow-amber-300/30 hover:-translate-y-0.5 active:translate-y-0 min-h-[44px]"
            >
              <JournalPlusCircleIcon className="h-4 w-4" aria-hidden />
              New Reading
            </button>
            {isExpanded ? (
              <button
                type="button"
                onClick={() => {
                  const journeySection = document.querySelector('[aria-label="Journal insights and journey"]');
                  if (journeySection) {
                    journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-amber-200/5 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-200/10 hover:border-amber-300/40 min-h-[44px]"
              >
                See Journey
                <CaretDown className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-amber-200/5 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-200/10 hover:border-amber-300/40 min-h-[44px]"
              >
                Show Details
                <CaretDown className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* Desktop: Keep expanded hero cards for larger screens */}
        <div className="hidden lg:block">
          {heroEntry && heroCards.length > 0 && (
            <div className="mb-4 flex flex-wrap justify-center gap-2.5">
              {heroCards.map((card, index) => {
                const isExpanded = expandedCardIndex === index;
                const canonical = getCanonicalCard(card);
                const isReversed = (card.orientation || '').toLowerCase().includes('reversed');
                const meaning = isReversed ? canonical?.reversed : canonical?.upright;
                const suitInfo = canonical?.suit ? SUIT_ELEMENTS[canonical.suit] : null;
                const isMajor = canonical?.number !== undefined;

                return (
                  <div key={card.id} className="flex items-stretch">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${card.name}, ${card.orientation}. Tap for insight.`}
                      onClick={() => onExpandedCardChange(isExpanded ? null : index)}
                      className={`relative w-24 sm:w-28 flex-shrink-0 overflow-hidden rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                        isExpanded
                          ? 'border-amber-400/40 ring-1 ring-amber-400/20 rounded-r-none'
                          : 'border-amber-300/20 hover:border-amber-300/30'
                      } bg-gradient-to-b from-[#120f1f] via-[#0c0a14] to-[#0a0911] shadow-[0_12px_32px_-20px_rgba(251,191,36,0.35)]`}
                    >
                      <div className="relative aspect-[2/3] overflow-hidden">
                        <img
                          src={card.image}
                          alt={card.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                        {index === 0 && heroDateLabel && (
                          <div className="absolute left-1.5 top-1.5 rounded-full bg-amber-300/25 px-1.5 py-0.5 text-[8px] font-semibold text-amber-50">
                            {heroDateLabel}
                          </div>
                        )}
                      </div>
                      <div className="px-2 pb-2 pt-1.5">
                        <p className="font-serif text-xs text-amber-50 leading-tight truncate">{card.name}</p>
                        <p className="text-[9px] text-amber-100/55">{card.orientation}</p>
                      </div>
                    </button>

                    {/* Slide-out insight panel */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-out ${
                        isExpanded ? 'w-36 sm:w-40 opacity-100' : 'w-0 opacity-0'
                      }`}
                    >
                      <div className="w-36 sm:w-40 h-full rounded-r-xl border-y border-r border-amber-400/25 bg-gradient-to-br from-[#12101c] to-[#0a0912] p-2 flex flex-col">
                        <p className="text-[9px] uppercase tracking-wider text-amber-300/50 mb-1">
                          {suitInfo ? suitInfo.element : isMajor ? 'Major Arcana' : 'Insight'}
                        </p>
                        {suitInfo && (
                          <p className="text-[9px] text-amber-200/50 mb-1.5 leading-tight">
                            {suitInfo.quality}
                          </p>
                        )}
                        <p className="text-[10px] text-amber-100/80 leading-relaxed overflow-hidden flex-1" style={{ display: '-webkit-box', WebkitLineClamp: suitInfo ? 4 : 5, WebkitBoxOrient: 'vertical' }}>
                          {meaning || 'Explore this card\'s traditional symbolism and personal significance in your reading.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop: Constellation layout - only visible on large screens */}
          <div className="relative" style={{ height: '340px' }}>
            {/* SVG constellation lines */}
            <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
              <defs>
                <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(251,191,36,0.45)" />
                  <stop offset="50%" stopColor="rgba(251,191,36,0.12)" />
                  <stop offset="100%" stopColor="rgba(251,191,36,0.45)" />
                </linearGradient>
                <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(251,191,36,0.4)" />
                  <stop offset="100%" stopColor="rgba(251,191,36,0.12)" />
                </linearGradient>
                <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(251,191,36,0.8)" />
                  <stop offset="60%" stopColor="rgba(251,191,36,0.25)" />
                  <stop offset="100%" stopColor="rgba(251,191,36,0)" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Draw connectors based on card positions */}
              {CARD_CONNECTORS.map(([from, to], idx) => {
                const start = statNodeMap[from];
                const end = statNodeMap[to];
                if (!start || !end) return null;
                return (
                  <line
                    key={idx}
                    x1={`${start.x}%`}
                    y1={`${start.y}%`}
                    x2={`${end.x}%`}
                    y2={`${end.y}%`}
                    stroke="url(#lineGradient2)"
                    strokeWidth="1"
                    opacity={start.isHero || end.isHero ? 0.65 : 0.35}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Accent arc between outer nodes */}
              <path
                d="M 20 125 Q 50 90 80 110"
                fill="none"
                stroke="url(#lineGradient1)"
                strokeWidth="1"
                opacity="0.35"
              />

              {/* Star nodes at intersections */}
              {statNodes.map((node) => (
                <g key={node.id}>
                  <circle cx={`${node.x}%`} cy={`${node.y}%`} r="3.5" fill="url(#nodeGlow)" />
                  <circle cx={`${node.x}%`} cy={`${node.y}%`} r={node.isHero ? 4 : 3} fill="rgba(251,191,36,0.55)" filter="url(#glow)" />
                </g>
              ))}

              {/* Smaller accent stars along the network */}
              {[{ x: 34, y: 40 }, { x: 66, y: 40 }, { x: 34, y: 56 }, { x: 66, y: 56 }, { x: 50, y: 62 }].map((star, i) => (
                <circle key={i} cx={`${star.x}%`} cy={`${star.y}%`} r="1.5" fill="rgba(251,191,36,0.28)" />
              ))}
            </svg>

            {/* Positioned tarot cards */}
            {statNodes.map((stat) => {
              const isHero = stat.id === 'entries';
              // Check if this card should show the notebook illustration
              const showNotebookIllustration = stat.id === 'context';
              const icon = (() => {
                if (stat.id === 'entries') return <JournalCardsAddIcon className="h-5 w-5" aria-hidden />;
                if (stat.id === 'reversal') return <JournalPercentCircleIcon className="h-5 w-5" aria-hidden />;
                if (stat.id === 'context') return <JournalBookIcon className="h-5 w-5" aria-hidden />;
                return <JournalRefreshIcon className="h-5 w-5" aria-hidden />;
              })();
              const rotation = { entries: 0, context: -3, reversal: 2.5, 'last-entry': -1.5 }[stat.id] || 0;
              const pos = statNodeMap[stat.id]
                ? { left: `${statNodeMap[stat.id].x}%`, top: `${statNodeMap[stat.id].y}%` }
                : { left: '50%', top: '50%' };

              return (
                <div
                  key={stat.id}
                  className="group absolute transition-transform duration-500 hover:z-10"
                  style={{
                    left: pos.left,
                    top: pos.top,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    width: isHero ? '160px' : '140px'
                  }}
                >
                  {/* Card glow */}
                  <div
                    className={`pointer-events-none absolute -inset-3 rounded-xl blur-2xl transition-opacity duration-500 ${
                      isHero ? 'bg-amber-400/20 opacity-100' : 'bg-amber-400/10 opacity-0 group-hover:opacity-100'
                    }`}
                    aria-hidden="true"
                  />

                  {/* Tarot card */}
                  <div
                    className={`relative overflow-hidden rounded-lg transition-all duration-300 group-hover:-translate-y-1 ${
                      isHero
                        ? 'ring-2 ring-amber-400/40 shadow-[0_0_40px_-10px_rgba(251,191,36,0.4)]'
                        : 'ring-1 ring-amber-300/20 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)] group-hover:ring-amber-300/30 group-hover:shadow-[0_12px_40px_-8px_rgba(251,191,36,0.2)]'
                    }`}
                    style={{ aspectRatio: '2.5/4' }}
                  >
                    {/* Outer decorative border area with intricate pattern */}
                    <div className={`absolute inset-0 ${
                      isHero
                        ? 'bg-gradient-to-b from-amber-800/50 via-amber-900/40 to-amber-800/50'
                        : 'bg-gradient-to-b from-amber-900/30 via-amber-950/25 to-amber-900/30'
                    }`}>
                      {/* Ornate card-back pattern */}
                      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                        <defs>
                          <pattern id={`cardPattern-${stat.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M10 0L20 10L10 20L0 10Z" fill="none" stroke="currentColor" strokeWidth="0.5" className={isHero ? 'text-amber-400/20' : 'text-amber-300/10'} />
                            <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="0.5" className={isHero ? 'text-amber-400/15' : 'text-amber-300/8'} />
                            <circle cx="10" cy="10" r="1" fill="currentColor" className={isHero ? 'text-amber-400/10' : 'text-amber-300/5'} />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#cardPattern-${stat.id})`} />
                      </svg>
                    </div>

                    {/* Inner card frame */}
                    <div className={`absolute inset-2 rounded overflow-hidden ${
                      isHero
                        ? 'bg-gradient-to-b from-[#12101c] via-[#0a0912] to-[#12101c]'
                        : 'bg-gradient-to-b from-[#0e0c16] via-[#08070d] to-[#0e0c16]'
                    }`}>
                      {/* Inner border */}
                      <div className={`absolute inset-0 rounded border ${
                        isHero ? 'border-amber-400/30' : 'border-amber-200/15 group-hover:border-amber-300/20'
                      } transition-colors`} />

                      {/* Decorative inner frame line */}
                      <div className={`absolute inset-1 rounded border ${
                        isHero ? 'border-amber-500/15' : 'border-amber-200/5'
                      }`} />

                      {/* Corner ornaments - more elaborate */}
                      {[
                        { pos: 'top-0 left-0', rotate: '0', anchor: 'M0 12L0 0L12 0' },
                        { pos: 'top-0 right-0', rotate: '90', anchor: 'M0 12L0 0L12 0' },
                        { pos: 'bottom-0 right-0', rotate: '180', anchor: 'M0 12L0 0L12 0' },
                        { pos: 'bottom-0 left-0', rotate: '270', anchor: 'M0 12L0 0L12 0' }
                      ].map((corner, i) => (
                        <svg
                          key={i}
                          className={`absolute ${corner.pos} w-5 h-5 ${isHero ? 'text-amber-400/50' : 'text-amber-300/25'}`}
                          viewBox="0 0 20 20"
                          style={{ transform: `rotate(${corner.rotate}deg)` }}
                          aria-hidden="true"
                        >
                          <path d={corner.anchor} fill="none" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="3" cy="3" r="1.5" fill="currentColor" />
                          <path d="M6 0L6 6L0 6" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
                        </svg>
                      ))}

                      {/* Center star/sun symbol for hero */}
                      {isHero && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]" aria-hidden="true">
                          <svg className="w-32 h-32 text-amber-300" viewBox="0 0 100 100">
                            {[...Array(8)].map((_, i) => (
                              <line
                                key={i}
                                x1="50"
                                y1="50"
                                x2={50 + 45 * Math.cos((i * Math.PI) / 4)}
                                y2={50 + 45 * Math.sin((i * Math.PI) / 4)}
                                stroke="currentColor"
                                strokeWidth="1"
                              />
                            ))}
                            <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
                            <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
                          </svg>
                        </div>
                      )}

                      {/* Card content */}
                      <div className="relative h-full flex flex-col items-center justify-center p-3 text-center">
                        {showNotebookIllustration ? (
                          <>
                            {/* Notebook illustration - like a tarot card image */}
                            <div className="relative mb-2 w-full flex-1 min-h-[80px] max-h-[100px]">
                              <svg className="w-full h-full" viewBox="0 0 80 100" aria-hidden="true">
                                {/* Open notebook */}
                                <g className="text-amber-200/40">
                                  {/* Left page */}
                                  <path d="M8 15 L38 12 L38 85 L8 88 Z" fill="rgba(251,191,36,0.08)" stroke="currentColor" strokeWidth="0.5" />
                                  {/* Right page */}
                                  <path d="M42 12 L72 15 L72 88 L42 85 Z" fill="rgba(251,191,36,0.06)" stroke="currentColor" strokeWidth="0.5" />
                                  {/* Spine */}
                                  <path d="M38 12 L40 10 L42 12 L42 85 L40 87 L38 85 Z" fill="rgba(251,191,36,0.12)" stroke="currentColor" strokeWidth="0.5" />
                                  {/* Page lines - left */}
                                  <line x1="12" y1="25" x2="34" y2="23" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  <line x1="12" y1="32" x2="34" y2="30" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  <line x1="12" y1="39" x2="34" y2="37" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  <line x1="12" y1="46" x2="34" y2="44" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  <line x1="12" y1="53" x2="34" y2="51" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  {/* Page lines - right */}
                                  <line x1="46" y1="23" x2="68" y2="25" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  <line x1="46" y1="30" x2="68" y2="32" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  <line x1="46" y1="37" x2="68" y2="39" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                  {/* Quill pen */}
                                  <g transform="translate(50, 45) rotate(25)">
                                    <path d="M0 0 L2 -25 L4 -28 L6 -25 L8 0 L4 2 Z" fill="rgba(251,191,36,0.15)" stroke="currentColor" strokeWidth="0.4" />
                                    <path d="M3 -28 L4 -35 L5 -28" fill="none" stroke="currentColor" strokeWidth="0.3" />
                                    <ellipse cx="4" cy="2" rx="2" ry="1" fill="rgba(251,191,36,0.2)" />
                                  </g>
                                  {/* Written text squiggles on right page */}
                                  <path d="M47 44 Q50 43 53 44 Q56 45 59 44" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                                  <path d="M47 51 Q49 50 51 51 Q53 52 55 51" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                                  {/* Small star doodle */}
                                  <path d="M30 60 L31 64 L35 64 L32 67 L33 71 L30 68 L27 71 L28 67 L25 64 L29 64 Z" fill="rgba(251,191,36,0.15)" stroke="currentColor" strokeWidth="0.3" />
                                  {/* Moon doodle */}
                                  <path d="M55 62 A8 8 0 1 1 55 78 A6 6 0 1 0 55 62" fill="rgba(251,191,36,0.1)" stroke="currentColor" strokeWidth="0.3" />
                                </g>
                              </svg>
                            </div>
                            {/* Label at bottom like tarot card name */}
                            <div className="border-t border-amber-200/10 pt-1.5 w-full">
                              <p className="text-[8px] uppercase tracking-[0.2em] text-amber-100/30 mb-0.5">{stat.label}</p>
                              <p className="font-serif text-lg text-amber-50/85 leading-tight">{stat.value}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Icon medallion */}
                            <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                              isHero
                                ? 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 text-amber-300 ring-2 ring-amber-400/30 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)]'
                                : 'bg-gradient-to-br from-amber-200/15 to-amber-400/10 text-amber-200/70 ring-1 ring-amber-200/20 group-hover:text-amber-200 group-hover:ring-amber-300/25'
                            }`}>
                              {icon}
                            </div>

                            {/* Label */}
                            <p className={`text-[9px] uppercase tracking-[0.2em] mb-1.5 ${
                              isHero ? 'text-amber-300/60' : 'text-amber-100/35'
                            }`}>
                              {stat.label}
                            </p>

                            {/* Value */}
                            <p className={`font-serif leading-tight ${
                              isHero
                                ? 'text-3xl text-amber-100 drop-shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                                : 'text-2xl text-amber-50/85'
                            }`}>
                              {stat.value}
                            </p>

                            {/* Hint */}
                            {stat.hint && (
                              <p className={`mt-1.5 text-[10px] leading-snug max-w-[100px] ${
                                isHero ? 'text-amber-200/45' : 'text-amber-100/25'
                              }`}>
                                {stat.hint}
                              </p>
                            )}

                            {/* Bottom decorative element */}
                            <div className={`mt-2 w-6 h-px ${
                              isHero
                                ? 'bg-gradient-to-r from-transparent via-amber-400/50 to-transparent'
                                : 'bg-gradient-to-r from-transparent via-amber-200/20 to-transparent'
                            }`} />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Top edge shine */}
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
                      isHero
                        ? 'bg-gradient-to-r from-transparent via-amber-300/50 to-transparent'
                        : 'bg-gradient-to-r from-transparent via-amber-200/20 to-transparent'
                    }`} aria-hidden="true" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default JournalSummaryBand;
