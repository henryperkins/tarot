I've finished the review: no edits made, captures and tests only. The deck now has identity coverage and an authored literal spotlight for all 78 cards. But the automatic move from literal description to personal interpretation still only works on the exact recorded fixture wording.

## 1. Verdict

- **Feature checkpoint: conditionally playable.** The recorded Star study runs well on desktop: identity → land pour → pool for "people back home" → both pitchers. The 78-card deck study works as a detail inspector. Before calling it a checkpoint, fix the stuck-`active` water loop (P2-1) and reword the all-card claim to what is actually supported.
- **Production: not ready.** The system is only reachable from `/__e2e/reading-gestures`. `TarotReading.jsx:1066-1075` never turns it on for real readings, and the artwork is served from `/output/reading-motion/...`. There is no evaluation on generated readings and no device evidence.
- **Fit with your intent: partial.** It does not, in general, build the literal→interpretive connection automatically. Every interpretive return rule is a phrase copied verbatim from the three fixtures. For newly generated prose, what you get is a card arriving when named, a soft spotlight on a literally described noun, and a click-to-inspect tool. That is close to the "card glows when named" baseline you called insufficient.
- **Direction: keep the presentation layer, change the semantic source.** The state machine, visibility gating, hold/coalescing and artwork registry are worth continuing. The regex layer that decides which prose connects to which detail is not.

## 2. What I inspected and ran

- **Read:** `update.patch` in full and the relevant parts of `bridge.patch`. Source: the aligner, `narrativeGestureState.js`, `NarrativeCardFocus.jsx`, `SpreadCompanion.jsx`, `CardTouchArt.jsx`, `useCardGestureMotion.js`, the touch CSS, the fixture page, all three `cardGestureDetails/` files, `cardGestureArtwork.js`, `NarrativePanel.jsx`, the routes and the `TarotReading` call site. Also the three fixtures, the sidecar file, the manifest names, and the new/changed e2e specs.
- **Unit tests run:** `deckGestureExpansion`, `narrativePassageAlignment`, `narrativeGestureState`, `cardGestureArtwork`. All 49 pass. I did not run the e2e specs (only unit tests were permitted).
- **Probes:** 7 runs of `probe.mjs` with text I wrote myself: an independent Star paragraph, a near-paraphrase of the fixture, Temperance/Tower, Ten of Swords/Queen of Wands, figurative Hermit/Star phrasing, and realistic descriptions of five cards.
- **Captures:** 14 runs of `capture.mjs`, Chromium only:
  - Star at 1280 and 390 wide, with gentle, burst and complete arrival, with and without reduced motion.
  - Star with the authored sidecar.
  - Five-card with burst arrival.
  - Deck study: Nine of Wands (phone), Two of Swords and Temperance (desktop).
- **Helper limits:**
  - It never scrolls, so automatic choreography for prose below the fold, including all phone streaming, went unobserved.
  - Screenshots are full-page stills, not video.
  - The animation count covers the whole document.
  - Timing includes screenshot overhead.
  - Headless only; WebKit not run.
- **Not judged:** motion feel and easing, real screen-reader output, frame-rate or battery cost, and whether the other ~135 detail positions are accurate (I spot-checked 4).

## 3. Strengths I could see

- **Star choreography (observed):** desktop gentle arrival moved identity → `land-pour` (rivulets visible at about 3s) → `pool-pour` on "people back home" → both details. In the clean run it settled to `static` with no animations left running.
- **Reduced motion (observed):** zero animations running, and the detail state stays correct (`data-details` changes per cue).
- **Visibility gating (observed):** cues whose text was off-screen were held as pending rather than played. This matches "text arrival is not proof of gaze".
- **Coalescing (observed):** burst arrival jumped straight to the latest cue.
- **Precision on the new cards:** no false positives in my probes. Negation, "you/your" clauses and metaphor framing are all rejected.
- **Deck mapping:** 78 faces map to artwork by name and the card back is excluded (manifest plus test). Every face has bounded geometry.
- **Phone crops:** small details read clearly in the crop (the Nine of Wands bandage, the Star's pool). No page errors in any capture.

## 4. Findings

**P1 — The literal→interpretive connection is memorized from the fixtures, not general**
- **Where:** `src/lib/narrativePassageAligner.js:49-59` (return rules), `:216-224` (the "both your drive and your sensitivity" synthesis), `:136-158` and especially `:155`.
- **Observed (probe):**
  - An independent Star paragraph ("The pool holds what you carry from home… The land is where you are planting something new… both pitchers stay in her hands") produced zero interpretive cues.
  - Changing the fixture to "people back at home", "fresh ground" and "Neither pitcher is dropped" removed 3 of the 4 returns.
  - The 70 newly covered cards have no return rules at all. The line at `:155` drops any clause containing you/your/we/I. So sentences like "That black cat is your instinct" and "The ten swords are the accumulated exhaustion…" can never pick up the detail's visual treatment.
- **Impact:** your central "meaningful continuity" requirement works only on verbatim recorded text. The all-card claim holds for identity and literal spotlight, not for meaning built alongside the prose.
- **Origin:** both. The approach predates this update; `update.patch` added two more fixture phrases (`:50-51`) plus the synthesis rule, and expanded literal-only coverage to 70 cards.
- **Suggested direction:** see section 5.

**P2-1 — The completed Star reading can stay `active` with water animating indefinitely**
- **Where:** `NarrativeCardFocus.jsx:98-102` and `narrativeGestureState.js:107-110`, combined with the infinite water loops at `narrative-card-touch.css:463,465`.
- **Observed:**
  - With burst arrival, two consecutive Star runs held `balance-2-332` in `phase: active` with 17 animations running, still at 7.4s and at 20.4s.
  - With gentle arrival it happened intermittently: Star stuck in `settling` from 9.3s to at least 16.3s (water paused); Temperance stuck `active` from 2.6s to at least 5.1s.
  - Other runs settled correctly.
- **Inferred mechanism (not confirmed):** the tick timer is only re-armed when `phase`, `activeUntil` or `held` change. A tick that arrives and doesn't advance the phase therefore never retries. One plausible trigger is that `setTimeout` truncates its delay to whole milliseconds, so it can fire just before `activeUntil`.
- **Impact:** breaks "no settled animation loops" on the primary example. It stops only if the passage scrolls out of view.
- **Origin:** pre-existing; this code is untouched by `update.patch`.
- **Suggested direction:** re-arm the timer whenever a tick doesn't advance the phase (or allow a small tolerance), and add an e2e check that burst arrival reaches `static`.

**P2-2 — Evidence for the 70 new cards is circular, and recall on realistic prose is low**
- **Where:** `cardGestureDetails/*` (`*_EXAMPLES`), `tests/deckGestureExpansion.test.mjs:39-48`, `ReadingGesturesFixture.jsx:71-78`.
- **Observed:** the deck study and its tests use probe sentences written alongside the rules. My independent, realistic descriptions matched 3 of 10 authored details. "small dog", "raises a wand", "clutches a coin to his chest", "a woman and child" and "pouring water between two cups" were all missed.
- **Impact:** most real readings will mostly show identity-only cues.
- **Origin:** introduced in `update.patch`.
- **Suggested direction:** evaluate against generated readings, not probes.

**P2-3 — Question and reflection connections never occur in dynamic mode**
- **Where:** the aligner never emits `personalContext`. Only authored sidecars do, and it is displayed at `SpreadCompanion.jsx:151,174`.
- **Observed:** with the authored sidecar, holding "people back home" shows "nostalgic" from the reflection. In dynamic mode, nothing is shown.
- **Origin:** pre-existing gap in scope.

**P3-1 — Inconsistent rules between the original 8 cards and the new 70**
- **Where:** `narrativePassageAligner.js:28-44` and `:234-237,252`.
- **Observed (probe):** "Let your own lantern light…" and "pouring energy into a pool of other people's needs" are classified as `literal` depictions for the original cards. The new cards block equivalent constructions.
- **Origin:** this inconsistency was introduced by `update.patch`.

**P3-2 — Weak desktop treatment for cards without motion**
- **Where:** `narrative-card-touch.css:487` (cropping only applies at 1023px wide or less) and `:460`.
- **Observed:** on the full desktop card, Two of Swords shows pale haze blobs. In reduced motion, the pool and land states differ only through a faint vignette. The e2e test that is supposed to check this passes with an average pixel difference above 2/255 (`reading-gestures-refinement.spec.js:152`).
- **Origin:** partly introduced (the surround layer is new).

**P3-3 — Prose turns into many dotted-underline buttons**
- **Observed:** about 25 dotted-underline targets across the five-card reading (`narrative-card-touch.css:469-470`), and every card-name mention is a target (`aligner:226`). This works against your "fewer buttons" goal.
- **Origin:** pre-existing.

**P3-4 — Card-specific branch in a shared renderer**
- **Where:** `SpreadCompanion.jsx:136` hard-codes an exception for The Star.
- **Origin:** pre-existing.

## 5. Alternative direction and next experiment

The packet already has the right pipe: the sidecar path, with its validator (`shared/contracts/readingPassageAssociations.js`) that checks quotes against the text and supports `personalContext`. Have the model that writes the reading also emit these associations against the authored detail IDs, including interpretive returns and question/reflection links. Keep the regex aligner only as a conservative fallback for literal descriptions.

**Most useful next experiment:** generate 15–20 fresh readings across varied spreads and orientations, each with a generated sidecar, and run them through the existing validator. Compare against the regex aligner on the same text, measuring:
- cards with at least one literal cue;
- literal details that get a valid later interpretive return;
- human-judged false or forced links.

Fix P2-1 before showing it to anyone.

## 6. Remaining uncertainties

- **All-card identity:** well supported (manifest name mapping, reducer test covering 78 cards in both orientations). I visually saw 9 faces, not all 78 loading.
- **Authored detail coverage:** every face has 1–2 details with bounded geometry. I confirmed placement for only 4 details.
- **Coverage on real generated readings:** low on my independent probes; there are no recorded generated readings with the new cards in the packet.
- **Motion coverage:** only The Star (water) and Ace of Wands, Seven of Swords and Wheel of Fortune (a one-off line trace) have real motion. The 70 new cards get a 550ms fade-in, a static spotlight, and on phones a crop. I saw stills only; timing feel isn't judged.
- **Physical devices:** none. Headless Chromium only. Phone choreography during streaming wasn't observed because the helper doesn't scroll. The sticky companion takes roughly 213px of an 844px phone screen.
- **Performance:** the full Markdown text is re-parsed on every streamed chunk (`NarrativeCardFocus.jsx:45-62`). I didn't measure the cost.
