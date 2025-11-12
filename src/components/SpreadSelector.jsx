import React from 'react';
import { Sparkles } from 'lucide-react';
import { SPREADS } from '../data/spreads';

export function SpreadSelector({
  selectedSpread,
  setSelectedSpread,
  setReading,
  setRevealedCards,
  setPersonalReading,
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
    <div className="bg-indigo-900/40 backdrop-blur rounded-lg p-6 mb-8 border border-amber-500/20">
      <h2 className="text-xl font-serif text-amber-200 mb-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5" />
        Choose Your Spread
      </h2>
      <p className="text-amber-100/60 text-xs -mt-1 mb-3">
        This edition defaults to the 22 Major Arcana; Minors (beta) can be enabled in settings.
      </p>
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(SPREADS).map(([key, spread]) => (
          <button
            key={key}
            onClick={() => {
              setSelectedSpread(key);
              setReading(null);
              setRevealedCards(new Set());
              setPersonalReading('');
              setAnalyzingText('');
              setIsGenerating(false);
              setDealIndex(0);
              setReflections({});
              setHasKnocked(false);
              setHasCut(false);
              setCutIndex(Math.floor(deckSize / 2));
              knockTimesRef.current = [];
            }}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedSpread === key
                ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                : 'bg-indigo-800/40 border-indigo-700/50 text-amber-100/70 hover:border-amber-500/50'
            }`}
          >
            <div className="font-serif font-semibold">{spread.name}</div>
            <div className="text-sm opacity-75">
              {spread.count} card{spread.count > 1 ? 's' : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}