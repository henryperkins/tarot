# Reading UI purpose and fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans for a subsequently authorized implementation. The user requested an actionable breakdown; this document is a proposal, not an instruction to implement or publish now. Steps use checkbox syntax for tracking.

**Goal:** Help a reader connect their question, actual cards, interpretation and practical reflection, then save or continue the reading without losing their place.

**Architecture:** Keep the existing continuous reading, gesture association state, card inspection dialog and journal/follow-up actions. Recompose the mobile presentation around readable spread context and artwork beside relevant passages; retain the wide-screen companion. Consolidate supporting controls and reuse the existing action-bar measurement and save state.

**Tech Stack:** React/Vite, existing Tailwind/CSS tokens, gesture components, Node tests and Playwright Chromium/WebKit.

**Spec:** This proposed design derives from the user's October 12 screenshot and request, [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and [design contract](../../design-contract.md). The current preview-source checkout also contains `docs/superpowers/specs/2026-10-08-reading-imagery-motion.md` and `docs/superpowers/plans/2026-10-11-reading-intent-closure.md`; preserve their prose, imagery and source-binding constraints.

## Evidence and source boundary

- The screenshot shows the reading page, not an open detail dialog. Its downscaled text cannot establish actual CSS font sizes or contrast ratios. The concerns are visual hierarchy, small artwork relative to its container, an unexplained duplicate card, and competing controls.
- The supplied preview requires Cloudflare Access. This review did not obtain an authenticated live view or verify its current deployment.
- Current local record `docs/superpowers/reviews/2026-10-12-reading-mobile-feedback.md` associates the exact supplied version `96af2b08-f656-43cc-a86a-919b19128d21` with candidate `phone-detail-20261012-r3`. It records an authored sample replay, natural phone scrolling and corrected explicit card inspection. Those are recorded results, not checks rerun for this plan.
- Implementation paths below are relative to `/home/ubuntu/tarot/.worktrees/reading-review-consolidation-20261010`, branch `codex/reading-review-consolidation-20261010`, observed HEAD `70f1668`. Some components do not exist in the primary checkout. Refresh the working diff and source/build manifest before implementation; HEAD alone does not identify the frozen frontend.
- The primary checkout is dirty. This task adds only this plan in its documentation directory. Do not implement from the older primary or `d970` source merely because it is the current directory or appears in older notes.

## Proposed experience

**Your question → recognizable spread → continuous interpretation with nearby artwork → practical reflection → save or follow up.**

The reader should be able to answer: What was I asking? Which card is this passage discussing? What visible detail supports the connection? What do I want to take from it? How can I return to this reading?

Prefer artwork placed with reliably associated passages on phones. A large pinned companion consumes reading space; a companion only at the top disappears precisely when its imagery becomes relevant. Keep the spread overview for orientation, and make explicit inspection available from the passage itself.

This is a proposed mobile composition change, including removal of the separate idle detail stage on phones. It preserves the full inspection dialog and desktop companion. It does not treat the screenshot as proof that the previously repaired dialog is broken.

## Global constraints

- Preserve the exact narrative, heading order, question, supplied notes, spread occurrences, reversals and artwork editions. No rewriting accepted prose to fit the layout, forced card-by-card slides, or required response after every card.
- Preserve the approved scan-spread/vector-companion edition arrangement. Use supported artwork geometry; do not stretch all decks into one aspect ratio or reuse detail coordinates across editions.
- Preserve source-order visible turns, the existing 1,800 ms active phase, explicit inspection priority and uninterrupted text delivery. No forced scroll, autoplay overlays, hidden playback backlog or artificial reading slowdown.
- Reduced-motion and restored readings retain static, inspectable meaning. A missing association leaves readable prose and manual whole-card inspection. No new annotation-model dependency or provider calls are needed for these fixes.
- Keep original question/notes accessible independently of current cues. Do not mutate original reflections to store a new post-reading thought; those inputs participate in source identity.
- Use the existing brand tokens, serif headings and sans-serif reading copy. Product targets: body at least 16 CSS px, meaningful supporting labels at least 14 CSS px, controls at least 44 × 44 CSS px, primary touch action at least 52 px high. Verify rendered results rather than inferring them from the supplied scaled image.
- Work in an isolated checkout based on the confirmed preview candidate, preserving dirty work, retained evidence and services on 8787/5175/8789/9235. No release, provider experiment or migration is part of this plan.

## Review focus

1. A paragraph can reference several cards, revisit one, or have no reliable association. Inline artwork must not invent a connection or reorder the argument (Task 3).
2. Source streaming, text selection and inspection may overlap. Closing a dialog must restore the initiating passage without an automatic scroll jump (Tasks 2–3).
3. Ten cards, long translated names, rotated artwork, landscape and 200% text enlargement must remain usable (Tasks 2 and 6).
4. Guest, signed-in, saving, saved, failure and follow-up entitlement states need meaningful actions; a duplicate save or unexplained unavailable action breaks the reflection flow (Task 4).
5. A late image, wrapping action label or mobile keyboard can change the usable viewport. The last line and every focused control must remain above the bottom dock (Tasks 4 and 6).

## File ownership map

| Responsibility | Existing files in the preview-source checkout |
| --- | --- |
| Reading order and original context | `src/components/NarrativePanel.jsx`, `src/components/reading/narrative/NarrativeBody.jsx`, `NarrativePanelHeader.jsx`, `NarrativeQuestionAnchor.jsx`, `NarrativePersonalContext.jsx` in that directory |
| Spread, nearby artwork and inspection | `src/components/reading/narrative/SpreadCompanion.jsx`, `CardTouchArt.jsx`, `GesturePhrase.jsx`, `NarrativeCardFocus.jsx` in that directory; `src/components/MarkdownRenderer.jsx`; `src/styles/narrative-card-touch.css` |
| Completion and optional tools | `src/components/scenes/CompleteScene.jsx`, `src/components/NarrativeReadingSurface.jsx`, `src/components/reading/complete/ContinueConversationSection.jsx`, `src/components/SpreadPatterns.jsx`, `src/components/FeedbackPanel.jsx` |
| Save, audio and navigation | `src/components/MobileActionBar.jsx`, `src/components/reading/narrative/NarrationControls.jsx`, `src/hooks/useSaveReading.js`, `src/hooks/useNarrativeReadingController.js`, `src/TarotReading.jsx`, `src/components/InstallFooter.jsx` |
| Type, spacing and clearances | `src/styles/tarot.css`, `src/styles/narrative-card-touch.css`, `src/styles/panelClasses.js`, `tailwind.config.js` |

### Task 1: Put the question and reading first

**Depends on:** Confirmed source snapshot. **Files:** Reading-order files above; `src/components/NarrativeSafetyNotice.jsx`.

**Interfaces:** Retain `NarrativePanelHeader({ focusToggleAvailable, isNarrativeFocus, onToggleNarrativeFocus })` and `NarrativePersonalContext({ question, reflections, cards })`. Rearrange their presentation without changing input identity.

- [ ] Present a short page title, **Your reading**, followed by the user's original question and one nearby **Your question and notes** action. Follow with the spread and opening prose. With no supplied question, omit the question block rather than inventing one.
- [ ] Move the existing focus-mode control into a clearly labeled **Reading options** disclosure. Label its existing behavior **Hide extra panels**, preserving its pressed state and keyboard access; it must not look like a text field.
- [ ] Keep safety copy accessible and readable. Remove redundant decorative framing around it; preserve substantive boundaries and distinguish ordinary reading context from a genuine error or safety fallback.
- [ ] Verify that the heading remains the programmatic reading focus target, and that question/notes can be opened before, during and after streaming without losing the reading position.

**Done when:** The page establishes the question and begins the reading without an unexplained preview stage or a row of competing settings. The user can recover their original inputs at any time.

### Task 2: Make the spread useful and inspection explicit

**Depends on:** Task 1 composition. **Files:** `SpreadCompanion.jsx`, `CardTouchArt.jsx`, `src/styles/narrative-card-touch.css`.

**Interfaces:** Preserve shelf `api.holdCard(occurrenceId)`, phrase `api.holdAssociation(associationId)` and dismissal `api.releaseAssociation()`. Preserve the current modal accessibility helper.

- [ ] Replace the mobile 40 px artwork/44 px shelf-button sizing with a three-card row using the available content width: 16 px outer gutters, 12 px gaps, and artwork capped at 108 px wide. At a 320 px viewport this allows approximately 88 px per card; at wider phone sizes it reaches the cap. Size the one-card spread independently rather than stretching it to full width.
- [ ] Show position, card name and orientation as actual visible labels. Allow wrapping; preserve the full accessible name and current-card indication.
- [ ] For four or more cards, use a horizontally scrollable row with a minimum 88 px card width and a visible overflow cue. Keep every card reachable by touch and keyboard; never shrink ten cards into one tiny row or automatically scroll the page.
- [ ] Remove the separate mobile `.gesture-window` and empty `.gesture-context` footprint from the normal reading layout. Retain a labeled desktop stage and the explicit phone inspection dialog. Remove its placeholder reservation when it no longer replaces an in-flow stage.
- [ ] In the detail dialog, include the selected card's name, position and orientation with full artwork, plus the associated phrase when available. Preserve whole-card inspection; offer detail emphasis only for supported literal associations.
- [ ] Verify shelf tap, inline activation, close button, backdrop and Escape. Restore focus to the connected opener; use the existing matching-shelf fallback only if that opener no longer exists. Preserve the pre-open reading scroll position.

**Done when:** The spread is recognizable, the unexplained fourth-card appearance is gone, and a reader can inspect the full artwork then resume their exact passage. This is distinct from merely meeting the earlier 216 × 360 px modal check.

### Task 3: Keep artwork connected to the interpretation

**Depends on:** Task 2 inspection path. **Files:** `NarrativePanel.jsx`, `MarkdownRenderer.jsx`, `StreamingNarrative.jsx`, `SpreadCompanion.jsx`, `GesturePhrase.jsx`, `NarrativeCardFocus.jsx`, `src/styles/narrative-card-touch.css`.

**Interfaces:** Reuse `renderParagraphLead` and `CardTouchPlate({ cardIndex })` where applicable. Extend `CardTouchPlate` with optional `associationId = null`: activate `holdAssociation(associationId)` for a validated detail association, otherwise `holdCard(card.occurrenceId)` for whole-card inspection. Keep `onSelectCard(cardIndex)` as the existing non-gesture fallback.

- [ ] Attach one modest, in-flow card figure to the beginning of a reliably associated interpretation passage on phones, using a 96 px artwork target and visible position/name/orientation. Pair it with the heading or opening lines so image and interpretation can be seen together. Avoid repeating it for every mention.
- [ ] Correct the current paragraph-lead wiring: `cardLinks` requires `gestureStudyEnabled`, while the existing lead condition also requires `!gestureStudyEnabled`. Decide rendering from validated association availability and layout, not mutually exclusive flags.
- [ ] Use existing source-bound associations and card occurrences. An opening roster is not an interpreted passage. Do not guess from common words, rewritten headings or card order. Unsupported or ambiguous passages keep ordinary prose and available manual inspection.
- [ ] Preserve relationship and returning-card passages. Render a pair only when a validated association supports it; do not split continuous prose into forced one-card panels.
- [ ] Route visible cue emphasis to the nearby figure on phones and retain the desktop companion. Register actual artwork visibility and inspection state. Offscreen artwork is not counted as seen; held inspection, reduced motion and saved readings retain their current priority/static rules.
- [ ] Keep image space stable while assets load and keep renderer identities stable through streaming. Selecting or copying prose must remain possible without opening a dialog or losing the selection.

**Done when:** While reading a card passage, someone can see which card it concerns and inspect the relevant artwork without scrolling back to the page top. Missing cues do not block the reading or start new inference.

### Task 4: Give the reading a useful ending

**Depends on:** Tasks 1–3. **Files:** Completion/action files in the ownership map; existing status components under `src/components/reading/narrative/`.

**Interfaces:** Reuse `onSaveReading`, `onOpenJournal`, `onViewJournalEntry`, `onOpenFollowUp`, `onNewReading` and the existing journal success/error status. Persist once through `useSaveReading`; do not create a second save implementation.

- [ ] Let the original synthesis and practical invitation finish the reading. Give that closing the same readable heading and paragraph treatment as the rest of the narrative. Preserve the exact text; do not generate a replacement takeaway in the browser.
- [ ] Make **Save to journal** the clear primary completion action. On phones place it in the dock once; on desktop use the in-flow completion controls. On success show **Saved** with **View saved entry** targeting the returned entry ID, rather than continuing to invite another save.
- [ ] Make **Ask about this reading** the secondary action, using the existing private follow-up flow. Preserve question, cards and reading context. Use existing guest/entitlement handling; any unavailable state needs a visible reason or actionable sign-in/upgrade path.
- [ ] Keep **New reading** as a quieter action in the completion area or overflow menu. Preserve existing reset protections and prevent incidental navigation from silently losing the reading.
- [ ] Place the single audio control near the beginning of the prose so a reader can choose listening early. Retain play/pause/stop/loading/error behavior, and avoid showing a second copy in the completion controls.
- [ ] Exercise save pending, success, repeat activation, offline/failure and journal reopen. Original supplied notes remain available and saved. A new editable post-reading takeaway would need its own persistence contract; do not introduce a field that loses text or overwrites original input snapshots in this UI fix.

**Done when:** The reader can finish, save, reopen the exact entry and ask a contextual follow-up. Saving feels like completion; optional media and starting over do not compete with it.

### Task 5: Consolidate supporting tools

**Depends on:** Task 4 action hierarchy. **Files:** `CompleteScene.jsx`, `NarrativeReadingSurface.jsx`, `SpreadPatterns.jsx`, `FeedbackPanel.jsx`, `InstallFooter.jsx`, `TarotReading.jsx`, `NarrativePanelHeader.jsx`.

**Interfaces:** Keep existing studio, insights, feedback and install handlers. Use one outer native disclosure or accessible equivalent for **Explore this reading**; retain the existing focus-mode state for visibility of extra panels.

- [ ] Put spread insights and the visual studio under **Explore this reading**, after the reading and primary completion path. Preserve each feature's content, entitlement rules, loading/error states and modal focus behavior.
- [ ] Replace the large studio teaser, generation badge and nested outlines with a compact **Create images or video** entry and one short description. Reveal the existing studio only after activation; this label does not trigger generation itself.
- [ ] Present **How did this reading land?** as a quiet feedback disclosure outside the interpretation. Make clear it rates the reading, rather than serving as the user's journal reflection.
- [ ] Remove the standalone Home Screen installation promotion from this reading-completion stack. Keep installation available in the existing global navigation/help surface, preserving its dismissal and browser capability logic.
- [ ] Use one divider between supporting groups and one border per open tool. Eliminate nested decorative panels while keeping expanded/collapsed state and keyboard focus visible.

**Done when:** Someone can read, save and follow up without navigating a feature catalogue; deeper tools remain easy to find after completion.

### Task 6: Apply a readable, consistent mobile layout

**Depends on:** Final composition in Tasks 1–5. **Files:** Existing tokens/styles, `NarrativePanel.jsx`, `NarrationControls.jsx`, `MobileActionBar.jsx`, `TarotReading.jsx`.

- [ ] Measure computed type sizes in the actual build. Use at least 16 px body copy with approximately 1.65–1.75 line height, 14 px meaningful supporting labels, and a 60–68ch reading column on wide screens. Keep serif headings and the existing palette.
- [ ] Check contrast on the final composed backgrounds, especially labels, secondary buttons and legal/context copy. Target the repository's AA text and focus contrast rules; preserve daylight-theme equivalents when adjusting semantic tokens.
- [ ] Use a small spacing scale: 8 px within a control group, 12–16 px between related elements, and 24–32 px between reading sections. Remove accumulated wrapper margins and empty reserved stages; do not fill every gap with another box.
- [ ] Preserve measured dock height, keyboard offset and safe-area handling. Reserve the dock clearance once, using the existing `--mobile-action-bar-height` contract, plus breathing room. Avoid double-counting an inset already included in the measured height.
- [ ] Verify 320, 390 and 428 px portrait widths, short landscape, desktop, light/dark themes, long labels and 200% text. Normal scrolling and keyboard focus must bring the last paragraph, open disclosure contents and every action fully above the dock.

**Done when:** Artwork and text remain readable without pinching, controls are clearly interactive, spacing follows the content, and the final reading lines remain reachable with mobile browser chrome or the keyboard present.

### Task 7: Verify the intended experience

**Depends on:** Tasks 1–6. **Files:** Extend affected existing suites including `e2e/reading-gestures-geometry.spec.js`, `reading-gestures-refinement.spec.js`, `reading-personal-context.spec.js`, `reading-visual-modals.spec.js`, `narrative-remediation.spec.js` and `spread-insights.spec.js`. Add `e2e/reading-purpose-ui.spec.js` for the integrated sequence and `playwright.reading-purpose.config.js` for an isolated lane.

- [ ] Add the proposed config with Chromium/WebKit desktop and phone profiles, normal/reduced motion, `workers: 1`, `retries: 0`, explicit test matches and an owned unused port (proposed 5214, checked before startup). Start only the implementation checkout. Set presentation on and model annotations off for this lane; block/stub provider requests.
- [ ] Write behavioral regressions for the review-focus cases in their owning tasks before changing the relevant behavior. Use rendered geometry for clipping and dock clearance, meaningful source/focus/selection assertions for interaction, and screenshots for hierarchy. Avoid tests that merely repeat CSS values.
- [ ] Cover one-, three-, five- and ten-card spreads, reversed cards, supported deck editions, relationship/revisit passages, missing/ambiguous associations, long questions/notes, delayed artwork, streaming, completed and restored readings.
- [ ] Verify guest/free/Plus/Pro control states with labeled fixtures. Separately exercise a real signed-in Pro save/reopen/follow-up UI using the local reviewer procedure on a confirmed safe local origin, without model inference or credential logging, then log out. Do not send the local reviewer credentials to the Cloudflare Access preview or restart protected beta services.
- [ ] Inspect both the authored preview and preserved representative generated readings. Confirm that question, imagery, interpretation and practical invitation connect in the actual content. A polished sample replay does not prove narrative-provider quality; content defects belong in the existing narrative-quality work rather than being hidden by frontend rewriting.
- [ ] On a physical iPhone, read naturally, open a card halfway down, return to the same passage, reach the last line, save and reopen. Repeat key controls with VoiceOver and larger text. Record device/iOS, authentication/tier and source identity; emulation remains separate evidence.
- [ ] Ask a fresh reader to identify the question, name the card behind a passage, point to the relevant artwork, describe a useful next reflection, and save/reopen the reading. Confusion in those tasks is a product failure even if screenshots and click tests pass.

Run the scoped lane after its config/spec exist:

```bash
VITE_READING_ALIGNER_ENABLED=true VITE_READING_MODEL_ANNOTATIONS=false npx playwright test --config playwright.reading-purpose.config.js
node --test tests/narrativeGestureState.test.mjs tests/narrativeCardLinks.test.mjs tests/readingPersonalContext.test.mjs tests/narrativeFocusTarget.test.mjs tests/narrativeSemantics.test.mjs
npm run lint
npm run test:a11y
npm run build
```

Run `npm test` before a subsequently authorized push. Reuse unchanged acceptance evidence with its original source identity; rerun affected behavior and shared-path dependencies. If narrative generation or prompts change in a later scope, use the existing subscription-authenticated narrative gate and record that separately. The commands above are future implementation checks and were not run for this document.

**Done when:** A person can connect question, card and prose, inspect without losing place, complete a reflection and return to the saved reading. Report functional, visual, real-authentication, physical-device and live-deployment evidence separately.

## Execution order and current result

Execute Tasks 1–3 first: they restore the connection between the cards and the reading. Then complete Tasks 4–5 for the ending and optional tools, Task 6 for consistent presentation, and Task 7 for final acceptance. Add each task's relevant regression alongside its implementation rather than deferring all verification to the end.

Current result: proposal and source inspection only. Application files, tests, preview services and deployments were not changed or run by this planning task. The proposed inline phone composition and action hierarchy remain reviewable decisions, not shipped behavior.
