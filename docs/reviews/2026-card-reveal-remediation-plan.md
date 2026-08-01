Type: review + remediation plan
Status: active
Last reviewed: 2026-08-01

# Card draw / reveal UI — findings and remediation plan

## Scope and method

Reviewed the card draw and reveal surface: the deck pile, the spread board, the
flip, and the effects layered on top of it (rings, bursts, haptics, audio).

Findings were produced by reading the code and then driving the running app —
Vite dev server on `:5173`, Chromium, `/api/auth/me` mocked to a Pro
subscription — through draw → reveal for all six spreads at 1280×900 and
390×844, measuring DOM geometry rather than judging by eye. Every claim below
that cites a number was measured in the browser.

The live reveal surface is:

```
RevealScene → ReadingBoard → SpreadTable
```

[`RevealScene.jsx`](../../src/components/scenes/RevealScene.jsx#L80) →
[`ReadingBoard.jsx`](../../src/components/ReadingBoard.jsx#L523) →
[`SpreadTable.jsx`](../../src/components/SpreadTable.jsx#L517).

`SpreadTable` is the only card renderer users see. `ReadingGrid.jsx` and
`Card.jsx` are a second, unreferenced implementation (see F8).

---

## Findings

### F1 — Card centering is silently destroyed; every spread is offset by half a card

**Severity: high. Affects every spread at every breakpoint.**

[`SpreadTable.jsx:941`](../../src/components/SpreadTable.jsx#L941) positions each
slot with `absolute -translate-x-1/2 -translate-y-1/2` plus percentage
`left`/`top`. But `SlotPulseWrapper`
([`:139`](../../src/components/SpreadTable.jsx#L139),
[`:143`](../../src/components/SpreadTable.jsx#L143)) calls
`set(node, { scale: 1 })` / `animate(node, { scale: [...] })`, and the motion
adapter's `set` ([`motionAdapter.js:305`](../../src/lib/motionAdapter.js#L305))
writes an **inline `transform`**. Tailwind 3's `-translate-*` utilities compile
into that same `transform` property, so the inline value wins and the centering
is erased.

Measured (Three-Card, board 976×651):

| slot | `left` | expected box left | actual box left |
|---|---|---:|---:|
| 0 | 20% | 131 | **195** |
| 1 | 50% | 424 | **488** |
| 2 | 80% | 717 | **781** |

`getComputedStyle(wrapper).transform` is literally `"none"` on every slot. Cards
are pinned by their **top-left corner**, not their centre.

Consequences:

- The whole board sits half a card down-and-right of where it was designed.
- Celtic slots 5 and 6 reach `bottom: 766` inside a 732px board (mobile: 234
  inside 195 — a 20% spill). Because the `cardsOnly` branch drops
  `overflow-hidden`
  ([`spreadTablePresentation.js:26`](../../src/lib/spreadTablePresentation.js#L26)),
  they spill onto the "Reset reveals" control.
- The Celtic Challenge card no longer crosses Present centrally.
- `getMaxCardWidth` ([`:105`](../../src/components/SpreadTable.jsx#L105)) sizes
  cards from centre-based maths that no longer describes reality.

Forcing `translate: -50% -50%` on the slots in the live page confirmed the
diagnosis: max card bottom went 766 → **673**, and the cross read correctly.

### F2 — Every ring effect on a card is clipped away and never renders

**Severity: high.**

The card button carries `overflow-hidden`
([`:1008`](../../src/components/SpreadTable.jsx#L1008)), and all of these live
inside it at negative insets:

| element | line | purpose | status |
|---|---|---|---|
| `numberBadge` `-top-2 -left-2` | [`:924`](../../src/components/SpreadTable.jsx#L924) | position number 1–10 | clipped |
| `FlashRing` `inset-[-12%]` | [`:1089`](../../src/components/SpreadTable.jsx#L1089) | deck → spread transition flash | clipped |
| `OneShotRing` `inset-[-8%]` | [`:1132`](../../src/components/SpreadTable.jsx#L1132) | return-to-card highlight | clipped |
| `OneShotRing` `inset-[-10%]` | [`:1142`](../../src/components/SpreadTable.jsx#L1142) | narrative mention pulse (suit-tinted) | clipped |

Measured badge offset relative to the card: `{ top: -6, left: -6 }`; computed
`overflow: hidden`. **The position numbers never appear on any card**, even
though the legend ([`:1217`](../../src/components/SpreadTable.jsx#L1217)), the
Celtic map overlay
([`ReadingBoard.jsx:390`](../../src/components/ReadingBoard.jsx#L390)) and the
mini-map all refer to them.

`PulseRing` on the *empty placeholder* does render, because that button is
`overflow-visible` ([`:962`](../../src/components/SpreadTable.jsx#L962)). So the
machinery is written and wired, and four of five card effects are invisible.

### F3 — Reversed cards are unreadable and unlabelled

**Severity: high — reversal changes a card's meaning.**

[`:1108`](../../src/components/SpreadTable.jsx#L1108) applies
`rotateZ(180deg)` to the face container, which holds the `<img>` **and** the
name overlay ([`:1124`](../../src/components/SpreadTable.jsx#L1124)). The card
title ends up mirrored at the top edge and is illegible.

There is also no "Reversed" badge on this surface — the retired `Card.jsx` had
one — and the button's `aria-label`
([`:1074`](../../src/components/SpreadTable.jsx#L1074)) is just
`${card.name} in ${position} position`, with no orientation. The live region
does announce orientation at reveal time
([`ReadingContext.jsx:1395`](../../src/contexts/ReadingContext.jsx#L1395)), but a
screen-reader user re-navigating the board cannot recover it.

### F4 — Decision spread: position 4 is 64% hidden behind position 5

**Severity: high for that spread.**

`SPREAD_LAYOUTS.decision`
([`:40`](../../src/components/SpreadTable.jsx#L40)) places *What clarifies the
best path* at `y: 70` and *Free will* at `y: 80` — 10% apart in a 3:2 board
where a card is ~28% of the height. Measured overlap: **64% of the card**, with
Free Will on top (equal z-index, later in DOM).

This is inherent to the coordinate table, not a consequence of F1 — it persists
after the centering fix.

Celtic's staff column has the same shape at lower severity: slots 6↔7, 7↔8, 8↔9
overlap **19% on desktop, 50% on mobile**, covering each card's top edge (and
its number badge, once F2 is fixed).

### F5 — Mobile Celtic Cross is not usable

**Severity: high.**

At a 390px viewport the board renders at **260×195 px** holding ten 52×78 cards.
Measured overlaps: 0↔1 60%, 0↔4 24%, 0↔5 26%, 1↔3 40%, staff column 50% each.
Cards overflow the board bottom by 39px onto the controls, and the Tactile Lens
button ([`:1241`](../../src/components/SpreadTable.jsx#L1241)) sits on top of the
*Past* card.

The `Map` overlay exists as a mitigation, but the board itself needs a
mobile-specific layout rather than a scaled-down desktop one.

### F6 — The "cinematic" soundtrack does not exist, and two audio systems fire per reveal

**Severity: medium.**

`public/audio/cinematic-sprite.mp3` is **0 bytes**; its own manifest
(`public/audio/cinematic-sprite.json`) says *"Placeholder sprite map. Replace
cinematic-sprite.mp3 with production audio in a follow-up."*
`SoundManager.preload()` fails, sets `spriteLoadFailed`
([`SoundManager.js:89`](../../src/lib/SoundManager.js#L89)), and every cue falls
through to `playSynthCue` — so `deal`, `flip` and `reveal-bloom` are bare
oscillator sweeps.

Meanwhile each reveal fires **two** independent sounds:

- `playFlip()` — [`useTarotState.js:301`](../../src/hooks/useTarotState.js#L301),
  real `/sounds/flip.mp3`;
- `sounds.play('deal')` —
  [`SpreadTable.jsx:832`](../../src/components/SpreadTable.jsx#L832), synth.

Two audio stacks, two cues, one gesture. Separately: nothing in the app calls
`setVolume` or `mute` on the cinematic manager —
[`useSounds.js`](../../src/hooks/useSounds.js#L20) exposes them and no caller
exists — so reveal SFX are **unmutable by the user**. Only the ambience track
has a preference
([`PreferencesContext.jsx:195`](../../src/contexts/PreferencesContext.jsx#L195)).

### F7 — `reveal-burst` is a drift field, and it costs nine canvases per Celtic reveal

**Severity: medium (perf), low (visual).**

[`ParticleLayer.jsx:96`](../../src/components/ParticleLayer.jsx#L96) configures
`reveal-burst` with `move.direction: 'none'` and the `random: true` inherited
from `shared` — no emitter, no radial velocity. It reads as haze, not a burst.

Measured during "Reveal instantly" on Celtic Cross: canvas count goes
1 → **10** → 1 within about a second as ten tsParticles instances mount and
unmount 90ms apart
([`SpreadTable.jsx:1185`](../../src/components/SpreadTable.jsx#L1185)). Cleanup
is correct, but that is a lot of engine churn for an effect that doesn't burst.

### F8 — ~2,100 lines of dead reveal UI

**Severity: low (correctness), medium (maintenance).**

[`ReadingGrid.jsx`](../../src/components/ReadingGrid.jsx) (591 lines),
[`Card.jsx`](../../src/components/Card.jsx) (947) and
[`LandscapeSplitView.jsx`](../../src/components/LandscapeSplitView.jsx) have no
importer anywhere in `src/`, `e2e/` or `tests/` — they only import each other.
They contain a parallel reveal implementation with swipe-to-reveal, element
flash, suit accents and Upright/Reversed pills, several of which the live
`SpreadTable` path lacks.
[`docs/reviews/2026-test-coverage-analysis.md`](./2026-test-coverage-analysis.md)
still recommends writing tests for them.

(`AnimatedReveal.jsx` is **live** — lazy-loaded from `CardModal` and
`NarrativeReadingSurface`. It is not part of this cleanup.)

### F9 — Smaller items

- `revealHintDismissedRef.current` is a ref read during render
  ([`:917`](../../src/components/SpreadTable.jsx#L917)) to decide pill
  visibility — non-reactive, works only by the accident of co-timed re-renders.
- `.card-swipe-hint` sets `transform: translateY(-50%)` while `.swipe-hint`
  animates `transform: translateX(...)`, wiping the vertical correction
  ([`tarot.css:3029`](../../src/styles/tarot.css#L3029),
  [`:3047`](../../src/styles/tarot.css#L3047)). Same class-vs-inline family as
  F1; currently only reachable from dead code.
- `handleSlotDeal` and the placeholder `PulseRing` are inert in `RevealScene` —
  `ReadingBoard` never passes `onSlotDeal`
  ([`ReadingBoard.jsx:523`](../../src/components/ReadingBoard.jsx#L523)), so
  `canDeal` is permanently false.
- `active:scale-95` on `[data-layout-card]` is defeated by the FLIP inline
  `transform` written by `createLayout`.
- Cards never grow to fill the board: `cardSizeStyle` only sets
  `maxWidth`/`maxHeight`, so the fixed `md:w-32` caps them at ~13% of a 976px
  board. Celtic in particular reads sparse.

---

## Remediation plan

### Ground rules

- `SpreadTable.jsx` is the one card surface; everything lands there or in a
  module it owns.
- Position semantics in [`src/data/spreads.js`](../../src/data/spreads.js)
  (`positions`, `roleKeys`) are **not** touched — only pixel geometry. No
  backend or narrative impact; `shared/contracts/` is unaffected.
- Layout coordinates exist in two hand-synced copies today
  (`SpreadTable.SPREAD_LAYOUTS`, `ReadingBoard.CELTIC_MAP_POSITIONS`). Collapse
  to one before retuning anything.
- `npm run gate:design` is a ratchet — it fails only on *increases*. New code
  must use existing tokens: no fresh `rgba()` literals (26 budgeted), no
  `min-h-[…]`, no `text-[…]`, no new `focus-visible:ring-*` variants.

### Workstreams

| # | Workstream | Fixes | Depends on | Size |
|---|---|---|---|---|
| 1 | Positioning & clipping correctness | F1, F2, F9 (partial) | — | S |
| 2 | Reversed-card presentation | F3 | — | S |
| 3 | Layout geometry engine | F4 | 1 | M |
| 4 | Handset Celtic Cross | F5 | 3 | M |
| 5 | Reveal effects & perf | F7 | — | M |
| 6 | Audio pipeline | F6 | — | S |
| 7 | Dead-code removal | F8, F9 (rest) | 2 | S |

Workstreams 1 and 2 are independent of everything else and fix the most visible
damage — ship them first. Workstream 3 carries the actual design work.

---

### PR-1 · Positioning & clipping correctness

**1a. Restore card centering.** Split the positioned element from the animated
one. `SlotPulseWrapper` currently *is* the positioned element, which is why
`set(node, { scale: 1 })` can overwrite its centering.

```jsx
<div
  className="absolute"
  data-slot-index={i}
  id={`spread-slot-${i}`}
  style={{
    left: `${pos.x}%`,
    top: `${pos.y}%`,
    translate: '-50% -50%',
    marginLeft: pos.offsetX ? `${pos.offsetX}%` : 0,
    zIndex
  }}
>
  <SlotPulseWrapper active={isNext && !card}>   {/* animated child */}
    …
  </SlotPulseWrapper>
</div>
```

Two independent guarantees: centering moves to the standalone `translate`
property (which composes with `transform` instead of being replaced by it),
*and* the animation library never touches the positioned node. Belt and braces,
because this class of bug is invisible in code review.

**1b. Audit for the same pattern.** Grep for elements that carry a Tailwind
`translate-*` / `scale-*` / `rotate-*` class *and* are passed to `animate()` or
`set()`. Known instances: `SlotPulseWrapper`; `.card-swipe-hint` + `.swipe-hint`
(the CSS-animation variant of the same conflict); `Card.jsx:660`.
`TactileLensOverlay`, `DeckPile` and `GhostCard` were checked and are clean.

**1c. Un-clip badge and rings.** Do not relocate them — move the clipping to
where it is actually needed. Drop `overflow-hidden` from the card button
([`:1008`](../../src/components/SpreadTable.jsx#L1008)) and add
`rounded-[inherit] overflow-hidden` to the two `FlipCard` face divs
([`:1103`](../../src/components/SpreadTable.jsx#L1103),
[`:1153`](../../src/components/SpreadTable.jsx#L1153)), which is the layer that
needs to respect the rounded border. Badge and all four rings then render, and
they keep the card's `rotate` / `scale` — which matters for the Celtic Challenge
card.

**1d.** Move `active:scale-95` on `[data-layout-card]` to the standalone `scale`
property, alongside the existing `positionScale`, so the FLIP inline `transform`
no longer defeats it.

**Acceptance**

- Card centre within 2px of its layout coordinate, every slot, every spread.
- Number badge has a non-null bounding box.
- A forced mention-pulse renders visible pixels outside the card border.

---

### PR-2 · Reversed-card presentation

Move `rotateZ(180deg)` off the face container
([`:1108`](../../src/components/SpreadTable.jsx#L1108)) and onto the `<img>`
alone. The name overlay then stays upright at the bottom where it belongs.

Restore the orientation signal the live surface lost when `Card.jsx` fell out of
use:

- a "Reversed" chip beside the name, reusing the retired pill's tokens
  (`bg-surface-muted/90 text-accent border-accent/50`), degrading to a `⟲` glyph
  at `compact` size;
- orientation in the persistent accessible name
  ([`:1074`](../../src/components/SpreadTable.jsx#L1074)):
  `${card.name}, reversed, in ${positionLabel} position…`. The live-region
  announcement at reveal time already covers first reveal; this covers
  re-navigation.

Check `CardInfoPopover` and `SpreadTableCompact`
([`:1326`](../../src/components/SpreadTable.jsx#L1326), which shows only
`name.charAt(0)`) for the same gap.

**Acceptance**

- `npm run test:a11y` clean.
- Accessible name contains orientation for reversed cards.
- Name label reads upright at every size.

---

### PR-3 · Layout geometry engine

**3a. Single source of truth.** Extract `SPREAD_LAYOUTS` to
`src/lib/spreadLayouts.js`; derive `ReadingBoard.CELTIC_MAP_POSITIONS`
([`ReadingBoard.jsx:26`](../../src/components/ReadingBoard.jsx#L26)) from it
instead of duplicating. `TactileLensOverlay` already receives `visibleLayout` as
a prop and stays in sync automatically.

**3b. Make the fitter overlap-aware.** `getMaxCardWidth`
([`:105`](../../src/components/SpreadTable.jsx#L105)) only checks container
edges — nothing stops neighbours colliding. Add pairwise separation: for each
pair not in an allow-list, with centre deltas `sx`, `sy` in px and per-position
scale and rotation folded into effective extents,

```
wPair = max( 2·sx / (effWᵢ + effWⱼ),
             2·sy / (effHᵢ + effHⱼ) · CARD_ASPECT )

w     = min( edgeConstraint, min over pairs of wPair )
```

`allowOverlap: [[0, 1]]` for `celtic` — the crossing card is the only
intentional overlap in the whole deck of spreads. With n ≤ 10 the cost is nil.
Cards then shrink rather than collide, which is the correct failure mode.

**3c. Retune coordinates** so the resulting size stays legible rather than
merely non-overlapping:

- `decision` — *Clarity* at `y: 70` and *Free Will* at `y: 80` are 10% apart in
  a 3:2 board where a card is ~28% of the height. Redistribute across the full
  vertical range.
- `celtic` staff — `y: 20/40/60/80` gives a 146px gap for a 192px-tall card.
  Either widen the span (roughly 12 → 88) or raise the board's aspect ratio from
  `4/3`; likely both.

Coordinates are tuned against the automated overlap check below, not by eye.

**Risks.** Spread-selector art (`selectorimages/*`, hand-drawn illustrations
loaded by [`spreadArt.js`](../../src/utils/spreadArt.js)) will drift from the
retuned layouts. Cosmetic follow-up, not a blocker.

**Acceptance**

- Zero unintended overlap at 390 / 768 / 1280 for all six spreads.
- Every card box inside the board box.
- Resulting card width at or above a per-breakpoint floor we set.

---

### PR-4 · Handset Celtic Cross

At 390px the board is 260×195 for ten cards; PR-3 alone would shrink them to
~26px, which is worse than the overlap. This needs a different layout, not a
smaller one.

Add `COMPACT_SPREAD_LAYOUTS.celtic` in `spreadLayouts.js`, selected when
`isHandset` (already plumbed through `ReadingBoard` → `SpreadTable`): the cross
as a compact plus on top, the staff as a horizontal row beneath, board aspect
taller (about `1/1`), and a bumped `sizeClass` for the handset branch. Keep the
existing `Map` overlay as the orientation aid.

The `cardsOnly` branch intentionally drops `overflow-hidden`
([`spreadTablePresentation.js:26`](../../src/lib/spreadTablePresentation.js#L26)),
which is why cards currently spill onto the Reset control. PR-1 and PR-3 remove
the spill; add board bottom-padding as defence in depth. Move the Tactile Lens
button out of the card field on handset.

**Alternative considered:** a pan/zoom board. Rejected — it adds a new gesture
surface to an already gesture-heavy screen.

---

### PR-5 · Reveal effects & perf

Replace the per-slot `ParticleLayer preset="reveal-burst"`
([`:1185`](../../src/components/SpreadTable.jsx#L1185)) with a CSS
`SlotRevealBurst`: N spans, per-spark `--angle` / `--distance` custom
properties, one shared keyframe, suit-tinted via the existing
`getSuitGlowColor`. No canvas, GPU-composited, and the global
`prefers-reduced-motion` block
([`tarot.css:3218`](../../src/styles/tarot.css#L3218)) disables it for free.

This removes the 1 → 10 → 1 tsParticles canvas churn per Celtic reveal *and*
actually bursts — the current preset uses `direction: 'none'` with random drift,
which is why it reads as haze. Keep `.slot-reveal-bloom`
([`tarot.css:2988`](../../src/styles/tarot.css#L2988)); it works. If
`reveal-burst` stays in `ParticleLayer` for other callers, give it radial
emission.

**Acceptance**

- Canvas count constant through a full reveal-all.
- Burst visible under normal motion, absent under reduced motion.

---

### PR-6 · Audio pipeline

**One system.** Drop `playFlip()` from `useTarotState.dealNext` / `revealCard`
([`:278`](../../src/hooks/useTarotState.js#L278),
[`:301`](../../src/hooks/useTarotState.js#L301)) — keep `unlockAudio()`.
`SoundManager` owns reveal audio and gains the cues the live path never fires:
`flip` at flip start, `reveal-bloom` at flip land. Both are already in the
sprite map; only `deal` plays today.

**Stop pretending about the sprite.** Make the synth path first-class: skip the
fetch when the asset is absent or zero-length so we don't log a decode error
every session, and tune `SYNTH_CUE_MAP`
([`SoundManager.js:14`](../../src/lib/SoundManager.js#L14)) so the cues sound
deliberate. Commissioning real audio becomes a tracked product task rather than
a silent runtime failure.

**Give users control.** Add a `soundEffectsOn` preference in
`PreferencesContext` mirroring `ambienceOn`, drive
`cinematicSoundManager.mute()` from it, and surface it in `AudioControls` /
`ExperienceSettings`.

---

### PR-7 · Dead-code removal

Delete `ReadingGrid.jsx`, `Card.jsx` and `LandscapeSplitView.jsx`. Everything
worth keeping is ported by PR-2 (Reversed chip) and PR-5 (element flash →
burst); suit accents already exist in `SpreadTable` via `getSuitBorderColor` /
`getRevealedCardGlow`; reflections already live in `CardDetailPanel` /
`CardFocusOverlay`.

Update [`docs/design-contract.md:52`](../design-contract.md) and
[`docs/reviews/2026-test-coverage-analysis.md`](./2026-test-coverage-analysis.md)
(which still recommends writing tests for the deleted files), then re-run
`node scripts/evaluation/verifyDesignContract.js --write-baseline` to tighten
the ratchet. `Journal_backup.jsx` looks like the same species — flagged, not
included.

Also in this PR:

- Derive the reveal-pill hint from `revealedCards.size === 0` instead of the
  render-read ref at [`:917`](../../src/components/SpreadTable.jsx#L917).
- Either wire `onSlotDeal` from `ReadingBoard` or delete the branch.

---

## Regression harness

Lands with PR-1, grows with PR-3 and PR-4. New `e2e/spread-layout.spec.js` — the
ad-hoc harness used for this review, made permanent. For each spread ×
{390×844, 768×1024, 1280×900}: deal, reveal all, then assert

1. every card box is inside the board box;
2. no pair overlaps beyond the declared allow-list;
3. each card's centre is within 2px of its layout coordinate — **this is the
   assertion that would have caught F1 on day one**;
4. the number badge and the mention-pulse ring have non-zero visible area.

Plus unit coverage for the extended `getMaxCardWidth` (allow-list, rotation,
scale) and an extension to
[`tests/spreadTablePresentation.test.mjs`](../../tests/spreadTablePresentation.test.mjs).

Existing visual snapshots (`e2e/cards-drawn-section.spec.js-snapshots/`) cover
the Journal entry card, not the board, so they should not churn.

---

## Open decisions

| Decision | Recommendation | Alternative |
|---|---|---|
| Audio sprite | Ship the synth path as intentional now; commission real audio separately | Block PR-6 on real assets |
| Handset Celtic | Compact layout variant | Pan/zoom board — more code, new gestures |
| Dead components | Delete after PR-2 ports the Reversed chip | Revive `Card.jsx` as a list/detail view — a product decision, not cleanup |

## Effort

PR-1 and PR-2 together are roughly a day and remove most of the visible damage.
PR-3 and PR-4 are the real work: design iteration against the harness. PR-5,
PR-6 and PR-7 are independent and parallelisable.
