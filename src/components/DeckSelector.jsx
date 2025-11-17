import React from 'react';
import { Check } from 'lucide-react';

const DECK_OPTIONS = [
  {
    id: 'rws-1909',
    label: 'Rider-Waite-Smith',
    subtitle: '1909 Edition',
    description: 'Classic Pamela Colman Smith watercolors with bold ink outlines and theatrical staging.',
    visualCues: ['Sunlit yellows', 'Lapis blues', 'Crimson accents'],
    texture: 'Hand-painted inks on watercolor paper'
  },
  {
    id: 'thoth-a1',
    label: 'Thoth',
    subtitle: 'Crowley/Harris A1',
    description: 'Abstract, prismatic geometry with layered astrological sigils and Art Deco gradients.',
    visualCues: ['Electric teal', 'Magenta', 'Saffron gold'],
    texture: 'Oil and watercolor washes with airbrushed gradients',
    note: 'Uses Thoth card names (e.g., "The Magus", "Adjustment")'
  },
  {
    id: 'marseille-classic',
    label: 'Tarot de Marseille',
    subtitle: '18th Century Scans',
    description: 'Woodcut line work with flat primary colors and medieval heraldry.',
    visualCues: ['Carmine red', 'Cobalt blue', 'Sunflower yellow'],
    texture: 'Bold, block-printed textures with minimal shading'
  }
];

export function DeckSelector({ selectedDeck, onDeckChange }) {
  return (
    <div className="space-y-3">
      <div className="mb-3">
        <h3 className="text-sm font-serif text-amber-200 mb-1">
          Choose your physical deck
        </h3>
        <p className="text-xs text-amber-100/70">
          Select the deck you're using so the vision validation can accurately recognize your cards.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {DECK_OPTIONS.map((deck) => (
          <button
            key={deck.id}
            type="button"
            onClick={() => onDeckChange(deck.id)}
            className={`
              relative text-left p-4 rounded-xl border-2 transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
              ${
                selectedDeck === deck.id
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600/80 hover:bg-slate-900/60'
              }
            `}
            aria-pressed={selectedDeck === deck.id}
          >
            {/* Selected indicator */}
            {selectedDeck === deck.id && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center">
                  <Check className="w-4 h-4 text-slate-950" strokeWidth={3} />
                </div>
              </div>
            )}

            {/* Deck info */}
            <div className="pr-8">
              <div className="font-serif text-amber-200 text-base mb-0.5">
                {deck.label}
              </div>
              <div className="text-[0.7rem] text-emerald-300/80 uppercase tracking-wider mb-2">
                {deck.subtitle}
              </div>
              <p className="text-xs text-amber-100/75 leading-snug mb-2">
                {deck.description}
              </p>

              {/* Visual cues */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {deck.visualCues.map((cue) => (
                  <span
                    key={cue}
                    className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-950/60 text-amber-200/80 border border-slate-700/50"
                  >
                    {cue}
                  </span>
                ))}
              </div>

              {/* Note if present */}
              {deck.note && (
                <p className="text-[0.65rem] text-amber-300/70 italic mt-2">
                  {deck.note}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Helper text */}
      <div className="mt-3 text-xs text-amber-100/70 bg-slate-950/60 border border-slate-800/70 rounded-lg px-3 py-2">
        <p>
          <strong className="text-amber-200">Why this matters:</strong> The vision AI uses deck-specific visual cues to recognize your cards.
          Selecting the correct deck improves recognition accuracy and ensures card names match your physical deck.
        </p>
      </div>
    </div>
  );
}
