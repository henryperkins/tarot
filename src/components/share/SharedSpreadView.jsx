import React, { useMemo } from 'react';
import { SPREADS } from '../../data/spreads';
import { MAJOR_ARCANA } from '../../data/majorArcana';
import { MINOR_ARCANA } from '../../data/minorArcana';

const CARD_LOOKUP = [...MAJOR_ARCANA, ...MINOR_ARCANA].reduce((acc, card) => {
  acc[card.name] = card;
  return acc;
}, {});

function getOrientationMeaning(card) {
  const reference = CARD_LOOKUP[card.name] || card;
  const upright = reference?.upright || card?.upright || '';
  const reversed = reference?.reversed || card?.reversed || '';
  const orientation = card?.orientation || '';
  const isReversed = orientation.toLowerCase().includes('reversed');
  return isReversed ? reversed || upright : upright || reversed;
}

function deriveSpreadPositions(entry) {
  if (!entry) return [];
  const spreadDefinition = entry.spreadKey ? SPREADS[entry.spreadKey] : null;
  if (spreadDefinition?.positions) {
    return spreadDefinition.positions;
  }
  return Array.isArray(entry.cards)
    ? entry.cards.map((_, index) => `Position ${index + 1}`)
    : [];
}

function mapNotes(notes) {
  return notes.slice().sort((a, b) => a.createdAt - b.createdAt).reduce((acc, note) => {
    const key = note.cardPosition || 'general';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(note);
    return acc;
  }, {});
}

function NoteAvatars({ notes }) {
  if (!notes || notes.length === 0) {
    return null;
  }
  const latest = notes.slice(-3);
  return (
    <div className="flex items-center gap-1">
      {latest.map((note) => {
        const label = note.authorName?.trim()?.slice(0, 2)?.toUpperCase() || '✨';
        return (
          <span
            key={note.id}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-[0.65rem] font-semibold text-emerald-100"
          >
            {label}
          </span>
        );
      })}
      {notes.length > latest.length && (
        <span className="text-xs text-emerald-200/80">+{notes.length - latest.length}</span>
      )}
    </div>
  );
}

export function SharedSpreadView({ entry, notes = [], selectedPosition, onSelectPosition }) {
  const positions = useMemo(() => deriveSpreadPositions(entry), [entry]);
  const noteMap = useMemo(() => mapNotes(notes), [notes]);

  if (!entry) {
    return null;
  }

  const generalNotes = noteMap.general || [];
  const gridClass = entry.spreadKey === 'celtic'
    ? 'cc-grid'
    : entry.cards?.length <= 1
      ? 'grid grid-cols-1'
      : entry.cards?.length <= 4
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-6">
      <div className={`${gridClass} gap-4`}>
        {entry.cards?.map((card, index) => {
          const positionLabel = card.position || positions[index] || `Card ${index + 1}`;
          const positionNotes = noteMap[positionLabel] || [];
          const active = selectedPosition === positionLabel;
          const orientation = card.orientation || 'Upright';
          const meaning = getOrientationMeaning(card) || 'Meaning unavailable';

          return (
            <button
              key={`${card.name}-${index}`}
              type="button"
              onClick={() => onSelectPosition?.(positionLabel)}
              className={`group w-full rounded-2xl border bg-slate-950/70 p-4 text-left shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                active ? 'border-emerald-300/70' : 'border-emerald-400/20 hover:border-emerald-300/40'
              } ${entry.spreadKey === 'celtic' ? 'modern-surface' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-emerald-200">{positionLabel}</p>
                {positionNotes.length > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] text-emerald-100">
                    {positionNotes.length} note{positionNotes.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-col items-center text-center">
                <div className={`w-full max-w-[220px] overflow-hidden rounded-xl border border-amber-400/30 ${
                  orientation.toLowerCase().includes('reversed') ? 'rotate-180' : ''
                }`}>
                  <img
                    src={card.image || '/images/cards/placeholder.jpg'}
                    alt={card.name}
                    className="w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = '/images/cards/placeholder.jpg';
                    }}
                  />
                </div>
                <p className="mt-3 font-serif text-lg text-amber-100">{card.name}</p>
                <span className="text-xs uppercase tracking-[0.25em] text-emerald-300/70">{orientation}</span>
                <p className="mt-2 text-sm text-amber-100/80">{meaning}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <NoteAvatars notes={positionNotes} />
                {active && (
                  <span className="rounded-full border border-emerald-300/60 px-2 py-0.5 text-[0.65rem] text-emerald-100">
                    Targeting note
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {generalNotes.length > 0 && (
        <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4 shadow-inner">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Whole spread reflections</p>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {generalNotes.map((note) => (
              <article key={note.id} className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-3">
                <header className="flex items-center justify-between text-[0.7rem] text-emerald-200/90">
                  <span className="font-semibold">{note.authorName}</span>
                  <time>{new Date(note.createdAt).toLocaleString()}</time>
                </header>
                <p className="mt-2 text-sm text-amber-100/90 whitespace-pre-wrap">{note.body}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
