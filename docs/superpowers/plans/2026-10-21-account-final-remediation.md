# Account final review remediation

> **For agentic workers:** Execute this checklist task by task in the current session. Keep all changes uncommitted.

**Goal:** Resolve the four remaining Account export and profile-navigation findings with regression coverage.

**Architecture:** Read the signed-in owner's device journal independently of cloud entitlements, validate the server export before merging it, and preserve the selected section when releasing the profile history guard. Keep the existing export format and ownership/deletion protections.

**Tech stack:** React, BrowserRouter, Cloudflare D1, Node tests with migrated in-memory SQLite, Playwright Chromium and mobile WebKit.

**Spec:** The final Account review in this session: omitted paid-account device readings, swallowed export parsing failures, removed extracted steps, and stale section hashes after profile editing.

## Constraints

- Leave HEAD and the index unchanged; do not commit or stage files.
- Preserve unrelated files and all existing critiques byte for byte.
- Leave the unrelated Tailwind ignore rule and existing critique documentation links untouched.
- Do not export another account's readings or unclaimed guest readings, and do not revive deleted data.
- Put verification logs and recovery files outside the repository.

## Review focus

- Plus/Pro accounts with unmigrated browser readings must export both cloud and browser data.
- A malformed, missing-section, or unreadable response must produce an error without a download.
- Unreadable device storage must fail visibly instead of claiming a complete export.
- Deleted readings, another owner's bucket, and the guest bucket must stay excluded.
- Save, cancel, discard, and browser Back must retain correct section and route history.

## Checklist

### 1. Complete and validate browser exports

Files: `src/pages/AccountPage.jsx`, `src/hooks/useJournal.js`, `e2e/account-data-safety.spec.js`.

- [x] Add Playwright cases for Plus/Pro local readings, cloud/local deduplication, account isolation, and deleted-entry filtering; observe the paid export failure.
- [x] Add cases for invalid JSON, incomplete bundles, and unreadable local storage; observe failures before implementation.
- [x] Add a strict owner-scoped device loader that works independently of cloud entitlements and honors existing deletion fences.
- [x] Reject invalid server bundles, merge owned device entries on every tier, and show errors without a success download.
- [x] Verify all export regression cases in Chromium and mobile WebKit.

### 2. Preserve saved action steps

Files: `functions/api/account/export.js`, `tests/accountExport.test.mjs`.

- [x] Seed nonempty extracted steps in migrated SQLite and assert that the real handler retains them; observe the failure.
- [x] Preserve parsed fields whose normalized name is unchanged.
- [x] Verify the export and journal-summary handler tests.

### 3. Preserve section navigation while closing profile edits

Files: `src/pages/AccountPage.jsx`, `src/hooks/useAndroidBackGuard.js`, `e2e/account-data-safety.spec.js`; add a focused root test if the shared guard changes.

- [x] Assert the selected hash survives Save and Cancel, then Back returns to Pricing; observe the existing failure.
- [x] Release the guard without restoring a stale Account section; keep ordinary overlays and discard navigation correct.
- [x] Verify section jumps, repeated jumps, Save, Cancel, Back/stay/discard, and the mobile overlay suite.

### 4. Final validation and preservation

- [x] Run the affected Account, narration, journal-search, responsive, memory, and overlay E2E checks with zero retries.
- [x] Run the root Node suite, lint for touched files, build, and default E2E collection.
- [x] Review the final diff for ownership, response-validation, and history edge cases.
- [x] Compare baseline hashes, HEAD, and the index; confirm unrelated files and all critiques are unchanged.
- [x] Record exact results and remaining limitations here and in the final response.

## Results

Initial red runs reproduced all four findings. An additional red case caught display fingerprint deduplication dropping a distinct legacy record; export now preserves both records and rejects invalid entries instead of silently omitting them.

Focused green checks: 32/32 browser cases across Chromium and mobile WebKit; 65/65 focused root tests for export, summary, guard lifecycle, and account/entry deletion fences. Lint is clean for the files changed in this remediation. The initial broader run passed 184/184 cases with zero retries, and an independent review found no additional actionable issues.

Stronger browser focus assertions then caught a desktop gap in the initial history fix: window POP listeners could observe the stale route despite capture registration. The root history driver now models registration order and native focus/scroll restoration. The final guard explicitly republishes the repaired location and preserves the current view after native restoration. Its 3 root regressions and all 4 Save/Cancel browser cases pass. Browser assertions require the last selected Audio section to remain visible and the Plan heading not to regain focus; clicking profile controls during editing does not change the selected hash.

Final verification:

- Affected browser matrix: **184/184 passed**, 9 specs, Chromium and mobile WebKit, **zero retries**, after the final history correction.
- Complete root suite: **4,400 passed, 2 skipped, 0 failed**, 4,402 tests and 530 suites. New export and Back-guard regressions run through `npm test`.
- Final build, ESLint for all 7 source/test files changed in this remediation, and `git diff --check`: **passed**.
- Default E2E collection: **1,068 tests across 80 files**; its root discovery regression also passed in the complete suite.
- `docs:check`: still reports **14 pre-existing link errors in the preserved critique**; no new Account or checklist link errors. These links remain untouched under the user's preservation constraint.
- Preservation: all **80 unrelated starting files**, including **all 3 critiques**, are byte-identical. Only the 5 intended files from the dirty baseline changed; the shared Back guard, its root test, and this checklist are the only newly dirty paths. Private configuration is unchanged, HEAD remains `15c2a7cafea6ee5839c6a5e412f2138220e58885` on `master`, and the index remains empty. No changes were committed or staged.

The native Back behavior was verified through browser automation and the focused history model; no physical-device gesture qualification was performed.

Recovery files and exact logs: `/tmp/tarot-account-final-fixes-e_ovpu4j/`.
