1) Executive Summary (Top 5 interaction fixes)
- Make knock cadence tolerant and visible; allow slow 3-tap rhythms without silently expiring.
- Gate the double-tap shuffle so it can’t fire before cut/ritual are locked; avoid accidental skips.
- Lock or queue deals during the 350ms ghost animation so rapid taps don’t “eat” taps.
- Respect reduced-motion preference on minimap/spinners; swap to static or fade states.
- Surface “reveal all” on mobile as soon as a reading exists (with a confirm), not only after first draw.

2) Interaction timeline critique (step-by-step)
- Spread selection: Carousel is clear; step indicator correctly holds state. No major ritual issues here.
- Question entry: Guided copy and quick-intention chip work; ritual readiness not previewed here (ok).
- Optional ritual (before dealing): Knock/cut badges are helpful, but the 3-knock window silently expires after ~2s; double-tap shares knock/shuffle, so a fast double tap can skip the cut.
- Shuffle/deal: Spinner overlay gives feedback, but rapid taps during the deck→slot fly animation can cancel the deal; mobile action bar hides “reveal all” until after first draw.
- Reveal card(s): Card flip timing feels right, but reduced-motion users still see pulsing minimap/spinner; reveal-all affordance is desktop-first.
- Reveal all → Generate reading: Desktop has “Reveal instantly”; mobile flow buries it, risking extra taps before narrative generation.

3) Detailed Findings & Fixes (table)

| ID    | Location (screen + component) | Issue | Why it matters | Severity | Fix (timing guidance) | Effort | Edge cases |
|-------|--------------------------------|-------|----------------|----------|-----------------------|--------|------------|
| RIT-1 | Ritual knocks (DeckRitual, `src/components/DeckRitual.jsx:102-132`; cadence logic `src/hooks/useTarotState.js:92-105`) | Knock count expires after ~2s with no cue; slow, intentional taps never reach 3/3. | First-time users get stuck at 1–2/3, feel the ritual is broken. | Med-High | Either remove the 2s expiry or show “3 quick taps” with a visible countdown; keep knocks sticky for 6s. Add a 180–240ms pulse + haptic after each tap so progress feels logged. | Low-Med | Slow devices/landscape where taps are spaced out; reduced-motion users should see a static count change instead of ripple. |
| RIT-2 | Shuffle gesture (DeckRitual, `src/components/DeckRitual.jsx:102-132`) | Double-tap triggers shuffle as soon as knocks are done, even if cut isn’t locked; same gesture is used for knock/draw/shuffle. | Easy to skip the cut and break the ritual’s meaning; feels jumpy/accidental. | High | Gate double-tap-to-shuffle until `hasCut` (or show an on-screen toggle). Add a 400–600ms lockout after the final knock before enabling shuffle. Copy hint: “Tap to finish knocks, then press Shuffle” (button) or “Double-tap to shuffle” only after cut badge is green. | Med | Small-height phones where buttons wrap; ensure keyboard focus/Enter key uses the same gating. |
| RIT-3 | Dealing feedback (deck→slot fly, `src/components/ReadingDisplay.jsx:372-411`) | Rapid taps while the 350ms ghost animation runs replace the animation and drop the deal; UI looks frozen. | Perceived lag and mistrust during the most tactile moment. | Med | Disable deck/draw buttons during the 350–450ms flight or queue taps. Show a brief “Dealing…” state on the button and keep haptic at completion. | Low-Med | Landscape and slow GPUs; ensure reduced-motion path still blocks repeat taps while instantly dealing. |
| RIT-4 | Reduced motion (spread minimap + shuffling spinner, `src/components/DeckRitual.jsx:150-158`, `src/components/DeckRitual.jsx:520-573`) | Minimap pulses and spinner rotations run even when `prefersReducedMotion` is true. | Accessibility regression; motion-sensitive users still see looping animations. | Med | When reduced-motion: freeze minimap markers (no pulse), swap spinner for a fade-in “Shuffling…” label. Use a single 120–180ms opacity change instead of loops. | Low | Very small screens: ensure static markers remain legible; dark mode contrast. |
| RIT-5 | Reveal-all affordance on mobile (action bar, `src/components/MobileActionBar.jsx:300-347`) | “Reveal instantly” is hidden until after the first card is drawn; no reveal-all near the board on mobile. | Users who want to skip staged reveals have to guess to draw first; adds taps and uncertainty. | Med | Surface a reveal-all control as soon as a reading exists (even before first draw) with a confirm sheet. Sequential reveal: 180–220ms per card; offer “Instant” when reduced-motion is on. | Low-Med | Small-height/landscape: keep the button visible above the fold; slow devices shouldn’t stutter during sequential reveals. |

4) QA checklist for regression testing
- Knocking: three taps spaced 3–5s apart still reach 3/3; badge and haptic fire every tap; reduced-motion mode shows no ripple.
- Double-tap: cannot trigger shuffle until cut is locked (or the shuffle button is used); double-tapping after knocks but before cut does nothing.
- Dealing: rapid double/treble taps during the deck→slot animation still result in exactly one dealt card and no frozen state.
- Reduced motion: enabling OS “Reduce motion” removes minimap pulses and replaces the shuffle spinner with a static/fade label; flips use instant or ≤120ms fades.
- Reveal-all: mobile shows a reveal-all option immediately after shuffle; confirmation works; sequential timing stays within 180–220ms per card and instant in reduced-motion.
- Skip & draw: skip-ritual path still shuffles correctly, respects question/cut defaults, and doesn’t regress the step indicator.
