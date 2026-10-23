# Journal Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Journal findings J1–J13 and lead with saved questions/history while preserving Tableu's identity and unrelated work.

**Architecture:** Keep current hooks/components and semantic tokens. Extract only local-write and saved-view ownership logic where meaningful tests need a pure boundary. Use real mounted browser flows for history, actions, errors, focus and contrast.

**Tech Stack:** React 19, Vite, Node test runner, Playwright Chromium/WebKit, local Wrangler Worker.

**Spec:** `docs/superpowers/specs/2026-10-23-journal-remediation-design.md`

## Global Constraints

- History and saved questions first; practice analytics remain available as secondary content.
- Preserve warm brass/plum ink, Source Serif headings, semantic light/dark tokens, tarot artwork, card geometry, and supported filter options.
- Preserve all local readings until an explicit deletion; unreadable data and failed writes/imports must not remove existing records or import sources.
- Saved views are owner scoped; legacy global names/queries are not exposed automatically.
- Guest/real active Pro browser review; other tiers use labeled fixtures. No model/provider calls or backend journal/share writes.
- Preserve unrelated dirty files and Git index; no commit, push or deployment.

## Review Focus

- Local history over 100 entries, duplicates, corrupt JSON, quota/throw/silent storage failures: preserve records and report truthful save/import outcomes (Task 1).
- Account A → guest → account B without remount/reload: no saved-view/query/draft leakage, including legacy global views (Task 2).
- Real guest versus signed-in Free/expired/cloud owner: correct deletion/sharing capabilities and errors distinct from empty state (Tasks 2–3).
- Narrow/enlarged/long-question reading: no horizontal overflow, control occlusion or inaccessible disclosure focus (Task 3).
- Actual painted dark/light Journey surfaces and screen-reader wording: contrast must pass over composition, with meaningful frequency text (Task 3).

### Task 1: Durable device-only journal writes and import (J1)

**Files:** `src/hooks/useJournal.js`, `src/lib/journal/localJournalStorage.js`, `src/lib/readingVisualStorage.js` only if needed, `tests/journalLocalDurability.test.mjs`.

**Interfaces:** `readLocalJournalEntries(storage, key)` reads strictly and throws on unreadable data. `writeLocalJournalEntries({ storage, key, entries })` returns verified persisted entries or failure; consumers preserve the original on failure. Existing hook save/import return contracts remain intact.

- [x] Add and run meaningful failing tests: 101+ records remain; 99 existing plus 3 incoming preserve 102; duplicates count correctly; malformed/scalar storage throws; quota/throw/silent failure preserves sources; successful import clears source only after verified destination.
- [x] Implement strict reads and verified persistence; remove both 100-entry slices; preserve source until verified import, report imported/skipped counts accurately.
- [x] Run targeted Node tests plus journal storage/visual/deletion regressions. Expected: all pass without dropping prose or existing visuals.

### Task 2: Owner-safe history-first Journal (J2, J3, J6–J10, J12)

**Files:** `src/components/Journal.jsx`, `src/components/JournalFilters.jsx`, `src/lib/journal/savedViews.js`, `src/hooks/useJournalFilters.js`, `src/components/journal/JournalStatusBanner.jsx`, `src/components/journal/JournalEmptyState.jsx`, `src/components/journal/JournalFloatingControls.jsx`, `src/components/journal/entry-card/EntryHeader/ComfortableHeader.jsx`, entry sharing/menu components as required, matching Node/browser tests.

**Interfaces:** Journal passes `ownerId` and auth readiness to filters; owner changes reset query/drafts/saved views before exposure. Optional practice content follows entries. Entry sharing callback is absent for device-only data. Existing filter values and menu behavior remain supported.

- [x] Add failing browser regressions for history/search access depth, question visibility, guest deletion, Free summary copy, owner/legacy view isolation, failed-load versus empty, enabled 44px Reset view, and non-occluding actions. Add meaningful saved-view storage unit tests.
- [x] Implement owner-scoped views/legacy explicit import, remove constellation duplication, lead history with search/ordinary filters and questions, place analytics/actions in secondary document flow, and clarify known-empty/error/storage states.
- [x] Run the targeted browser and Node checks, updating older tests only when their assertions describe deliberately changed UI. Expected: supported filter capabilities remain and all named findings are resolved.

### Task 3: Accessible reading, polish, independent review and integration (J4, J5, J11, J13)

**Files:** Journey season/coach styles, `CardsDrawnSection/useCardFan.js`, `CardsCallingYou.jsx`, scoped E2E tests/config; only narrow supporting styles if needed.

- [x] Add/run failing behavior checks for fan Escape focus and rendered frequency wording; use the measured audit as the failing contrast/occlusion evidence.
- [x] Fix focus after mount, accessible wording, and reliably contrasting text surfaces. Preserve existing identity and shared behavior outside Journal.
- [x] Run focused Chromium/WebKit flows at 320/390/768/1440, dark/light, and enlarged text. Verify real guest and real local Pro with scoped data fixtures and logout. Expected: no occlusion/overflow, contrast >=4.5:1, all required controls work.
- [x] Run `npm test`, changed-file lint, build, `npm run test:a11y`, and the active Impeccable automatic design-hook checks after UI completion (no redundant manual detector pass). Expected: passing checks; every failure is diagnosed and recorded rather than hidden.
- [x] Request fresh independent whole-diff code review; resolve material findings with focused regression checks. Complete Impeccable polish with a rendered pass and close only the exact processed critique snapshot after all priorities clear.
- [x] Verify original-file hashes/index, copy only owned changes into the primary checkout, verify final source parity and preserve unrelated files, stop task services, and provide a concrete evidence report. No Git publication stages.

## Review additions

Native Web Locks serialize authoritative journal mutations across saves, explicit imports, deletion, migration cleanup, and saved visual updates. Ordered guest/account acquisition avoids deadlock. A post-write deleted-account fence erases late owner copies and restores an unowned guest source if an in-flight import or migration is invalidated. Browser API unavailability fails without replacing stored readings. Add the fourth public module `src/lib/journal/storageLock.js` to the existing frozen-source allowlist.

The real mounted A → guest → B search regression verifies render-phase reset scheduling. The native two-tab save/visual regression verifies that both browser engines honor the shared critical section.
