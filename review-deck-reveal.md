**Findings**
- Minor: The deck remains focusable/clickable even when `cardsRemaining === 0`; `handleDealWithAnimation` no-ops, but `aria-disabled` only tracks `isDeckPrimary`, so users can still “tap” a dead deck. Consider disabling/hiding the deck (or updating `aria-disabled`) when empty. `src/components/DeckRitual.jsx:332-337` `src/components/DeckRitual.jsx:560-631`
- Minor: Ritual gating is handset-only; on desktop `revealStage` resolves to `action`, so users can bypass the deck ritual by revealing from the board. If ritual enforcement is intended cross-device, extend the gating. `src/components/ReadingDisplay.jsx:327-332` `src/components/ReadingBoard.jsx:437-510`
- Minor: No explicit tests found for deck→spread transition, ghost animation, or ritual sequencing. Consider one e2e path to lock this flow. (No matches in `tests/` or `e2e/` for DeckRitual/ReadingBoard/ghost.)
- Observation: `AmberStarfield` and `GlowToggle` aren’t wired into the reveal flow; immersion shifts are currently handled by deck/spread surfaces only. `src/components/AmberStarfield.jsx` `src/components/GlowToggle.jsx`

**Open Questions / Assumptions**
- Is ritual gating intentionally handset-only, or should deck-first staging apply on desktop as well?

**The Stage & Atmosphere**
- `ReadingBoard` is the orchestration hub: it computes next reveal, passes state to `SpreadTable`, renders the map overlay (Celtic Cross on handset), and conditionally shows the detail panel vs. focus sheet. `src/components/ReadingBoard.jsx:413-520`
- The deck→spread handoff is explicitly staged: `allowBoardReveal` is tied to `revealStage`, and a micro-flash highlights the next slot when moving from `deck` to `spread`. `src/components/ReadingBoard.jsx:437-470`
- `DeckRitual` establishes the pre‑reveal mood: stacked cards, idle breathing on the top card, ritual status chips (knock/cut), haptic pulses, and ripple effects drive the “ceremony” before the draw. `src/components/DeckRitual.jsx:214-337` `src/components/DeckRitual.jsx:364-515`
- `AmberStarfield` is a static glow overlay and `GlowToggle` is a generic preference control, so there’s no reveal-stage lighting change here yet. `src/components/AmberStarfield.jsx` `src/components/GlowToggle.jsx` `src/components/ExperienceSettings.jsx:90-176`

**The Draw Mechanism (Animation & Interaction)**
- `DeckPile` (legacy) uses animejs springs for hover/press feedback and `useAnimeScope` for cleanup. It’s a single tap target that triggers `onDraw`. `src/components/DeckPile.jsx:45-160` `src/hooks/useAnimeScope.js:1-14`
- `DeckRitual` encodes the gesture grammar: tap = knock/draw, double‑tap = shuffle, long‑press = cut; when the board is primary it blocks draws and toasts a board hint to keep the flow intact. `src/components/DeckRitual.jsx:393-452`
- `useAnimatePresence` controls the cut slider’s mount/unmount to preserve exit animation and avoid layout popping. `src/components/DeckRitual.jsx:52-109` `src/hooks/useAnimatePresence.js:1-28`
- Deck→spread “physics” are DOM‑based: `handleAnimatedDeal` measures deck and target slot rects, then GhostCard animates `x/y` + scale with a custom ease curve. `src/components/ReadingDisplay.jsx:460-500` `src/components/ReadingDisplay.jsx:41-114`
- Final card coordinates are percent‑based (`SPREAD_LAYOUTS`) with responsive card sizing and Celtic offset tuning; `useHandsetLayout` only affects sizing/staging, not the actual coordinate math. `src/components/SpreadTable.jsx:404-553` `src/hooks/useHandsetLayout.js:1-52` `src/components/ReadingBoard.jsx:432-449`

**The Card Component & State**
- `Card` separates logical reveal (`isRevealed`) from visual reveal (`isVisuallyRevealed`), running a three‑phase flip (blur/rotate → content swap → settle) and enabling swipe‑to‑reveal on touch. Reversal is handled by a 180° rotation. `src/components/Card.jsx:170-502` `src/components/Card.jsx:512-700`
- `InteractiveCardOverlay` is post‑reveal enrichment (symbol hotspots + portal tooltips), not the reveal trigger. `src/components/InteractiveCardOverlay.jsx:1-220`
- `useTarotState` is the core state machine: `revealedCards` Set is the source of truth, `dealNext` reveals the next available slot, `revealCard` is idempotent, and `revealAll` batch‑reveals. Ritual steps (knock/cut) are tracked/reset on shuffle. `src/hooks/useTarotState.js:200-312` `src/hooks/useTarotState.js:264-305`
- `ReadingContext` exposes this state to `ReadingDisplay`, which drives deck/spread gating and card focus/modal behavior. `src/contexts/ReadingContext.jsx:40-120`

**Alternative Reveal Paths (Camera)**
- Camera flow: `CameraCapture` creates an image file with a vision id/label, then `VisionValidationPanel` pipes it into `useVisionValidation` for CLIP analysis and returns results to context via `handleVisionResults`. `src/components/CameraCapture.jsx:49-70` `src/components/VisionValidationPanel.jsx:30-106` `src/hooks/useVisionValidation.js:20-98` `src/components/ReadingDisplay.jsx:679-687`
- This path is validation/telemetry only; the revealed card visuals in `CardModal` still come from the reading’s card data via `getCardImage`, not from the camera image. `src/components/CardModal.jsx:1-120` `src/contexts/ReadingContext.jsx:880-940`
- Transition to the modal remains a normal card click from the spread, so camera use doesn’t alter reveal mechanics—only confidence/conflict reporting. `src/components/ReadingDisplay.jsx:502-540`

**Performance & Flow Safeguards**
- Performance: `useReducedMotion` gates heavy animations; initial transforms are set in `useLayoutEffect` to avoid flicker; animejs `createLayout`/`createTimeline` prevent layout thrash; `ResizeObserver` keeps card sizing responsive; `willChange` is applied to animating elements. `src/components/DeckRitual.jsx:214-337` `src/components/SpreadTable.jsx:490-540` `src/components/ReadingDisplay.jsx:41-114`
- Flow safeguards: `revealStage` gates deck vs. board, `handleDeckTap` blocks out‑of‑stage draws, and `dealNext`/`revealCard` are idempotent, so users can’t reveal the same card twice or skip the ritual sequence on handset. `src/components/ReadingDisplay.jsx:327-332` `src/components/DeckRitual.jsx:393-452` `src/hooks/useTarotState.js:264-305`
