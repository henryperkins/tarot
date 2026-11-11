# Journal quiet toolbar — implementation and design QA

Type: evidence
Status: six review findings remediated and verified locally
Updated: 2026-11-11 UTC

PR: [#147](https://github.com/henryperkins/tarot/pull/147). This follow-up starts from reviewed head `7d57b0a0f079735b2bccc2646778e417b7d1ebf0` on `fix/pr147-review-findings` in `/home/ubuntu/tarot/.worktrees/pr147-review-findings`, for publication to the existing `feat/journal-quiet-toolbar` PR branch. No merge or deployment was performed.

## Visual source and scope

The supplied `882C379E-78D2-45E3-8355-AA6D98726853.PNG` is the selected **Quiet toolbar** direction. It is a raster concept board, not a measured browser viewport. Its relevant hierarchy is a full-width mobile search field, a single row of Filters / chronological order / View at 390px, consistent quiet control styling, active-filter chips, and separate month navigation.

The immutable ordering, matching and analytics inputs, pagination and month projection, and backward-compatible saved-view normalization from the existing PR remain intact. Scope is the six review findings plus close-button, focus-order, and documentation follow-up.

## Review findings addressed

1. **Theme controls and selection contrast.** Native radios and checkboxes cover their labels as transparent pointer and keyboard targets, preventing the global checkbox artwork from showing. Their visible indicators are consistently 16×16px, use theme tokens, and mark selection with a dot or check. Labels retain a 44px minimum target and a focus ring. Measured indicator contrast is **9.09:1 in dark** and **5.46:1 in light**, above the 3:1 non-text requirement.
2. **Month navigation.** The select has explicit right padding and a separate decorative CaretDown, with its native background chevron removed. The phone heading uses the smaller title size so the full month label fits beside it at 390px; narrow or enlarged-text layouts can wrap.
3. **Mobile toolbar.** Sort uses the same keyboard listbox disclosure as View. All three controls use 14px medium-weight labels and the quiet outline treatment. View includes a leading list icon; Filters includes a caret and active count. At 390px with two filters, their measured widths are **107 / 108 / 80px**, plus two 8px gaps: **311px within a 324.8px toolbar**. All three are 44px high on the same row. Search remains 16px. Controls wrap at 320px or enlarged text.
4. **Popover bounds.** The desktop filter panel is capped to the toolbar width. At 1024px, its measured left edge is **50.6px** and its width is **514.8px**, matching the toolbar rather than extending left of it. Existing vertical clamping and independently scrolling choices remain. Sort/View menus also clamp to the viewport, using untransformed width and immediate positioning.
5. **Owner transitions.** Sort resets to Newest first before rendering a new account or guest list. Filter visibility belongs to the same owner/readiness state as saved views; Sort/View disclosure instances also reset on owner changes. Mounted probes exercise account A → account B → guest → account A without reloading the tested component.
6. **Clear behavior.** Panel clearing is enabled only by non-query criteria and preserves the external query and sort. Toolbar clearing still resets the query and criteria while retaining order.

The panel uses the shared circular CloseButton. Its DOM position follows Filters, so Shift+Tab from Close filters returns to its trigger. A delayed jump-to-search focus now yields if the reader has already moved focus. Dropdown opening focuses its selected option during layout, avoiding a queued animation frame stealing a subsequent keyboard selection.

The [Journal design guidance](../../DESIGN.md#journal-entries) now describes these controls. This report was relocated from root `design-qa.md`. The replacement PR description is retained with the local artifacts at `output/playwright/pr147-review2/pr-description.md`.

## Verification

The following checks apply to this local follow-up. Browser evidence uses the final production build; the mounted source probes use an isolated Vite server.

- Production build: passed; existing `onnxruntime-web` direct-eval warning.
- Focused Node journal tests: **40 passed, 0 failed** across journalListOrder, journalHistory, journalSavedViews, journalUtils, journalProgressiveHistory, and journalSemanticSearch.
- Static accessibility: **24/24 theme checks**, **0 static WCAG errors**. The repository-wide analyzer continues to report advisory warnings; this does not establish a full accessibility audit.
- Mounted owner-transition probes: **2 passed**, Chromium on Vite, using synthetic account responses and local journal fixtures.
- Final scoped browser run: **110 passed, 0 failed** in one Chromium/WebKit invocation (55 per browser, including 35 quiet-toolbar cases per browser). The additional 2 mounted probes bring the distinct passing browser project/case count to **112** across the production-preview and Vite runs.
- Targeted timing follow-up: the focus cases passed three repetitions per browser; the final menu-bounds case also passed three repetitions in each browser after its positioning correction. These repeats are not added to the distinct case count.
- Scoped ESLint: **0 errors, 0 warnings**. Maintained Markdown links: **241 files checked, all local links resolve**. Whitespace: passed.
- Pre-push full Node suite (`npm test`): **6,514 tests: 6,512 passed, 0 failed, 2 skipped**, exit 0 in **210.42 seconds**. The log is `output/playwright/pr147-review2/publication-npm-test.log`.
- Release/model gates: not run for this UI-only follow-up.

The scope excludes `sticky rail journey stays visible while scrolling`, whose unchanged-base failure is documented in the previous published QA record. An initial broad invocation reproduced that failure. No sticky-rail implementation or assertion was changed.

Earlier attempts exposed pointer interception from visually hidden inputs, fixture React imports that did not share the isolated Vite optimizer instance, a delayed menu-focus race, and menu positioning that animated beyond viewport margins. Those attempts are retained in the local logs and are not passing evidence. The final run uses full-label native input targets, a Vite-transformed source probe, layout-time menu focus, and immediate menu positioning.

## Rendered evidence and limits

Chromium captures use the production build, UTC/en-US, reduced motion, and synthetic guest readings. The supplied concept was inspected alongside the rendered default and active toolbar, mobile filter sheet, and desktop filter popover in dark and light themes. Captures cover 390×844, 1024×900, and 1280×900. Browser assertions additionally cover 320 and 768px, short viewports, up to 200% root text, footer hit-testing, keyboard selection/dismissal, and search/sort/saved-view behavior. Manual capture recorded no unexpected console errors or uncaught page errors.

Current artifacts are under `output/playwright/pr147-review2/` in the remediation worktree, including `visual-measurements.json`, `mobile-default-dark.png`, `mobile-active-dark.png`, `mobile-active-light.png`, mobile-panel images, desktop-panel images, and test logs. These artifacts are ignored local files, not published PR attachments.

Guest and synthetic signed-in Pro states are covered. The real local Worker at `http://localhost:8787/api/auth/me` did not respond within the five-second probe; its existing process was preserved and no real reviewer login was attempted. Credentials were not read or copied. Real authentication, subscription billing, search-backend integration, physical devices, browser chrome, and screen-reader use remain outside this evidence. No production services or data were changed.

## Previous published QA at 7d57b0a0

The earlier follow-up addressed native sort-label sizing, vertical panel/footer reachability, and grouped chip locators. It recorded **26 quiet-toolbar cases**, **176 distinct browser project/case combinations** across multiple runs, and a pre-push full Node result of **6,514 tests: 6,512 passed, 0 failed, 2 skipped**. Those figures describe the previous published tree, not this follow-up. Earlier browser artifacts remain under `/home/ubuntu/tarot/output/playwright/pr147-remediation/`; the original read-only review remains under `/home/ubuntu/tarot/output/playwright/pr147-review/`.

The original implementation's earlier setup failures are retained below as historical evidence. They do not describe current browser availability.

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
