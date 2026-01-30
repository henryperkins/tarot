# Mobile Action Bar UX Review

Reviewed `src/components/MobileActionBar.jsx` (mode logic + labels), `src/TarotReading.jsx` (state derivation + step labels), `src/hooks/useKeyboardOffset.js` (visualViewport), and `src/styles/tarot.css` (landscape + bar styling).

## 1) State Table

| Mode | Primary Action | Secondary Actions | Label Text | User Mental Model |
| --- | --- | --- | --- | --- |
| Shuffling | Disabled primary button | None | “Shuffling…” (spinner); Step badge shown when not landscape | “System is shuffling/dealing; wait.” |
| Preparation | Shuffle & draw | Settings (gear), Coach (sparkle) when `showUtilityButtons` | “Shuffle & draw” (landscape: “Shuffle”); Step badge Step 1–4 when not landscape | “Set up my intention/ritual, then start.” |
| Revealing | Next card | Reveal all (if >1 card, not deck‑focus) | “Draw next (x/n)” when deck focus, “Reveal next (x/n)” when spread focus; landscape: “x/n”. “Reveal instantly” (landscape: “All”). Step badge shown when not landscape | “Reveal cards one by one (or all at once).” |
| Ready‑for‑narrative | Create narrative | New reading | “Create narrative” (landscape: “Create”); Step badge when not landscape | “All cards revealed; generate the narrative.” |
| Generating | Disabled primary | New reading | “Weaving…” (landscape: “Weaving”); Step badge when not landscape | “Narrative is generating; I can wait or start over.” |
| Error | Retry narrative | New reading | “Retry narrative” (landscape: “Retry”); Step badge when not landscape | “Generation failed; try again or reset.” |
| Completed | Save reading (only if narrative exists) | Chat (if follow‑up available), New reading | “Save reading” (landscape: “Save”), “Chat”, “New reading” (landscape: “New”). Step badge only when Save button appears | “Reading done; save, chat, or start a new one.” |

## 2) Five Improvements (Incremental)

1) Keep the primary emphasis consistent in Revealing: don’t downgrade the “Next” button to `secondary` when `revealFocus` is `deck`/`spread`. Keep primary styling and use the label to communicate context (“Draw next” vs “Reveal next”).
2) Make landscape labels explicit: replace single‑word or numeric‑only labels with compact verbs (e.g., “Next 2/7”, “New read”, “Create story”, “Reveal all”). Step labels are hidden in landscape, so the label itself needs to carry intent.
3) Adjust step badge timing for reading states: once a reading exists, `activeStep` locks to `reading` (Step 4) even while still revealing. Consider mode‑based badges (“Reveal”, “Narrate”) or hide the step badge after the draw begins, so the badge doesn’t imply completion too early.
4) Stabilize landscape sizing: current `flex-wrap` + varying `min-w` values cause row breaks when action count changes (e.g., when “Reveal all” or “Chat” appears). In landscape, switch to a fixed grid or `flex-nowrap` with `min-w-touch` + smaller text to keep the bar height stable across modes.
5) Tune keyboard avoidance: `useKeyboardOffset` ignores offsets under 120px, which can leave the bar overlapping compact or split keyboards. Lower the threshold or make it proportional to viewport height, and align the transition duration with the keyboard animation (≈250–300ms) to avoid snap/jump.

## 3) Accessibility Checks

- **ARIA integrity**: verify `aria-controls` targets exist and are stable (`#mobile-settings-drawer`, `#guided-intention-coach`, `#mobile-followup-drawer`), and `aria-expanded` mirrors open state. Confirm action labels remain meaningful when step badges are hidden (landscape).
- **Disabled state communication**: disabled buttons use `disabled` and visible “Shuffling…” / “Weaving…”. Ensure this is also conveyed to screen readers (optionally `aria-busy="true"` on the nav or status region).
- **Touch targets**: confirm all buttons maintain at least 44px (`min-h-touch`/`min-w-touch`). In landscape, `min-w-[3rem]` is 48px so OK, but validate icon buttons and dense layouts still meet 44px with safe spacing.

## 4) Gotcha Scenarios to Test

- **Rotation mid‑generation**: start narrative generation, rotate to landscape mid‑stream. Verify the action bar doesn’t wrap/reflow into two rows, labels remain legible, and keyboard offset/transition doesn’t jump.
- **Keyboard open during follow‑up chat**: open follow‑up drawer, focus input to show keyboard. Ensure the input is not covered, bar remains hidden, and `visualViewport` updates don’t cause flicker or padding jumps.
- **Reveal‑all edge case on slow network**: tap “Reveal instantly” with simulated latency. Confirm the mode transitions cleanly to “Create narrative”, “Weaving…”, and that “Reveal all” disappears promptly without leaving ambiguous or stale labels.
