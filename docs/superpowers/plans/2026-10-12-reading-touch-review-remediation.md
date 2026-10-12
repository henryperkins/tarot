# Reading-touch review remediation implementation checklist

> **Implementation status, 2026-10-12:** Code and regression cases for Tasks 1–6 are implemented in this worktree. Checked items track implementation; they do not claim every proposed browser permutation passed. Task 7 below records focused UI checks and remaining physical-device/comprehension gaps. The user explicitly narrowed verification to the changed UI; the broad matrix was stopped. See the [implementation report](../reviews/2026-10-12-reading-touch-remediation.md).

**Goal:** Let someone connect their question, cards and interpretation while the reading arrives, inspect any referenced card without losing their place, and finish by saving or asking a useful follow-up.

**Architecture:** Build on the current mobile spread and stable Markdown renderer. Correct cue eligibility at the observer/engine boundary, route explicit inspection through the existing card modal, and give the reading one shared save controller. Recompose existing controls and supporting panels around the continuous narrative.

**Tech Stack:** React/Vite, ESM, existing Tailwind/CSS tokens, Node tests, Playwright Chromium/WebKit.

**Spec:** The user's screenshot, the original reading UI proposal, and the three outstanding findings in the latest review; product foundations are [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and the [design contract](../../design-contract.md). All implementation decisions needed for this branch are restated below. Do not copy APIs or files from the earlier consolidation-worktree proposal without reconciling them with this branch.

## Source and evidence

- Target: `/home/ubuntu/tarot/.worktrees/reading-touch-20261012`, branch `claude/reading-touch-20261012`, reviewed HEAD `f002ad4e321bc9434b795280a53487addb7c7f0f`. The worktree was clean before this checklist was added.
- Prior review at that HEAD: 78 unit tests passed across `cardTouchMotion`, `narrativeCardLinks`, `narrativeReadingModelUtils`, and `narrativeSemantics`; 13 browser cases passed in desktop Chromium and phone Chromium/WebKit, including reduced motion. Those totals are prior evidence, not checks rerun for this document.
- An additional local diagnostic reproduced an initially offscreen detail remaining unplayed after entering view during streaming, then activating after completion. It also confirmed that a keyboard-activated detail opens an `aria-hidden` preview whose full-card button has `tabIndex=-1`.
- Local diagnostic artifacts: `/tmp/tableu-reading-touch-rereview-20261012/diagnostic.mjs`, `diagnostic.json`, `stream-visible-detail.png`, `keyboard-detail.png`, and `mobile-spread.png`. Temporary artifacts may expire; convert the relevant scenarios into committed regressions during implementation.
- Browser data and Pro authentication were mocked. The Cloudflare Access preview, real account persistence, actual provider generation and physical iPhone behavior were not established by that review.

| Finding | Solution owner | Acceptance |
| --- | --- | --- |
| F1: Streaming scroll can miss a visible detail | Task 1 | A detail first arriving offscreen gets its turn when read during streaming; it does not wait for `done`. |
| F2: Detail activation lacks accessible full inspection | Task 2 | Touch, click, Enter and Space open the same labeled full-artwork dialog and return to the initiating passage. |
| F3a: Question, settings and listening are poorly ordered | Task 3 | Question/context, spread, listening and continuous prose form a clear reading sequence. |
| F3b: Saving and follow-up do not communicate completion | Task 4 | One save operation produces persistent Saved/View saved entry state; contextual follow-up is secondary. |
| F3c: Supporting tools compete with completion | Task 5 | Tools are grouped after the main path; feedback and starting over are quiet; installation is available elsewhere. |
| Readability and end-of-page requirements across these fixes | Tasks 6–7 | Labels, focus, artwork and trailing content retain targeted responsive UI coverage. |

## Global constraints

- Preserve the already working mobile spread fallback, desktop rail, visible card names/positions/orientations, and 15 px name / 14 px position captions. Keep the stable Markdown component identities introduced in `f002ad4`.
- Preserve exact supplied prose, question, original reflections, card occurrences, reversals and artwork editions. A cue key is identity metadata, not permission to invent or rewrite an association. Missing or unsupported detail metadata falls back to whole-card inspection.
- Preserve source-order visible turns with a full **1800 ms** active phase. Do not reinstate latest-only queue truncation, automatic overlays, hidden playback backlogs, forced scrolling or slowed prose delivery. Explicit inspection has priority.
- Reduced-motion and restored readings retain static, inspectable information. No new inference, paid provider requests, narrative regeneration, database migrations or deployment is needed for this checklist.
- Body text is at least **16 CSS px**; meaningful supporting labels are at least **14 CSS px**. Standalone controls have **44 × 44 CSS px** targets; primary completion actions are at least **52 px** high. Inline text controls must preserve readable line flow and have an equivalent large card-inspection target; do not inflate every word into a 44 px box.
- Use existing safe-area, keyboard and measured dock contracts. Reserve clearance once; measure the actual header/dock bounds when deciding whether a cue or focused control is visible.
- Preserve unrelated work and services on ports **8787/5175/8789/9235**. Refresh status before implementation; do not reset the primary checkout or restart those services. Commit/push/deploy are separate from this checklist request.

## Review focus

1. Text first arrives below the fold, then becomes visible before generation ends; later deltas, DOM replacements and the `done` transition must neither lose nor replay its turn (Task 1).
2. Inspection overlaps incoming text, selection/copying, focus restoration or replacement of its opener; the original passage and scroll position must survive (Task 2).
3. Save requests overlap rapid clicks, resizing, status timeout, a new reading, or an account/storage-mode change; a successful old request must not mark another reading saved (Task 4).
4. One-, three-, five- and ten-card spreads, reversals, unsupported detail geometry and 200% text must retain recognizable artwork and usable labels (Tasks 2 and 6).
5. An expanded tool, late image, wrapping button label, install dialog or on-screen keyboard changes layout; final prose and focused controls must remain reachable above the dock (Tasks 5–7).

## Task 1: Make visible cue eligibility work throughout streaming

**Dependencies:** None. **Finding:** F1.

**Modify:** `src/hooks/useNarrativeReadingLine.js`, `src/components/reading/narrative/cardTouchMotion.js`, `src/components/reading/narrative/NarrativeCardFocus.jsx`, `src/lib/narrativeCardLinks.js`, `src/components/StreamingNarrative.jsx`, `src/components/NarrativePanel.jsx`, `src/hooks/useNarrativeReadingController.js`, `src/hooks/narrativeReadingModelUtils.js`.

**Create:** `playwright.reading-purpose.config.js`, `vite.reading-purpose.config.js`. Create this test harness here so the first interaction fix can be verified independently; Task 7 records focused UI acceptance.

**Tests:** Extend `tests/cardTouchMotion.test.mjs`, `tests/narrativeCardLinks.test.mjs`, `e2e/reading-card-touch.spec.js`, and `e2e/helpers/narrativeFixtures.js`.

**Solution (review baseline):** Streaming and scrolling must feed the same eligibility process. Previously `read()` returns early for `isLive`, while `collect()` adds every discovered element to `announced` before the engine rejects offscreen details. Discovery must not mean that a cue was presented.

**Interfaces:** Keep `useNarrativeReadingLine(containerRef, { enabled, isLive })`. Add an opaque `data-reading-detail-key` to imagery spans; pass the existing `readingIdentity` into `NarrativeCardFocusProvider`. Extend `traces.reach({ key, card, points, element })` and the corresponding focus API. The engine owns queued/played keys for that reading. Add `traces.setSuspended(boolean)` for Task 2's inspection priority, without clearing the reading's playback ledger.

- [x] Create an isolated browser harness with focused desktop Chromium and phone WebKit defaults; keep additional device/motion profiles opt-in, `workers: 1`, `retries: 0`, an explicit test list and external artifact output. Use a checked unused `READING_REVIEW_PORT`, default 5214, a separate temporary Vite cache and no API proxy to protected port 8787. Fixtures must stub/block API/provider traffic; never silently reuse another agent's server.
- [x] Add the failing browser regression: emit a first delta with a recognized detail below the fold, scroll its complete phrase into the reading zone while the stream remains open, then emit another delta. Assert the detail is presented before `done`, and neither prose content nor page position is altered by presentation.
- [x] Give each detail occurrence a stable key based on its Markdown block source position, local rendered range, card occurrence and touch ID, scoped by `readingIdentity`. A later mention of the same card/detail gets a different occurrence key. Preserve the same logical key across split formatting. Test emoji, entities, repeated words and emphasis; do not treat flattened rendered offsets as raw Markdown source offsets.
- [x] Run visibility collection on scroll, resize and relevant Markdown mutations during both streaming and completed states. Remove the `isLive` bypass for eligibility; live arrival may still influence passive card emphasis, but may not prevent a reader from reaching earlier text.
- [x] Replace the discovery-only `announced` WeakSet with the engine's occurrence ledger. Record presentation when a turn actually starts, including every occurrence in a combined visual emphasis. Offscreen observations remain eligible later; queued duplicates do not restart timers. Do not collapse separate occurrences merely because card/point values match.
- [x] Compute visibility from the unobscured reading area, excluding sticky header, dock and keyboard occlusion. Require a complete recognized phrase to be rendered; discard queued items that leave view before their turn. Preserve every still-visible occurrence in source order for 1800 ms; any grouped emphasis must give each member that exposure and must not skip another waiting occurrence.
- [x] Preserve played identity across ordinary rerenders and the stream-to-complete transition. Disconnect observers on cleanup without treating `isLive` changes as a new reading. Clear the ledger on an actual reading/source replacement; discard invalidated ranges safely and rebind connected elements by key.
- [x] Make suspension pause automatic playback while inspection is open. On close, reassess current visibility before resuming eligible, unplayed turns. Reduced-motion/restored modes expose static associations and manual inspection without automatic arrival playback.
- [x] Add engine cases for four or more waiting visible occurrences, offscreen rejection followed by entry, queued disappearance, repeated mentions, suspension/resume and reading replacement. Add browser cases for scrolling backward during streaming, multiple deltas, selection continuity and `done` without duplicate playback.

**Verify:** Run the changed Node suites, then `READING_REVIEW_PORT=5214 npm run test:e2e -- --config playwright.reading-purpose.config.js reading-card-touch.spec.js` after checking that port is unused. For a deterministic draw, freeze the clock only through drawing, then restore advancing time before sending deltas: `ReadingContext` throttles streamed updates using `Date.now()`. Record rendered emphasis and timing, not just event receipt or a span's existence.

**Done when:** The reproduced offscreen-to-visible case works before generation completes, every eligible occurrence gets its turn, and automatic presentation never opens an overlay or moves the page.

## Task 2: Unify explicit inspection in an accessible full-artwork dialog

**Dependencies:** Task 1's suspension API. **Finding:** F2.

**Modify:** `src/hooks/useNarrativeReadingLine.js`, `src/lib/narrativeCardLinks.js`, `src/components/reading/narrative/NarrativeCardFocus.jsx`, `src/components/reading/narrative/SpreadCompanion.jsx`, `src/components/NarrativePanel.jsx`, `src/components/ReadingDisplay.jsx`, `src/hooks/useNarrativeReadingController.js`, `src/hooks/narrativeReadingModelUtils.js`, `src/hooks/useReadingSelection.js`, `src/components/reading/ReadingOverlays.jsx`, `src/components/CardModal.jsx`, `src/styles/narrative-card-touch.css`. Extend `src/hooks/useModalA11y.js` only if its existing return-focus/fallback options cannot satisfy the cases below.

**Tests:** Extend `e2e/reading-card-touch.spec.js`, `e2e/reading-visual-modals.spec.js`, `tests/narrativeCardLinks.test.mjs`, and `tests/narrativeSemantics.test.mjs` where shared renderer assertions are affected.

**Solution (review baseline):** Use the same inspection path for shelf cards, inline artwork, card names and imagery phrases. The current detail `choose()` branch calls `holdDetail()` and creates `CardEcho`; it must open the existing accessible dialog instead. The current `CardModal` also uses an 80 px phone image with `aspect-[2/3]` and `object-cover`, so routing alone is insufficient for full-artwork inspection.

**Interfaces:** Extend `api.selectCard(index, inspection = null)` and `ReadingDisplay`'s `handleSelectInsightCard(index, inspection = null)`. Optional inspection data is `{ detailKey, touchIds, phrase, triggerElement }`. Store validated context alongside `selectedCardData`, not in the narrative or saved source. Add optional `artworkMode='compact'`, `inspectionContext=null`, `returnFocusRef`, and `getFallbackFocus` props to `CardModal`; `ReadingOverlays` uses full artwork for reading inspection. Pass `inspectionOpen` from `selectedCardData` through the narrative model to the focus provider.

- [x] Add failing behavior checks: click/tap/Enter/Space on a returning imagery phrase opens a named modal containing the matching card, position, orientation and exact phrase. The full-card action must be reachable through the accessibility tree and keyboard.
- [x] Route detail and card-name activation through `selectCard`; validate the current reading identity, index and supported touch IDs in the owning controller. Give both kinds of text control dialog semantics (`aria-haspopup="dialog"`), replacing the detail's toggle-only `aria-pressed` contract. Preserve text selection/copying and avoid nested interactive elements in Markdown links.
- [x] Remove `CardEcho` from the reading path and remove its unused CSS/held-preview state. Hover and keyboard focus may continue passive in-flow emphasis; explicit activation alone opens inspection. Remove dead toggle methods only after checking all callers.
- [x] Implement the full-artwork reading mode: center the whole image, use the actual edition's aspect ratio with `object-fit: contain`, and target 216 px width / 360 px height for 3:5 artwork when space permits. Short screens must scroll the dialog rather than crop the image or lose its close control. Keep artwork and readable labels correctly oriented for reversed cards.
- [x] Show the original phrase as text alongside the card's accessible name, position and orientation. Only use detail highlighting supported by that exact artwork edition. Keep the whole card visible by default; missing geometry keeps a useful whole-card dialog. Changing cards through modal navigation clears mismatched phrase/highlight context.
- [x] Capture the actual activating element, including Safari taps that do not focus it. Reuse `useModalA11y` for focus trapping, background isolation, Escape and scroll locking. Provide a visible **Back to reading** action and backdrop dismissal. Suspend automatic cues from modal open until dismissal.
- [x] Restore focus to the connected opener or its replacement with the same detail key; otherwise use the matching available card control and then the reading focus target as fallbacks. Preserve pre-open reading scroll and avoid the `handleFocusIn` path calling `scrollIntoView()` during modal restoration. Keep ordinary keyboard navigation's visibility protection.
- [x] Test all dismissal paths with incoming deltas, completion during inspection, late artwork, text selection, missing/replaced opener, repeated activation, different decks and reversed cards. Assert actual image bounds/containment and scroll restoration (allow at most 2 CSS px rounding), not merely dialog visibility. Update the old echo-toggle test to the new dialog behavior; retain the no-automatic-overlay regression.

**Done when:** Every explicit entry point provides full, inspectable artwork and returns the reader to the same passage without relying on a hidden or untabbable preview button.

## Task 3: Put the question, context and listening controls before the prose

**Dependencies:** Tasks 1–2 behavior remains green. **Finding:** F3a.

**Modify:** `src/components/NarrativePanel.jsx`, `src/components/reading/narrative/NarrativePanelHeader.jsx`, `src/components/reading/narrative/NarrativeBody.jsx`, `src/components/reading/narrative/NarrationControls.jsx`, `src/components/reading/narrative/NarrativeStatusStack.jsx`, `src/hooks/useNarrativeReadingController.js`, `src/hooks/narrativeReadingModelUtils.js`.

**Create:** `src/components/reading/narrative/NarrativePersonalContext.jsx`, `e2e/reading-purpose-ui.spec.js`. **Extend tests:** `tests/narrativeSemantics.test.mjs`, `tests/narrativeReadingModelUtils.test.mjs`, `e2e/narrative-remediation.spec.js`, `e2e/media-narration-reliability.spec.js`.

**Interfaces:** Keep the header's existing focus-toggle callbacks and stable focus-target ID. Add `NarrativePersonalContext({ question, reflections, cards })`; `cards` uses the existing spread-card model. Add an `audioControls` slot to `NarrativeBody`. Make `NarrationControls` audio-only; separate `NarrativeStatusStack` with `section='audio'|'journal'` so voice errors/progress and journal completion can occupy their correct locations without duplication.

- [x] Change the page title to **Your reading**, preserving its h2 level, programmatic focus target and heading hierarchy. Put the existing focus toggle in native **Reading options**, labeled **Hide extra panels**, with a real pressed/checked state.
- [x] Retain the original question near the title; omit it when absent. Add **Your question and notes** as an accessible, in-flow disclosure showing exact original inputs with card/position labels. Do not depend on the three-line, `aria-hidden` note under an artwork button as the only way to read a reflection.
- [x] Wire original `reflections` through the narrative model to the new context component. Show all supplied note text when expanded; empty inputs have no fabricated replacements. Keep source inputs read-only here and preserve them across streaming and completion.
- [x] Order the reading as title/question/context, unobtrusive safety information, existing spread overview, one audio-control group, then continuous prose. Move loading/progress/pause/stop/voice-enablement/tier-error states with their audio control. Opening the page or a disclosure must not start narration or generation.
- [x] Remove the audio control's old completion-area copy. Preserve the original narrative heading order and closing practical invitation; do not create a browser-generated takeaway or an unsaved reflection field.
- [x] Add integrated assertions for empty/long question and notes, streaming/completed states, focus mode, keyboard disclosure operation, and exactly one visible narration control group across widths. Update title expectations deliberately while retaining heading nesting, live announcements, TTS offsets and existing narration-provider behavior tests.

**Done when:** The reader can recover their original context and choose listening before reading; the focus control is clearly a setting rather than an input-like pill.

## Task 4: Share save state and make completion useful

**Dependencies:** Task 3's audio/journal separation. **Finding:** F3b.

**Modify:** `src/hooks/useSaveReading.js`, `src/TarotReading.jsx`, `src/components/ReadingDisplay.jsx`, `src/components/MobileActionBar.jsx`, `src/hooks/useNarrativeReadingController.js`, `src/hooks/narrativeReadingModelUtils.js`, `src/components/NarrativePanel.jsx`, `src/components/reading/narrative/NarrativeStatusStack.jsx`, `src/components/scenes/CompleteScene.jsx`, `src/components/reading/complete/ContinueConversationSection.jsx`, `src/components/reading/complete/NewReadingSection.jsx`.

**Create:** `src/components/reading/complete/ReadingCompletionActions.jsx`. **Tests:** Extend `e2e/reading-purpose-ui.spec.js`, `e2e/helpers/narrativeFixtures.js`, `tests/narrativeReadingModelUtils.test.mjs`; retain `tests/journalDedupe.test.mjs`, `tests/journalFetchEntryById.test.mjs` and existing journal-owner coverage for affected persistence behavior.

**Solution (review baseline):** `TarotReading` and `ReadingDisplay` previously called `useSaveReading()` separately, so their in-flight and saved tracking is separate. `journalStatus` is cleared after five seconds. Neither separate hook instances nor the temporary notice should own persistent Saved/View saved entry behavior.

**Interfaces:** Have one `useSaveReading()` instance in `TarotReading` return `{ saveReading, isSaving, saveState }`, where `saveState = { readingKey, status: 'idle'|'saving'|'saved'|'error', entryId: string|null, error: string|null }`. Pass that controller into `ReadingDisplay({ saveController, ... })` and its narrative/completion model; the dock uses the same instance. Use the existing journal navigation contract `/journal` with route state `{ highlightEntryId: entryId, fromReading: true }` for exact-entry reopening.

- [x] Add regressions with a delayed journal response: repeated clicks and a handset-to-desktop resize must dispatch only one save. After success and the existing five-second notice timeout, the same reading must still expose **Saved** and **View saved entry** pointing at the returned ID.
- [x] Remove `ReadingDisplay`'s independent save-hook instance. Keep persistence in `useSaveReading`/`useJournal`; use an immediate in-flight ref/promise guard as well as disabled controls, so two activations before React rerenders cannot duplicate a request.
- [x] Capture the reading/source identity and journal owner/storage mode when a save starts. Bind saved state and returned entry ID to that snapshot; reset the visible state on a different reading, source regeneration or owner/storage-mode change. A late old success may finish its own storage operation but must not mark a newer reading saved. Preserve existing journal deduplication and original question/cards/prose/reflections.
- [x] Display **Save to journal** -> disabled **Saving…** -> **Saved** plus **View saved entry**. Keep error text and a retry on failure. Preserve the backend's returned ID for deduplicated results too. If success lacks an ID, show Saved with generic **View journal** and record the response-contract gap; never invent an ID or claim to reopen the exact entry.
- [x] Render the primary save/completion group once in the phone dock and once in the desktop in-flow completion area, with only the applicable version visible. Keep saved state independent of the transient `journalStatus`; avoid duplicate save nudges or competing journal buttons for the same completed reading.
- [x] Label the secondary action **Ask about this reading**. Reuse existing private follow-up context, entitlement handling and modal focus behavior. Test allowed, signed-out/local-storage, exhausted and unavailable states with truthful explanatory copy or existing sign-in/upgrade routes; do not add a new entitlement gate to guest journal saving.
- [x] Move **New reading** out of the completed dock into a quiet in-flow action after completion, available on phones as well as desktop. Reuse the current reset/shuffle path and protections; starting over must remain an explicit action rather than a side effect of save, disclosure or inspection.
- [x] Extend fixtures with real response-shaped entry IDs, delayed responses, errors and deduplicated saves. Test local guest save/reopen, authenticated save/reopen, rapid retry, status expiry, resize, new-reading-during-save and account/storage changes. Verify exact saved text and original notes, not just a success toast.

**Done when:** Saving feels complete, there is one persistence owner, and View saved entry reliably returns to the exact reading while contextual follow-up remains easy to find.

## Task 5: Group optional tools after completion

**Dependencies:** Tasks 3–4. **Finding:** F3c.

**Modify:** `src/components/scenes/CompleteScene.jsx`, `src/components/NarrativeReadingSurface.jsx`, `src/components/reading/complete/ReadingInputUsageSection.jsx`, `src/components/reading/complete/ReadingMediaSection.jsx`, `src/components/reading/complete/ReadingFeedbackSection.jsx`, `src/components/FeedbackPanel.jsx`, `src/TarotReading.jsx`, `src/components/UserMenu.jsx`, `src/components/InstallControl.jsx` as needed for its new host.

**Tests:** Extend `e2e/reading-purpose-ui.spec.js`, `e2e/spread-insights.spec.js`, `e2e/reading-input-usage.spec.js`, `e2e/reading-visual-modals.spec.js`, and affected `e2e/pwa-install.spec.js` / `e2e/pwa-install-lifecycle.spec.js` cases.

**Interfaces:** Reuse `narrativeModel.secondaryContent`, current studio/media handlers and `isNarrativeFocus`. A native **Explore this reading** disclosure owns supporting panels in the completed scene; focus mode controls their availability. Reuse `InstallControl` and `usePwaInstall` rather than a second install implementation.

- [x] Place **Explore this reading** after the original closing prose and primary completion path. Group spread insights, reading-input provenance, visual creation and recent media inside it; preserve their existing content and entitlement rules. Initial completion should show a compact disclosure, not a stack of expanded promotional panels.
- [x] Replace the studio teaser, generation badge and nested outlines with **Create images or video** plus one short description. Activation opens the existing studio; neither disclosure expansion nor card inspection dispatches image/video generation.
- [x] Give open tools clear headings and at most one outer decorative border per group. Keep each expanded/collapsed state accessible; avoid nested control groups that look like multiple primary actions.
- [x] Present **How did this reading land?** as a quiet feedback disclosure outside the interpretation. Keep its rating purpose distinct from original notes and journal content; retain pending, success and error behavior.
- [x] Remove `InstallFooter` from the reading-completion stack. Add the existing install control to the global UserMenu settings/utility area for both guest and signed-in states, preserving capability detection, dismissal and consumed-prompt focus restoration. The current branch has no other `InstallControl` host, so relocation must be implemented before removing its only entry point.
- [x] Preserve focus when a tool closes, focus mode hides supporting panels, or an install prompt consumes/removes its opener. Return focus to the relevant disclosure/settings trigger without opening another modal or scrolling to the page start.
- [x] Test guest and eligible-user tools, collapsed/expanded states, studio/media errors, empty media, feedback failure, focus-mode toggling and install supported/unsupported/standalone states. Assert zero provider requests merely from visiting or expanding the reading.

**Done when:** Read/save/follow-up is a complete path without traversing a feature catalogue; optional tools and installation remain discoverable in their intended locations.

## Task 6: Verify typography, spacing and dock clearance in the final composition

**Dependencies:** Tasks 2–5. **Covers:** Cross-cutting readability and preservation of previous fixes.

**Modify as needed:** `src/styles/narrative-card-touch.css`, `src/styles/tarot.css`, `src/styles/panelClasses.js`, `src/components/MobileActionBar.jsx`, `src/TarotReading.jsx`, and components changed by Tasks 2–5. Retain `src/hooks/useKeyboardOffset.js` behavior unless a reproduced issue requires a fix.

**Tests:** Extend `e2e/reading-purpose-ui.spec.js`, `e2e/reading-card-touch.spec.js`, and relevant `e2e/narrative-remediation.spec.js` geometry cases.

- [x] Measure the rendered final composition at 320, 390 and 428 px portrait widths, a short landscape viewport, and desktop. Cover one-, three-, five- and ten-card spreads, long card/position names, reversals and supported deck editions. Keep the mobile overview in normal document flow, with 88–108 px artwork and horizontal scrolling/overflow indication for longer spreads.
- [x] Preserve 15/14 px card captions; raise remaining meaningful context/action labels to at least 14 px, including original-note access and save/follow-up states. Keep at least 16 px body copy, roughly 1.65–1.75 line height and a comfortable desktop reading measure. Check text/focus contrast on both composed themes, including muted notes.
- [x] Use 8 px within action groups, 12–16 px between related elements and 24–32 px between reading sections. Remove stacked wrapper margins and empty reserved stages. Keep inline artwork modest enough for a readable adjacent prose column; use the original 96 px target where current wide floats compress phone text.
- [x] Preserve MobileActionBar's ResizeObserver measurement of `--mobile-action-bar-height` and the page's single clearance owner. Recalculate correctly when labels wrap, Saved actions appear, the device rotates or the keyboard opens. Do not add a second safe-area inset already represented by the measured dock.
- [x] Test 200% text, delayed/missing images, expanded supporting tools and the follow-up keyboard. At the bottom, every trailing prose line and action must scroll above the dock; keyboard navigation must expose a visible focus indicator without content being trapped under the sticky header.
- [x] Capture phone/desktop screenshots and inspect actual card/text overlap, hierarchy and wrapping. Use bounding-box/focus assertions for functional clearance; a passing CSS-size assertion alone is insufficient.

**Done when:** The reader can read, inspect, finish and act without pinching text, losing place or fighting fixed UI.

## Task 7: Focus verification on the changed UI

**Dependencies:** Tasks 1–6. This section supersedes the original full browser/tier/spread matrix after the user's explicit scope correction. No provider qualification or new reading generation is required.

- [x] Record the branch, baseline commit and working source manifest. Keep implementation uncommitted; preserve unrelated work and protected services on 8787/5175/8789/9235.
- [x] Make routine harness defaults the affected card/reading UI suites in desktop Chromium and phone WebKit, with one worker, zero retries, isolated Vite cache and mocked API/provider traffic. Extended profiles require `READING_REVIEW_MATRIX=1`; they were not completed or certified.
- [x] Exercise changed layout/order, question and notes disclosure, card inspection, all dismissal paths, focus and scroll restoration, save completion/retry, exact entry navigation, follow-up entry and optional tools using existing targeted results. Record source and evidence boundaries in the report; do not add up interrupted runs into a green matrix.
- [x] Check enlarged text, short screens, artwork failure and the relocated installation utility against measured hit areas and dock clearance. Inspect the phone capture; retain existing mobile overview and single dock-clearance ownership.
- [x] Record available unit, build, owned lint and static accessibility results. The repository lint failure belongs to untouched WordPress files. Stop the broad browser/PWA runs at the user's instruction.
- [x] Record the already completed local Pro login/save/reopen check separately from fixtures. Its synthetic journal entry was deleted and the account logged out; it made no live provider request.
- [x] Resolve the WebKit partial-stream regression. A minimal reproduction outside the app isolated idle, chunked fixture transport buffering. Periodic SSE keepalive comments deliver the same complete text without adding event IDs or changing UI assertions. The original WebKit case and its Chromium counterpart each passed; no application reading code changed for this correction.
- [ ] Physical iPhone/Safari/VoiceOver acceptance remains unavailable in this environment. Emulation does not establish physical-device behavior.
- [ ] An independent human reader's comprehension check remains unperformed.

Only rerun a changed or unresolved UI case. For example, from this worktree after checking port 5214 is free:

```bash
ss -ltn '( sport = :5214 )'
READING_REVIEW_PORT=5214 npm run test:e2e -- --config playwright.reading-purpose.config.js reading-card-touch.spec.js --project=webkit-phone-no-preference --grep 'offscreen details'
```

Use an unused port if needed; leave existing listeners alone. The broad matrix is not a release gate for this UI task. Static accessibility checks do not substitute for screen-reader testing. The Cloudflare Access preview was not redeployed or qualified by these local checks.

## Execution status

Tasks 1–6 have code and regression coverage. Task 7 has completed focused UI validation, including the previously failing WebKit case; physical-device and independent-reader checks remain open above. See the [implementation report](../reviews/2026-10-12-reading-touch-remediation.md) for exact results and limitations. The user authorized commit and isolated review-preview publication on 2026-10-12. Release evidence is recorded separately from these UI checks; no migration or provider experiment is needed.
