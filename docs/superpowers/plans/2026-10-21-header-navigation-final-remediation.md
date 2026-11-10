# Direction A final-review remediation implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this checklist task by task when implementation is requested. Keep the changes uncommitted; commit steps in generic skill templates do not apply.

**Goal:** Close the three P2 findings from the final integration review and establish commit readiness against the approved Direction A specification.

**Architecture:** Let canvas progress wrap according to its content. Keep the settings drawer's installation host mounted, but give its preparation controls a lifetime bounded by the open drawer. This restores tab initialization and cleans up descendant confirmation guards without changing the shared modal/history infrastructure.

**Tech stack:** React, existing CSS tokens, React Router BrowserRouter, Node tests, Playwright Chromium/WebKit.

**Spec:** [Approved shared-navigation design](../specs/2026-10-21-shared-app-navigation-design.md), especially sections 5–9 and NAV-05, NAV-09, NAV-10, NAV-11.

**Implementation-plan relationship:** A follow-up to [Gate 2 integration](2026-10-21-header-navigation-gate2.md) and the original seven-step plan: repairs affect canvas progress (step 4), retained reading controls (steps 3–4), and integration validation (step 7). The accepted frame, destinations, route scope, and height policy remain the implementation contract.

**Status:** Complete. All 38 actions are checked. FIN-01, FIN-02, and FIN-03 are closed, with 473 passes/3 capability skips in the affected cohort and a complete Gate 2 result of 936 passes/6 capability skips across 942 cases, with zero failures, flaky results or retries. Source and worktree preservation checks pass. The subsequently authorized token cleanup also closes GATE-01, with fresh focused evidence recorded separately from that complete matrix. Physical-device limits remain explicit. The earlier 890-pass/6-skip run remains historical evidence and is not reused as remediation acceptance.

**Final evidence:** [Remediation addendum](../reviews/2026-10-21-header-navigation-final-remediation-review.md) and the later [logo-token cleanup addendum](../reviews/2026-10-21-header-navigation-logo-token-cleanup.md). Existing critiques and historical reports remain unchanged.

**Worktree:** `/home/ubuntu/.codex/worktrees/1877/tarot`, branch `codex/header-navigation-revamp-20261019`, HEAD `804c84cd4356ae4ace801517390b60a66fc59bd3` at planning time.

## Global constraints

- Keep application changes, tests, and documentation uncommitted and unstaged.
- Preserve the main checkout, isolated prototype, original approved spec, existing critiques/reports, unrelated files, and comparison previews. Capture fresh status/index/file hashes before execution; never use `git add -A`.
- Preserve the 56px normal app bar plus safe area, 64rem inner cap, 44px minimum controls, and exactly one enabled destination placement on routes with destinations.
- Preserve completed/current/upcoming/skipped step semantics and existing reading handlers. A skipped ritual must not be announced as completed.
- Preserve generation, cancellation, save state, ritual facts, installation offers, focus return, and browser history. No backend, journal-storage, entitlement, billing, or router changes.
- Keep inactive destination copies `hidden` and `inert`. Do not use clipping, smaller text, or smaller targets to conceal progress overflow.
- Use deterministic synthetic browser fixtures; no live model calls. Label keyboard, safe-area, installation, and viewport evidence as emulated.
- Preserve the historical reports of the pre-existing logo design-gate failure. The separately authorized token cleanup closes it without changing the baseline or introducing an ignore rule.

## Findings and acceptance mapping

| ID | Confirmed problem | Solution | Owner task | Acceptance |
| --- | --- | --- | --- | --- |
| FIN-01 — P2 | Progress labels overlap at 320px and 390px with 200% text | Replace the forced four-column handset grid with content-sized wrapping; test label bounds and hit targets | 1 | NAV-05, NAV-11 |
| FIN-02 — P2 | Escape closes the drawer but leaves its hidden Skip confirmation consuming Back | Unmount drawer-scoped preparation controls on close so their confirmation effects and Back guard clean up | 2 | NAV-10 |
| FIN-03 — P2 | Canvas Step 3: Ritual opens the retained drawer on Deck | Mount preparation controls at opening with the current requested tab; retain the install host separately | 2 | NAV-05, NAV-09 |
| GATE-01 — closed follow-up | `gate:design` reported two literal colors in `TableuLogo.jsx` | Fixed named brand tokens preserve both variants and explicit color overrides; fresh gate and render comparisons pass | Separately authorized token cleanup | Existing design gate and logo-token addendum |

Review evidence is retained in `/tmp/direction-a-final-review-cblqfoiz/`: enlarged-progress screenshots, `persistent-drawer-regressions.json`, the 18-case regression result, and worktree preservation hashes. The final review also passed 17 focused Node checks. These are baseline results, not remediation passes.

## File map

| File | Planned responsibility |
| --- | --- |
| [navigation.css](../../../src/styles/navigation.css) | Wrap compact progress according to intrinsic label width |
| [TarotReading.jsx](../../../src/TarotReading.jsx) | Bound `ReadingPreparation` mounting to drawer openness while preserving the sibling `InstallControl` |
| [navigationFixtures.js](../../../e2e/helpers/navigationFixtures.js) | Add an optional `rituals` fixture setting, defaulting to the current `false`, for deterministic preference initialization |
| [navigation-review-regressions.spec.js](../../../e2e/navigation-review-regressions.spec.js) | New failing regressions for FIN-01/02/03 and their reopening/close-path boundaries |
| [navigation-gate2.spec.js](../../../e2e/navigation-gate2.spec.js) | Extend the existing 200% text sweep to inspect canvas progress as well as header controls |
| [pwa-install.spec.js](../../../e2e/pwa-install.spec.js) | Protect installation completion and focus while the surrounding preparation content closes |
| This checklist and a new remediation evidence addendum | Track closure and exact final results without rewriting existing critiques |

`MobileSettingsDrawer`, `ReadingPreparation`, `RitualControls`, `useModalA11y`, and `useAndroidBackGuard` are inspection points. Their current interfaces need no change for the proposed lifetime fix.

## Review focus

1. Enlarged completed/skipped labels, both themes, and font loading: every visible label remains within its own target, with no neighboring overlap (task 1).
2. Nested Skip confirmation followed by Escape, close button, Done, backdrop, or Back: no invisible overlay or dead history entry survives closure (task 2).
3. Reopening from an explicit Ritual or Deck request: the requested available tab wins; actual question/knock/cut/deck facts survive closing (task 2).
4. Installation resolves after preparation closes: the same install host handles the result once and returns focus to a visible control (task 2).
5. Handset-to-desktop changes while preparation is open: modal isolation and locks release, focus lands visibly, and no descendant guard remains (task 2).

## Task 1 — Repair enlarged canvas progress

**Files:** `src/styles/navigation.css`, `e2e/navigation-review-regressions.spec.js`, `e2e/navigation-gate2.spec.js`.

**Interface:** Preserve `StepProgress({ canvas, steps, activeStep, onSelect, completedIds, skippedIds })`, its accessible names, and all step IDs/handlers. Change layout only.

- [x] Add `enlarged canvas progress labels stay inside independent targets` coverage in both browser engines at 320px and 390px, with 100% and 200% root text, setup and completed states, and dark/light themes. Wait for fonts and settled layout before measuring.
- [x] Assert every progress button is at least 44 × 44px; every visible label and skipped annotation is contained by its own button within 1 CSS pixel; adjacent labels have no positive-area overlap; each button center hit-tests to that button or its descendant. Include the neighboring canvas Settings target and document overflow in these checks.
- [x] Verify all four steps remain keyboard reachable and expose the expected current/completed/skipped semantics. Capture and inspect the enlarged layouts, including the skipped-ritual annotation.
- [x] Run the new cases before implementation and retain failures showing the existing overlap. At 320px/200%, the baseline puts roughly 94–96px labels inside 46px buttons.
- [x] Replace the mobile `repeat(4, minmax(0, 1fr))` rule with a wrapping flex list whose items use their content width as the basis and may grow into remaining space. Keep the existing button semantics, typography, gaps, and minimum target size. Normal 320px text should still fit four steps; enlarged text can form two rows. Avoid a viewport-only threshold that fails again when text grows.
- [x] Extend the existing Gate 2 200% text test to run the same containment/overlap assertions on Reading progress. Header-only geometry and `scrollWidth` do not detect this failure.
- [x] Rerun the focused cases; inspect current Chromium/WebKit captures and confirm that reducing text size restores the compact normal layout without stale widths or clipped focus.
- [x] Mark FIN-01 closed only when these assertions pass in both engines and the captures are readable.

## Task 2 — Separate preparation lifetime from installation lifetime

**Files:** `src/TarotReading.jsx`, `e2e/helpers/navigationFixtures.js`, `e2e/navigation-review-regressions.spec.js`, `e2e/pwa-install.spec.js`.

**Interfaces:** Preserve `MobileSettingsDrawer({ isOpen, onClose, children, footer, keepMounted })` and `ReadingPreparation({ initialMobileTab, ...existingProps })`. Extend `prepareNavigation(page, options)` with `options.rituals = false`; seed `showRitualSteps` for the correct guest/user owner inside its existing initialization script.

### Regression FIN-02: hidden confirmation and history

- [x] Add `closing preparation clears its descendant ritual confirmation guard`: seed a completed reading with rituals enabled, start on `/journal`, navigate to Reading, open preparation, choose Ritual, open Skip, and press Escape. Assert the drawer is closed, its Skip confirmation is absent from the DOM, and the overlay history marker clears. A single subsequent Back must reach `/journal`; Forward must return to Reading without reopening a stale confirmation.
- [x] Cover close-button, Done, and backdrop closures with Skip open. Cover Back separately: first Back closes Skip, second closes preparation, third returns to Journal. Assert visible focus restoration, released modal isolation/scroll lock, and no extra entry after non-Back closure.
- [x] Cover a handset-to-desktop transition with Skip open: no hidden preparation confirmation/guard survives and focus reaches a visible equivalent or the canvas heading.
- [x] Run and retain the pre-fix failure for the Escape sequence in Chromium and WebKit. Do not simulate success by manually deleting `history.state` or closing the hidden confirmation from the test.

### Regression FIN-03: requested tab on opening

- [x] Add `Ritual progress opens preparation on the requested tab`: load a completed reading with rituals enabled, select canvas Step 3, and assert Ritual has `aria-selected="true"` and Deck has `"false"`.
- [x] Select Deck manually, close, then select Step 3 again; Ritual must be selected. Also use an opener that explicitly requests Deck and assert Deck wins. Preserve the existing fallback to Deck when ritual controls are disabled.
- [x] Cover setup, a pending interpretation, and completed reading lifecycles. Use the existing controllable narrative fixture for pending generation; assert opening/closing settings does not start, duplicate, cancel, or replace that request.
- [x] Run and retain the pre-fix completed-reading failure in both engines.

### Shared implementation and PWA protection

- [x] In `TarotReading.jsx`, render the mobile `ReadingPreparation` only when `isMobileSettingsOpen` is true. Keep passing the existing `mobileSettingsTab` as `initialMobileTab`; fresh mounting then honors the requested tab naturally.
- [x] Keep the existing `keepMounted={Boolean(personalReading) || isGenerating}` drawer behavior and the `InstallControl` sibling mounted for those phases. Give the install host a stable key/position. Do not put it inside the new preparation conditional or key the whole drawer by tab/open state.
- [x] Preserve all lifted reading state and callbacks. Closing preparation removes transient UI state such as selected tab and Skip confirmation; it must not reset the user's question, selected deck, performed knocks/cut, reading, or generation. Assert those facts across close/reopen.
- [x] Add or strengthen a deferred-install test: start an install action in a completed/pending reading, close preparation before its asynchronous result, then resolve it. Assert one prompt invocation, handled completion, no route/reading reset, and visible fallback focus. Retain the existing iOS Later/Already added persistence checks and native prompt lifecycle assertions.
- [x] Rerun the FIN-02 and FIN-03 regressions together with settings/overlay/PWA cases. No shared modal or global Back-guard change should be necessary; investigate any need for one before broadening the implementation.
- [x] Mark FIN-02 and FIN-03 closed independently when their exact reproductions and boundary cases pass in both engines.

## Task 3 — Validate and reconcile readiness evidence

Run from the header-navigation worktree. Store outputs in a fresh `/tmp` directory and keep the earlier evidence intact. `NAV_GATE2_OUTPUT_DIR` must point to that new directory; the existing Gate 2 config owns separate Vite caches and feature lanes.

- [x] Run the focused Node checks after the implementation:

```bash
node --test tests/navigationLayout.test.mjs tests/playwrightFrontendConfig.test.mjs tests/appChromeLayout.test.mjs tests/ritualProgress.test.mjs
```

- [x] Run the affected browser suites through the existing Gate 2 configuration, preserving desktop and handset projects in both engines:

```bash
npx playwright test --config=playwright.navigation-gate2.config.js e2e/navigation-review-regressions.spec.js e2e/navigation-gate2.spec.js e2e/navigation-integration.spec.js e2e/navigation-gate1.spec.js e2e/responsive-adaptation.spec.js e2e/mobile-overlays.spec.js e2e/pwa-install.spec.js e2e/pwa-install-lifecycle.spec.js
```

- [x] Run `npm run lint`, `npm run build`, `npm run docs:check`, `npm run test:contrast`, `npm run gate:design`, and `npm test -- --test-concurrency=2`. Keep the known logo failure explicit. Run Node checks before browser acceptance because the Node public-file probes can trigger Vite reloads.
- [x] Once the source is final, collect the complete Gate 2 matrix with `npx playwright test --config=playwright.navigation-gate2.config.js --list`, freeze its source hashes, and run it once. This is justified because the prior acceptance missed the newly confirmed layout/history failures and the fixes change runtime behavior. Record actual new counts; do not reuse 896 or add diagnostic reruns to the acceptance total.
- [x] Require zero unexpected failures, no silent omissions/retry masking, and individually explained capability skips. Inspect the new enlarged-progress and drawer/PWA evidence; preserve the established primary-route frame and quiet-route assertions.
- [x] Write a new remediation evidence addendum with before/after source identity, FIN-01/02/03 results, exact commands/counts, screenshots inspected, and remaining limits. Link it from this checklist when it exists. Preserve existing critiques and historical Gate 1/Gate 2 reports byte-for-byte.
- [x] Validate this checklist and the new addendum's relative links explicitly: `docs:check` currently excludes `docs/superpowers`.
- [x] Obtain a final read-only review focused on these fixes and their integration; resolve any confirmed regressions with focused checks before claiming readiness.
- [x] Verify `git diff --check`, unchanged HEAD/index, only the intended remediation paths added to the original dirty-file manifest, and unchanged main/prototype/unrelated-file hashes. Keep all work uncommitted.

## Resolved logo exception and later release checks

**GATE-01 is closed separately from the three Direction A regressions.** The owner authorized the planned token cleanup. [TableuLogo.jsx](../../../src/components/TableuLogo.jsx) now uses `--brand-logo-ink` for `mono` and `--brand-logo-ivory` for `dark`, defined as fixed `#1A1A1A` and `#E8DAC3` values in the canonical [theme.css](../../../src/styles/theme.css). Theme-dependent palette variables would change those variants, so the fixed tokens have no light-mode or increased-contrast overrides. Explicit `color` props retain precedence; artwork geometry and the design-gate baseline are unchanged.

Fresh proof covers all six variants, default/custom colors, both themes and normal/increased contrast in Chromium and WebKit: 96 observations have identical before/after colors, SVG geometry, paths and semantics; all eight paired PNGs are byte-identical. The design gate, 4,419 Node tests, six existing navigation cases, lint, build and 24 contrast pairs pass, with the same two opt-in Node skips. The [logo-token addendum](../reviews/2026-10-21-header-navigation-logo-token-cleanup.md) records this candidate's source identity and exact checks. The prior 942-case complete Gate 2 run remains qualified to its recorded pre-token source; it was not rerun or relabeled for this behavior-preserving follow-up.

Physical iOS/Android keyboard, safe-area, standalone-installation, and assistive-technology checks remain separate release evidence. Automated passes must not be presented as hardware qualification. Commit, push, PR update, preview replacement, merge, and deployment are subsequent explicitly requested stages.

## Commit-readiness checklist

- [x] FIN-01: enlarged progress is readable, nonoverlapping, keyboard operable, and correctly hit-tested in both engines.
- [x] FIN-02: closing preparation removes descendant guards; no dead Back press remains.
- [x] FIN-03: explicit tab requests work on first open and reopen without losing reading facts.
- [x] PWA host persistence and visible focus return survive the narrower preparation lifetime.
- [x] Current-source affected checks and complete Gate 2 evidence are recorded with exact results and remaining limits.
- [x] Final review has no unresolved confirmed P1/P2 issue; the separately reviewed logo-token cleanup closes the remaining design-gate exception.
- [x] Original critiques/specs, unrelated work, comparison previews, and Git state are preserved.

Completing this checklist establishes readiness for a separately requested scoped commit; it does not authorize publication.
