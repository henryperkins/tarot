---
target: deck / spread / reveal UI and animations
total_score: 21
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 2
timestamp: 2026-08-26T06-03-36Z
slug: src-components-scenes-revealscene-jsx
---
Method: dual-agent (A: 01a03c9b-4999-7a93-8434-9ac445805a02 · B: 01a03c9b-499c-7da2-a52b-20780ea7adaa)

# Design critique — deck / spread / reveal UI and animations

Target: `src/components/scenes/RevealScene.jsx` (full operate loop: deck → spread → ritual → deal → reveal)
Mode: Operate, with Experience qualities during ritual and reveal

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Knock dots, `N of M` copy, and `aria-live` on reveal are strong; the first deal is a hard scene cut with no flight. |
| 2 | Match System / Real World | 2 | RWS faces and reversal rotation feel like a table. Dealing does not: deck and seats never coexist, so there is no hand. |
| 3 | User Control and Freedom | 2 | “Reveal instantly” exists. “Reset reveals (keep this spread)” unmounts the cloth back to ritual. Celtic is paywalled, not skippable. |
| 4 | Consistency and Standards | 2 | Visual language is coherent (gold, serif, RWS). The verb is not: Deal / Draw next / Reveal next / Reveal instantly / Tap to uncover truth. |
| 5 | Error Prevention | 2 | Three knocks in 2s with a silent cadence reset in cinematic `minimalUI`. The primary “Deal the cards” CTA does not require the knock the heading just asked for. |
| 6 | Recognition Rather Than Recall | 2 | `ReadingBoard` always sets `hideLegend={true}`. Past / Present / Future live in titles and overlays, not on the seats. |
| 7 | Flexibility and Efficiency | 2 | `k`/`c` shortcuts and instant reveal exist. Cinematic mode removes the Knock/Cut/Shuffle buttons the gesture coach promised. Mobile `dealNext` bypasses the ghost path. |
| 8 | Aesthetic and Minimalist Design | 2 | The cloth with RWS is quiet and good. Setup and mobile chrome compete: six spreads, truncated step chips, captions on the art. |
| 9 | Error Recovery | 2 | Live region announcing card + position + meaning is excellent. Reset copy lies. Paywall names “Enlightened” vs “Plus”. |
| 10 | Help and Documentation | 2 | Onboarding is the most Tableu screen in the product. `GestureCoachOverlay` then passes `total`/`current` into `CarouselDots`, which expects `totalItems`/`activeIndex` — dots render `null`. |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Authored in the artifacts, interchangeable in the operating loop. Rider-Waite faces, a serif “Knock three times”, a stacked pile, suit-colored backs, a five-card cross, a two-path layout, and a Celtic crossing card that is actually a cross — that is Tableu. The verb is a scene router: shuffle is a 1200ms disabled button, “Deal the cards” does not deal, the first `dealNext()` unmounts the deck and mounts a fully populated `SpreadTable`, and the ghost flight is architecturally impossible because deck and slots never share a DOM. Tableu designed a reader’s table, then operated it as a product wizard.

**Deterministic scan:** CLI `detect.mjs` returned 3 warnings. Two are false positives (`TactileLensOverlay.jsx:61` CSS triangle caret flagged as `side-tab`). One is real but small: `AnimatedReveal.jsx:129` animates `width` on a 4px progress bar (gated off under reduced motion). The browser engine, injected into live markup, found 17–61 anti-patterns per view: `dark-glow` / `radial-spotlight-glow` / `gpt-thin-border-wide-shadow` on spread cards and chrome, `low-contrast` (measured ~2.3:1–3.1:1 on muted gold text), `nested-cards`, `tiny-text` (11px), `pulsing-dot` in header, `all-caps-body`, `clipped-overflow-container` on `.spread-selector-panel`, and `layout-transition` (`transition: padding`). Many glow hits are the product’s gold material, not accidental SaaS shine — but low contrast, 11px type, nested cards on the spread mall, and captions sitting on RWS titles are real.

**Visual overlays:** Detector injection succeeded in a Playwright Chromium session (banners and per-element labels visible on captured frames). It did **not** attach to the user’s Chrome: `browser-use` was not on PATH / remote-debugging permission blocked. No `[Human]` tab overlay is available in the running desktop browser.

## Overall Impression

The spread geometry and the Rider-Waite faces are the product. Everything around them — scene cuts, competing verbs, unnamed seats, and motion that cannot be skipped — treats tarot as a multi-step app instead of a table. The single biggest opportunity is to put the deck and the empty seats on one cloth and deal into them.

## What's Working

1. **Spread geometry is authored.** Five-card cross, decision (Heart / Path A / Path B), relationship, and Celtic with the crossing card rotated 90° read as a cloth, not a CSS grid of widgets. Slot centering uses `translate: -50% -50%`; the old transform-ate-centering bug is not present.
2. **RWS + reversal are the real focal object.** Inverted cards with a Reversed chip, lazy-loaded faces until needed, and a mobile focus overlay that names the position in one breath.
3. **Screen-reader status is better than the visuals.** After deal: “Revealed Six of Swords. Position: Past — …”. Skip links appear on first Tab. Custom `useReducedMotion` (not framer-motion) actually gates flip duration and particles (`count: 0`).

## Priority Issues

### [P0] The deal is a scene change, not a deal
- **Why it matters:** A reader deals onto a table that is already there. Here `RitualScene` (deck, no slots) and `RevealScene` (slots, no deck) never coexist. `handleAnimatedDeal` looks for `#spread-slot-N` and `deckRef`; on ritual the slots are missing, on reveal the deck is missing, so both paths fall through to `dealNext()`. First reveal unmounts the deck and spawns every remaining card face-down. Reset empties `revealedCards` and `deriveLegacyScene` sends the user back to ritual — the cloth leaves the page. Ghost deal, deal-trail particles, and “keep this spread” are theater around a router.
- **Fix:** Mount `DeckRitual` and `SpreadTable` on one stage. Empty placeholders until each flight lands. Ghost ~350ms, skippable. Reset turns seats face-down on the same cloth.
- **Suggested command:** `/impeccable shape` (one cloth), then `/impeccable animate` (the actual deal)

### [P0] Handset chrome collides and then lies about the verb
- **Why it matters:** On 390×844, GlobalNav labels truncate, step chips read as fragments, and ritual shows “Knock three times” plus `Deal the cards` plus an action bar `Draw next` — three labels for one action. Reveal correctly hides desktop pills (`isHandset ? 'hidden' : 'hidden sm:block'`), then the action bar still offers Reveal next / Reveal instantly under `CardFocusOverlay`. Landscape stacks overlay + chips + dual CTAs in 390px of height. Deck taps did not fill knock dots in the live walk.
- **Fix:** One bottom verb that matches the scene. Hide `MobileActionBar` while a card overlay is open. Don’t truncate step labels — drop them on handset. Make knock a visible 44px control, not a 2s undocumented gesture.
- **Suggested command:** `/impeccable adapt` plus `/impeccable clarify`

### [P1] The seats are unnamed
- **Why it matters:** The product’s own interpretation rule is position-first. `ReadingBoard` hard-codes `hideLegend={true}`. Number badges 1/2/3 only. The tactile-lens control sits below an 800px desktop fold. Mobile overlay says “Past”; the cloth does not.
- **Fix:** Always-on short labels (Past / Present / Future, or numbered Celtic names). Lens as enhancement, not the only map.
- **Suggested command:** `/impeccable layout`

### [P1] Copy fights itself
- **Why it matters:** One session prints Deal the cards, Draw next, Reveal next, Reveal instantly, aria-label “Reveal all cards”, Tap to uncover truth, Reset reveals (keep this spread), Unlock Celtic… Enlightened plan / Upgrade to Plus, and “QUICK · 1 CARDS”. Jordan cannot tell whether knocking is required. Sam hears a different verb than they see.
- **Fix:** One glossary: Knock → Cut → Shuffle → Deal (face-down) → Turn (face-up) → Instantly turn remaining. Reset = “Turn these cards face-down”. Align plan names. Fix the 1-card plural.
- **Suggested command:** `/impeccable clarify`

### [P2] Motion you cannot skip, and type sitting on the picture
- **Why it matters:** Shuffle locks 1200ms (`useTarotState.js:255`) with no skip — still a blank delay under reduced motion. `SceneShell` `ritual→reveal` overlay is 920ms (authored-entrance budget is 500–800ms) and still runs a 200ms JS fade when reduced. `dealNext`/`revealCard` call `navigator.vibrate(10)` without `useHaptic`. Knock, shuffle, deal, flip, reveal-bloom, and complete-chime are marked `essential: true`, so they still play when `SoundManager.reducedMotion` is set. Global CSS `animation-duration: 0.01ms !important` on `*` (`tarot.css:3263-3272`) is the “destroy useful feedback” pattern. Captions (`Fool`, `HighPries…`) paint over printed RWS titles; next-card pill “Tap to uncover truth” covers the sigil; Celtic compact map is `T T T T T T T T S T`.
- **Fix:** Skip control on shuffle/overlay; 150ms snap under `useReducedMotion`; gate vibrate through `useHaptic`; demote flip/deal SFX from essential; drop name captions on RWS; park progress off the top card; compact map = numbers 1–10.
- **Suggested command:** `/impeccable animate` plus `/impeccable quieter`

## Persona Red Flags

**Jordan (first-timer):** Onboarding is kind. Then six spreads, a vision-study footnote, “1 CARDS”, Knock heading vs Deal CTA, a 1.2s frozen form, three cards appearing from nowhere, and “Tap to uncover truth” on a card already on the table. They will not learn that cut exists.

**Sam (keyboard / screen reader):** Skip links and live regions are the best-designed things in reveal. Then Deal can lack a visible ring, Cut is a secret `c`, gesture-coach pagination is a no-op, cinematic mode removes the explicit buttons the coach described, and essential SFX still play under reduced motion.

**Casey (one-handed mobile):** First fold is crowded. Two primary CTAs. Overlay is a good single-card read until the action bar keeps dealing underneath it. Landscape: overlay + steps + dual CTAs, no table. Touch: progress dots and knock badges are well under 44px; `RitualControls` icon wrappers are 36px.

**Querent (practiced-reader, not a gimmick):** Dotted anonymous pile, no cut chrome, no named seats, a deal that is a route change, particles as a substitute for a hand. The Celtic drawing is the one moment that looks like tarot — and the live product sells it behind Plus.

## Cognitive load

Failed: single focus, chunking, visual hierarchy, one thing at a time, minimal choices, working memory. Passed: grouping, progressive disclosure. **6 failures → high.**

## Emotional journey

Opening (onboarding) is Tableu. Valley: 1200ms shuffle of a form, not a deck. Almost-peak: “Knock three times” undercut by Deal as the filled button. Cut, not a deal: 920ms overlay, deck gone, seats already full. Peak: reversed RWS on the cloth. Valley: Reset returns an empty dotted brick; Create Personal Narrative sits below an 800px fold. High-stakes (reversals) are calm. The scare is commercial and mechanical, not divinatory.

## Motion-specific findings

**Intended focal sequence:** knock → cut → shuffle → ghost deal → flip.
**Actual:** 1200ms disabled button → stacked-deck idle breath → Deal (no ghost) → 920ms overlay → cards already seated → 420ms `FlipCard` `rotateY`.

Motion explains face-down vs face-up. It does not explain undealt → dealt. There is no undealt state on the cloth.

| Beat | Duration | Skippable? |
|------|----------|------------|
| Shuffle timeout | 1200ms | No |
| Ghost deal | 350ms | Never ran |
| Scene overlay ritual→reveal | 920ms | No |
| Flip | 420ms | Instant reveal skips remaining, not in-flight |
| Idle breath | 3800ms loop | Stops on hover |

`will-change: transform` sits at rest on `SpreadTable` FlipCard. `ParticleLayer` still mounts on ritual/reveal in mobile stable mode (`SceneShell` only gates narrative/complete). Card images are not all-78 eager (good). `Card.jsx` / `ReadingGrid` / `LandscapeSplitView` are unused by the live cinematic path — two flip engines, only `SpreadTable` is on the cloth.

## Minor Observations

- Fixture `5/3` progress is a fixture bug (reading length 5, layout 3), not the live three-card path.
- CLI `layout-transition` on `AnimatedReveal` progress width is technically true, low impact.
- Hard-coded `rgba(...)` in `SceneShell` backdrops and `DeckRitual` overlays sit beside tokens.
- `RevealScene` has no `aria-live`; `ReadingBoard` still exposes `sr-only` polite status when `cardsOnly`.
- Header `READING` eyebrow + four step buttons remain in “cinematic” mode. `minimalNav` is not minimal.

## Questions to Consider

- If a querent cannot see the deck and the empty seats at the same time, what ritual is being staged?
- Why is the primary button on “Knock three times” Deal?
- If Reset “keeps this spread”, why does the spread leave the page?
- Why does a position-first product hide every position name?
- Why keep `Card.jsx` if `SpreadTable` is the only cloth?
