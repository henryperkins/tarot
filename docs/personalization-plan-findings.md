# Personalization Plan Evaluation

This document captures an in-depth review of the “Personalization Features Implementation Plan” with emphasis on architectural alignment, data-flow accuracy, and implementation risks.

## Scope
- **Plan under review:** `docs/personalization-implementation-plan.md`
- **Focus areas:** Ritual-step removal, spread defaults, backend prompt personalization, local composer behavior, and UI helper visibility.

## Key Findings

### 1. Ritual Skip Proposal Conflicts With Current Flow
- `TarotReading` does not manage a `currentStep`; `activeStep` is derived from `useTarotState` flags (`src/TarotReading.jsx:392`). There is no place in this component to “advance directly from spread selection to card drawing” by simply checking `personalization.showRitualSteps`.
- Ritual state lives inside `useTarotState` (`hasKnocked`, `knockCount`, `hasCut`, `sessionSeed`, etc. in `src/hooks/useTarotState.js:15-153`). Any attempt to auto-complete rituals must update those flags and timers; otherwise shuffle seeding logic will still expect real knocks/cuts before drawing.
- Suggested random defaults (“random knock count 1-3, random cut position”) undermine deterministic `sessionSeed` generation (`computeSeed` uses `knockTimesRef` + `cutIndex`, `src/hooks/useTarotState.js:96-137`). Randomizing on every reading prevents reproducibility and contradicts existing analytics that rely on stable seeds.

### 2. Spread Defaults Need State-Layer Changes
- Current plan modifies only `src/components/SpreadSelector.jsx`, yet the canonical spread selection is stored in `useTarotState` (`selectedSpreadState`, `selectSpread`, `src/hooks/useTarotState.js:6-71`). Initializing “preferred spread depth” must happen where the state is created; otherwise UI highlights diverge from the actual spread used to shuffle/deal.
- Any “recommended spread” indicator should pull from preference data exposed by `usePreferences`, but the state update has to occur before a reading starts so downstream consumers (deal logic, analytics, seeded shuffles) use the intended spread.

### 3. Wrong File Targeted for Local Composer Updates
- Item 2.5 points to `functions/lib/narrativeBuilder.js`, yet that file only re-exports helpers (`functions/lib/narrativeBuilder.js:1-8`). The actual local fallback implementation is inside `functions/api/tarot-reading.js` (`composeReadingEnhanced`, `generateReadingFromAnalysis`, `buildGenericReading`, `functions/api/tarot-reading.js:1169-1315`).
- Without touching those composer functions, tone/frame/display-name hints will **never** reach locally generated narratives, leaving the fallback path unpersonalized.

### 4. Backend Personalization Coverage Is Partial
- Plan ensures Claude prompts receive personalization, but local composer instructions mention only tone. Display name and spiritual frame still need to be woven into `buildGenericReading` and spread-specific builders (`functions/api/tarot-reading.js:1233-1315`); otherwise backend behavior diverges depending on which narrative engine is active.
- `onRequestPost` currently ignores personalization entirely (`functions/api/tarot-reading.js:360-418`). Extracting the object from the request schema is necessary but insufficient—prompt builders, telemetry logging, and analytics should all be aware of the new field to avoid silent drops.

### 5. UI Helper Visibility Requires Component Audits
- Experience-driven helpers span multiple components (`ReadingPreparation`, `HelperToggle`, `Tooltip` usage). The plan cites `RitualControls`, `QuestionInput`, and `SpreadSelector`, but there are additional helper surfaces (e.g., `ReadingPreparation` toggles, `GuidedIntentionCoach` nudges) that may also need collapsing/expansion logic to provide a cohesive “experienced vs. newbie” experience.

### 6. Settings Surface Missing Linkage
- `ExperienceSettings` currently exposes only theme/deck/reversal controls (`src/components/ExperienceSettings.jsx:1-170`). Adding personalization inputs there is reasonable, but the plan should confirm that `PreferencesContext` exposes setters for every field (tone, frame, preferred spread depth). If new setters are required, they belong in `src/contexts/PreferencesContext.jsx:200-230`; assuming “no changes needed” may block UI work.

## Recommendations
1. **Ritual Skip:** Extend `useTarotState` with a `shouldSkipRitual` preference, and ensure shuffle seeding behaves predictably (either use fixed defaults or bypass seeding). Update `RitualControls` rendering conditionally via this flag.
2. **Spread Defaults:** Initialize `selectedSpreadState` based on `preferredSpreadDepth` when `useTarotState` mounts; have `SpreadSelector` simply reflect the currently selected spread.
3. **Local Composer:** Modify `composeReadingEnhanced` (and downstream spread builders) to accept personalization metadata, applying tone/frame/name consistently.
4. **Schema & API:** Thread the new `personalization` object through validation, logging, prompt construction, and telemetry so both cloud and local backends behave identically.
5. **UI Helpers:** Audit all helper-heavy surfaces to ensure experience-based toggles behave consistently; document which components intentionally remain unchanged to avoid regressions.
6. **Settings:** Verify/create preference setters before building the “Reading Style” section, and ensure the experience flows stay synchronized with onboarding defaults.

Addressing these items will keep the personalization initiative aligned with current architecture and avoid regressions in ritual control, reproducibility, and fallback narratives.
