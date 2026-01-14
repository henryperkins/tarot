### A. Executive Summary (Top 5 Recommendations)
- **Issue/Opportunity:** Spread choice “commits” immediately (selection triggers confirmation), which reduces safe exploration. **Recommended Fix:** Split “Preview” vs “Use this spread” (primary CTA), and show a quick “Positions” peek (chips) before committing. **Expected Impact:** Higher confidence + curiosity; fewer accidental selections; smoother ritual ramp.
- **Issue/Opportunity:** Position meaning is hard to parse on the board (legend overlays the board; Celtic Cross hides legend on handset; face-down cards don’t show position labels). **Recommended Fix:** Move the legend out of the board (below as a collapsible “Positions” tray), and add a lightweight “Map” toggle for Celtic Cross. **Expected Impact:** Faster comprehension; fewer mis-taps; users feel “guided” rather than lost.
- **Issue/Opportunity:** Card reveal on the board is a content swap (no satisfying flip), so the moment of revelation feels flatter than the theme. **Recommended Fix:** Add an in-place flip/ink-reveal animation (~420ms total: 0→90° 200ms, swap, 90→0° 220ms; ease-out), synchronized to audio/haptic at mid-flip. **Expected Impact:** More delight + ritual gravity; higher reveal completion.
- **Issue/Opportunity:** “Reveal all” is instantaneous, making the reading feel like a batch action (transactional). **Recommended Fix:** Offer “Reveal all (guided)” that reveals sequentially (350–450ms/card) with a visible “Skip animation” control; keep instant reveal as secondary. **Expected Impact:** Better pacing + anticipation; preserves agency for power users.
- **Issue/Opportunity:** Post-reveal exploration on mobile is stop/start (detail sheet blocks the board; no next/prev). **Recommended Fix:** Add next/prev (and swipe) navigation inside the card detail sheet + modal, with “x of n” and position label persistent. **Expected Impact:** Easier comparison across positions; deeper engagement; less cognitive reset.

---

### B. Strengths to Preserve
- Spread selection cards have strong information scent already (layout preview + card count + complexity stars + “Recommended/Locked” states).
- Board clearly differentiates unrevealed vs revealed (cardback + prompt vs face + suit glow), supporting intuitive scanning.
- Ritual layer is directionally strong: shuffle feedback, audio cue on flip, and optional “reveal in order vs intuition” framing.
- Post-reveal hierarchy is sensible: quick glance in sheet/panel → “Open full card” for deep reading.

---

### C. Detailed Findings Table

| ID | Location | Issue | Why It Matters | Severity | Suggested Fix | Effort |
|----|----------|-------|----------------|----------|---------------|--------|
| SR-1 | Spread Selection – selection behavior | Tap selects *and* confirms immediately, limiting “browse safely.” | User control + confidence (progressive disclosure). | Med | Separate “Select for preview” from “Use this spread” CTA; only confirm on CTA. | Med |
| SR-2 | Spread Selection – info scent | Layout previews don’t expose position meanings until later. | Predictability; reduces “what am I choosing?” anxiety. | Med | Add “Positions” peek (chips from spread `positions[]`, truncated with “+N more”). | Low |
| BL-1 | Board – position legend | Legend is absolutely positioned inside the board; likely occludes bottom positions (e.g., y≈80%). | Tap accuracy + comprehension (Fitts’s Law, spatial mapping). | High | Move legend below board (collapsible tray), or reserve bottom safe zone and shift layout up when legend is visible. | Med |
| BL-2 | Board – Celtic Cross on handset | Legend is hidden, and position labels aren’t visible on face-down cards—only numeric badges remain. | Celtic Cross is already cognitively heavy; this increases confusion. | High | Add “Map” toggle: mini overlay showing numbered layout + labels (or bottom sheet legend). | Med |
| BL-3 | Board – auto scroll | Board calls `scrollIntoView` on each next index; can cause unexpected page movement while revealing. | Breaks ritual flow; feels like the UI is “pulling” the user. | Med | Only scroll when next slot is off-screen (intersection check), or only when using “Reveal next” CTA. | Low |
| DR-1 | Dealing/reveal – deck→board relationship | Reveal is not spatially connected to the deck (no “card travels” moment). | Ritual payoff + perceived physicality. | Med | Add a “ghost card” fly-to-slot (450–600ms) then flip-in-place; reduced-motion uses fade + glow only. | High |
| RV-1 | Reveal interaction – in-place animation | Board reveal is a hard swap (no flip/ink reveal). | The core “reveal” moment should be the peak. | High | Add 3D flip (~420ms) or ink-bloom (blur+scale) reveal; sync flip sound at 50%. | Med |
| RV-2 | Reveal affordance density | “Tap to reveal” pill appears on *every* unrevealed card. | Visual clutter, especially on large spreads; competes with mystique. | Med | Show the pill only on the “Next” card (plus first-time hint); others use subtle glow ring. | Low |
| RV-3 | Reveal all pacing | “Reveal all” flips everything instantly. | Collapses suspense; feels transactional. | Med | “Guided reveal all” sequential reveal with skip/fast-forward; keep instant as secondary. | Med |
| DR-2 | Progress/minimap (Deck ritual variant) | Minimap logic treats “card exists” as “revealed,” which can show all revealed prematurely. | Misleading progress + potential spoilers → trust hit. | High | Drive minimap from `revealedCards` (or an explicit revealed mask), not card presence. | Low |
| EX-1 | Post-reveal – mobile detail sheet | Detail sheet blocks board and has no next/prev navigation. | Comparative reading becomes high-friction. | High | Add next/prev + swipe inside sheet; keep sheet open while switching cards; show “x/n”. | Med |
| EX-2 | Post-reveal – full card modal | Modal has no in-modal next/prev; requires close→reselect loop. | Same friction at the “deep read” level. | Med | Add edge arrows + swipe navigation (revealed-only by default). | Med |
| EX-3 | Post-reveal – meaning truncation | Detail panel clamps meaning to ~4 lines, forcing “Open full card” for basic reading. | Extra taps break flow; users lose spread context. | Low–Med | Add “Expand meaning” inline in the sheet/panel; keep “Open full card” for imagery + symbols. | Low |

---

### D. Prioritized Fixes

**Now (High impact, low effort)**
- Fix progress indicators to reflect revealed vs unrevealed (especially minimap logic in deck ritual variant).
- Reduce “Tap to reveal” pill density: show it only on the next card + first-time hint; use subtle glow elsewhere.
- Stop auto-scrolling unless the next card is actually off-screen.

**Next (High impact, higher effort)**
- Move legend out of the board into a non-occluding “Positions” tray; add a Celtic Cross “Map” overlay.
- Add in-place flip/ink reveal (and sync flip audio/haptic to the visual moment).
- Add next/prev + swipe navigation inside the mobile detail sheet and full card modal.

**Later (Polish & delight)**
- Add a deck→slot “ghost deal” animation to strengthen physicality.
- Add “Guided reveal all” with pacing controls (skip/fast-forward) and subtle ambient accents (glow/particles) that don’t distract.

---

### Key Questions (Direct Answers)
- **Spread selection confidence/curiosity:** Mostly yes (strong previews), but improves significantly with preview-before-commit + position peek.
- **Board layout understandable:** For small spreads yes; for Celtic Cross on phones, not immediately—needs a map/legend solution.
- **Dealing builds anticipation:** Audio/haptics help; adding spatial deck→slot motion would elevate the ritual.
- **Reveal intuitive/satisfying:** Intuitive (clear tap affordance), but satisfaction is limited by the lack of a visual flip.
- **Examine cards without losing context:** Partially—mobile needs in-sheet/modal navigation to avoid constant closing.
- **Ritual vs transaction:** The bones are ritualistic; “Reveal all” and abrupt swaps are the main “transaction” leaks.
