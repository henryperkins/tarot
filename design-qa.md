# Journal quiet toolbar — implementation and design QA

**Current result: all three PR review findings addressed and browser-verified locally.**

Updated: 2026-11-11 UTC. PR: [#147](https://github.com/henryperkins/tarot/pull/147). Reviewed head: `b36abc3d88b43135ab405e127b95c3e1bfeda081`; base: `e1f526a3691547ef46c6cd733a9842f077d2f4a4`. Remediation was prepared on `fix/pr147-review-findings`, based on that exact PR head, for publication to the existing `feat/journal-quiet-toolbar` PR branch. No merge or deployment was performed.

## Selected visual source

The selected direction is **Option 1: Quiet toolbar**. The original implementation recorded `tableu-journal-quiet-toolbar.png`, 1536 × 1024, SHA-256 `d7bf66887f6bf3b72d80e1f6f5a0dd74d61146b0c234503c7ac32acbc3aed733`. The review also inspected the supplied `Photo 1.jpg`, 1280 × 853, SHA-256 `9f313a01c9ebcc01229a5862f3176b96902c2aa001b5b73769b723668ded27b5`.

These are raster concept boards, not measured browser viewports. Their authoritative direction is the control hierarchy: prominent search, explicit chronological order, one Filters disclosure, a density disclosure, removable active-filter chips, and separate month navigation.

## Implemented scope

- Search fills the phone toolbar's first row. Other controls wrap when their full labels cannot fit together.
- Newest first / Oldest first orders an immutable projection of the matching readings. Equal timestamps remain stable; undated or invalid dates remain last in either direction.
- Sort changes reset the visible batch and stale month navigation. Month counts, jump indices, pagination and highlighted-reading retention use the same ordered projection.
- Sorting does not alter query signatures, semantic-search mode, filter badges or analytics inputs. All controls remain disabled while complete cloud history is pending.
- Filters opens a non-modal desktop popover or a modal phone sheet with native named choices, live filtering and explicit Close / Show readings controls.
- Display contains Comfortable / Compact. Existing device density persistence remains intact.
- Active chips, clearing and owner-scoped saved views remain available. Clearing preserves sort. Saved views include sort; older views default to newest without rewriting stored bytes merely on read.
- Existing fonts, theme tokens, icons, reading cards, artwork and app chrome are retained.

Intentional differences from the concept board: **Display** replaces **View**, and the existing reading-card layout and Journey rail remain. This PR implements the toolbar direction rather than reproducing the concept board's flat reading rows.

## Review findings and remediation

1. **Clipped phone sort labels:** the native select now takes its intrinsic minimum width from both option labels, including matching text styles and space for the caret. The controls wrap before truncating the selected value. The shared labels also generate the native options. Mobile input text remains 16px and all controls retain their 44px minimum height. The redundant native background chevron is suppressed.
2. **Desktop filter footer outside the viewport:** the popover now measures the space available below its anchor and within the visual viewport, accounting for the pinned header and bottom navigation. It moves upward when necessary and updates on resizing, scrolling and chrome-size changes. The choices scroll independently of the header and footer. Observers, listeners and scheduled frames are cleaned up on dismissal and when switching to the phone sheet.
3. **Four failing filter assertions:** chip assertions are scoped to the named Journal filters region; multiple contexts use the existing grouped `2 contexts` chip. Tests also reopen the panel to verify both selections persist, remove the grouped chip, and verify both selections clear.

The broader regression run additionally exposed a timing-sensitive follow-up typography assertion: its partial-text locator matched a hidden Suspense fallback and the rendered paragraph at once. It now waits for the exact parsed paragraph. That case passed three parallel repetitions against each of the production preview and the normal Vite server.

Ten regression cases were added to the quiet-toolbar suite, bringing it to 26. They cover full sort-label fit with active filters at 320, 390, 768 and 1280px; 200% root text at 320 and 390px; footer reachability at 1280×900, 1280×600 and 768×900; internal scrolling, a resize to 500px high, page scrolling, enlarged text, preserved selections and focus restoration. Footer checks assert full visibility and pointer hit-testing before interactions can automatically scroll a button into view.

## Current verification

| Check | Observed result |
| --- | --- |
| Production build | Passed; existing `onnxruntime-web` direct-eval warning |
| Six focused Node journal files | 40 passed, 0 failed |
| Chromium journal/filter/list/Journey cases | 141 distinct cases passed across the production-preview run, Vite-dependent harness run and targeted follow-up assertion recheck |
| WebKit quiet-toolbar and filter-hardening cases | 31 passed, 0 failed against the production preview |
| Configured iPhone 13 WebKit mobile filter cases | 4 passed, 0 failed against the production preview |
| Changed JS/JSX/test-file ESLint | Passed, zero errors or warnings |
| Markdown links and whitespace | Passed; all local links resolve across 241 maintained Markdown files |
| Pre-push full Node suite (`npm test`) | 6,514 tests: 6,512 passed, 0 failed, 2 skipped; exit 0 in 211.64 seconds |
| Release/model gates | Not run for this UI-only change |
| Merge / deployment | Not performed |

The browser total is **176 distinct project/case combinations with passing evidence across runs**, not one uninterrupted green invocation. The known sticky-Journey-rail case was excluded from this remediation matrix after the preceding review reproduced its failure on the unchanged base. It is unchanged and is not one of the PR findings.

The complete Node suite was rerun after the user authorized commit and push. Its successful current result supersedes the historical setup failures recorded below. The local run log is `output/playwright/pr147-remediation/publication-npm-test.log` in the primary checkout.

A first broad dev-server run was interrupted after concurrent server setup collided and stale Vite dependency requests returned HTTP 504. The production-preview run then exposed that Journey harnesses and two journal tests explicitly import Vite source modules, which a production bundle does not serve; those cases were rerun with their normal Vite server. Logs preserve these attempts and the follow-up assertion failure, rather than presenting them as successful runs.

## Rendered comparison

Manual captures used the built application at 320×844, 390×844, 768×900, 1024×900 and 1280×900 CSS pixels, Chromium, DPR 1, UTC/en-US and reduced motion. A synthetic guest fixture contains 35 readings across four months, including the concept's leading questions and real bundled artwork. Dark captures include default and active filters, the desktop popover and phone sheet; light phone captures include default and active filters.

- At 390px with Love and Last 30 days selected, the sort control has 162px of label space for approximately 91px of rendered text. At 320px it has 98px. Neither viewport overflows horizontally. Display moves to the next row where the three controls cannot fit without clipping.
- At 1280×900, the desktop panel ends at y=892 and Show readings occupies y=835–879. The review's original panel ended below the viewport at approximately y=1023.
- The header, reading cards, typography and artwork retain the PR's existing presentation. Changes target the readable toolbar and reachable filter actions.
- Manual console output contains only the expected synthetic guest `/api/auth/me` 401 and the intentionally blocked service-worker warning; no other logged application errors were observed.

Local evidence is under `output/playwright/pr147-remediation/` in the primary checkout, including `verification.md`, `active-320.png`, `active-390.png`, `active-768.png`, `active-1280.png`, `desktop-panel.png`, `mobile-sheet-dark.png`, `mobile-active-light.png`, measured bounds and test logs. The original read-only review remains under `output/playwright/pr147-review/`. These ignored local artifacts are not published PR attachments.

## Coverage limits

Guest and synthetic owner/Free/Plus/Pro states were exercised by the existing browser fixtures. Those fixtures do not establish real session authentication, subscription billing or search-backend behavior. The local Worker at `http://localhost:8787` did not answer its auth probe within five seconds; it was left untouched and no real reviewer login was attempted. The credentials were not exposed or copied into evidence. Physical devices, mobile browser chrome and a screen reader were not exercised. No production data or services were changed.

## Original implementation verification history

The following records the original implementation environment and predates the successful browser review/remediation above. Its browser-launch failures and earlier full-suite counts are historical, not the current browser status.

1. Initial production build passed. Focused sorting/saved-view tests passed.
2. Source review found ancestor clipping and analytics tie-order coupling. The history shell now permits popup overflow while its decorative child remains clipped; analytics and both Journey instances receive the unchanged matching order.
3. Source review also led to consistent mobile visual/DOM order and focus restoration after saving/cancelling a saved view.
4. The initial full Node suite reported 6,507 tests: 6,495 passed, 9 failed, 3 skipped. Five failures exposed missing new modules in the isolated-runtime source allowlist. Both modules were added; the dedicated runtime recheck passed **15/15**.
5. The four other failures were reproduced against the exact unchanged base in a separate clean worktree. Two assume a missing `/tmp/opencode` parent; two require an absent Chromium headless-shell executable. The baseline failed-file run reported 19 tests: 15 passed, 4 failed.
6. Final production build and focused checks passed. The final complete suite reported **6,507 tests: 6,500 passed, 4 failed, 3 skipped** (291.55 seconds, exit 1). The four failures are the same setup failures reproduced on the unchanged base; no source-allowlist failures remain.
7. Cloud-browser navigation to the local review harness returned `upstream connect error or disconnect/reset before headers; reset reason: connection termination`. The scratch preview initially also encountered `uv_interface_addresses` / `EPERM` on a wildcard bind. A safer loopback preview started, but was not reachable through the browser's preview route. No permission, security or network-isolation bypass was attempted. Owned preview processes were stopped.
8. After the reader explicitly authorized local Playwright verification, `npx playwright install chromium` under Playwright **1.62.1** exited 1. The official Chromium ZIP URL returned HTTP 200 with `Content-Type: text/html`, 195 bytes, and a "Site Unavailable / Unable to access this site" page instead of an archive. This response does not distinguish upstream unavailability from destination policy.
9. A normally configured launch using the existing `/usr/bin/chromium` (**Chromium 156.0.8078.79**) failed before page creation: `process_singleton_posix.cc:297 — socket() failed: Operation not permitted (1)`, followed by a ptrace denial. Execution stopped at that runtime permission boundary without additional browser flags, privilege escalation, sandbox changes, mirrors, or proxy changes. **Zero E2E cases executed.**
10. The missing `/tmp/opencode` parent was created as test setup. The earlier full-suite and baseline counts above predate that setup change; they were not presented as new post-setup results. Application source and tests were unchanged during this verification attempt.

Exact local browser launch preflight (this failed before opening a page):

```js
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true
});
const page = await browser.newPage();
await page.setContent('<h1>Local browser smoke check</h1>');
console.log(JSON.stringify({
  version: browser.version(),
  heading: await page.getByRole('heading').innerText()
}));
await browser.close();
```
