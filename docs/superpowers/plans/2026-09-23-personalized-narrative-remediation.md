# Personalized Narrative Remediation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration and superpowers:dispatching-parallel-agents for the independent semantics, theme, and acceptance-test tasks. Steps use checkbox syntax for tracking.

**Goal:** Close NAR-01 through NAR-09 while retaining complete narrative content, reading actions, conversation state, and existing permission/request guards.

**Architecture:** Keep one mounted FollowUpChat in a responsive, body-portaled overlay. Coordinate focus and background isolation through the modal hook, give chat one shrinking scroll region plus a reachable footer, and retain the existing handset decision. Make semantics and theme changes in their existing components and tokens; validate using synthetic jobs/SSE fixtures.

**Tech Stack:** React 19, Vite, Tailwind, Node test runner, Playwright Chromium and mobile WebKit.

**Spec:** [Remediation specification](../specs/2026-09-23-personalized-narrative-remediation.md)

## Global Constraints

- Preserve the existing page h1 (Tableu), complete narrative text, source metadata, prompt/API/persistence behavior, and all existing reading actions.
- Minimum interactive target: 44 by 44 CSS pixels; chat close/send: 48 by 48 CSS pixels.
- Preserve `(max-width: 768px), ((hover: none) and (pointer: coarse) and (max-height: 960px))`.
- Preserve the 500-character question limit, 750-character feedback notes limit, IME guard, tier limits, and journal consent.
- Use `--z-modal-backdrop: 60` and `--z-modal: 70`; preserve higher-priority overlays.
- Badge text contrast must be at least 4.5:1, relevant nontext indicators at least 3:1, in light and dark themes.
- Normal close/reopen and handset transitions preserve draft, messages, history preference, suggestion state, turn accounting, and in-flight requests.
- No backend, prompt, database, deployment, publication, or unrelated dirty-checkout changes.

## Review Focus

1. Closing while a request streams must retain its eventual response without sending again (task 1 and task 4).
2. Nested overlays and a removed opener must restore interactivity before focus and never trap focus in a closed dialog (task 1 and task 4).
3. 200% text and a keyboard-reduced viewport must expose the entire footer through fallback scrolling (task 1 and task 4).
4. Heading remapping must preserve streaming offsets and leave chat/journal Markdown unchanged (task 2 and task 4).
5. Source statuses must use two differing metadata fixtures rather than matching reference artwork through hardcoded counts (task 3 and task 4).

## Task 1: Overlay lifecycle, conversation, and available height

**Files:** `src/components/FollowUpModal.jsx`, `FollowUpDrawer.jsx`, `FollowUpChat.jsx`, `src/components/reading/complete/ContinueConversationSection.jsx`, `src/TarotReading.jsx`, `src/hooks/useModalA11y.js`, a scoped follow-up stylesheet and viewport helper if needed.

**Interface:** One `FollowUpModal({isOpen, onClose, isVisible, isHandset, autoFocusInput, returnFocusRef})` instance owns a stable portal/container/chat child; the handset prop changes presentation only. The focus owner selects the initial control; Chat no longer schedules its own autofocus. Entry points pass their invoking control explicitly for Safari focus restoration.

- [x] Reproduce baseline failures using the task 4 tests and retain failure logs.
- [x] Replace separate active modal/drawer mounts with one persistent portal at the reading level. Keep existing desktop/mobile entry points and action-bar suppression.
- [x] Set closed content `inert={!isOpen}` and `hidden={!isOpen}`. Capture the opener on activation, isolate the correct background siblings, and restore prior inert/ARIA state before focusing a connected opener or `#personalized-narrative-title`.
- [x] Ensure only the top active modal handles Escape/Tab; cancel delayed focus and handle nested overlay return focus.
- [x] Structure chat as a bounded flex column with a header, `min-height: 0` scroll region, and footer. Use an effective VisualViewport height without also subtracting keyboard padding. Permit whole-dialog overflow when fixed content cannot fit.
- [x] Remove overridden suggestion roles; keep native direct-submit buttons and a synchronous in-flight guard. Retain auth, identity, limits, consent, and Enter/IME behavior.
- [x] Run lifecycle, requests, hit-testing, short-window, target-size, and shared-modal regression tests.

## Task 2: Native ratings, narrative hierarchy, and skip navigation

**Files:** `src/components/FeedbackPanel.jsx`, `src/components/MarkdownRenderer.jsx`, `src/components/StreamingNarrative.jsx`, narrative header/body components, `src/components/SpreadPatterns.jsx`, and only the skip-link section of `src/TarotReading.jsx`.

**Interface:** Contextual Markdown heading offset/base option defaults to current shared behavior; narrative opts into h3 top-level sections. Stable narrative id is `personalized-narrative-title`. Native feedback groups keep existing payload names.

- [x] Add focused regression assertions for initially unselected native groups, keyboard selection, headings, and mounted skip targets; observe failing baseline.
- [x] Use `fieldset`/`legend`, shared-per-group input names, native radios, separate focus and checked treatment, and at least 44px labels.
- [x] Preserve notes, errors, success announcements, submission guards, and failed-submit retention.
- [x] Use h2 panel headings and h3 immediate children. Map all six Markdown levels relative to the narrative without rewriting content or changing word/section offsets.
- [x] Render skip links only for mounted destinations. Activation focuses and scrolls the target without changing reading state.
- [x] Run focused component/model and browser regression cases.

## Task 3: Theme and source usage

**Files:** `src/styles/theme.css`, `src/styles/tarot.css`, `tailwind.config.js`, `src/components/reading/complete/ReadingInputUsageSection.jsx`, supporting usage-model tests if required.

**Interface:** Define `z-modal`/`z-modal-backdrop`; normal light semantic status pairs are opaque. Source model remains authoritative. Theme-aware reading panel styling is scoped to `.scene-shell--reading .scene-stage__panel`.

- [x] Verify failing light success contrast and source status fixtures before editing.
- [x] Add light success `#2F6A3B` on `#EDF4EE` and caution `#854D0E` on `#FEF3C7`, with corresponding readable dark pairs and meaningful icon/text status distinctions.
- [x] Correct the reading frame's light appearance, preserving ritual/reveal styling and current typography/motion tokens.
- [x] Correct disclosure heading semantics and readable labels; preserve model-derived counts and used/requested-unused/skipped/not-requested distinctions.
- [x] Measure rendered contrast and inspect both themes with two source fixtures.

## Task 4: Deterministic acceptance tests and evidence

**Files:** `e2e/narrative-remediation.spec.js`, reusable fixture helper under `e2e/helpers/` if useful, implementation evidence document and rendered artifacts.

**Interface:** Intercept `/api/tarot-reading/jobs` and its SSE stream, complete a real reading, then exercise chat/feedback. Preserve a controllable follow-up SSE response and request counters.

- [x] Build fixtures using the actual jobs/stream route, authenticated Pro user, five narrative sections plus deeper headings, and two source models.
- [x] Write assertions covering A01-A09, both motion preferences, keyboard focus, request counts, retained state, errors/guards, 320/390/1440 widths, short height, 200% text, handset breakpoint changes, and coarse-pointer mode.
- [x] Reproduce closed-chat semantics, source contrast, feedback, heading, and dangling-navigation defects before their fixes; run the full acceptance coverage against the implementation. The supplied audit documents the original mobile foreground defect; this run did not capture that specific pre-fix case.
- [x] Verify desktop and mobile project collection and run focused suites. Preserve reading-hardening, follow-up, visual-modal, accessibility, and saved-intentions coverage.
- [x] Capture the three reference states and useful dark/narrow/focus/enlarged-text variants. Inspect screenshots and a runtime interaction trace; report simulated keyboard evidence separately from physical devices and screen readers.
- [x] Run `npm test`, `npm run lint`, `npm run build`, `npm run gate:design`, `npm run test:a11y`, `npm run test:a11y:e2e`, and `npm run ci:narrative-check`. Record exact results and pre-existing failures without disguising them.
- [x] Review integrated diff and deliver an A01-A09 checklist, re-audit table, remaining limitations, commands, and artifact links together with the spec and reference assets.

## Execution record

- Baseline: `7e9170fb2b64184a6225940f4cbef7b9e92caced`, matching the spec. Isolated branch: `codex/narrative-remediation`.
- Original checkout has unrelated ephemeris/instruction edits; they remain outside this worktree.
- Browser plugin skill is not available. Use the repository's Playwright workflow with Chromium and mobile WebKit.
- The user supplied an implementation-ready spec and explicitly requested implementation; proceed through the implementation and validation without a second design-approval pause.
- Physical-handset and spoken screen-reader passes require available hardware/software; do not substitute DOM/axe evidence for those claims.


## Completion evidence

The [implementation report](2026-09-23-personalized-narrative-remediation-report.md) records A01–A09, the 18/20 local rendered re-audit, commands, screenshots, baseline/final interaction traces, and limitations. All 31 acceptance scenarios have passing executions across the recorded runs; a final seven-case lifecycle/heading/navigation run passed after the particle lifecycle fix. The original 16-case reading/visual/saved-intention regression group passed, with the unchanged mid-stream error case also passing three consecutive repetitions.

Final unit suite: 1,938 passed. Build, design, static accessibility, Chromium accessibility E2E, and narrative quality gates passed. Repository lint retains 146 pre-existing errors and 37 warnings, with changed-file findings distinguished in the report. No physical handset or spoken screen-reader pass was available.

Integration required one bounded addition beyond the originally listed components: the narrative error transition exposed the particle adapter's pending-load cleanup race. `ParticleLayer` now uses a shared initialization promise and `particleLifecycle.js` serializes ownership and destroys cancelled, detached, or failed containers. Four focused regression tests cover those cases. Independent review's stale follow-up JSON-response finding and rejected-particle-load cleanup finding are both resolved.

Changes remain local and uncommitted in the isolated worktree. The specification and v2 references are included with the evidence package; no application publication, deployment, database change, or unrelated original-checkout edit was performed.