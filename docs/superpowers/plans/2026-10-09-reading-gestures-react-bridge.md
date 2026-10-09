# Personalized Reading Gestures React Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal React demonstrator that preserves recorded readings while adapting the accepted imagery, emergence, hold, and revisit interactions to Tableu's actual streaming lifecycle.

**Architecture:** Reconcile the existing `feat/reading-card-touch` foundation before extending its Markdown annotations, focus provider, and artwork component. Feed one focus engine with validated, hand-authored source associations and actual visible-source progress; keep source delivery, reader inspection, artwork geometry, and animation cleanup separate. The first bridge runs recorded fixtures through the application components, with arbitrary readings retaining their current usable prose when no semantic sidecar exists.

**Tech Stack:** React 19, existing React Markdown/remark pipeline, existing `motion` dependency and `src/lib/motionAdapter.js`, native Web Animations API where needed, Node's test runner, and Playwright with controlled SSE fixtures.

**Spec:** [Personalized reading imagery and motion proposal](../specs/2026-10-08-reading-imagery-motion.md), [playable study and provenance](../../../output/reading-motion/README.md), [product](../../../PRODUCT.md), [design](../../../DESIGN.md), and [design contract](../../design-contract.md).

## Global Constraints

- “Preserve its current prose, headings, section structure, and interpretive depth.” Do not rewrite recorded or generated readings to fit animation.
- “Use hand-authored semantic cues tied to exact fixture passages for this prototype. An automated semantic-tagging system is not required.” This bridge has no new live generation, paid API calls, or generalized tagging service.
- “Streaming introduces associations.” Source delivery continues during held inspection; holding pauses the visual accompaniment, not the SSE connection or model job.
- “Explicit reader inspection takes priority and holds the association.” Completed and restored readings retain revisit access without replaying a cue backlog.
- “If text arrives quickly, coalesce cues rather than rapidly playing a backlog.” Retain at most one latest pending automatic association.
- “Do not force scrolling or assume text arrival proves gaze position.” Visibility gates motion; it is not an eye tracker.
- “Keep Tableu’s established Source Serif headings and Inter reading copy.” Preserve native paragraph/list semantics and existing heading/TTS/HTML policies.
- “Reflections are optional.” Production context consists of the actual question and optional `reflections[spreadIndex]`; do not manufacture a general reflection.
- “Respect reduced-motion preferences with static associations that preserve the same meaning.” Add no playback button, continuous pulse, diagnostic rings, or instructional engagement toolbar.
- Use the current study values initially: presence `0` and hidden before introduction; `0.035` at physical-description start; quadratic ease-in to `0.55` at its authored midpoint; ease-out to `1` at description end. The artwork's resting layer is opacity `0.74` with `brightness(0.88)`; hover, keyboard focus, and held inspection brighten to `1`, retaining detail illumination and approximately `3px` lift. These are study values, not validated production reading-speed tokens.
- Use `pool-pour` and `land-pour` consistently from literal description through interpretation and balanced payoff. Unsupported details fall back to the whole card.
- Keep original SVGs as image resources. Do not inline executable originals, copy the entire approximately 276 MB deck into production assets, or silently change production deck lookup/vision assets.
- Work in an isolated execution worktree, stage only owned paths, and preserve earlier studies and unrelated changes. This document authorizes no implementation, merge, push, deployment, or release by itself.

## Review Focus

1. Same-spread regeneration and final/snapshot text replacement must cancel stale associations without mistaking an ordinary append or reconnect for a new reading; pinned by Task 2.
2. Markdown-split phrases, repeated card names, translated prose, and identical canonical cards at different positions must resolve to the correct source occurrence rather than a normalized-TTS or DOM offset; pinned by Task 3.
3. A fast stream, hidden tab, offscreen passage, or aborted job must settle or coalesce motion without catching up through an animation backlog; pinned by Tasks 5 and 7.
4. Reversed cards and alternate artwork editions must preserve geometry on the actual image, applying reversal once and degrading unsupported geometry to whole-card context; pinned by Task 4.
5. Explicit keyboard/touch inspection, optional notes, and small handsets must retain meaningful imagery and reading space as generation continues; pinned by Tasks 5 through 7.

---

## Execution baseline and existing foundation

At plan authoring, this study worktree is on `feat/reading-imagery-motion`, `HEAD` **`8f5487f5a19849c5e7ab906a9138b8e16ca33cac`**, with additional study/doc/asset changes. A separate local and remote `feat/reading-card-touch` tip is **`eca5290090d1166f5d2446a8552c77998fc4567d`**. Recheck both before execution; neither the standalone study nor the parallel branch is an approved production implementation.

| Foundation to reuse | Current limitation to address |
| --- | --- |
| `buildSpreadCompanionCards({ reading, visibleCount, spreadPositions, deckStyleId, revealedCards })` | Needs an explicit artwork edition and occurrence identity; current frame mapping describes production scans. |
| `buildCardLinkCatalog({ cards, deckStyle })`, `analyzeBlock(text, catalog, options)`, `remarkCardLinks({ catalog })` | Useful identity/idiom/ownership safeguards, but keyword detection does not establish interpretation or personal relevance. Block-local ranges are not immutable raw-source anchors. |
| `MarkdownRenderer({ extraRemarkPlugins, renderParagraphLead, ... })` and `StreamingNarrative({ cardLinks, renderParagraphLead, ... })` | Reuse the extension seam; preserve TTS and heading behavior while adding validated source-range metadata. |
| `NarrativeCardFocusProvider({ cards, onSelectCard, stable, children })` | Has pointer/scroll priority but no run/revision/held state. Its panel mount is unkeyed. |
| `useNarrativeReadingLine(containerRef, { enabled, isLive })` | Live mode always activates the newest block; completed mode assumes a line at 42% viewport height. Neither proves gaze. Touch pin currently expires after 2800 ms. |
| `CardTouchArt({ card, state, touches, touchKey, calm })` and `SpreadCompanion({ variant })` | Geometry assumes RWS scan proportions; Star groups both pitchers under one ID. Cards appear immediately, and phone plates are small. |

Source evidence at the current study baseline: `ReadingContext.jsx:487–505` batches formatted server text at 120 ms; `553–573` accepts replacement snapshots/final text; `650–685` guards replacement requests; `829–879` handles hidden/route pause. `useNarrativeReadingController.js:153–158` disables client typing for server-streamed readings. `StreamingNarrative.jsx:290–298` currently resets callback dedupe on every text change. `ReadingDisplay.jsx:116–121` identifies a spread by spread/seed/count, not a generation. `formatting.js:314–343` retains raw text separately from normalized/TTS/section representations.

## File responsibilities

Extend the parallel branch's existing files for catalog/remark integration, provider, reading-line observation, `CardTouchArt`, companion layout, panel plumbing, and styles. Add only these focused units:

- `src/lib/narrativeGestureSource.js`: pure generation/source-revision transitions; no geometry or scheduling.
- `src/components/reading/narrative/narrativeGestureState.js`: pure focus/hold/latest-pending transitions used by the existing provider.
- `src/components/reading/narrative/useCardGestureMotion.js`: scoped, cancellable motion owned by `CardTouchArt`.
- `src/components/ReadingGesturesFixture.jsx`: development-only recorded-fixture host using application components.
- `output/reading-motion/fixtures/gesture-sidecars.json`: authored associations/reveal ranges for the existing Star and Celtic excerpts, with exact provenance.
- Focused tests named in the tasks below. Do not create a second card parser, focus context, reading-progress hook, or gesture scheduler.

### Task 1: Reconcile the existing card-touch foundation

**Files:** Review all files in `eca5290`; adapt its existing `narrativeCardLinks.js`, `NarrativeCardFocus.jsx`, `useNarrativeReadingLine.js`, `CardTouchArt.jsx`, `SpreadCompanion.jsx`, renderer/panel/controller plumbing, and `narrative-card-touch.css`. Tests: `tests/narrativeCardLinks.test.mjs`, `tests/narrativeReadingModelUtils.test.mjs`, `tests/narrativeSemantics.test.mjs`.

**Interfaces:** Preserve the signatures in the foundation table. Produce one reconciled annotation/focus/artwork foundation on the future execution branch before adding semantic state.

- [ ] Inspect fresh `git status --short`, `git worktree list`, `git rev-parse HEAD feat/reading-card-touch origin/feat/reading-card-touch`, and `git show --stat eca5290090d1166f5d2446a8552c77998fc4567d`. If refs moved, review the new diff and update the execution record instead of blindly applying the remembered tip.
- [ ] Create a clean execution worktree from the committed study result; review the exact `eca5290` patch and integrate that foundation there, resolving only owned overlaps. Keep the standalone studies available. Record the chosen foundation SHA; do not merge anything while merely preparing this plan.
- [ ] Add/retain assertions that catalog ownership distinguishes aliases and duplicate positions, headings remain nested beneath the panel, and Markdown emphasis/HTML policy/TTS word offsets remain unchanged. Run `node --test tests/narrativeCardLinks.test.mjs tests/narrativeReadingModelUtils.test.mjs tests/narrativeSemantics.test.mjs` before adaptations to establish the actual baseline.
- [ ] Remove no existing inspection behavior by accident: keep `onSelectCard(index)` explicit. Thread `gestureStudyEnabled = false` and `gestureSidecar = null` through controller/panel props; only the internal fixture supplies both. Automatic semantic artwork focus requires that opt-in and a validated sidecar. Keyword-only catalog fallback may support identity inspection, but cannot light an inferred personal association or start the new emergence sequence on ordinary production readings.
- [ ] Run the same focused tests after reconciliation. Commit only the reviewed foundation/adapted files with `feat: reconcile reading card touch foundation`.

### Task 2: Retain generation identity and reconcile source updates

**Files:** Create `src/lib/narrativeGestureSource.js`; modify `src/contexts/ReadingContext.jsx`, `src/components/ReadingDisplay.jsx`, `src/hooks/useNarrativeReadingController.js`, and `src/hooks/narrativeReadingModelUtils.js`. Test: `tests/narrativeGestureSource.test.mjs`.

**Interfaces:** `createGestureSource({ runId, raw = '', status = 'idle' }) -> SourceFrame`; `advanceGestureSource(frame, { raw, kind, status }) -> SourceFrame`. `SourceFrame` is `{ runId, raw, sourceRevision, kind, status }`; `kind` is `append | snapshot | complete | hydrate`; status is `idle | streaming | paused | complete | error`. A different generation gets a new `runId`; `sourceRevision` starts at zero and increases only when new raw text is not an equal/extended prefix of the previous raw text.

- [ ] Write `test('append, resume, and completion preserve generation identity')` and `test('non-prefix source replacement invalidates associations')`; include identical replay, prefix snapshot, pause/resume, final truncation, and same-spread regeneration. Pin the pure transition with:

  ```js
  const base = createGestureSource({ runId: 'run-a', raw: 'The Star', status: 'streaming' });
  const appended = advanceGestureSource(base, { raw: 'The Star pours.', kind: 'append', status: 'streaming' });
  assert.equal(appended.runId, 'run-a');
  assert.equal(appended.sourceRevision, 0);
  assert.equal(advanceGestureSource(appended, { raw: 'The Hermit waits.', kind: 'snapshot', status: 'streaming' }).sourceRevision, 1);
  assert.notEqual(createGestureSource({ runId: 'run-b', raw: base.raw }).runId, base.runId);
  ```
- [ ] Run `node --test tests/narrativeGestureSource.test.mjs`; expect the new exports/assertions to fail before implementation.
- [ ] Implement the pure transitions. Create the generation ID before starting a new job; retain it through metadata, reconnect, completion, and job-ref cleanup. Hydrated completed readings get one stable mounted run identity. Never use job tokens, changing content hashes, or spread/count identity as the run ID.
- [ ] Update the frame at the existing guarded source flush/snapshot/done/error/pause sites. Pass it through the controller/panel model; preserve exact raw text independently from formatting. Stale request completion must not mutate the replacement run's frame. Mark errors/paused status without pretending an error notice is reading prose.
- [ ] Run the focused test and existing `tests/readingJobStream.test.mjs` and `tests/narrativeReadingModelUtils.test.mjs`; commit only Task 2 paths with `feat: track stable reading gesture source identity`.

### Task 3: Add authored source associations through the existing remark seam

**Files:** Modify `src/lib/narrativeCardLinks.js`, `src/components/MarkdownRenderer.jsx`, `src/components/StreamingNarrative.jsx`, and `src/components/reading/narrative/NarrativeBody.jsx`; create `output/reading-motion/fixtures/gesture-sidecars.json`. Tests: extend `tests/narrativeCardLinks.test.mjs` and `tests/narrativeSemantics.test.mjs`.

**Interfaces:** Extend `remarkCardLinks({ catalog, associations = [] })`. Add `resolveGestureSidecar({ sidecar, source, cards, artworkEdition }) -> { associations, introductions, invalid }` to `narrativeCardLinks.js`. A sidecar contains recorded source identity, `expectedRaw`, associations, and introduction ranges. Each association is `{ id, occurrenceId, detailIds, kind, passage: { start, end, quote }, meaningRange?, personalContext?, relatedOccurrenceIds? }`; `kind` is `identity | literal | interpretation | balance | relationship`. `occurrenceId` combines the run and spread index, not canonical name. Introduction bounds are `{ occurrenceId, start, namedEnd, descriptionStart, midpoint, end }` in the same raw UTF-16 source domain.

`StreamingNarrative` adds `gestureSource: SourceFrame` and `onVisibleSourceProgress({ runId, sourceRevision, visibleEnd, complete, mode })`; mode is `server | typing | instant`. `visibleEnd` refers to the actual displayed prefix of raw source, not the SSE event boundary, word count, normalized TTS string, or DOM text length. When plain display text differs from raw text, use the source projection to map its displayed prefix; an ambiguous projection suppresses progress-driven cues instead of guessing an offset.

- [ ] Write failing assertions for exact quotes spanning `**strong**`/emphasis, apostrophes and emoji, duplicate phrase occurrences, translated prose, code/HTML exclusion, absent reflections, and a wrong-card/wrong-source sidecar. Source replacement invalidates unmatched quotes instead of guessing a new connection.
- [ ] Run `node --test tests/narrativeCardLinks.test.mjs tests/narrativeSemantics.test.mjs`; the new association/progress cases must fail while existing semantics remain green.
- [ ] Author the Star's six associations and Hermit/Wands relationship from their exact fixture excerpts. Preserve the Star's 23:47 qualification provenance and the Celtic fixture's 23:23 recorded-samples provenance. Keep fixture `reflectionsText` explicitly labelled recorded-fixture context; production card notes use `{ type: 'card-reflection', spreadIndex, quote }`, and a question uses `{ type: 'question', quote }`.
- [ ] Validate streamed raw text as a prefix of the sidecar's recorded `expectedRaw`; validate every available quoted range. Permit emergence progress within a validated introduction prefix, but activate passage emphasis only when its associated range is actually available. If no sidecar matches, emit no semantic associations.
- [ ] Project raw ranges through Markdown AST source positions into noninteractive spans and stable association attributes. Retain source positions when splitting nodes. Keep normalized TTS offsets independent; preserve heading hierarchy, paragraphs, lists, links, `skipHtml`, and visible text. Do not use `extractSections().content` for offsets.
- [ ] Add `test('reported progress follows the rendered raw-source prefix')`, covering Markdown and plain normalized display. Assert `visibleEnd <= gestureSource.raw.length`, a partial quoted phrase has no passage emphasis, skipping client typing emits the full mapped boundary once, and source append does not reset established cue identity. Emit progress after rendering; suppressed typing, mobile Markdown, reduced motion, and completed hydration must not fabricate a slow replay. Preserve existing narration and completion callbacks.
- [ ] Run both focused suites, assert Star normalized word count `97` and Celtic excerpt word count `183`, and commit Task 3 paths with `feat: associate reading gestures with exact source passages`.

### Task 4: Version artwork geometry and preserve literal-to-meaning continuity

**Files:** Modify `src/data/cardTouchPoints.js`, `src/components/reading/narrative/CardTouchArt.jsx`, and `src/hooks/narrativeReadingModelUtils.js`. Tests: create `tests/cardGestureArtwork.test.mjs`; extend `tests/narrativeReadingModelUtils.test.mjs`.

**Interfaces:** `getCardTouchPoints(canonicalName, { artworkEdition = 'rws-1909-scan' } = {}) -> Detail[]`; each detail has stable `id`, normalized spots and optional traced path. Companion cards add `occurrenceId`, `artworkEdition`, and `frame`; production canonical identity/deck aliases remain separate. `CardTouchArt` accepts these card fields plus `presence = 1` while preserving its existing props.

- [ ] Write failing assertions: vector Star `pool-pour` and `land-pour` identify separate supported details; literal/memory share the same pool ID; literal/new-ground share the same land ID; balance uses both. Unsupported edition/card/detail returns whole-card context. Two occurrences of the same canonical card retain different occurrence IDs.
- [ ] Run `node --test tests/cardGestureArtwork.test.mjs tests/narrativeReadingModelUtils.test.mjs`; expect the new edition/continuity cases to fail.
- [ ] Add only the authored demonstration geometry for the Immanuelle edition, using the inspected `1086 × 1810` / `3 / 5` artwork and study's actual pitcher/pour coordinates. Preserve existing scan geometry and the distinction from vision/training coordinates. Do not enable scan points merely because a vector card depicts the same name.
- [ ] Apply reversal once to the artwork and illumination container together; keep stored geometry in upright coordinates. Verify a land/pool/lantern spot and optional path remain aligned under 180-degree reversal. Whole-card identity cues must not accidentally inherit a previous detail.
- [ ] Retain existing production image URLs and assets. The internal fixture host supplies explicit local vector URLs; broader production adoption/optimization is a separate decision. Run the focused suites and commit Task 4 paths with `feat: version gesture artwork details by edition`.

### Task 5: Extend the single focus engine with hold and coalesced accompaniment

**Files:** Create `src/components/reading/narrative/narrativeGestureState.js`; modify `NarrativeCardFocus.jsx`, `src/hooks/useNarrativeReadingLine.js`, `NarrativePanel.jsx`, `src/hooks/useReadingSelection.js`, `src/components/ReadingDisplay.jsx`, and the panel/controller callback plumbing. Test: `tests/narrativeGestureState.test.mjs`; browser signal checks are in Task 7's `e2e/reading-gestures.spec.js`.

**Interfaces:** `createGestureFocusState({ runId, sourceRevision, completed = false }) -> FocusState`; `reduceGestureFocus(state, event) -> FocusState`. Events are `{ type: 'PROGRESS', progress, eligibleAssociationIds, now }`, `{ type: 'VISIBLE', id, visible }`, `{ type: 'HOLD', id }`, `{ type: 'RELEASE' }`, `{ type: 'INSPECTION', kind, active, occurrenceId }`, `{ type: 'SOURCE', source }`, `{ type: 'STATUS', status }`, `{ type: 'MOTION', reducedMotion }`, and `{ type: 'TICK', now }`. All cue-bearing events carry `runId`/`sourceRevision`; mismatched events are ignored. State retains current association, held association, active inspection kinds, at most one latest pending automatic association, and settled presence per occurrence. Extend the existing provider API with `holdAssociation(id)`, `releaseAssociation()`, `reportProgress(progress)`, `reportVisibility({ id, visible })`, and `reportInspection({ kind: 'modal' | 'card-detail', active, occurrenceId })`.

`useReadingSelection` exposes explicit `manualInspectionStatus` records `{ kind, active, index, readingKey }` without changing its selection methods. `ReadingDisplay` maps those to the current gesture occurrence and passes them through panel/controller props. Automatically derived `activeFocusedCardData` is not an inspection-intent signal.

- [ ] Write failing tests: held pool inspection survives incoming ground/balance progress; release adopts the latest eligible cue rather than playing missed ones; multiple cues in one update do not produce a sweep queue; completed hydration settles without autoplay; revision/run replacement clears stale hold/pending state.
- [ ] Add tests for hidden/offscreen/paused/error states cancelling motion eligibility, with a same-run resume retaining established associations and coalescing new arrivals. Assert `pending` is a single cue/null, never an array. SSE source state continues advancing while `held` stays unchanged. Add `test('manual modal inspection suspends automatic artwork without releasing a held cue')`: open/close the modal while held, receive new progress, and assert the independent held association survives; closing one inspection kind must not clear another active inspection.
- [ ] Run `node --test tests/narrativeGestureState.test.mjs`; expect failure before implementation.
- [ ] Implement the pure reducer inside the existing provider. Replace the unconditional newest-live-block rule with actual association availability plus visibility gating. Use the reading-line hook only to report visible/revisited associations; do not claim its 42% band measures attention. Remove the fixed 2800 ms release for explicit hold; transient hover may remain transient.
- [ ] Add keyboard/touch hold and release on artwork/association controls with visible focus and appropriate names. In `useReadingSelection`, report inspection intent only from manual card selection, explicit panel/modal opening, and the corresponding closes; do not infer it from the automatically selected last revealed card. An active explicit detail panel or modal suspends automatic artwork while source delivery keeps going. Modal close restores automatic eligibility only if no other inspection/hold remains.
- [ ] Preserve `handleCloseDetail`'s existing user-initiated scroll/focus-return behavior and existing selection/modal navigation. Automatic cues never invoke `onSelectCard`, `handleCloseDetail`, or any `revealedCards` mutation, never open a modal, and never move focus/scroll. Add spies/assertions for those forbidden automatic calls in the focused browser checks.
- [ ] Run the focused reducer suite, then commit Task 5 paths with `feat: let reader inspection hold streamed associations`.

### Task 6: Apply emergence, illumination, and responsive card relationships

**Files:** Create `src/components/reading/narrative/useCardGestureMotion.js`; modify `CardTouchArt.jsx`, `SpreadCompanion.jsx`, `src/styles/narrative-card-touch.css`, and existing `NarrativeCardFocus.jsx` state projection. Tests: create `tests/cardGestureMotion.test.mjs`; extend `tests/narrativeGestureState.test.mjs`.

**Interfaces:** `getCardPresence({ introduction, visibleEnd, inspected = false, reducedMotion = false }) -> number` in `narrativeGestureState.js`; `useCardGestureMotion({ elementRef, runId, sourceRevision, associationId, gesture, reducedMotion, enabled })` owns one cancellable effect. `src/lib/motionAdapter.js` exports `animate(target, mixed, extraOptions)` and `createScope(options)` at the verified baseline; recheck those exports before reuse. Prefer the study's scoped native `element.animate()` lifecycle for its traced gestures when that maps directly, and use the existing adapter for other shared motion. Add no animation dependency or second timeline engine.

- [ ] Write `test('card presence follows each authored physical description')`; pin the curve with the following assertions, then add inspected/reduced-motion and independent second-card cases:

  ```js
  const introduction = { occurrenceId: 'run-a:2', start: 10, namedEnd: 20, descriptionStart: 30, midpoint: 50, end: 70 };
  assert.equal(getCardPresence({ introduction, visibleEnd: 10 }), 0);
  assert.equal(getCardPresence({ introduction, visibleEnd: 30 }), 0.035);
  assert.equal(getCardPresence({ introduction, visibleEnd: 50 }), 0.55);
  assert.equal(getCardPresence({ introduction, visibleEnd: 70 }), 1);
  assert.equal(getCardPresence({ introduction, visibleEnd: 20, reducedMotion: true }), 1);
  ```
- [ ] Write motion-lifecycle assertions using injected animation controls: replacement, hidden state, new cue, and unmount cancel prior controls; reduced motion starts zero animations; unsupported `Element.animate` still renders settled artwork; no permanent `will-change` leaks after settlement.
- [ ] Run `node --test tests/narrativeGestureState.test.mjs tests/cardGestureMotion.test.mjs`; expect the new behavior to fail.
- [ ] Apply the exact initial study values in Global Constraints. Compose base translucency/hover brightness separately from detail illumination so hover does not erase the association. Preserve the branch's separate transform/filter layers; avoid compounded reversal, perpetual pulse, and revealing a blank caption/control before presence `0.035`.
- [ ] On phones, show a stable nearby artwork area with enough detail to recognize both pours. When Hermit/Wands relate, retain a recognizable second-card context while the relevant detail is legible. Preserve paragraph width/reading space and 44px interaction targets; do not install an always-expanded sticky full card.
- [ ] Run the focused suites and commit Task 6 paths with `feat: accompany reading passages with restrained card emergence`.

### Task 7: Prove the bridge in an internal fixture route and controlled SSE

**Files:** Create `src/components/ReadingGesturesFixture.jsx` and `e2e/reading-gestures.spec.js`; modify `src/components/AnimatedRoutes.jsx` and `e2e/helpers/narrativeFixtures.js`; add only a bounded local fixture adapter if needed. Use the existing Star/Celtic fixture JSON and authored sidecar. Record evidence in `output/reading-motion/react-bridge-verification.md`.

**Interfaces:** Development-only lazy route `/__e2e/reading-gestures`, following the existing `/__e2e/spread-layout` pattern. The fixture selects `star | celtic`, source arrival `gentle | burst | complete`, optional reflection, and raw/source update controls outside the product-facing reading. It renders the real narrative panel/renderer/provider components. Extend the controllable SSE helper to accept recorded narrative/meta and unique job IDs without intercepting authentication when claiming real-session coverage.

- [ ] Write failing browser assertions for the six Star states: identity; pool-pour; land-pour; memory/pool continuity; new-ground/land continuity; balanced both. Assert exact fixture prose/headings and that the initial card is hidden, becomes perceptible around the authored description midpoint, and has no playback control.
- [ ] Add Hermit → Wands → Hermit return → relationship assertions, one pointer/keyboard revisit, and held inspection while new SSE deltas still arrive. Add burst, replacement snapshot, terminal error, route leave/return, reduced-motion change, and completed-hydration cases. Assert no stale run associations, at most one pending cue, and unchanged scroll/focus under automatic accompaniment.
- [ ] Run `npx playwright test e2e/reading-gestures.spec.js --project=chromium`; expect failure until the internal host is implemented. Explicitly call `page.emulateMedia({ reducedMotion: 'no-preference' })` for motion cases: the repository config defaults to `reduce`.
- [ ] Implement the development-only host and fixture adapter. Reference only required original vector files by local development URL under `/output/reading-motion/assets/rws-immanuelle/`; verify actual MIME/decode through Vite. Do not import all original SVGs into the production bundle or change the public deck resolver. Unsupported ordinary reading routes retain functional prose/inspection with no sidecar.
- [ ] Run the focused suite at `1040×1100`, `390×844`, and `375×667`, including one WebKit handset pass via the `mobile` project and `@mobile` cases. Inspect screenshots for actual detail alignment, overflow, restrained transitions, optional-note omission, coherent two-card context, and visible keyboard focus. Record browser/version/motion/auth mode and only checks actually performed.
- [ ] Later application review must cover a separate guest context and a real signed-in local Pro context on the Worker origin, following [the reviewer workflow](../../local-reviewer-account.md). Keep model/reading responses recorded or mocked, label those fixtures accurately, verify real auth/tier separately, load private credentials without printing them, and log out. Mocked Pro fixture auth is not actual Pro coverage. If the local account is unavailable on another machine, record that gap.
- [ ] Run the changed unit suites and focused E2E tests; commit only Task 7 paths/evidence with `test: demonstrate reading gesture bridge with recorded streams`. Run `npm test` before any future push per repository guidance; no narrative/vision generation gates or deployment commands are part of this bridge's fixture verification.

### Task 8: Gate any broader production direction on a five-card demonstrator

**Files:** Update `output/reading-motion/react-bridge-verification.md` and the reading-motion README. If continuing beyond the first bridge, create `output/reading-motion/fixtures/gestures-five-card-creative-project.json` and extend the same internal host/sidecar/tests; preserve `data/evaluations/narrative-samples.json` unchanged.

**Interfaces:** The existing single annotation/focus engine must support revisiting an occurrence and shared associations without introducing an unlock progression. A five-card fixture uses the exact `five-card-creative-project` sample at generation timestamp **`2026-10-07T23:23:59.556Z`**, preserving its question, reflection, full reading, card positions/orientations, and source checksum.

- [ ] Record the first bridge's actual limitations: authored fixtures only, current phone relationship result, no generalized sidecar generation, no validated reading-speed/gaze model, and no production asset migration.
- [ ] Before advocating a generic 3–5 card rollout, extract that exact sample: Ace of Wands upright; Seven of Swords reversed; Queen of Cups upright; Three of Pentacles upright; Wheel of Fortune reversed. Retain its original Opening, The Story, Putting It Together, Gentle Next Steps, and Closing. Do not splice its prose with another evaluation run.
- [ ] Add an explicit future gate test: the card currently interpreted emerges while prior cards remain inspectable; the sample's later Ace/Queen relationship reuses earlier imagery; synthesis/next-step revisits work without forced scrolling or rapid five-card sweeps. Require phone inspection of actual hand/cloud, swords, cup, collaboration, and wheel detail support in the selected artwork edition.
- [ ] Evaluate the overlap/dim/smaller-previous-card proposal against that demonstration. Treat its generic 3–5 card transition as a hypothesis until observed; revise presentation if repeated handoffs or shared contexts weaken reading space or meaning. Do not declare a universal transition validated by the current two-card fixture.
- [ ] Record a concrete continuation decision in the evidence document: retain/adapt this engine based on the demonstrator, and separately specify any future semantic tagging and optimized production asset work. Commit only these docs/fixtures with `docs: record reading gesture bridge rollout gates`. No merge/deploy is included.

## Completion evidence and handoff

The implementer reports exact source/foundation SHAs, owned changes, focused test results, browser/auth coverage, the internal preview command/URL, and unresolved gates. Passing mock-SSE/fixture checks does not establish live narrative metadata, real model generation, broader deck geometry, production download performance, or generalized 3–5 card choreography. Preserve the standalone study as a reviewable reference while the React bridge is evaluated.
