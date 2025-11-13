import React from 'react';
import { Sparkles } from 'lucide-react';
import { SPREADS } from '../data/spreads';

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
  deckSize = 22
}) {
  return (
    <div className="modern-surface p-4 sm:p-6 mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-serif text-amber-200 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
        Choose Your Spread
      </h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
        {Object.entries(SPREADS).map(([key, spread]) => (
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
            }}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
              selectedSpread === key
                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-900/40'
                : 'bg-slate-900/70 border-slate-700/60 text-amber-100/80 hover:border-emerald-400/40 hover:bg-slate-900/90'
            }`}
          >
            <div className="font-serif font-semibold text-sm sm:text-base">{spread.name}</div>
            <div className="text-xs sm:text-sm opacity-75">
              {spread.count} card{spread.count > 1 ? 's' : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
