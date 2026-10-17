# Remaining Frontend Failures Checklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Resolve every remaining lint error, confirmed behavior defect, invalid test assumption, and test-environment gap identified in the October 8 investigation, while preserving the pending React hooks cleanup and its bug fixes.

**Architecture:** Keep behavior and state ownership in existing components, hooks, and providers. Correct test configuration before judging motion-sensitive behavior, repair confirmed defects with focused regression coverage, then verify the unchanged source snapshot in both development and built-preview lanes.

**Tech Stack:** React 19, Vite, ESLint/react-hooks v7, Playwright with Chromium and WebKit, Node's test runner.

**Spec:** The user's October 8 review and subsequent investigation, summarized by the coverage table below. Product decisions follow [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and [design-contract.md](../../design-contract.md). Raw investigation evidence currently resides at `/tmp/tarot-remaining-errors-investigation-20261008.md` and the artifact paths named there; this checklist contains the actions and acceptance criteria without requiring those temporary files.

**Status:** Planning only. Existing fixes are explicitly labeled for preservation and verification. Unchecked implementation items have not been completed by creating this document. Investigation baseline: `ba009b3` plus the pending working-tree changes; refresh this baseline before execution.

## Global Constraints

- Preserve unrelated tracked changes, plugin-review archives, review Markdown, `tmp/plugin-review-2026-10-01/`, and `docs/Uploadandsubmityourplugin.md`. Stage explicit owned paths only when committing is requested.
- Follow existing ESM/functional React conventions: 2-space indentation, single quotes, terminal semicolons, and existing design tokens.
- Retain the full-history search and failed-preferences request fixes already in the pending diff.
- Do not suppress lint rules, weaken geometry assertions, automatically accept snapshots, or increase timeouts to conceal unexplained failures.
- Browser tests stub external services. Record guest, mocked subscription, real-account, browser, viewport, and actual motion coverage separately; use [the local reviewer workflow](../../local-reviewer-account.md) for any real Pro session.
- Run `npm test` before pushing. No commit, push, deployment, migration, narrative-provider invocation, or GitHub billing change is part of checklist creation.

## Review Focus

- Canceled deferred callbacks must leave an auth recheck pending: Task 3.
- Account changes must isolate coach drafts and storage, including saving the previous owner's draft: Task 8.
- Manual edits, deliberate empty questions, restored AI text, and late responses must preserve the reader's chosen wording: Task 8.
- Moving headers, entrance transforms, and docks must not make off-screen focus appear valid: Task 4.
- Nested-dialog cancellation must restore the exact opener without a later parent-trap focus jump: Task 7.

## Task 1: Isolate the test server and eliminate reload interference

**Files:** `vite.config.js`; `playwright.config.js`, `playwright.a11y.config.js`, `playwright.hardening.config.js`, `playwright.install.config.js`, `playwright.journal.config.js`, `playwright.modals.config.js`; affected API fixtures under `e2e/helpers/`.

**Interfaces:** Produces strict, dedicated test origins and server ownership for all subsequent tasks. Existing intentional external-origin overrides remain usable.

- [ ] Record HEAD, working-tree/index status, installed Playwright version, and occupied test ports before execution. Do not run browser checks while another agent edits the tested source.
- [ ] Give each automatic test server a dedicated loopback port, matching command/base URL, `--strictPort`, and `reuseExistingServer: false`. Preserve the modal configuration's current strict port 5197, one worker, and 60-second test timeout.
- [ ] Exclude nested `.worktrees` and unrelated scratch directories from Vite watching. Verify that editing a temporary ignored HTML file causes no page navigation; verify that editing an actual application file still updates the app. Restore probe files afterward.
- [ ] Mock every expected API call in frontend-only fixtures, including auth/health probes, or explicitly run the Worker when backend behavior is under test. Do not broadly swallow unknown API failures. Remove conflicting color environment settings from the verification invocation if present.
- [ ] Run `npm run test:e2e:modals -- --retries=0`. Completion requires no server reuse, unexpected document reload, detached-element timeout, or unexplained backend connection error. The traced historical modal timeout is resolved by eliminating reload interference, not by raising its timeout.

## Task 2: Make motion profiles real

**Files:** The six configs in Task 1; `e2e/accessibility.spec.js`, `e2e/journal-responsive-adaptation.spec.js`, `e2e/share-note-hardening.spec.js`, `e2e/page-transitions.spec.js`; create `playwright.regressions.config.js`; add `test:e2e:regressions` to `package.json`.

**Interfaces:** Produces verified `reduce` and `no-preference` browser contexts consumed by Tasks 4, 7, 8, 12, and 13.

- [ ] Replace ignored top-level `use.reducedMotion` and affected `test.use({ reducedMotion })` declarations with `contextOptions: { reducedMotion }`, preserving any existing context options. Keep valid `page.emulateMedia` and `browser.newContext` settings.
- [ ] In the modal project matrix, set `use.contextOptions.reducedMotion` for each named profile. Preserve Chromium, desktop WebKit, and iPhone WebKit coverage in both modes.
- [ ] Add a runtime media assertion to the motion-sensitive test setup: `matchMedia('(prefers-reduced-motion: reduce)').matches` must equal the intended mode. Ensure global defaults do not override a project's normal-motion selection.
- [ ] Add a focused regression runner using the same six verified engine/device/motion profiles, a dedicated strict loopback server on port 5198, one worker, and no retries or server reuse. Include the specs named in Tasks 3–8, 10, 12, and 13; preserve their mobile/desktop tag selection. Name the projects `chromium-reduce`, `chromium-no-preference`, `webkit-desktop-reduce`, `webkit-desktop-no-preference`, `webkit-iphone-reduce`, and `webkit-iphone-no-preference`.
- [ ] Run `npm run test:e2e:modals -- --retries=0`: all six saved-intentions profiles must pass with the media assertion. Run the affected local motion overrides as well. Profile names alone are not completion evidence.

For a spec named below, its standard focused verification command is `npm run test:e2e:regressions -- e2e/<spec>.spec.js --retries=0`. Use `--project=<name>` to select a specific verified motion profile; Task 4 adds repeat counts. This runner supplements the broad frontend suite and dedicated modal/Worker lanes.

## Task 3: Preserve and verify the fixes already in the pending diff

**Files:** `src/hooks/useJournalFilters.js`, `src/contexts/AuthContext.jsx`, `src/contexts/PreferencesContext.jsx`, `src/components/UserMenu.jsx`, `e2e/frontend-effect-state.spec.js`, `e2e/auth-route-recheck.spec.js`, `playwright.integration.config.js`, `package.json`, `playwright.modals.config.js`.

**Interfaces:** Preserves stable idle search state, request lifecycle behavior, and one pending auth recheck across redirects. This is independent of AuthModal email retention in Task 6.

- [ ] Retain shared `IDLE_SERVER_SEARCH` for both state initialization and inactive search; confirm no fresh idle `results` array reaches the filtered-list memo.
- [ ] Run the existing highlight cases before any filter edit and after an edit. Each deep link must scroll once, preserve the reader's later scroll during unrelated rerenders, clear the highlight around its configured 3.2-second expiry, and keep an entry beyond the first batch rendered.
- [ ] Preserve full-history search coverage: repeat a query after clearing it, wait for the new response, reject obsolete results, and leave the loading state. Preserve unavailable-entry banner recovery and pagination reset coverage.
- [ ] Preserve failed-preferences coverage: an open menu must issue one failed request without a render-driven loop; explicit retry makes one additional request and can recover. Cover usage errors independently.
- [ ] Retain the AuthContext pending-recheck fix: consume route/initialization markers only when the deferred check actually executes. Run all five StrictMode/native-microtask cases, covering initialized and initially skipped `/design` and `/governance-critique`, consecutive normal redirects, and ordinary navigation with no extra check.
- [ ] Verify `npm run test:e2e -- e2e/frontend-effect-state.spec.js e2e/auth-route-recheck.spec.js --workers=1 --retries=0`, plus WebKit coverage through a dedicated profile. Keep the Vite-only auth harness excluded from Worker integration runs.
- [ ] Before an eventual scoped commit, confirm both new files—`playwright.modals.config.js` and `e2e/auth-route-recheck.spec.js`—are included. Verify `test:e2e:modals` works from the committed file set rather than relying on untracked files.

## Task 4: Keep the small-phone intention field visible on focus

**Files:** `src/TarotReading.jsx` (`scrollQuickIntentionIntoView`), relevant existing header/dock styles in `src/styles/tailwind.css`, `e2e/intention-polish.spec.js`.

**Interfaces:** Consumes verified motion settings from Task 2. Produces a focus reveal bounded by the viewport, sticky header, and visible action dock.

- [ ] Strengthen the existing failing test before changing scrolling: assert the field lies inside the viewport and between the measured header and dock; assert the dock itself is in its settled viewport position. Exercise focusing during and after the page entrance transition.
- [ ] Scroll the actual focused field using immediate focus-reveal behavior. Recheck its bounds after header compaction or relevant layout changes while it remains focused, correcting any occlusion without overriding later intentional reader scrolling.
- [ ] Test the original 320×568 viewport and a larger handset, focus/blur/refocus, enlarged text, both actual motion modes, and viewport-height/safe-area changes while focused. A passing assertion must not accept a field and transformed dock that are both below the viewport; assert the intended field actually has focus.
- [ ] Run the small-phone focus case on WebKit with `--repeat-each=10 --retries=0` in each motion mode. Completion requires zero failures and correct geometry; retain a trace on failure. Preserve the rest of intention editing and reading completion behavior.

## Task 5: Support keyboard scrolling in both Arcana rows

**Files:** `src/components/ReadingJourney/sections/MajorArcanaMap.jsx`, `e2e/startup-hardening.spec.js`.

**Interfaces:** Both existing focusable row groups consume ArrowLeft/ArrowRight and scroll horizontally without moving focus or scrolling the document.

- [ ] Extend the regression to both rows: ArrowRight increases `scrollLeft` when overflow exists, ArrowLeft returns it toward zero, boundaries remain valid, and focus stays on the row.
- [ ] Add a shared explicit horizontal key handler to both groups. Prevent the browser's competing arrow action for handled keys; preserve Tab, other keys, and existing accessible group names.
- [ ] Run the Arcana case on Chromium, desktop WebKit, and mobile WebKit in both actual motion modes, including the original 1280×900 emulated-mobile case and a narrow viewport. No-overflow rows must remain usable. Label this browser-emulation evidence; physical keyboard behavior remains separately unverified.

## Task 6: Restore the tested auth email-draft behavior

**Files:** `src/components/UserMenu.jsx`, `src/components/AuthModal.jsx`, `e2e/frontend-state-sync.spec.js`.

**Interfaces:** Lift the ephemeral email draft into the mounted menu owner and pass it into the deferred modal through `emailDraft` and `onEmailDraftChange`. Keep passwords, confirmation, loading, visibility, and feedback owned by each modal session. This preserves lazy mounting.

- [ ] Keep the existing close/reopen email-preservation contract as the implementation target. If product intent instead changes, document that decision explicitly before altering the test; there is no current design requirement justifying deletion of the assertion.
- [ ] Add optional controlled email-draft props to AuthModal with its existing local state as fallback for other callers. Wire UserMenu's draft into the deferred instance without persisting it to storage or another account.
- [ ] Clear the owned draft at authentication/account-session boundaries. A reopened modal keeps the email but starts with cleared passwords, masked visibility, fresh mode selection, and cleared feedback. Ignore obsolete responses from a closed session.
- [ ] Run `e2e/frontend-state-sync.spec.js` at 390px and 1280px, covering mode switches, failed submission, close/reopen, successful sign-in, and sign-out/account change. Check the fallback callers on Journal, Account, and Pricing as well. Preserve focus restoration, deferred loading, and missing-chunk recovery. Both original email assertions must pass.

## Task 7: Give onboarding focus one initial-focus owner

**Files:** `src/components/onboarding/OnboardingWizard.jsx`; create `e2e/onboarding-exit-focus.spec.js`; extend `playwright.modals.config.js` to include the new spec.

**Interfaces:** The existing `useModalA11y` hook owns initial focus/restoration. The parent FocusTrap enforces containment while the nested ConfirmModal temporarily owns its own layer.

- [ ] Persist the scratch reproduction as a regression: open “Save & resume later,” cancel via “Stay here,” and assert the exact resume opener remains focused across subsequent animation frames and rerenders. Cover the equivalent Skip opener.
- [ ] Apply the proven minimal direction: set the parent trap's `initialFocus: false`, retaining `useModalA11y` initial focus and the existing parent/nested trap activation. Pausing alone is insufficient because unpause also invokes initial focus.
- [ ] Verify Tab/Shift+Tab containment, Escape cancellation, repeated nested opening, Skip confirmation, Save & close persistence, and focus/scroll restoration after the outer wizard closes.
- [ ] Update the nearby ownership comment to match the final code and ConfirmModal's hook-based focus handling.
- [ ] Run `npm run test:e2e:modals -- --retries=0`. Require at least the 12 skip/resume narrow-layout combinations across the six verified motion profiles, plus desktop-width initial-focus, containment, and direct-close checks. The prior 390×844 proof alone does not establish desktop coverage.

## Task 8: Resolve all six coach lint errors as one lifecycle refactor

**Files:** `src/contexts/GuidedIntentionCoachContext.jsx`, its mount in `src/TarotReading.jsx`, `e2e/intention-coach.spec.js`, `tests/coachDraft.test.mjs`, `tests/coachStorage.test.mjs`, `tests/intentionCoach.spread.test.mjs` where behavior changes warrant coverage.

**Interfaces:** A mounted coach session is scoped to its owner, initializes storage once, derives suggestions/guided output, and owns only genuine asynchronous work. Keep the existing public context API unless an internal change is necessary and update all consumers together.

- [ ] **Line 702:** replace effect-driven session initialization with an owner-scoped mounted session boundary and lazy initialization. Snapshot the previous owner's displayed draft before disposal and prevent it from initializing the next owner's session.
- [ ] **Line 723:** initialize templates, history, and journal statistics from the owner-scoped storage snapshot; retain save/delete/apply event updates and existing storage failure handling.
- [ ] **Line 739:** derive suggestions from their inputs instead of duplicating the calculation in state. Preserve source-change pagination reset behavior.
- [ ] **Line 745:** derive a valid page and rendered slice; associate explicit page selection with the suggestion source/session so stale choices do not leak into new results.
- [ ] **Line 750:** remove closed-state resets made obsolete by unmounting the coach. Retain timeout cleanup; if another consumer persistently mounts it, give that consumer an explicit session boundary.
- [ ] **Line 778 and the same generator effect:** derive guided question/loading state where possible; retain asynchronous generation, abort cleanup, and stale-response rejection. Snapshot displayed generated text even if that text is no longer stored as duplicated state.
- [ ] Extend behavioral coverage for account switching while open; draft restoration after close/reopen; spread changes before/after Remix; deliberate empty edits; editing during generation; canceled/failed requests; template changes; and changing suggestion counts/pages.
- [ ] Retain the current enlarged-editor reachability assertion. Verify long text at 320px is scroll-reachable with no horizontal or internal editor overflow; do not restore the obsolete requirement that the entire editor fit within one viewport.
- [ ] Run `npx eslint src/contexts/GuidedIntentionCoachContext.jsx`, `node --test tests/coachDraft.test.mjs tests/coachStorage.test.mjs tests/intentionCoach.spread.test.mjs`, and `e2e/intention-coach.spec.js` on Chromium and WebKit with verified motion settings. Completion requires all six errors gone and preserved draft/generation behavior.

## Task 9: Correct invalid Tooltip containers

**Files:** `src/components/ReadingJourney/JourneySidebar.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`; inspect `src/components/Tooltip.jsx` but keep its shared API unchanged unless necessary.

**Interfaces:** Both journey surfaces contain Tooltip's block root in a valid container while preserving text, classes, names, and tooltip interaction.

- [ ] Replace the offending paragraph wrappers at the investigated lines 454 and 535 with suitable containers, preserving their styling and semantics.
- [ ] Inspect desktop sidebar and mobile sheet with real rendered tooltips. Completion requires no React DOM-nesting warnings, unchanged keyboard/pointer tooltip behavior, and intact accessible names. Use existing browser/accessibility coverage; a mirror test of the wrapper tag is unnecessary.

## Task 10: Update all 11 stale Journal tests

**Files:** `e2e/journal-filters.spec.js`; existing Journal fixtures/helpers. Product targets are `JournalFilters.jsx`, `JournalFloatingControls.jsx`, and `useJournalFilters.js` only if the updated behavior assertions expose a new defect.

**Interfaces:** Tests use current accessible controls and separately measure all filtered matches, loaded records, and rendered pagination batches.

- [ ] Update desktop and mobile region locators from “Focus your journal” to “Journal filters.”
- [ ] Replace removed “Find a reading” navigation with “Jump to journal filters”; assert its scroll and search-focus behavior on desktop and mobile.
- [ ] Replace “Advanced filters” with “More filters”; cover compact disclosure, filter-map shortcuts, and opening/selecting the timeframe dropdown.
- [ ] Replace old “Showing n of n” assumptions with the current Filtered/Loaded meanings. Test rendered article counts for pagination rather than expecting the total matching count to change.
- [ ] Freeze fixture time and assert exact matching entries: Love IDs 0/6/12; reversals 0/4/8/12; 30-day window 0–4; the fixture's seven search matches. Assert filter clearing restores the original result set.
- [ ] Verify 10→15 rendered entries with and without an active query, filter edits reset the batch limit to 10 (rendering fewer when fewer entries match), and combined filters preserve their matching semantics.
- [ ] Run `e2e/journal-filters.spec.js` on both selected browser projects. Completion requires all 16 existing cases passing, with all 11 former failures exercising behavior beyond the formerly stale locator.

## Task 11: Count actual artwork downloads and cover built-only cases

**Files:** `e2e/initial-loading.spec.js`, `e2e/startup-polish.spec.js`; create `playwright.production.config.js`; add `test:e2e:production` to `package.json`.

**Interfaces:** The production config serves a freshly built bundle on strict loopback port 5199 with no server reuse. It includes the initial-loading/startup-polish specs in Chromium and WebKit and preserves their platform tags.

- [ ] Record pathname plus resource type in the artwork test. Count actual image requests separately from Vite's `?import&url` script modules; continue checking actual sound/media downloads.
- [ ] Assert onboarding fetches no hidden spread images or sounds, then skipping onboarding loads the selected artwork with nonzero natural dimensions. Exercise this in development and built preview.
- [ ] Add a repeatable built-preview lane: `npm run build` followed by `npm run test:e2e:production -- --retries=0`. Configure correct context motion settings, fixtures, trace retention, and a distinct results directory.
- [ ] Require all 18 formerly skipped production-only cases to execute and pass, covering startup budgets, deferred chunks, loading states, failure recovery, and deferred feature behavior. They may remain explicitly skipped in the separate Vite development lane.
- [ ] Preserve the intentional WebKit skip for Chromium CDP tab suspension; verify the supported Chromium case executes. Report unsupported CDP skips separately from missing production coverage.

## Task 12: Repair card snapshots and settle the clipping contract

**Files:** `e2e/cards-drawn-section.spec.js`, its existing snapshot directory, `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardFan.jsx`, sibling `useCardFan.js`, and maintained design documentation only if clarification is necessary.

**Interfaces:** Snapshot targets represent the actual collapsed stack and expanded fan after fonts, images, and layout settle. Any geometry change follows the recorded design decision.

- [ ] Assert the correct section and expanded/collapsed state before capture, wait for font/image readiness, and wait for the relevant transition/layout to settle. Preserve functional expansion, collapse, accessible labels, and card keyboard navigation checks.
- [ ] Compare actual captures with the existing files: the old collapsed dimensions differ, and the old fan image contains insights text rather than a fan. Review both intended captures before refreshing only these snapshots.
- [ ] Resolve the measured 6px/15px edge cropping against current `DESIGN.md` and the archived full-visibility note. Record which contract governs: permitted radius clipping must preserve usable visible targets; full card visibility requires geometry that reserves rotated card extents. Do not use snapshot acceptance to make this decision implicitly.
- [ ] If geometry changes are required, verify representative 1/3/6/10-card spreads at narrow widths and enlarged text; retain intentional overlap and accessible hit targets without horizontal page overflow.
- [ ] Run the cards spec twice without updating snapshots after the reviewed baseline refresh. Completion requires stable capture, passing comparisons, and functional checks. The historical pre-comparison stability timeout's exact cause remains unproven unless fresh traces establish it.

## Task 13: Close the four title/PWA timeout cases without weakening assertions

**Files:** `e2e/frontend-p1-hardening.spec.js`, `e2e/pwa-install.spec.js`; shared readiness helpers only when a repeated diagnosis justifies them.

**Interfaces:** Consumes isolated serving from Task 1. Tests retain descriptive title, stable-page-end, visibility, hit-target, and dialog behavior assertions.

- [ ] Rerun the ten-route/trailing-slash title case and the landscape/PWA Journal cases at 800×1000 and 1024×768 on the frozen source snapshot, three times each with retries disabled.
- [ ] Bound route visits individually and wait for route content readiness; preserve exact title assertions. In PWA tests, observe layout settling after safe-area padding changes and require actual viewport visibility, click hit tests, dialog opening/closing, and focus restoration.
- [ ] If a timeout recurs, retain traces and measure reloads, pending navigation/resources, scroll-height changes, and padding/dock geometry before editing product code or budgets. Establish a cause, apply its scoped fix, and rerun the exact case.
- [ ] Completion requires repeated passes in isolation and the broad final run. Record historical causes as unresolved if they remain unreproduced; do not claim title/PWA defects were fixed solely because isolated reruns pass.

## Task 14: Verify the whole result and prepare an explicit commit scope

**Files:** All task-owned paths above; update this checklist with results and unresolved decisions.

**Interfaces:** Produces a reproducible verification record and a reviewed set of owned changes. Integration/release results are reported separately from frontend/unit results.

- [ ] Run `npm run lint` and require zero errors; run `npm test`, `npm run build`, and `npm run docs:check`. Record totals and distinguish pre-existing warnings from failures. The root Node suite does not substitute for browser or Worker tests.
- [ ] With edits frozen, run the complete frontend suite, dedicated modal/Journal/install/hardening lanes, and the production lane with zero retries for the final evidence run. Include normal-motion checks for focus, keyboard, onboarding, and coach behavior; do not rely only on a global reduced-motion default.
- [ ] Run affected Worker-backed auth/Journal/preferences integration checks with local services available and external inference stubbed. Keep the Vite-only auth-route harness in its frontend lane; no paid provider requests are needed for these fixes.
- [ ] Review guest and signed-in Pro behavior for the changed account/Journal/coach flows using the documented local reviewer process. Keep mocked tier coverage for account switching and Plus/server-search thresholds; report real-account and physical-device gaps precisely and log out afterward.
- [ ] Account for every failed or skipped case. Completion requires zero unexplained failures, all 18 built-only checks executed, and an explicit reason for every remaining browser-specific skip. Update totals because new regression tests change the historical 588-case denominator.
- [ ] Review the final diff and explicit owned file list, including new configs/specs and reviewed snapshots. Confirm unrelated plugin-review and other-session files remain unchanged. Commit/push only when requested; deployment is a separate action.

## Coverage Map

| Investigation item | Checklist owner |
|---|---|
| Journal idle identity regression, full-history hang, preference retry flood, deferred auth recheck | Task 3 |
| Original 2 auth failures | Task 6 |
| Original title failure + 3 PWA failures | Tasks 1 and 13 |
| Original 2 artwork request failures | Task 11 |
| Original 11 Journal failures | Task 10 |
| Original card capture/snapshot failure + uncertain fan clipping | Task 12 |
| Original enlarged-coach failure from the former assertion | Task 8: preserve current reachability test |
| Original mobile intention-focus failure and false-positive geometry | Task 4 |
| Original Arcana keyboard failure | Task 5 |
| All 6 coach lint errors | Task 8 |
| Ignored motion configuration in 6 configs and 4 local overrides | Task 2 |
| Onboarding resume-cancel focus and stale ownership comment | Task 7 |
| Invalid Tooltip nesting in 2 journey surfaces | Task 9 |
| Untracked modal config dependency and strict-port ownership | Tasks 1 and 3 |
| Historical modal timeout from worktree-triggered reload | Task 1 |
| 18 production-only skips + 1 intentional WebKit CDP skip | Task 11 |
| Local API connection noise and conflicting color warnings | Task 1 |
| Full verification, honest scope, and exclusion of unrelated leftovers | Task 14 |
