# Tarot Dealing And Reveal UX Remediation Plan (2026-06-22)

Type: plan
Status: active background document
Last reviewed: 2026-06-22

## Scope

This plan remediates the Tarot Card Stack / Dealing / Reveal UX issues identified in the review of the default-on `newDeckInterface` flow.

It covers these defects and the shared architecture that caused them:

1. Ritual gating can be bypassed from primary deck and mobile action CTAs.
2. Shuffle clears ritual state before the draw fully uses it.
3. The first deck-to-slot animation cannot run because the spread target is not mounted yet.
4. Skip-ritual behavior can regress across repeated readings.
5. Ritual cut controls do not reflect the active deck size.
6. In-flight ghost deals can leak across reset and reopen cards unexpectedly.

## Goals

- Make the dealing flow obey one clear product contract on handset and desktop.
- Ensure every reveal entry point uses the same gating and state transitions.
- Preserve ritual inputs through shuffle so the reading actually reflects the ritual the user performed.
- Restore the intended cinematic first-deal animation.
- Keep the ritual UI synchronized with the actual deck configuration.
- Add regression coverage for the full stack, dealing, reveal, and reset path.

## Non-goals

- No redesign of the visual art direction, theme, or deck aesthetics.
- No changes to reading interpretation logic beyond ritual-state correctness.
- No broad rewrite of scene orchestration outside the deal/reveal flow.

## Target UX Contract

### 1. Ritual-enabled flow

1. The user selects a spread and optional question.
2. The user may complete the ritual before the first deal.
3. Until the ritual is satisfied, primary deck and mobile actions must not reveal cards.
4. Once the ritual is satisfied, the first action deals from the deck into the first spread slot.
5. After the first deal, the user can continue revealing card-by-card from the board or use explicit alternative actions that obey the same sequencing.

### 2. Ritual-skipped flow

1. If personalization disables ritual, the app must treat every new reading as pre-satisfied.
2. Ritual instructions, gating copy, and ritual-only blockers must disappear from the active dealing path.
3. Shuffle must still create a deterministic ritual snapshot for seed generation, but this must be internal and invisible to the user.

### 3. Shared interaction rules

1. The deck UI, quick-draw CTA, mobile action bar, and any keyboard shortcuts must all call the same command layer.
2. The spread must have mounted slot targets before the first animated deal begins.
3. Reset, new reading, spread change, deck-scope change, and reduced-motion mode must all produce deterministic, cancel-safe behavior.

## Solution Overview

The complete fix is to move the deal/reveal path to one canonical state and command model instead of letting each component call raw low-level helpers such as `dealNext()` directly.

The implementation should introduce:

1. A canonical deal session model in shared state.
2. A command layer that every CTA uses.
3. A stable ritual snapshot that survives shuffle.
4. A mounted spread target surface during the first deck animation.
5. A cancel-safe animation lifecycle for reset and restart actions.

## Workstream A: Normalize The Deal Session State Model

### A1. Add canonical derived state in shared reading state

Implement a single source of truth in `useTarotState` or `ReadingContext` for the deal flow, with selectors exposed to consumers instead of ad hoc local branching.

Add derived values such as:

1. `ritualMode`: `required` or `skipped`.
2. `ritualSatisfied`: whether the current reading is allowed to start dealing.
3. `dealStage`: `ritual`, `deck`, `spread`, `ready-for-narrative`, or `complete`.
4. `nextRevealIndex`: the next unrevealed visible slot.
5. `canDealFromDeck`.
6. `canRevealOnBoard`.
7. `canRevealAll`.

This removes duplicated logic currently spread across `TarotReading.jsx`, `ReadingDisplay.jsx`, `DeckRitual.jsx`, `ReadingBoard.jsx`, and `MobileActionBar.jsx`.

### A2. Replace direct low-level actions with a command layer

Expose higher-level commands from shared state or `ReadingDisplay`:

1. `attemptPrimaryDealAction()`.
2. `attemptRevealNextAction()`.
3. `attemptRevealAllAction()`.
4. `resetRevealProgress()`.
5. `startNewReading()`.

Rules for these commands:

1. They must enforce ritual gating.
2. They must respect `dealStage`.
3. They must no-op safely if the command is not valid for the current state.
4. They must be the only actions passed into deck CTAs, the mobile action bar, and keyboard handlers.

### A3. Update all consumers to use the command layer

Replace raw calls to `dealNext`, `revealAll`, and similar direct actions where they are user-facing.

Primary components to update:

1. `src/components/DeckRitual.jsx`
2. `src/components/MobileActionBar.jsx`
3. `src/TarotReading.jsx`
4. `src/components/scenes/RitualScene.jsx`
5. `src/components/scenes/RevealScene.jsx`

## Workstream B: Preserve Ritual Inputs Through Shuffle

### B1. Split reading resets from ritual resets

Replace the current `resetReadingState()` behavior with explicit reset helpers.

Recommended split:

1. `resetReadingProgress()` clears reading output state only.
2. `resetRitualProgress()` clears knock, cut, cadence, and ritual-specific input state.
3. `resetSessionForNewReading()` composes both when the user explicitly starts over.

### B2. Snapshot ritual data before shuffle mutates anything

At the start of shuffle, capture a stable `ritualSnapshot` that includes:

1. `knockTimes`
2. `knockCount`
3. `cutIndex`
4. `userQuestion`
5. `deckSize`
6. Whether ritual was explicit or auto-satisfied

Use that snapshot for:

1. seed computation,
2. shuffle behavior,
3. optional reading metadata for observability.

The shuffle path must not clear ritual inputs until the new reading session has been fully initialized or the user explicitly starts another reading.

### B3. Make ritual completion durable for the current reading session

Once a reading is shuffled successfully:

1. the reading should remember whether ritual was completed or skipped,
2. the current session should not fall back into ritual-required mode mid-flow,
3. the prep UI should not imply the ritual still needs to be done for the already-started reading.

## Workstream C: Enforce Gating And Align UX Copy

### C1. Block reveal actions until ritual is satisfied

Update all reveal-capable controls so they cannot bypass ritual requirements.

Behavior requirements:

1. During `dealStage === ritual`, primary reveal actions should either be disabled or route the user back to the ritual completion step.
2. Quick-draw buttons in `DeckRitual` must not call deal logic before ritual satisfaction.
3. The mobile action bar must not call `dealNext` directly during the deck stage.

### C2. Make alternative actions explicit instead of accidental bypasses

If the product keeps alternative reveal actions outside the deck itself, they must be framed as explicit accessible alternatives, not silent bypasses.

Examples:

1. `Reveal next` is allowed only when the state machine says reveal is valid.
2. `Reveal instantly` is allowed only after the reading has actually entered reveal stage.
3. Keyboard shortcuts must share the same restrictions.

### C3. Rewrite helper copy to match the actual flow

Update copy in these areas so the language matches the behavior after the fix:

1. `ReadingPreparation`
2. `DeckRitual`
3. mobile action labels
4. scene titles and helper text

Copy rules:

1. If ritual is required, say so clearly.
2. If ritual is optional or skipped by preference, say that clearly.
3. Do not tell the user to complete ritual steps if the app will already let them reveal.

## Workstream D: Make The First Deck-To-Slot Animation Real

### D1. Mount spread targets before the first animated deal

The first deck animation currently fails because the destination slot is not present in the DOM.

The recommended fix is to keep the spread target surface mounted during the ritual/deck stage on the handset `newDeckInterface` path.

Implementation direction:

1. Render a spread skeleton or `ReadingBoard` target surface in `RitualScene` while the deck is still primary.
2. Reuse the same slot ids and layout nodes that `ReadingDisplay` and `SpreadTable` already target.
3. Keep board reveals disabled until the stage changes, but keep the slot geometry mounted.

This avoids inventing a separate hidden coordinate system and keeps the animation target source-of-truth identical to the visible spread.

### D2. Preserve the intended deck-to-board handoff

After the first card is dealt:

1. the scene transition should preserve continuity,
2. the slot flash cue should trigger on the true next slot,
3. the board should already be aligned with the animation destination used by the ghost card.

### D3. Keep reduced-motion behavior simple

When reduced motion is enabled:

1. skip the ghost animation,
2. reveal the correct target card immediately,
3. keep stage and focus behavior identical to the animated path.

## Workstream E: Fix Skip-Ritual Determinism

### E1. Remove stale-state dependence from auto-complete logic

The skip-ritual path must depend on the preference itself, not on the previous reading's `hasKnocked` value.

Implementation rule:

1. auto-satisfied ritual state is derived from `shouldSkipRitual`,
2. not from prior in-memory ritual progress.

### E2. Reapply skip behavior on every new reading session

For every new reading when ritual is disabled:

1. synthesize a deterministic ritual snapshot,
2. mark the ritual as satisfied,
3. skip ritual-only instructional UI,
4. move directly into a valid deck deal stage.

### E3. Add regression protection for repeated readings

Test repeated sequences of:

1. shuffle,
2. reveal,
3. new reading,
4. shuffle again,

to ensure skip-ritual never regresses into ritual-required mode.

## Workstream F: Sync Ritual Controls With Actual Deck Size

### F1. Pass real deck size through the ritual scene

Replace hard-coded `78` deck values with the active deck size from preferences or reading state.

Impacted path:

1. `PreferencesContext`
2. `TarotReading`
3. `ReadingDisplay`
4. `RitualScene`
5. `DeckRitual`

### F2. Clamp cut state when deck scope changes

When the user switches between majors-only and full deck:

1. the cut slider range must update immediately,
2. `cutIndex` must clamp into the new valid range,
3. the aria labels and visible copy must reference the active deck size.

### F3. Verify majors-only end to end

Run the majors-only path through:

1. ritual entry,
2. cut adjustment,
3. shuffle,
4. reveal,

to ensure the stack and the actual draw model stay aligned.

## Workstream G: Make Reset And Animation Lifecycles Cancel-Safe

### G1. Track the intended ghost target explicitly

The ghost animation should finish by revealing the card it was launched for, not by calling a generic `dealNext()`.

Store a stable payload for each in-flight animation:

1. target slot index,
2. reading identity,
3. animation generation token.

### G2. Cancel in-flight animations on all reset boundaries

Reset or invalidate the ghost animation when any of these happen:

1. reset reveals,
2. new reading,
3. spread change,
4. deck-scope change,
5. reading identity change.

If the animation completes after invalidation, completion must no-op.

### G3. Prevent stale completion from reopening cards

Update `handleGhostComplete()` so it:

1. confirms the animation still belongs to the active reading identity,
2. reveals the intended target index directly,
3. does nothing if the request is stale.

## File-Level Implementation Map

### State and orchestration

1. `src/hooks/useTarotState.js`
2. `src/contexts/ReadingContext.jsx`
3. `src/hooks/useSceneOrchestrator.js` only if scene derivation must recognize the refined deal stages

### Deal and reveal UI

1. `src/components/ReadingDisplay.jsx`
2. `src/components/DeckRitual.jsx`
3. `src/components/scenes/RitualScene.jsx`
4. `src/components/scenes/RevealScene.jsx`
5. `src/components/ReadingBoard.jsx`
6. `src/components/SpreadTable.jsx`
7. `src/components/MobileActionBar.jsx`
8. `src/TarotReading.jsx`

### Tests

1. `functions/__tests__/` or `tests/` for state and regression coverage
2. `e2e/` for handset flow validation if the repo already has suitable Playwright infrastructure for this path

## Testing Plan

### Unit and state tests

1. Ritual snapshot survives shuffle and is the input used for seed generation.
2. `resetReadingProgress()` does not wipe ritual state.
3. `resetSessionForNewReading()` does wipe ritual state.
4. Skip-ritual remains auto-satisfied across repeated new readings.
5. Deck-size changes clamp cut index and slider range correctly.
6. Ghost animation completion reveals the intended target index only when still valid.

### Component tests

1. `DeckRitual` quick-draw CTA cannot reveal before ritual completion.
2. `MobileActionBar` deck-stage CTA cannot bypass ritual gating.
3. First reveal has a mounted slot target.
4. Reset during ghost animation leaves the board fully reset.
5. Reduced-motion mode follows the same stage contract without animation.

### Manual verification matrix

1. Handset, ritual enabled, full 78-card deck.
2. Handset, ritual enabled, majors-only deck.
3. Handset, ritual skipped by personalization.
4. Desktop fallback flow.
5. Reduced-motion enabled.
6. Repeated readings without page reload.
7. Reset reveals while an animation is in flight.

## Quality Gate

1. Run targeted tests for state and UI files touched by this work.
2. Run `npm test`.
3. Run `npm run build`.
4. Run lint on modified files or global lint if the branch is clean enough.
5. If Playwright coverage exists for this flow, run the relevant handset scenario.

## Rollout Strategy

Implement in three reviewable slices inside one PR.

### Slice 1

1. Canonical state model.
2. Ritual snapshot and reset separation.
3. Skip-ritual fix.

### Slice 2

1. CTA command-layer migration.
2. Deck-size propagation.
3. Copy alignment.

### Slice 3

1. First deal animation target fix.
2. Ghost cancel-safety.
3. Final regression coverage.

## Acceptance Criteria

- No user-facing CTA can reveal cards before ritual satisfaction when ritual is enabled.
- Shuffle uses the ritual inputs the user actually performed.
- Skip-ritual behaves consistently on every new reading.
- The cut slider reflects the active deck size in both majors-only and full-deck modes.
- The first deck-to-slot animation has a real mounted target and no longer falls back in the default animated path.
- Reset and new-reading actions cannot be undone by stale ghost-animation completion.
- Automated coverage exists for the identified regressions.
- Build and tests pass after implementation.
