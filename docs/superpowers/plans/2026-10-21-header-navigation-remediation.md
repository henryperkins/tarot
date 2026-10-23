# Direction A prototype remediation checklist and implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this checklist in the isolated prototype, with one independent review after validation. Keep all changes uncommitted.

**Goal:** Resolve every finding from the prototype review and deliver the approved Direction A prototype with complete Gate 1 evidence and its own verified preview URL.

**Architecture:** Keep page-level composition, the existing router, reading state, and Account exit boundary. Share the app header, destination presentation, and bottom-region layout. Coordinate measured chrome within each page; do not introduce a navigation store or persistent router provider.

**Tech stack:** React, Vite, existing viewport/sticky hooks, semantic CSS tokens, Node tests, Playwright Chromium/WebKit, an isolated local Worker and preview proxy.

**Spec:** The authoritative, uncommitted [approved design specification](../specs/2026-10-21-shared-app-navigation-design.md) stays unchanged in the PR worktree. This plan completes the user's seven-step implementation plan; steps 1–6 are Gate 1 and step 7 remains Gate 2.

## Global constraints

- Work only in `/home/ubuntu/tarot/.worktrees/header-nav-prototype-a`, based on `804c84cd4356ae4ace801517390b60a66fc59bd3`.
- Preserve the main checkout, PR worktree, existing critiques, uncommitted spec, and existing PR preview. No staging, commits, push, PR update, integration, or production deployment.
- One 56px app-bar row at normal text size, excluding top safe area; 64rem inner cap; 16px handset/24px desktop gutters, increased for safe area; 44px targets.
- Desktop destinations form the left cluster after the brand. Handsets use the established `useHandsetLayout` decision. Inactive mounted destination copies are `hidden` and `inert`.
- Guest Settings links directly to `/account`; visible Sign in opens the existing dialog. Keep wordmark, Settings, and Sign in at 320px, including completed readings.
- Quiet reset/verify/share routes suppress destinations. Empty quiet routes reserve zero bottom height; guest share reserves its measured contextual actions and safe area exactly once.
- Preserve all existing reading handlers, Account exit/hash/history guards, route focus, PWA installation access, and backend/data behavior.
- Keep 25% bottom / 40% combined / 25% combined below 500px visible height provisional until measured. Release contextual actions, named secondary controls, header, then destinations. Restore pinning when space returns.
- No credentials in source, logs, URLs, or browser artifacts. Public preview uses separate synthetic identities; approved local reviewer credentials stay on their approved origin.
- Gate 1 is technical/visual evidence for the owner's decision. Gate 2, commits, and publication to the PR remain separately authorized.

## Findings and acceptance mapping

| Review finding | Remediation task | Spec criteria | Original plan step |
| --- | --- | --- | --- |
| F1 Pricing/Journal fixed-control collisions | 2, 4 | NAV-06/07 | 3, 5 |
| F2 Reversed ritual completion/skip states | 3 | NAV-05/09 | 4 |
| F3 Irreversible flow fallback / missing combined budget | 2 | NAV-06/07 | 3 |
| F4 Missing Account end clearance (also Gallery/Design) | 2, 4 | NAV-06/07 | 3, 5 |
| F5 Breakpoint destination focus loss | 2 | NAV-04/07 | 1, 3 |
| F6 Completed guest header overflows at 320px | 1 | NAV-03/10 | 2 |
| F7 Reading outer-frame mismatch | 1 | NAV-01/02 | 1, 4 |
| F8 Share/Gallery non-sticky measured wrappers | 1, 4 | NAV-01/06/07 | 1, 5 |
| F9 Lint errors / incomplete Gate 1 probes | 5, 6 | NAV-01–07/12 | validation, 6 |
| M1 Account label and auth-loading reservation | 1 | NAV-03 | 2 |
| M2 Share promotional explanation/desktop placement | 4 | NAV-06 | 5 |
| R1 New reading reuses the preceding ritual/seed | 3 | NAV-05/09 | 4 |
| R2 Keyboard resize obscures the focused Journal search field | 2 | NAV-06/07 | 3 |
| Visual follow-up: actual Account trigger shifts; mobile progress wraps | 1, 3, 5 | NAV-01/03/05 | 1, 2, 4 |
| R3 iOS installation choices unmount with the Account menu | 7 | NAV-10 | 2 |
| R4 Enlarged-text action recovery depends on resize history | 7 | NAV-06/07 | 3 |

## Review focus

- Resize while a destination has keyboard focus: transfer to its equivalent before hiding it; keyboard hiding instead focuses the page heading.
- Open/close the keyboard and rotate back from short landscape: actions, destinations, pinned heights, and content clearance recover without remounting focused actions.
- Restore a completed guest reading at 320px: installation remains reachable without overflow or another header control.
- Change safe-area padding and scroll to the last Account/Journal/Gallery control: its hit area remains clear of all chrome.
- Draw after either performing or skipping the optional ritual: truthful progress labels survive drawing and reload without changing reading eligibility.

## Task 1: Shared header geometry and account controls

**Files:** `src/components/AppHeader.jsx`, `GlobalNav.jsx`, `UserMenu.jsx`, `src/TarotReading.jsx`, `src/styles/navigation.css`; supporting wrapper changes in Task 4.

**Interfaces:** Preserve `AppHeader({ destinations = true, installInMenu, onRequestExit })`; brand/account/destination geometry belongs to this component. Keep canvas progress below the header within `main`. Existing auth and installation handlers stay intact.

- [x] Add browser regressions for 390px route alignment, normal 56px height, desktop left cluster, and completed guest 320px fit; run and retain failures against the reviewed prototype.
- [x] Move Reading's header outside the padded content container; preserve one main landmark and route heading/focus behavior.
- [x] Render signed-in `Account` beside the avatar on desktop, with identity in its accessible name/menu; reserve the guest/account control area while auth loads.
- [x] Keep guest Settings and direct Sign in, and put guest reading installation access inside the existing settings sheet rather than an extra overflowing header control.
- [x] Verify buildable geometry, guest Journal → Settings in one tap, and auth dialog opening at 320px.

## Task 2: One measured bottom region and reversible height/focus policy

**Files:** `src/components/AppBottomRegion.jsx`, `DestinationNav.jsx`, `GlobalNav.jsx`, `MobileActionBar.jsx`, `src/hooks/useResponsiveSticky.js`, page-scoped chrome measurement helpers under `src/lib/`, and `src/styles/navigation.css`.

**Interfaces:** A single page-scoped observer measures natural header/actions/destinations/secondary-control heights and publishes actual pinned reservations. `AppBottomRegion` keeps action DOM stable when switching between fixed and flow layouts. Bridge `--mobile-action-bar-height` to complete fixed bottom height; consume page padding once.

- [x] Add failing browser tests for both breakpoint focus directions, portrait → short landscape → portrait, keyboard focus/visibility, and safe-area end clearance; add pure policy boundary tests with independently calculated expected releases.
- [x] Keep both destination placements mounted where applicable. Reveal the equivalent before transferring focus; apply `hidden` and `inert` to inactive groups before paint. Quiet routes never acquire destinations.
- [x] Measure actions independently from their fixed/flow placement so the fallback can recover without oscillation. Empty/hidden action rows contribute zero height.
- [x] Implement combined visible-height budgeting with release order: actions; Account section chips / Journal floating controls then month headings then insights rail / Reading contents toolbar then card companion / Share tabs; header; destinations.
- [x] Preserve focused text fields during keyboard changes; if a destination held focus when it disappears, focus the canvas/page heading. Count keyboard offset and safe area once.
- [x] Update existing `.mobile-action-bar` geometry consumers to the shared region. Keep overlay inertness, action labels, busy states, and handlers.
- [x] Run policy tests and the corresponding Chromium/WebKit regressions; verify no stale root styles after route changes.

## Task 3: Truthful ritual progress

**Files:** `src/hooks/useTarotState.js`, `src/contexts/ReadingContext.jsx`, `src/lib/readingSnapshot.js` only if required for existing snapshot compatibility, `src/TarotReading.jsx`, `src/components/StepProgress.jsx`; focused Node tests using `tests/helpers/tarotStateHarness.mjs`.

**Interfaces:** Expose presentation milestones from the existing reading-state owner. Preserve current ritual readiness and shuffle/reveal handlers. Do not infer historical completion from artificial readiness flags or create a separate progress model.

- [x] Add tests demonstrating the performed-ritual and disabled-ritual label reversal; run them before changing the hook.
- [x] Preserve/derive truthful ritual state through drawing and restore while keeping current action eligibility intact; current-step treatment takes precedence over completed/skipped.
- [x] Test both paths and a new reading/reset, then verify completed/current/upcoming/skipped labels in the real canvas.

## Task 4: Adopt the shared contract on every included route

**Files:** `src/components/Journal.jsx`, `journal/JournalFloatingControls.jsx`, `src/pages/AccountPage.jsx`, `CardGalleryPage.jsx`, `PricingPage.jsx`, `DesignSystemPage.jsx`, `ShareReading.jsx`, reset/verify pages as needed.

- [x] Add failing hit-target regressions for Pricing Go Plus, scrolled Journal destinations/Filters, safe-area Account last link, and Gallery/Share headers after scroll.
- [x] Put Pricing's handset upgrade actions in the shared contextual slot. Position Journal floating controls above the complete bottom reservation and return them to flow under the release policy.
- [x] Add measured clearance on Account/Gallery/Design; preserve Account's capture guard around header and dock and its `onRequestExit` callback.
- [x] Remove competing Share/Gallery header wrappers/measurements; use actual shared pinned height for tabs, toolbar offsets, focus, and scroll controls.
- [x] Render shared-reading promotional explanation in page flow on both layouts; desktop actions remain in flow, handset actions use the quiet bottom region. Suppress destinations through loaded/loading/error states.
- [x] Verify quiet password form and guest share have zero destination reservation, while share contextual actions retain exactly their measured reservation.
- [x] Recheck relevant existing action/guard behavior with bounded regressions; retain full NAV-08–12 matrix for Gate 2.

## Task 5: Maintainable regression coverage and Gate 1 visual evidence

**Files:** replace root `gate1-probe.mjs` with configured tests under `e2e/`; add `playwright.navigation.config.js`; update complete `tests/navigationLayout.test.mjs`; Gate 1 report under `docs/superpowers/reviews/`.

- [x] Use controlled guest/Pro API fixtures and deterministic saved readings; block external model calls. Add a scoped configuration that explicitly collects Chromium primary cases and WebKit spot checks.
- [x] Run complete `navigationLayout.test.mjs`, full lint, build, focused Node tests, and the new navigation browser checks. Run `npm test` after behavior changes; record exact counts and any failures without claiming Gate 2 completion.
- [x] Capture and inspect all 40 primary combinations: setup/completed Reading, populated/empty Journal, Account × guest/Pro × dark/light × 1440×1000/390×844.
- [x] Validate 320px guest controls, breakpoint focus/hidden/inert, quiet password/share, keyboard open/close, short landscape, and actual longest busy/follow-up labels. Run bounded WebKit destination/clearance/height-policy checks.
- [x] Record the 64rem-header versus wider Reading-canvas visual judgment and measured provisional budget results; identify any proposed spec amendment explicitly.
- [x] Run the Impeccable detector once after UI edits, assess its results against the approved direction, and preserve existing critiques/configuration.

## Task 6: Isolated preview, final review, and preservation

- [x] Freeze the validated prototype source/asset identity and provision separate synthetic guest/Pro preview state; leave the PR #118 comparison service and data unchanged.
- [x] Start a separate persistent preview/proxy/tunnel, verify public HTTP, source identity, guest/Pro bootstrap, and representative routes. No credentials appear in URLs or source.
- [x] Obtain one fresh independent final review of the complete diff/spec/checklist; resolve actionable issues and rerun their affected checks.
- [x] Verify original main/PR HEADs, indexes, dirty files, critiques, spec hash, and comparison preview identity against the preservation manifest.
- [x] Mark only evidenced items complete; deliver checklist, validation report, screenshots, both comparison URLs, and explicit remaining device/assistive-technology gaps.

## Task 7: Final-review P2 corrections

**Scope:** Fix R3/R4 in the isolated prototype only. Keep existing design, route guards, action DOM, data, critiques, and PR comparison preview intact.

- [x] Preserve the pre-fix state and add browser regressions; observe all six new cases fail for the reviewed causes in Chromium/WebKit.
- [x] Keep the signed-in installation host mounted across menu dismissal, with the closed menu hidden/inert. Preserve dialog pointer choices, persistence after reload, and visible focus return.
- [x] Measure prospective fixed action geometry before resolving placement, preserving the same action DOM and restoring temporary styles before paint.
- [x] Run the expanded Gate 1 matrix, affected Node coverage, full Node suite, lint/build, and one final independent review; inspect the new focused screenshots.
- [x] Refresh the prototype's frozen preview identity and its public behavior checks; update this checklist/report with exact evidence and verify preservation.

**Recovery/evidence:** `/tmp/tarot-nav-p2-fixes-oerphfeg/`. The initial six failing cases are retained in `red.log` and `red-results/`. An initial WebKit measurement assertion sampled clearance before its resize publication settled; the regression now waits for measured and rendered fixed clearance to agree before comparing histories.

## Gate 2 — recorded, not authorized by this remediation

- [ ] Owner gives Gate 1 visual approval.
- [ ] Integrate the accepted prototype into the header-navigation PR branch.
- [ ] Update navigation guidance in `DESIGN.md` and its sidecar together; retain the rest of the design system.
- [ ] Complete NAV-01–12 matrix, including real local Pro auth, Free/local data, long names/auth failures, 200% text, every dirty-profile exit, full reading/PWA/overlay/history and supporting-route cases in Chromium/WebKit.
- [ ] Run affected suites listed in spec §10, lint/build/full Node suite, and documentation checks; record exact collection and result counts.
- [ ] Commit, push, or update PR #118 only after a separate explicit request.

## Execution record

- Initial preservation/recovery manifest: `/tmp/tarot-nav-remediation-w5kvvel4/before.json`; dirty prototype recovery archive and patch stored beside it.
- Initial verified failures: read-only review evidence `/tmp/tarot-nav-review-06b8t1r5/`; five navigation unit tests and build passed, full lint failed on 21 probe globals; nine findings and two smaller spec gaps above remain open at checklist creation.
- Ruling: execute the requested remediation now in the existing isolated worktree, without another plan-approval pause; the user's “Address all findings” authorizes these fixes. Preserve the visual-approval/integration boundary.


## Initial completion evidence — before the final read-only review

Tasks 1–6 passed the initial evidence below. The final read-only review identified R3/R4, now tracked in Task 7; its current validation record supersedes the initial completion wording. Owner visual approval and all Gate 2 items remain open. See the [Gate 1 review and delivery report](../reviews/2026-10-21-header-navigation-gate1-review.md) for finding-by-finding closure, exact results, screenshots, layout judgments, source identity, and evidence limits.

- Shared chrome is 56px in all 40 primary screenshot cases; actual Account/Sign in controls, rather than their wrappers, are measured. Guest Settings/Sign in fit at 320px. Desktop Account is labelled; loading reserves its area.
- One page-scoped layout owner implements measured clearance, reversible fixed/flow placement, named secondary release order, hidden/inert destination copies, breakpoint focus handoff, keyboard focus reveal, and quiet routes.
- Ritual progress uses existing reading facts and restores accurately; an explicit new reading does not inherit the old ritual seed. Revisited steps show current state while completion facts remain intact.
- The independent whole-change reviewer found two P2 issues (R1/R2), reproduced them, then confirmed their corrections. The final verdict reports no remaining actionable Gate 1 findings. Drawer isolation, visible focus restoration, deferred install completion, and actual account alignment were also rechecked.
- `npm test`: 4,420 tests, 4,418 passed, two existing opt-in CLI/app-server skips, zero failures. Full lint, production build, and `git diff --check` pass.
- `playwright.navigation.config.js`: 58/58 passed (54 Chromium, four WebKit), including 40 visual cases. An additional run of the strengthened real-label case passed after adding hit-target checks for actions released into page flow; its test file passes ESLint.
- All eight contact sheets covering all 40 cases were inspected, plus generating/follow-up action screenshots. The 64rem frame and provisional budgets are explicitly assessed in the report. Impeccable ran once across 23 changed UI files: two typography advisories, no blocking findings; rationale recorded without changing existing design authority or critiques.
- Isolated synthetic preview: https://terminals-maintained-bedford-andy.trycloudflare.com/prototype. Source identity: `direction-a-804c84cd-2772699ec873`. The original PR preview still serves `804c84cd` at https://elections-shoe-kernel-inn.trycloudflare.com/preview.
- Public checks verified seven guest/Pro route and viewport combinations, actual synthetic login/logout, quiet share destinations, no page errors/overflow, and the served entry asset's SHA-256. Main/PR HEADs, indexes, 58 main dirty/untracked file hashes, the approved uncommitted spec, and existing critiques remain unchanged. Prototype changes are uncommitted and unstaged.

The checklist remains actionable for the next phase: obtain the owner's visual decision, integrate only the accepted prototype, update DESIGN.md and its sidecar together, and execute the complete Gate 2 matrix before any separately authorized commit or PR publication.


## Final-review P2 completion evidence — Task 7

R3/R4 are fixed and covered. All six new cases failed before implementation and pass afterward. The current Gate 1 suite passes **64/64** (57 Chromium, seven WebKit), including all 40 primary visual comparisons; all eight contact sheets and both enlarged-text recovery screenshots were inspected. The recovered 320×600 / 18px action row is 284×61px with 118px fixed clearance on both resize histories in both engines.

The full Node suite passes 4,418/4,420 with two existing opt-in skips and zero failures. Focused navigation/reading/PWA Node coverage passes 66/66; lint, production build, and whitespace checks pass. A fresh independent review found no confirmed remaining P1/P2 issue. Full Gate 2 and owner visual approval remain open.

The existing Direction A URL now serves `direction-a-804c84cd-8b806ecbd38f`: https://terminals-maintained-bedford-andy.trycloudflare.com/prototype. The six new regressions also pass against this public frozen build; seven guest/Pro route-state checks, asset identity, and synthetic generation were reverified. The prior prototype assets/metadata/replaced runtime files are preserved in its private `versions/direction-a-804c84cd-2772699ec873/` archive. The original PR comparison service remains unchanged.

This follow-up changed only `src/components/UserMenu.jsx`, `src/lib/observeAppChrome.js`, `e2e/navigation-gate1.spec.js`, this checklist, and the Gate 1 report relative to the pre-fix prototype snapshot. Main/PR files, existing critiques, the approved spec, HEADs, and indexes are preserved. All work remains unstaged and uncommitted. See the report for current artifact paths, source/asset hashes, validation limits, and preservation evidence.
