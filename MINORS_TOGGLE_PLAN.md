# Minors (Beta) Integration Plan

This document captures the pragmatic plan and targeted code changes to introduce a **Minors (beta)** mode while:

- Keeping Majors-only as the default.
- Ensuring all UX/copy remains accurate to the active deck.
- Preserving existing seeded shuffle + ritual mechanics.
- Letting narrative logic naturally extend to Minors (suits/elements/reversals).

---

## 1. Data: Add Minor Arcana

Create: [`src/data/minorArcana.js`](src/data/minorArcana.js)

Shape mirrors Majors, with additional suit/rank metadata.

Pattern:

- Use `rank`, `rankValue`, `suit`.
- Leave `number` undefined (reserved for Majors).
- Provide upright/reversed meanings using a concise RWS-aligned baseline.

Example structure (partial):

```js
// src/data/minorArcana.js
const RANKS = [
  { rank: 'Ace', rankValue: 1 },
  { rank: 'Two', rankValue: 2 },
  { rank: 'Three', rankValue: 3 },
  { rank: 'Four', rankValue: 4 },
  { rank: 'Five', rankValue: 5 },
  { rank: 'Six', rankValue: 6 },
  { rank: 'Seven', rankValue: 7 },
  { rank: 'Eight', rankValue: 8 },
  { rank: 'Nine', rankValue: 9 },
  { rank: 'Ten', rankValue: 10 },
  { rank: 'Page', rankValue: 11 },
  { rank: 'Knight', rankValue: 12 },
  { rank: 'Queen', rankValue: 13 },
  { rank: 'King', rankValue: 14 }
];

function makeCard(suit, rank, rankValue, upright, reversed) {
  return {
    name: `${rank} of ${suit}`,
    suit,
    rank,
    rankValue,
    upright,
    reversed
  };
}

// TODO: Fill full 56-card set with concise meanings.
export const MINOR_ARCANA = [
  makeCard('Cups', 'Ace', 1, 'New feelings, intuition, love', 'Emotional block, repressed feelings'),
  makeCard('Cups', 'Two', 2, 'Unity, partnership, mutual attraction', 'Imbalance, tension, broken communication'),
  // ...
];
```

Notes:

- Keep meanings succinct and consistent with existing Major copy.
- No need for `number` field; Majors-only logic already relies on 0–21.

---

## 2. Deck: Full deck support + suit-run relationships

Update: [`src/lib/deck.js`](src/lib/deck.js)

Add deck pool helper and wire into `drawSpread` and relationships:

```js
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { SPREADS } from '../data/spreads';

// Active deck pool based on toggle
export function getDeckPool(includeMinors = false) {
  return includeMinors ? [...MAJOR_ARCANA, ...MINOR_ARCANA] : MAJOR_ARCANA;
}

// Draw using selected pool
export function drawSpread({ spreadKey, useSeed, seed, includeMinors = false }) {
  const spread = SPREADS[spreadKey];
  if (!spread) throw new Error(`Unknown spread: ${spreadKey}`);

  const pool = getDeckPool(includeMinors);
  const shuffled = useSeed ? seededShuffle(pool, seed) : cryptoShuffle(pool);
  const count = spread.count;

  const orientationRand = useSeed ? xorshift32((seed ^ 0xa5a5a5a5) >>> 0) : null;

  return shuffled.slice(0, count).map(card => ({
    ...card,
    isReversed: useSeed ? orientationRand() > 0.5 : Math.random() > 0.5
  }));
}
```

Enhance `computeRelationships(cards)` to include:

- Existing Major sequences (unchanged in spirit).
- New Minor suit runs (3+ consecutive ranks in same suit).

Concept:

- Identify majors with `number` 0–21:
  - If adjacent numbers in sequence appear, push a `type: 'sequence'` relationship.
- Identify minors with `suit` + `rankValue`:
  - For each suit, sort unique `rankValue`s.
  - If any run of 3+ consecutive values, push `type: 'suit-run'` with explanatory text.
- Keep existing symbolic Major pairings.

This feeds directly into existing highlights UI with no API changes.

---

## 3. Settings: “Minors (beta)” toggle

Update: [`src/components/SettingsToggles.jsx`](src/components/SettingsToggles.jsx)

Extend props and render third checkbox:

```jsx
// Add: includeMinors, setIncludeMinors
export function SettingsToggles({
  voiceOn,
  setVoiceOn,
  ambienceOn,
  setAmbienceOn,
  includeMinors,
  setIncludeMinors
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Existing Reader voice + ambience toggles */}
      {/* ... */}

      {/* New: Minors (beta) */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={includeMinors}
          onChange={e => setIncludeMinors(e.target.checked)}
          className="accent-amber-500"
        />
        <span className="text-amber-100/80 text-sm">Minors (beta)</span>
      </label>
    </div>
  );
}
```

Behavior:

- Default `includeMinors = false` → Majors-only (current behavior).
- When enabled, toggles `drawSpread` to use full deck via `includeMinors`.

---

## 4. Ritual: deck-size-aware cut slider

Update: [`src/components/RitualControls.jsx`](src/components/RitualControls.jsx)

Make cut control use active deck size:

```jsx
export function RitualControls({
  hasKnocked,
  handleKnock,
  cutIndex,
  setCutIndex,
  hasCut,
  applyCut,
  knocksCount = 0,
  deckSize = 22
}) {
  // ...
  <input
    type="range"
    min={0}
    max={Math.max(0, deckSize - 1)}
    value={cutIndex}
    onChange={e => setCutIndex(parseInt(e.target.value, 10))}
    className="w-48"
    aria-label="Cut position"
  />
  // ...
}
```

Notes:

- Existing seed-consumption semantics remain; only the slider range adjusts.

---

## 5. SpreadSelector: deck-aware reset

Update: [`src/components/SpreadSelector.jsx`](src/components/SpreadSelector.jsx)

- Remove MAJOR_ARCANA import.
- Accept `deckSize` prop (with default 22).
- Use it when resetting `cutIndex`:

```jsx
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
  // ...
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
}
```

Microcopy:

- For now, keep the Majors-only line, as this is the stable default.
- Once Minors are wired end-to-end, adjust to something like:
  - `Deck scope: Major Arcana` or `Full deck`, conditional on `includeMinors`.

---

## 6. Card header: clean labels for Minors

Update: [`src/components/Card.jsx`](src/components/Card.jsx)

Introduce helpers:

- `isMajor(card)`: uses `number` 0–21.
- `headerLabel(card)`:
  - Majors: roman numeral from existing `romanize`.
  - Minors: `Rank • Suit` if fields present; else parse from `name`.

Skeleton:

```jsx
function isMajor(card) {
  return typeof card.number === 'number' && card.number >= 0 && card.number <= 21;
}

function headerLabel(card) {
  if (isMajor(card)) {
    return typeof card.number === 'number' ? romanize(card.number) : '';
  }
  if (card.rank && card.suit) {
    return `${card.rank} • ${card.suit}`;
  }
  const m = (card.name || '').match(/^(\w+)\s+of\s+(\w+)$/);
  return m ? `${m[1]} • ${m[2]}` : card.name || '';
}

// In card face header:
<div className="tarot-card-face-header">
  <span>{headerLabel(card)}</span>
</div>
```

This keeps majors iconic and makes minors readable at a glance.

---

## 7. Wiring in TarotReading

Update: [`src/TarotReading.jsx`](src/TarotReading.jsx)

Key steps:

1. Import helpers and state:

```jsx
import { getDeckPool, computeSeed, computeRelationships, drawSpread } from './lib/deck';

const [includeMinors, setIncludeMinors] = useState(false);
const deckSize = getDeckPool(includeMinors).length;
```

2. Reset cutIndex on toggle:

```jsx
useEffect(() => {
  setCutIndex(Math.floor(deckSize / 2));
}, [includeMinors, deckSize]);
```

3. Pass `includeMinors` to Settings:

```jsx
<SettingsToggles
  voiceOn={voiceOn}
  setVoiceOn={setVoiceOn}
  ambienceOn={ambienceOn}
  setAmbienceOn={setAmbienceOn}
  includeMinors={includeMinors}
  setIncludeMinors={setIncludeMinors}
/>
```

4. Pass deckSize into SpreadSelector + RitualControls:

```jsx
<SpreadSelector
  // ...
  setCutIndex={setCutIndex}
  knockTimesRef={knockTimesRef}
  deckSize={deckSize}
/>

<RitualControls
  hasKnocked={hasKnocked}
  handleKnock={handleKnock}
  cutIndex={cutIndex}
  setCutIndex={setCutIndex}
  hasCut={hasCut}
  applyCut={applyCut}
  knocksCount={Math.min((knockTimesRef.current || []).length, 3)}
  deckSize={deckSize}
/>
```

5. Use `includeMinors` when drawing:

```jsx
const shuffle = () => {
  // existing reset + seed logic...
  const cards = drawSpread({
    spreadKey: currentSpread,
    useSeed,
    seed,
    includeMinors
  });
  setReading(cards);
  setIsShuffling(false);
};
```

6. Deck scope copy (highlights):

- Replace static scope line with:

```jsx
<span className="font-semibold text-amber-200">Deck scope:</span>{' '}
{includeMinors
  ? 'Full deck (Major + Minor Arcana).'
  : 'Major Arcana focus (archetypal themes).'}
```

7. Suit-run highlight (optional, leveraging relationships):

```jsx
{relationships.some(r => r.type === 'suit-run') && (
  <div className="flex items-start gap-3">
    <div className="text-emerald-400 mt-1">-</div>
    <div>
      <span className="font-semibold text-emerald-300">Suit run:</span>{' '}
      A string of consecutive ranks in one suit highlights a focused theme.
    </div>
  </div>
)}
```

---

## 8. QA Checklist

- Default:
  - Minors toggle off.
  - 22-card deck.
  - Ritual cut slider max = 21.
  - Spread Highlights: Majors scope line.
- With Minors (beta) on:
  - 78-card pool.
  - Ritual cut slider max = 77.
  - Spread Highlights reflect full deck scope.
  - Relationships may include `suit-run` entries.
- Ethics:
  - All new copy remains framed as reflection, not fixed prediction.

---

## Next Steps (Optional)

- Populate all 56 Minors in [`src/data/minorArcana.js`](src/data/minorArcana.js) with final meanings.
- Add small suit glyphs in `Card` for visual clarity.
- Persist `includeMinors` to localStorage.
- Add visual “beta” affordance (sub-label / tooltip) near the Minors toggle.
