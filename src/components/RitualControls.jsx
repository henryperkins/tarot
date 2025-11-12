import React from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';

export function RitualControls({
  hasKnocked,
  handleKnock,
  cutIndex,
  setCutIndex,
  hasCut,
  applyCut
}) {
  return (
    <div className="bg-indigo-900/40 backdrop-blur rounded-lg p-6 mb-6 border border-amber-500/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="font-serif text-amber-200 mb-2">Clear the deck</div>
          <button
            onClick={handleKnock}
            className="px-4 py-2 rounded-lg border border-amber-500/40 bg-indigo-950/60 hover:bg-indigo-900/60"
            aria-pressed={hasKnocked}
            title="Knock 3 times"
          >
            {hasKnocked ? 'Cleared' : 'Knock 3x'}
          </button>
        </div>
        <div className="flex-1">
          <div className="font-serif text-amber-200 mb-2">Cut the deck</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={MAJOR_ARCANA.length - 1}
              value={cutIndex}
              onChange={event => setCutIndex(parseInt(event.target.value, 10))}
              className="w-48"
              aria-label="Cut position"
            />
            <button
              onClick={applyCut}
              className="px-3 py-2 rounded-lg border border-amber-500/40 bg-indigo-950/60 hover:bg-indigo-900/60"
              aria-pressed={hasCut}
            >
              {hasCut ? 'Cut set' : 'Set cut'}
            </button>
          </div>
          <div className="text-xs text-amber-100/60 mt-1">Cut at: {cutIndex}</div>
        </div>
      </div>
    </div>
  );
}