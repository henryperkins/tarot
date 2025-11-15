import React from 'react';
import { Sparkles } from 'lucide-react';
import { SPREADS } from '../data/spreads';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';

const DEFAULT_DECK_SIZE =
  Array.isArray(MINOR_ARCANA) && MINOR_ARCANA.length === 56
    ? MAJOR_ARCANA.length + MINOR_ARCANA.length
    : MAJOR_ARCANA.length;

export function SpreadSelector({
  selectedSpread,
  setSelectedSpread,
  setReading,
  setRevealedCards,
  setPersonalReading,
  setJournalStatus,
  setAnalyzingText,
  setIsGenerating,
  setDealIndex,
  setReflections,
  setHasKnocked,
  setHasCut,
  setCutIndex,
  knockTimesRef,
  deckSize = DEFAULT_DECK_SIZE,
  onSpreadConfirm
}) {
  return (
    <div className="modern-surface p-4 sm:p-6 mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-serif text-amber-200 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
        Choose Your Spread
      </h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
        {Object.entries(SPREADS).map(([key, spread]) => {
          const isActive = selectedSpread === key;
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedSpread(key);
                setReading(null);
                setRevealedCards(new Set());
                setPersonalReading(null);
                setJournalStatus?.(null);
                setAnalyzingText('');
                setIsGenerating(false);
                setDealIndex(0);
                setReflections({});
                setHasKnocked(false);
                setHasCut(false);
                setCutIndex(Math.floor(deckSize / 2));
                knockTimesRef.current = [];
                onSpreadConfirm?.(key);
              }}
              className={`relative p-3 sm:p-4 rounded-lg border-2 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                isActive
                  ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-900/40'
                  : 'bg-slate-900/70 border-slate-700/60 text-amber-100/80 hover:border-emerald-400/40 hover:bg-slate-900/90'
              }`}
              aria-pressed={isActive}
            >
              <div className="font-serif font-semibold text-sm sm:text-base flex items-center gap-2">
                {spread.name}
                {isActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-xs-plus uppercase tracking-[0.16em]">
                    ✓ Selected
                  </span>
                )}
              </div>
              <div className="text-xs-plus sm:text-sm opacity-80 mt-0.5">
                {spread.count} card{spread.count > 1 ? 's' : ''} · {spread.description || 'Guided snapshot for your focus.'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
