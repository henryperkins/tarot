# Narrative Reading UI Simplification Plan

**Date:** 2026-03-05

**Goal:** Reduce the nesting, prop fan-out, and mixed responsibilities in the Narrative Reading UI without changing the user-facing reading flow, scene transitions, or mobile behavior.

**Primary Hotspots:**
- [`src/components/ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx) is currently the controller, scene assembler, modal host, media manager, and narrative view-model builder.
- [`src/components/NarrativePanel.jsx`](/home/azureuser/tarot/src/components/NarrativePanel.jsx) mixes narrative presentation, narration controls, journal navigation, prompting, and status UI.
- [`src/components/scenes/CompleteScene.jsx`](/home/azureuser/tarot/src/components/scenes/CompleteScene.jsx) and [`src/components/scenes/NarrativeScene.jsx`](/home/azureuser/tarot/src/components/scenes/NarrativeScene.jsx) duplicate the same “narrative panel + secondary sections” composition pattern.
- [`src/components/NarrativeReadingSurface.jsx`](/home/azureuser/tarot/src/components/NarrativeReadingSurface.jsx) is structurally simple, but it is wired into the rest of the flow through a large prop object assembled upstream.

**Scope:**
- `src/components/ReadingDisplay.jsx`
- `src/components/NarrativePanel.jsx`
- `src/components/NarrativeReadingSurface.jsx`
- `src/components/scenes/SceneShell.jsx`
- `src/components/scenes/NarrativeScene.jsx`
- `src/components/scenes/CompleteScene.jsx`
- `src/hooks/useSceneOrchestrator.js`
- supporting extracted hooks/components created under `src/components/reading/` or `src/hooks/`

**Non-Goals:**
- Rewriting `ReadingContext` in the first pass
- Changing visual design direction
- Removing scene transitions or cinematic behaviors
- Reworking journal, follow-up chat, or media APIs beyond extracting their UI ownership

---

## Current Problems To Solve

### 1. `ReadingDisplay` owns too many concerns

Today it handles:
- reading state derivation
- scene orchestration
- narrative view-model assembly
- auto-narration timers
- mention pulse state
- card modal state and card-to-card navigation
- ghost card animation state
- media gallery loading/persistence/deletion
- toast milestone side effects
- scene payload construction

This makes [`ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx#L277) expensive to reason about and difficult to change safely.

### 2. Prop assembly is replacing real boundaries

`ReadingDisplay` builds large objects for:
- `narrativePanelProps` at [`ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx#L714)
- `sceneData` at [`ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx#L1278)

Those objects are effectively view models, but they are untyped, inline, and broad enough that scene and panel components depend on the controller’s internal shape.

The current prop surfaces are also a useful complexity signal:
- `NarrativePanel` currently takes roughly 35+ props
- `NarrativeReadingSurface` currently takes roughly 20+ props

### 3. Scene composition duplicates layout responsibilities

Both scenes render:
- a stage wrapper
- a max-width panel container
- the narrative panel
- optional secondary content below it

See:
- [`NarrativeScene.jsx`](/home/azureuser/tarot/src/components/scenes/NarrativeScene.jsx#L1)
- [`CompleteScene.jsx`](/home/azureuser/tarot/src/components/scenes/CompleteScene.jsx#L95)

The duplication is small per file, but it forces future narrative-layout changes to be repeated across scenes.

### 4. Narrative UI is split across “panel” and “surface” in a way that is hard to follow

The user-visible narrative area is currently assembled as:
- `NarrativePanel`
- then `NarrativeReadingSurface`
- then completion-only cards inside `CompleteScene`

That split is valid from a UX perspective, but not from a code-ownership perspective. The same feature area is composed across multiple files with different ownership rules.

The composition is also inverted today: `ReadingDisplay` prebuilds the panel and secondary surface, then injects them into scenes instead of letting scenes own the narrative layout directly.

### 5. Legacy/canonical scene state duality adds cognitive load

[`useSceneOrchestrator.js`](/home/azureuser/tarot/src/hooks/useSceneOrchestrator.js#L1) still exposes both legacy and canonical scene names. That may be necessary short term, but it makes the rest of the tree harder to simplify because consumers need to know which flavor they are reading.

---

## Target Architecture

The simplification target is:

1. `ReadingDisplay` becomes a thin shell that:
- reads context and top-level prefs
- calls a small number of focused hooks
- renders `ReadingChrome`, `ReadingSceneRouter`, and `ReadingOverlays`

2. Narrative-specific derived state moves into a dedicated controller hook:
- `useNarrativeReadingController()`

3. Selection, overlay, and media concerns move into their own hooks:
- `useReadingSelection()`
- `useReadingMediaGallery()`
- `useNarrationAutomation()`

4. Scene components receive narrower inputs:
- a focused scene model, or
- smaller explicit prop groups instead of one broad `sceneData` bag

5. Add a dedicated scene router:
- `ReadingSceneRouter`

6. Narrative and complete scenes share one layout primitive:
- `NarrativeStageLayout`

7. Completion-only panels become explicit sections:
- `ContinueConversationSection`
- `ReadingInputUsageSection`
- `ReadingMediaSection`
- `ReadingFeedbackSection`
- `NewReadingSection`

---

## Phased Refactor Plan

## Phase 0: Freeze Behavior Before Structural Changes

### Step 0.1: Capture the reading-flow behaviors we must preserve

Before extracting anything, define targeted coverage for:
- reveal flow on desktop
- reveal flow on handset/mobile stable mode
- interlude to narrative to complete scene transitions
- follow-up modal open/close behavior
- narrative focus toggle behavior
- media gallery rendering for eligible users
- narration controls and voice prompt visibility

### Step 0.2: Add refactor-safe smoke tests

Add a small set of targeted tests around:
- `useSceneOrchestrator()`
- narrative/complete scene composition
- completion-only sections visibility

This should be enough to refactor structure without relying on manual full-flow retesting every time.

---

## Phase 1: Extract The Controller Seams Out Of `ReadingDisplay`

### Step 1.1: Create a narrative controller hook

Create `useNarrativeReadingController()` to own:
- narrative text derivation
- atmosphere classes
- insight/visual companion flags
- cinematic card selection
- narrative highlight phrases
- question normalization
- narrative panel/surface view data

This removes the biggest cluster of derived narrative booleans from [`ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx#L578).

### Step 1.2: Extract selection and overlay state

Create `useReadingSelection()` to own:
- `selectedCardData`
- `focusedCardData`
- `recentlyClosedIndex`
- revealed-card navigation
- narrative mention pulse state

This isolates the modal/navigation logic currently spread across [`ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx#L362) and [`ReadingDisplay.jsx`](/home/azureuser/tarot/src/components/ReadingDisplay.jsx#L1121).

### Step 1.3: Extract media gallery logic

Create `useReadingMediaGallery()` to own:
- media loading
- persistence
- deletion
- optimistic item updates
- hero-story-art side effects where possible

This removes network concerns from the display component.

### Step 1.4: Extract narration automation

Create `useNarrationAutomation()` to own:
- auto-narration timer refs
- trigger guards
- voice prompt enable flow

This keeps the panel focused on presentation and manual actions.

### Step 1.5: Leave `ReadingDisplay` with three jobs only

After extraction, `ReadingDisplay` should mainly:
- assemble top-level inputs from context/prefs
- render the current scene shell
- render overlays such as `CardModal` and `GhostCard`

---

## Phase 2: Simplify Narrative Composition

### Step 2.1: Introduce a shared narrative stage layout

Create `NarrativeStageLayout` to encapsulate:
- stage padding
- max-width wrapper
- narrative panel slot
- secondary content slot

Then use it in both:
- [`NarrativeScene.jsx`](/home/azureuser/tarot/src/components/scenes/NarrativeScene.jsx)
- [`CompleteScene.jsx`](/home/azureuser/tarot/src/components/scenes/CompleteScene.jsx)

### Step 2.2: Turn completion blocks into explicit section components

Extract from [`CompleteScene.jsx`](/home/azureuser/tarot/src/components/scenes/CompleteScene.jsx#L137):
- follow-up CTA and modal
- source-usage summary
- media gallery section
- feedback panel section
- reset/new-reading CTA

This makes `CompleteScene` an orchestrator of sections rather than one large conditional JSX file.

### Step 2.3: Clarify the “panel vs surface” relationship

Keep the UX split, but rename ownership more clearly:
- `NarrativePanel` remains the primary reading text container
- `NarrativeReadingSurface` becomes the secondary companion/insight block

If the current name is too broad, consider renaming `NarrativeReadingSurface` to `NarrativeCompanionSection` in a follow-up pass.

---

## Phase 3: Break `NarrativePanel` Into Small Presentational Units

### Step 3.1: Split the panel into stable subcomponents

Extract:
- `NarrativePanelHeader`
- `NarrativeQuestionAnchor`
- `NarrativeBody`
- `NarrationControls`
- `NarrativeStatusStack`

This reduces the prop count and keeps `NarrativePanel` focused on composition.

### Step 3.2: Remove routing and journal-navigation knowledge from leaf UI

Move journal navigation callbacks out of [`NarrativePanel.jsx`](/home/azureuser/tarot/src/components/NarrativePanel.jsx#L205) so leaf components receive simple handlers rather than creating routes internally.

### Step 3.3: Collapse duplicated visibility logic into a panel view model

The current show/hide rules for narration status, progress, tier errors, voice prompt, journal nudge, and save button should be computed in one place upstream and passed in as a compact `statusModel`.

---

## Phase 4: Narrow The Scene API

### Step 4.1: Replace the broad `sceneData` bag

Instead of one object with dozens of unrelated keys, split scene inputs into focused groups:
- `sceneVisuals`
- `ritualModel`
- `revealModel`
- `narrativeModel`
- `completionModel`

### Step 4.2: Move scene-only behavior closer to scene consumers

Examples:
- follow-up UI belongs with completion model
- reveal controls belong with reveal model
- narrative panel/surface belong with narrative model

### Step 4.3: Reduce legacy scene naming once consumers are stable

After scene consumers move to canonical scene names, remove legacy scene references from most UI code and keep conversion logic isolated inside [`useSceneOrchestrator.js`](/home/azureuser/tarot/src/hooks/useSceneOrchestrator.js).

---

## Phase 5: Final Cleanup And File/Folder Shape

### Proposed file shape

Potential target structure:
- `src/components/reading/ReadingDisplay.jsx`
- `src/components/reading/ReadingChrome.jsx`
- `src/components/reading/ReadingOverlays.jsx`
- `src/components/reading/NarrativeStageLayout.jsx`
- `src/components/reading/complete/ContinueConversationSection.jsx`
- `src/components/reading/complete/ReadingInputUsageSection.jsx`
- `src/components/reading/complete/ReadingMediaSection.jsx`
- `src/components/reading/complete/ReadingFeedbackSection.jsx`
- `src/components/reading/narrative/NarrativePanel.jsx`
- `src/components/reading/narrative/NarrationControls.jsx`
- `src/components/reading/narrative/NarrativeStatusStack.jsx`
- `src/hooks/useNarrativeReadingController.js`
- `src/hooks/useReadingSelection.js`
- `src/hooks/useReadingMediaGallery.js`
- `src/hooks/useNarrationAutomation.js`

This should only happen after extraction seams are stable. Do not start by moving files around before behavior is isolated.

---

## Suggested Execution Order

1. Add targeted behavior coverage for scenes, completion blocks, and mobile/desktop narrative flow.
2. Extract `useReadingSelection()` and `useReadingMediaGallery()` first.
3. Extract `useNarrativeReadingController()` next.
4. Introduce `NarrativeStageLayout`.
5. Split completion blocks into section components.
6. Split `NarrativePanel` into presentational subcomponents.
7. Narrow `sceneData` into scene-specific models.
8. Clean up legacy scene references where they are no longer needed.

This order keeps the highest-risk behavioral logic in place until the lower-risk boundaries are established.

---

## Acceptance Criteria

The refactor is complete when:
- `ReadingDisplay.jsx` is primarily composition/orchestration, not business logic
- network/media concerns are no longer embedded in `ReadingDisplay`
- modal/navigation state is no longer embedded in `ReadingDisplay`
- narrative and complete scenes share one layout primitive
- `NarrativePanel` is a composition component, not a large logic container
- scene consumers no longer depend on one broad `sceneData` object
- mobile stable mode, follow-up chat, streaming narrative, visual companion, and feedback flows still work

### Optional size targets

These are guardrails, not hard rules:
- `ReadingDisplay.jsx` under ~700 lines
- `NarrativePanel.jsx` under ~180 lines
- `CompleteScene.jsx` under ~180 lines

---

## Risks And Guardrails

### Key risks
- breaking scene transition timing
- breaking mobile stable mode behavior
- regressing narration auto-start or voice prompt behavior
- regressing follow-up modal ownership
- regressing card modal navigation and mention pulse behavior

### Guardrails
- keep scene transition code in `SceneShell` stable until the composition refactor is complete
- avoid mixing behavior extraction with visual redesign
- extract hooks before moving files
- preserve current route/navigation behavior until explicit callback boundaries exist

---

## Recommended First Refactor Slice

The safest first implementation slice is:

1. extract `useReadingSelection()`
2. extract `useReadingMediaGallery()`
3. extract completion-only panels out of `CompleteScene`

That slice removes a meaningful amount of nesting without touching scene transitions, streaming narrative rendering, or the core reading state machine.
