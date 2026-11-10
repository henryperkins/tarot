# Direction A integration and Gate 2 checklist

**Authorization:** The owner approved Direction A on 2026-10-21 and requested integration into `codex/header-navigation-revamp-20261019`, coordinated design documentation, and the full Gate 2 matrix. Keep every change uncommitted and preserve unrelated files and existing critiques.

**Source:** Approved prototype `/home/ubuntu/tarot/.worktrees/header-nav-prototype-a`, base `804c84cd4356ae4ace801517390b60a66fc59bd3`, frozen runtime identity `direction-a-804c84cd-8b806ecbd38f`.

**Authority:** [Approved specification](../specs/2026-10-21-shared-app-navigation-design.md), original seven-step implementation plan in the conversation, and [Gate 1 remediation checklist](2026-10-21-header-navigation-remediation.md). Gate 1 source/reports remain historical evidence; the current owner approval supersedes their pending-approval wording. Preserve the original spec bytes.

**Recovery/evidence:** `/tmp/tarot-direction-a-gate2-34yu4maa/`. Baseline HEAD/index/status/file hashes and dirty-file recovery archives cover main, PR, and prototype worktrees.

## Task 1: Integrate the accepted source

- [x] Verify source and target share the reviewed base and no target edit overlaps the approved patch.
- [x] Copy only the 38 approved tracked/untracked prototype files; preserve the original spec and all unrelated paths.
- [x] Verify byte parity with the approved prototype before integration fixes; retain both P2 regressions and their six browser cases.

## Task 2: Update navigation design authority

- [x] Update DESIGN.md navigation/component/layout guidance and normative nav-active tokens to the approved shared frame and text destinations.
- [x] Update `.impeccable/design.json` in the same change: tokens, real-link component example, underline/dot state, quiet variant, canvas progress, handset ownership/fallback.
- [x] Keep other design identity, tokens, and existing critiques intact; verify maintained Markdown links and design-contract checks. Links pass; the design gate has the recorded pre-existing unchanged-logo color-literal failure, preserved without a waiver.

## Task 3: Run the complete existing browser regression set

- [x] Add an explicit Gate 2 collection configuration covering all specified suites, including handset-tagged cases, in both Chromium and WebKit.
- [x] Collect and record exact counts before running. Run the 15 named existing suites plus Gate 1 and missing Gate 2 coverage; retain browser-specific CDP skips explicitly.
- [x] Update selectors/assertions whose old header contract changed while preserving their behavioral assertions. Reproduce and fix integration defects with failing regression coverage.

Named existing suites: responsive-adaptation, question-field, mobile-overlays, frontend-p1-hardening, account-data-safety, account-recovery, storage-hardening, account-plan-hardening, journal-responsive-adaptation, journal-visual-restoration, reading-deck-scope, pwa-install, pwa-install-lifecycle, share-note-hardening, page-transitions.

## Task 4: Close the full specification matrix

- [x] Primary visual comparison: setup/completed Reading, populated/empty Journal, Account; 1440x1000 and 390x844; dark/light; guests and Pro; inspect images.
- [x] Auth/data: guest Journal to Settings, real local Pro authentication on its approved origin (32 fresh-page visual cases plus verified logout), Free/local readings, auth loading/failure and failed data, long identity.
- [x] Layout: 320, 768, 769, 1024, 1440px; touch-first desktop-site layout; short landscape; 200% text; changed safe area; reversible placement and reachable final controls.
- [x] Reading: setup, shuffle, deal/reveal, generating, failure/retry, completed, saving, saved, follow-up, settings, first-run welcome, tutorial replay.
- [x] Account: dirty profile exits via brand, header/dock destinations, pricing, Sign out, replay, Back; stay/discard; direct and in-page subscription hashes.
- [x] Navigation/overlays: nested Gallery active route, direct loads, history, modified links, keyboard traversal, hidden-copy isolation, menu/focus return, announcements, modal inertness.
- [x] Supporting routes: Pricing, Gallery, reset/verify, share loaded/loading/error/guest, Design; quiet destinations remain absent through auth/keyboard/viewport changes.
- [x] PWA/viewport: install openers, native-offer and iOS guide lifecycles, prompt/sheet focus, keyboard cycles, orientation, reduced motion, end clearance, both Gate 1 P2 regressions, Gallery pinning, contextual-action breakpoint handoff and flow-secondary focus.

Automated viewport/keyboard/safe-area/gesture evidence must be labelled emulated. Physical devices and assistive technology remain separate evidence gaps unless actual hardware is available; do not claim device qualification from Playwright.

## Task 5: Final quality, review, and preservation

- [x] Run navigationLayout/playwrightFrontendConfig and focused state/PWA policy Node tests, full npm test, lint, build, docs:check and relevant design checks. Record exact results.
- [x] Run one final Impeccable scan and inspect findings against the approved design.
- [x] Obtain one independent read-only review of the full uncommitted branch against spec/plan and resolve important findings with regression checks.
- [x] Update the Gate 2 report and acceptance mapping with exact final counts, evidence types, and any remaining gaps.
- [x] Confirm main/prototype hashes, approved spec, existing critiques, HEADs and indexes remain unchanged. No staging, commit, push, PR update, or preview replacement.

## Acceptance mapping

| Criteria | Evidence owner |
| --- | --- |
| NAV-01/02 | Primary visual/geometry comparisons and supporting-route probes |
| NAV-03/04 | Guest/auth/breakpoint/route and focus checks |
| NAV-05/09 | Progress, ritual-state and reading lifecycle suites |
| NAV-06/07 | Full layout, keyboard, safe-area, height-budget and action hit-target cases |
| NAV-08 | Account data-safety/recovery and added header/dock exit coverage |
| NAV-10 | Overlay and complete PWA suites in both engines |
| NAV-11 | Theme, contrast, reduced-motion, keyboard and 200% text matrix; explicit device/AT gaps |
| NAV-12 | Scoped integration manifest, current validation, preservation and uncommitted delivery |

## Completed Gate 2 evidence

The complete frozen-source acceptance run collected 896 cases in 19 files: **890 passed, 6 explicit WebKit capability skips, 0 failed, 0 retries**, in 21.9 minutes. Earlier diagnostic cohorts are retained separately in the [Gate 2 report](../reviews/2026-10-21-header-navigation-gate2-review.md), together with the 12-criterion acceptance mapping and the unchanged-logo design-gate exception.

Full Node: 4,419 passed, 2 existing opt-in skips, 0 failed (4,421 collected, 531 suites). Lint, build, documentation links, 24 token-contrast checks and the final static scan pass. Final focused coverage passes 17 Node checks, 18 browser regressions, 20 partial-input repetitions and 20 long-label PWA repetitions. The real local-Pro pass covers 32 states with verified logout; inspected render evidence includes 80 primary and 16 decoded empty-state captures. Browser emulation remains separate from physical-device and assistive-technology qualification.

The tested runtime delta is `fa93f7fee09cf4c120b595bfd549ba93b2fa92c72189a6bbf70ecb9c1227bce7` on HEAD `804c84cd4356ae4ace801517390b60a66fc59bd3`. All 61 inputs remained frozen during acceptance. Only this checklist and the report are finalized afterward. No source publication or Git staging is part of this task.
