# Remaining Frontend Failures Checklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Resolve every remaining lint error, confirmed behavior defect, invalid test assumption, and test-environment gap identified in the October 8 investigation, while preserving the pending React hooks cleanup and its bug fixes.

**Architecture:** Keep behavior and state ownership in existing components, hooks, and providers. Correct test configuration before judging motion-sensitive behavior, repair confirmed defects with focused regression coverage, then verify the unchanged source snapshot in both development and built-preview lanes.

**Tech Stack:** React 19, Vite, ESLint/react-hooks v7, Playwright with Chromium and WebKit, Node's test runner.

**Spec:** The user's October 8 review and subsequent investigation, summarized by the coverage table below. Product decisions follow [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and [design-contract.md](../../design-contract.md). Raw investigation evidence currently resides at `/tmp/tarot-remaining-errors-investigation-20261008.md` and the artifact paths named there; this checklist contains the actions and acceptance criteria without requiring those temporary files.

**Status:** Complete in isolated worktree `fix/remaining-frontend-20261008`, based on `ba009b346216c46597c60a4f07a5283cfc98d5cc` plus the explicitly scoped pending hooks cleanup. All 14 implementation and acceptance tasks are complete. See the execution record below for browser qualifications and retained historical evidence, and the local commit record for delivery status.

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

- [x] Record HEAD, working-tree/index status, installed Playwright version, and occupied test ports before execution. Do not run browser checks while another agent edits the tested source.
- [x] Give each automatic test server a dedicated loopback port, matching command/base URL, `--strictPort`, and `reuseExistingServer: false`. Preserve the modal configuration's current strict port 5197, one worker, and 60-second test timeout.
- [x] Exclude nested `.worktrees` and unrelated scratch directories from Vite watching. Verify that editing a temporary ignored HTML file causes no page navigation; verify that editing an actual application file still updates the app. Restore probe files afterward.
- [x] Mock every expected API call in frontend-only fixtures, including auth/health probes, or explicitly run the Worker when backend behavior is under test. Do not broadly swallow unknown API failures. Remove conflicting color environment settings from the verification invocation if present.
- [x] Run `npm run test:e2e:modals -- --retries=0`. Completion requires no server reuse, unexpected document reload, detached-element timeout, or unexplained backend connection error. The traced historical modal timeout is resolved by eliminating reload interference, not by raising its timeout.

## Task 2: Make motion profiles real

**Files:** The six configs in Task 1; `e2e/accessibility.spec.js`, `e2e/journal-responsive-adaptation.spec.js`, `e2e/share-note-hardening.spec.js`, `e2e/page-transitions.spec.js`; create `playwright.regressions.config.js`; add `test:e2e:regressions` to `package.json`.

**Interfaces:** Produces verified `reduce` and `no-preference` browser contexts consumed by Tasks 4, 7, 8, 12, and 13.

- [x] Replace ignored top-level `use.reducedMotion` and affected `test.use({ reducedMotion })` declarations with `contextOptions: { reducedMotion }`, preserving any existing context options. Keep valid `page.emulateMedia` and `browser.newContext` settings.
- [x] In the modal project matrix, set `use.contextOptions.reducedMotion` for each named profile. Preserve Chromium, desktop WebKit, and iPhone WebKit coverage in both modes.
- [x] Add a runtime media assertion to the motion-sensitive test setup: `matchMedia('(prefers-reduced-motion: reduce)').matches` must equal the intended mode. Ensure global defaults do not override a project's normal-motion selection.
- [x] Add a focused regression runner using the same six verified engine/device/motion profiles, a dedicated strict loopback server on port 5198, one worker, and no retries or server reuse. Include the specs named in Tasks 3–8, 10, 12, and 13; preserve their mobile/desktop tag selection. Name the projects `chromium-reduce`, `chromium-no-preference`, `webkit-desktop-reduce`, `webkit-desktop-no-preference`, `webkit-iphone-reduce`, and `webkit-iphone-no-preference`.
- [x] Run `npm run test:e2e:modals -- --retries=0`: all six saved-intentions profiles must pass with the media assertion. Run the affected local motion overrides as well. Profile names alone are not completion evidence.

For a spec named below, its standard focused verification command is `npm run test:e2e:regressions -- e2e/<spec>.spec.js --retries=0`. Use `--project=<name>` to select a specific verified motion profile; Task 4 adds repeat counts. This runner supplements the broad frontend suite and dedicated modal/Worker lanes.

## Task 3: Preserve and verify the fixes already in the pending diff

**Files:** `src/hooks/useJournalFilters.js`, `src/contexts/AuthContext.jsx`, `src/contexts/PreferencesContext.jsx`, `src/components/UserMenu.jsx`, `e2e/frontend-effect-state.spec.js`, `e2e/auth-route-recheck.spec.js`, `playwright.integration.config.js`, `package.json`, `playwright.modals.config.js`.

**Interfaces:** Preserves stable idle search state, request lifecycle behavior, and one pending auth recheck across redirects. This is independent of AuthModal email retention in Task 6.

- [x] Retain shared `IDLE_SERVER_SEARCH` for both state initialization and inactive search; confirm no fresh idle `results` array reaches the filtered-list memo.
- [x] Run the existing highlight cases before any filter edit and after an edit. Each deep link must scroll once, preserve the reader's later scroll during unrelated rerenders, clear the highlight around its configured 3.2-second expiry, and keep an entry beyond the first batch rendered.
- [x] Preserve full-history search coverage: repeat a query after clearing it, wait for the new response, reject obsolete results, and leave the loading state. Preserve unavailable-entry banner recovery and pagination reset coverage.
- [x] Preserve failed-preferences coverage: an open menu must issue one failed request without a render-driven loop; explicit retry makes one additional request and can recover. Cover usage errors independently.
- [x] Retain the AuthContext pending-recheck fix: consume route/initialization markers only when the deferred check actually executes. Run all five StrictMode/native-microtask cases, covering initialized and initially skipped `/design` and `/governance-critique`, consecutive normal redirects, and ordinary navigation with no extra check.
- [x] Verify `npm run test:e2e -- e2e/frontend-effect-state.spec.js e2e/auth-route-recheck.spec.js --workers=1 --retries=0`, plus WebKit coverage through a dedicated profile. Keep the Vite-only auth harness excluded from Worker integration runs.
- [x] Before an eventual scoped commit, confirm both new files—`playwright.modals.config.js` and `e2e/auth-route-recheck.spec.js`—are included. Verify `test:e2e:modals` works from the committed file set rather than relying on untracked files.

## Task 4: Keep the small-phone intention field visible on focus

**Files:** `src/TarotReading.jsx` (`scrollQuickIntentionIntoView`), relevant existing header/dock styles in `src/styles/tailwind.css`, `e2e/intention-polish.spec.js`.

**Interfaces:** Consumes verified motion settings from Task 2. Produces a focus reveal bounded by the viewport, sticky header, and visible action dock.

- [x] Strengthen the existing failing test before changing scrolling: assert the field lies inside the viewport and between the measured header and dock; assert the dock itself is in its settled viewport position. Exercise focusing during and after the page entrance transition.
- [x] Scroll the actual focused field using immediate focus-reveal behavior. Recheck its bounds after header compaction or relevant layout changes while it remains focused, correcting any occlusion without overriding later intentional reader scrolling.
- [x] Test the original 320×568 viewport and a larger handset, focus/blur/refocus, enlarged text, both actual motion modes, and viewport-height/safe-area changes while focused. A passing assertion must not accept a field and transformed dock that are both below the viewport; assert the intended field actually has focus.
- [x] Run the small-phone focus case on WebKit with `--repeat-each=10 --retries=0` in each motion mode. Completion requires zero failures and correct geometry; retain a trace on failure. Preserve the rest of intention editing and reading completion behavior.

## Task 5: Support keyboard scrolling in both Arcana rows

**Files:** `src/components/ReadingJourney/sections/MajorArcanaMap.jsx`, `e2e/startup-hardening.spec.js`.

**Interfaces:** Both existing focusable row groups consume ArrowLeft/ArrowRight and scroll horizontally without moving focus or scrolling the document.

- [x] Extend the regression to both rows: ArrowRight increases `scrollLeft` when overflow exists, ArrowLeft returns it toward zero, boundaries remain valid, and focus stays on the row.
- [x] Add a shared explicit horizontal key handler to both groups. Prevent the browser's competing arrow action for handled keys; preserve Tab, other keys, and existing accessible group names.
- [x] Run the Arcana case on Chromium, desktop WebKit, and mobile WebKit in both actual motion modes, including the original 1280×900 emulated-mobile case and a narrow viewport. No-overflow rows must remain usable. Label this browser-emulation evidence; physical keyboard behavior remains separately unverified.

## Task 6: Restore the tested auth email-draft behavior

**Files:** `src/components/UserMenu.jsx`, `src/components/AuthModal.jsx`, `e2e/frontend-state-sync.spec.js`.

**Interfaces:** Lift the ephemeral email draft into the mounted menu owner and pass it into the deferred modal through `emailDraft` and `onEmailDraftChange`. Keep passwords, confirmation, loading, visibility, and feedback owned by each modal session. This preserves lazy mounting.

- [x] Keep the existing close/reopen email-preservation contract as the implementation target. If product intent instead changes, document that decision explicitly before altering the test; there is no current design requirement justifying deletion of the assertion.
- [x] Add optional controlled email-draft props to AuthModal with its existing local state as fallback for other callers. Wire UserMenu's draft into the deferred instance without persisting it to storage or another account.
- [x] Clear the owned draft at authentication/account-session boundaries. A reopened modal keeps the email but starts with cleared passwords, masked visibility, fresh mode selection, and cleared feedback. Ignore obsolete responses from a closed session.
- [x] Run `e2e/frontend-state-sync.spec.js` at 390px and 1280px, covering mode switches, failed submission, close/reopen, successful sign-in, and sign-out/account change. Check the fallback callers on Journal, Account, and Pricing as well. Preserve focus restoration, deferred loading, and missing-chunk recovery. Both original email assertions must pass.

## Task 7: Give onboarding focus one initial-focus owner

**Files:** `src/components/onboarding/OnboardingWizard.jsx`; create `e2e/onboarding-exit-focus.spec.js`; extend `playwright.modals.config.js` to include the new spec.

**Interfaces:** The existing `useModalA11y` hook owns initial focus/restoration. The parent FocusTrap enforces containment while the nested ConfirmModal temporarily owns its own layer.

- [x] Persist the scratch reproduction as a regression: open “Save & resume later,” cancel via “Stay here,” and assert the exact resume opener remains focused across subsequent animation frames and rerenders. Cover the equivalent Skip opener.
- [x] Apply the proven minimal direction: set the parent trap's `initialFocus: false`, retaining `useModalA11y` initial focus and the existing parent/nested trap activation. Pausing alone is insufficient because unpause also invokes initial focus.
- [x] Verify Tab/Shift+Tab containment, Escape cancellation, repeated nested opening, Skip confirmation, Save & close persistence, and focus/scroll restoration after the outer wizard closes.
- [x] Update the nearby ownership comment to match the final code and ConfirmModal's hook-based focus handling.
- [x] Run `npm run test:e2e:modals -- --retries=0`. Require at least the 12 skip/resume narrow-layout combinations across the six verified motion profiles, plus desktop-width initial-focus, containment, and direct-close checks. The prior 390×844 proof alone does not establish desktop coverage.

## Task 8: Resolve all six coach lint errors as one lifecycle refactor

**Files:** `src/contexts/GuidedIntentionCoachContext.jsx`, its mount in `src/TarotReading.jsx`, `e2e/intention-coach.spec.js`, `tests/coachDraft.test.mjs`, `tests/coachStorage.test.mjs`, `tests/intentionCoach.spread.test.mjs` where behavior changes warrant coverage.

**Interfaces:** A mounted coach session is scoped to its owner, initializes storage once, derives suggestions/guided output, and owns only genuine asynchronous work. Keep the existing public context API unless an internal change is necessary and update all consumers together.

- [x] **Line 702:** replace effect-driven session initialization with an owner-scoped mounted session boundary and lazy initialization. Snapshot the previous owner's displayed draft before disposal and prevent it from initializing the next owner's session.
- [x] **Line 723:** initialize templates, history, and journal statistics from the owner-scoped storage snapshot; retain save/delete/apply event updates and existing storage failure handling.
- [x] **Line 739:** derive suggestions from their inputs instead of duplicating the calculation in state. Preserve source-change pagination reset behavior.
- [x] **Line 745:** derive a valid page and rendered slice; associate explicit page selection with the suggestion source/session so stale choices do not leak into new results.
- [x] **Line 750:** remove closed-state resets made obsolete by unmounting the coach. Retain timeout cleanup; if another consumer persistently mounts it, give that consumer an explicit session boundary.
- [x] **Line 778 and the same generator effect:** derive guided question/loading state where possible; retain asynchronous generation, abort cleanup, and stale-response rejection. Snapshot displayed generated text even if that text is no longer stored as duplicated state.
- [x] Extend behavioral coverage for account switching while open; draft restoration after close/reopen; spread changes before/after Remix; deliberate empty edits; editing during generation; canceled/failed requests; template changes; and changing suggestion counts/pages.
- [x] Retain the current enlarged-editor reachability assertion. Verify long text at 320px is scroll-reachable with no horizontal or internal editor overflow; do not restore the obsolete requirement that the entire editor fit within one viewport.
- [x] Run `npx eslint src/contexts/GuidedIntentionCoachContext.jsx`, `node --test tests/coachDraft.test.mjs tests/coachStorage.test.mjs tests/intentionCoach.spread.test.mjs`, and `e2e/intention-coach.spec.js` on Chromium and WebKit with verified motion settings. Completion requires all six errors gone and preserved draft/generation behavior.

## Task 9: Correct invalid Tooltip containers

**Files:** `src/components/ReadingJourney/JourneySidebar.jsx`, `src/components/ReadingJourney/JourneyMobileSheet.jsx`; inspect `src/components/Tooltip.jsx` but keep its shared API unchanged unless necessary.

**Interfaces:** Both journey surfaces contain Tooltip's block root in a valid container while preserving text, classes, names, and tooltip interaction.

- [x] Replace the offending paragraph wrappers at the investigated lines 454 and 535 with suitable containers, preserving their styling and semantics.
- [x] Inspect desktop sidebar and mobile sheet with real rendered tooltips. Completion requires no React DOM-nesting warnings, unchanged keyboard/pointer tooltip behavior, and intact accessible names. Use existing browser/accessibility coverage; a mirror test of the wrapper tag is unnecessary.

## Task 10: Update all 11 stale Journal tests

**Files:** `e2e/journal-filters.spec.js`; existing Journal fixtures/helpers. Product targets are `JournalFilters.jsx`, `JournalFloatingControls.jsx`, and `useJournalFilters.js` only if the updated behavior assertions expose a new defect.

**Interfaces:** Tests use current accessible controls and separately measure all filtered matches, loaded records, and rendered pagination batches.

- [x] Update desktop and mobile region locators from “Focus your journal” to “Journal filters.”
- [x] Replace removed “Find a reading” navigation with “Jump to journal filters”; assert its scroll and search-focus behavior on desktop and mobile.
- [x] Replace “Advanced filters” with “More filters”; cover compact disclosure, filter-map shortcuts, and opening/selecting the timeframe dropdown.
- [x] Replace old “Showing n of n” assumptions with the current Filtered/Loaded meanings. Test rendered article counts for pagination rather than expecting the total matching count to change.
- [x] Freeze fixture time and assert exact matching entries: Love IDs 0/6/12; reversals 0/4/8/12; 30-day window 0–4; the fixture's seven search matches. Assert filter clearing restores the original result set.
- [x] Verify 10→15 rendered entries with and without an active query, filter edits reset the batch limit to 10 (rendering fewer when fewer entries match), and combined filters preserve their matching semantics.
- [x] Run `e2e/journal-filters.spec.js` on both selected browser projects. Completion requires all 16 existing cases passing, with all 11 former failures exercising behavior beyond the formerly stale locator.

## Task 11: Count actual artwork downloads and cover built-only cases

**Files:** `e2e/initial-loading.spec.js`, `e2e/startup-polish.spec.js`; create `playwright.production.config.js`; add `test:e2e:production` to `package.json`.

**Interfaces:** The production config serves a freshly built bundle on strict loopback port 5199 with no server reuse. It includes the initial-loading/startup-polish specs in Chromium and WebKit and preserves their platform tags.

- [x] Record pathname plus resource type in the artwork test. Count actual image requests separately from Vite's `?import&url` script modules; continue checking actual sound/media downloads.
- [x] Assert onboarding fetches no hidden spread images or sounds, then skipping onboarding loads the selected artwork with nonzero natural dimensions. Exercise this in development and built preview.
- [x] Add a repeatable built-preview lane: `npm run build` followed by `npm run test:e2e:production -- --retries=0`. Configure correct context motion settings, fixtures, trace retention, and a distinct results directory.
- [x] Require all 18 formerly skipped production-only cases to execute and pass, covering startup budgets, deferred chunks, loading states, failure recovery, and deferred feature behavior. They may remain explicitly skipped in the separate Vite development lane.
- [x] Preserve the intentional WebKit skip for Chromium CDP tab suspension; verify the supported Chromium case executes. Report unsupported CDP skips separately from missing production coverage.

## Task 12: Repair card snapshots and settle the clipping contract

**Files:** `e2e/cards-drawn-section.spec.js`, its existing snapshot directory, `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardFan.jsx`, sibling `useCardFan.js`, and maintained design documentation only if clarification is necessary.

**Interfaces:** Snapshot targets represent the actual collapsed stack and expanded fan after fonts, images, and layout settle. Any geometry change follows the recorded design decision.

- [x] Assert the correct section and expanded/collapsed state before capture, wait for font/image readiness, and wait for the relevant transition/layout to settle. Preserve functional expansion, collapse, accessible labels, and card keyboard navigation checks.
- [x] Compare actual captures with the existing files: the old collapsed dimensions differ, and the old fan image contains insights text rather than a fan. Review both intended captures before refreshing only these snapshots.
- [x] Resolve the measured 6px/15px edge cropping against current `DESIGN.md` and the archived full-visibility note. Record which contract governs: permitted radius clipping must preserve usable visible targets; full card visibility requires geometry that reserves rotated card extents. Do not use snapshot acceptance to make this decision implicitly.
- [x] If geometry changes are required, verify representative 1/3/6/10-card spreads at narrow widths and enlarged text; retain intentional overlap and accessible hit targets without horizontal page overflow.
- [x] Run the cards spec twice without updating snapshots after the reviewed baseline refresh. Completion requires stable capture, passing comparisons, and functional checks. The historical pre-comparison stability timeout's exact cause remains unproven unless fresh traces establish it.

## Task 13: Close the four title/PWA timeout cases without weakening assertions

**Files:** `e2e/frontend-p1-hardening.spec.js`, `e2e/pwa-install.spec.js`; shared readiness helpers only when a repeated diagnosis justifies them.

**Interfaces:** Consumes isolated serving from Task 1. Tests retain descriptive title, stable-page-end, visibility, hit-target, and dialog behavior assertions.

- [x] Rerun the ten-route/trailing-slash title case and the landscape/PWA Journal cases at 800×1000 and 1024×768 on the frozen source snapshot, three times each with retries disabled.
- [x] Bound route visits individually and wait for route content readiness; preserve exact title assertions. In PWA tests, observe layout settling after safe-area padding changes and require actual viewport visibility, click hit tests, dialog opening/closing, and focus restoration.
- [x] If a timeout recurs, retain traces and measure reloads, pending navigation/resources, scroll-height changes, and padding/dock geometry before editing product code or budgets. Establish a cause, apply its scoped fix, and rerun the exact case.
- [x] Completion requires repeated passes in isolation and the broad final run. Record historical causes as unresolved if they remain unreproduced; do not claim title/PWA defects were fixed solely because isolated reruns pass.

## Task 14: Verify the whole result and prepare an explicit commit scope

**Files:** All task-owned paths above; update this checklist with results and unresolved decisions.

**Interfaces:** Produces a reproducible verification record and a reviewed set of owned changes. Integration/release results are reported separately from frontend/unit results.

- [x] Run `npm run lint` and require zero errors; run `npm test`, `npm run build`, and `npm run docs:check`. Record totals and distinguish pre-existing warnings from failures. The root Node suite does not substitute for browser or Worker tests.
- [x] With edits frozen, run the complete frontend suite, dedicated modal/Journal/install/hardening lanes, and the production lane with zero retries for the final evidence run. Include normal-motion checks for focus, keyboard, onboarding, and coach behavior; do not rely only on a global reduced-motion default.
- [x] Run affected Worker-backed auth/Journal/preferences integration checks with local services available and external inference stubbed. Keep the Vite-only auth-route harness in its frontend lane; no paid provider requests are needed for these fixes.
- [x] Review guest and signed-in Pro behavior for the changed account/Journal/coach flows using the documented local reviewer process. Keep mocked tier coverage for account switching and Plus/server-search thresholds; report real-account and physical-device gaps precisely and log out afterward.
- [x] Account for every failed or skipped case. Completion requires zero unexplained failures, all 18 built-only checks executed, and an explicit reason for every remaining browser-specific skip. Update totals because new regression tests change the historical 588-case denominator.
- [x] Review the final diff and explicit owned file list, including new configs/specs and reviewed snapshots. Confirm unrelated plugin-review and other-session files remain unchanged. Commit/push only when requested; deployment is a separate action.

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

## Execution record — October 8

Implementation and the fresh whole-change review are complete. Three Important findings were addressed: the coach's owner-personalization initialization race, source-import assertions incompatible with the Worker lane, and missing failed-generation/pagination/onboarding-persistence coverage. The retained draft, full-history Journal search, failed-preferences retry, and deferred auth-recheck fixes remain covered. No deferred minor findings.

The isolated worktree is `/home/ubuntu/tarot/.worktrees/remaining-frontend`. The original checkout's 64 pre-existing changed files retain their pre-execution SHA-256 hashes; its HEAD and staged paths remain unchanged. The owned manifest contains 95 paths, including the new configs/specs, this plan, and exactly two inspected card snapshots. Two unrelated pending WordPress editor files were present only to reproduce the existing lint baseline and are excluded from delivery. Use the explicit manifest rather than directory-wide staging.

Evidence is retained in `.superpowers/sdd/2026-10-08-remaining-frontend-failures/`: `owned-paths.txt`, `implementation-paths-vs-primary.txt`, `frozen-source.json`, raw lane logs/JSON, `acceptance-summary.json`, and the progress ledger. These ignored artifacts are retained because the changes are uncommitted. The final frontend source set has 94 frozen hashes; documentation is recorded separately. The final one-line ShareReading observer correction changes only that file; the other 93 hashes remain identical to the completed full-suite snapshot. ShareReading is imported only by the lazy `/share/:token` route. Complete affected-route qualifications on the final snapshot supplement the retained full-suite evidence: all five frontend specs that visit shared readings (174 cases), all six state-synchronization profiles (88), the four installation shared-route cases executed within that fresh 174-case lane under the matching browser profiles, a fresh direct-route title assertion, and complete hardening/modal/build/preview/Worker/real-account gates. The original 66 title/PWA repeats remain valid for unchanged title behavior; the observer correction changes share-page geometry only. The full frontend and retained dedicated totals are consequently qualified multi-run evidence, rather than a claim of one complete 619-case run after that last observer line. A clean export of baseline plus the 95 owned overlays matches all 94 source hashes, excludes private state and unrelated pending edits, and passes the six-profile modal gate using its own installed dependency layout.

`npm run lint`: zero errors and warnings. `npm test`: 2,942 passed, zero failures/skips. `npm run build`: passed; the existing third-party ONNX eval warning remains. `npm run docs:check`: passed after this record was written. The five Worker search unit cases also pass. Final browser commands use zero retries and single-worker lanes; the last affected-route and remaining gates run serially after parallel WebKit candidates showed intermittent geometry timeouts, with dedicated strict origins and no server reuse.

| Final lane | Passed | Skipped | Failed/flaky |
|---|---:|---:|---:|
| Full frontend | 600 | 19 | 0 |
| Six-profile regression matrix | 494 | 2 | 0 |
| Traced desktop WebKit reduced-motion qualification | 90 | 1 | 0 |
| Title/PWA three-repeat checks | 66 | 0 | 0 |
| Hardening | 54 | 0 | 0 |
| Installation | 109 | 0 | 0 |
| Modals from explicit-source export | 30 | 0 | 0 |
| Built preview | 30 | 0 | 0 |
| Worker-backed Journal | 4 | 0 | 0 |
| Post-correction shared-route frontend suites | 174 | 0 | 0 |
| Post-correction six-profile share state | 88 | 0 | 0 |
| Final exact enlarged-landscape PWA repeats | 3 | 0 | 0 |

The matrix qualification retains the unaffected cases from the 496-case candidate and replaces desktop WebKit reduced motion with the complete 91-case traced run on the final snapshot. Its shared-page state cases in every profile are also replaced by the fresh 88-case six-profile state run. The other 93 source files are unchanged; the single-file share-page qualification is described above. The raw candidate had two escaped health GET requests (`/api/health/tts` and `/api/health/tarot-reading`) and no assertion failures. Eighteen instrumented focused/transition checks did not reproduce the escape, so its cause is unproven. The replacement profile has zero proxy errors or unexpected API calls; both the raw candidate and qualifying traces are retained. The accepted matrix covers 494 passing cases and two explicitly unsupported WebKit CDP cases; this is qualified multi-run evidence, not a claim that the raw candidate had no backend errors.

The frontend's 19 skips consist of 18 built-only cases that all execute successfully in the built-preview lane and one unsupported WebKit CDP suspension case. The matrix's two skips are desktop WebKit touch synthesis requiring CDP. The qualifying-profile rerun repeats one of those same skips. Supported Chromium cases execute. All 42 failures from the earlier diagnostic inventories (35 frontend and seven matrix) map to passing final cases; no assertion failure remains unaccounted for. The later three historical, one installation, and one affected-route PWA candidate failures also map to passing final unchanged-source reruns. The affected-route candidate passed 173/174 while another WebKit lane ran; its reading-install hit check failed. Its complete 174-case rerun and three exact enlarged-landscape PWA repeats were subsequently run serially. Their source/geometry/timeouts were unchanged; host-load attribution remains an inference, not a claim of a PWA code fix. The late hardening failure maps to the fresh hardening pass after observing page-container resizing: an error-message insertion had moved the already-focused submit below the viewport without a new focus event. Its JSON/log and inspected trace observations are retained; the focused repeat runner overwrote the original raw hardening screenshot/trace, so those raw artifacts are not claimed as retained. The exact case passes three repeats after the one-line correction. A strict-server startup rejection and interrupted qualification runs are retained and excluded from passing totals.

Small-phone focus passes ten repeats in each actual motion mode on iPhone WebKit. Card coverage includes full rotated visibility at 320px with enlarged text for 1/3/6/10 cards, two inspected baselines, two unchanged-baseline matrix passes, and three further WebKit snapshot repeats. The exact title and landscape/Journal PWA cases pass three times across all six profiles. A preceding 66-case candidate had three normal-motion iPhone page-end timeouts: its trace measured two animation frames taking 8.7 seconds and a later valid page-end measurement arriving after the assertion deadline, while three CPU-active WebKit processes included an unrelated review. That candidate and its traces are retained. The overlapping installation candidate passed 108/109; its initial enlarged-landscape five-point hit check failed before dialog restoration. Its trace and screenshot are retained, and the entire 109-case installation lane was also rerun unchanged. These candidate failures are excluded from final passing totals. The complete 66-case lane was rerun unchanged with scheduling that accounts for external browser processes; no source edit or timeout increase was used. The observed frame starvation is confirmed; attribution to external host load remains an inference. The historical title, Journal page-end, card pre-comparison capture, motion-cleanup, restored-PWA hit-target, and Arcana timeouts retain their raw evidence; unreproduced historical causes are not represented as product fixes. Test readiness corrections retain the original geometry, hit-target, lifetime, snapshot, and timeout budgets.

Real local review: eight guest/active-Pro sessions across Chromium and WebKit at 390px and 1280px, actual normal motion. Account, Journal, coach draft reopening, real password authentication, local Journal/preferences APIs, and logout followed by an unauthenticated response pass. External inference/speech/usage are stubbed. Pro review uses copied local D1 state and the documented private credential file; no credentials or browser sessions enter the source set. Mocked owner switching, Plus/server-search thresholds and fixture subscription states are separate evidence. Worker-backed Journal checks use the local handler and stub external services. This does not prove physical keyboards, assistive technology, real Plus/canceled subscriptions, CI, deployment or production health.

| Ruling | Reason and cost if wrong |
|---|---|
| Retain isolated uncommitted worktree | Task 14 prepares an explicit scope; cost: transfer/integration remains a separate operation. |
| Desktop onboarding uses direct-close coverage | Desktop has no resume control; cost: a future desktop nested-resume flow needs coverage. |
| Full rotated-card visibility governs | Existing design accessibility contract; cost: tighter fan spacing on narrow phones. |
| Exclude readingSchema from speculative module preload | A real 503 demonstrated WebKit negative caching after reload; cost: that small chunk loses speculative overlap. |
| Leave comprehensive late-owner Journal/menu cancellation outside scope | These are baseline request paths; cost: those existing asynchronous races remain possible. |
| Leave concurrent shared-note mutation/refresh cancellation outside scope | Preserve baseline write behavior; cost: those existing concurrent races remain possible. |
| Qualify real-device and live coverage separately | Local browser evidence has defined limits; cost: physical keyboard, screen-reader and production behavior remain unproven. |
| Exclude unrelated WordPress edits from the delivery manifest | They were copied solely for lint-baseline reproduction; cost: directory-wide staging could include unrelated work. |
| Replace the affected matrix profile with its traced qualifying rerun | Two raw health escapes had an unproven cause; cost: an intermittent fixture escape may recur, so retain its evidence and the clean qualifying traces. |
| Reuse unchanged-route evidence after the final ShareReading observer line | Only the lazy share page and one of 94 source hashes changed; all five affected frontend suites, all six share-state profiles, and the required dedicated gates are fresh; the four shared-install cases are mapped from matching fresh frontend profiles, and title behavior is unchanged. Cost: frontend and some dedicated totals combine retained unaffected-route evidence with current affected-route qualifications. |

No commit, push, deployment, migration, paid-provider call, or GitHub billing change was performed. The completion ledger's baseline-to-HEAD ranges describe uncommitted work and do not imply implementation commits.

## Local commit record — October 8

Following the completed handoff and the user's instruction to proceed, the 95 owned paths are recorded in a scoped local commit on `fix/remaining-frontend-20261008`. All 94 frozen source hashes remain unchanged. The saved acceptance/preservation audit and staged-scope checks pass; existing qualified unit and browser evidence is reused without a new broad run.

The execution record above describes the original uncommitted handoff. This local commit stage preserves the primary checkout, the two unrelated WordPress editor files, and ignored evidence. Integration into `master`, push, deployment, and migrations remain separate stages.
