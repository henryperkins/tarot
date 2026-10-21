# Direction A integration and Gate 2 evidence

**Status:** Direction A is integrated and the full automated Gate 2 matrix is complete: 890 passed, 6 explicit capability skips, 0 failures and 0 retries. The existing unchanged-logo design-gate failure and physical-device/assistive-technology limits are recorded below. Everything remains uncommitted.

**Authorization:** The owner approved Direction A and requested integration into `codex/header-navigation-revamp-20261019`, coordinated design documentation, and the full Gate 2 matrix. Everything remains uncommitted. The approved spec and existing critiques remain unchanged.

**Authority:** [Design specification](../specs/2026-10-21-shared-app-navigation-design.md), original implementation plan in the conversation, and the [integration checklist](../plans/2026-10-21-header-navigation-gate2.md). Earlier Gate 1 reports describe the isolated prototype; the owner's subsequent approval authorizes this integration.

## Source and scope

The target remains based on PR #118 commit `804c84cd4356ae4ace801517390b60a66fc59bd3`. The initial integration copied exactly the 38 accepted prototype files, with byte parity recorded before integration fixes. The prototype worktree and comparison previews have not been replaced.

The shared frame, plain-text destination links, guest Settings and direct Sign in, quiet routes, canvas progress, single handset bottom-region ownership, and reversible height policy are integrated at page level. Account's existing exit guard still contains both placements. No backend handlers, entitlements, journal storage, billing, or authentication protocols change.

`DESIGN.md` and `.impeccable/design.json` now describe the same accepted navigation contract, including semantic active state, the 64rem frame, enlarged-text growth, quiet variant, guest tutorial access, and completed/current/upcoming/skipped progress. The sidecar's progress example also uses the canvas's ordered steps, checks, numbered skipped ritual and 44px controls instead of its former underline treatment.

Evidence and recovery directory: `/tmp/tarot-direction-a-gate2-34yu4maa/`. `before.json` records original HEADs, indexes, statuses and dirty-file hashes; recovery archives preserve all three worktrees' original dirty files. `integration-manifest.json` records the copied source. `gate2-source.json` records the runtime source identity used for the full run: `fa93f7fee09cf4c120b595bfd549ba93b2fa92c72189a6bbf70ecb9c1227bce7`.

## Integration regressions closed

- Open account menus initially raised the header above confirmation dialogs. The menu layer now stays below dialogs, and confirmations isolate their background. Dirty-profile menu exits retain one confirmation and working Stay/Discard actions.
- Direct guest Sign in now isolates the application background and restores keyboard focus to a current header control.
- At 200% text, the brand and reserved account area can wrap instead of overflowing compact viewports. Normal text retains the 56px row.
- Reading actions released into page flow receive measured focus clearance, including after their dimensions change. Fixed actions keep their existing behavior.
- In short landscape, reading preparation scrolls as one sheet so installation remains reachable between its header and footer. A scrolled-body gesture does not accidentally dismiss that sheet. Consuming an installation button restores a visible fallback control.
- Gallery filters again participate in shared measurement, with their existing desktop minimum width/height eligibility and reversible fallback.
- Shared-reading contextual links hand focus to their visible copy before the old placement becomes hidden/inert; reading actions without an equivalent hand focus to the canvas. Hidden follow-up actions remain mounted until that handoff.
- Enlarged shared-reading contextual links wrap or stack within the bottom region. Focus on secondary controls that have returned to page flow clears the actual pinned header.
- The final-section continuation keeps its natural row height while invisible/inert at the end of the reading. This removes a 44px section-tracking layout loop that made canvas Settings unclickable.
- Chrome measurement no longer pulls the page back to an unrelated offscreen input after deliberate scrolling. Fully or partially visible focused controls and resized focused chrome still receive clearance. A direct partial-input regression fails in both engines before the boundary correction and passes after it, alongside deliberate-scroll preservation.
- Prospective fixed-size measurement preserves document and nested scroll positions when actions occupy page flow. Temporarily removing the region from flow previously let the browser clamp both offsets, which clipped long action labels. A deterministic regression reproduced both losses in both engines; the fix passes that regression and 20 repeated PWA long-label cases. The shared header also overrides inherited short-landscape padding within the same CSS layer, retaining 56px plus safe area on all three primary routes.
- Guest Settings now exposes tutorial replay. The welcome, Skip confirmation, and return to a visible control work without sign-in; Sign out remains authenticated-only.

Existing browser assertions were updated where the accepted design deliberately replaced the former guest disclosure, progress label, or independently fixed action bar. Behavioral checks for hit targets, reading content, save/cancellation semantics, installation, navigation, keyboard focus and history remain.

## Validation

The full Gate 2 configuration explicitly collects the 15 existing suites named in the spec, Gate 1 coverage, and three integration coverage files. Visual-restoration tests use a separate owned Vite lane with their required gesture/model-annotation flags; other cases retain the normal feature configuration. Each lane owns a separate private dependency cache, covered by a Node regression, so the feature configurations cannot invalidate each other. Existing Node runtime tests temporarily create/remove public canary files; running those beside a watching Vite server triggered reloads and cleared a test's local data via its init script. The final browser run follows the completed Node run and freezes all watched source files. It uses four workers globally, with the heavy WebKit visual projects capped at two, no concurrent builds or Node server tests, and a detached runner that records completion independently of the command session.

| Browser project | Collected | Passed | Skipped |
| --- | ---: | ---: | ---: |
| Chromium | 297 | 297 | 0 |
| Chromium handset | 130 | 130 | 0 |
| WebKit | 297 | 292 | 5 |
| WebKit handset | 130 | 129 | 1 |
| Chromium journal visual lane | 20 | 20 | 0 |
| Chromium handset journal visual lane | 1 | 1 | 0 |
| WebKit journal visual lane | 20 | 20 | 0 |
| WebKit handset journal visual lane | 1 | 1 | 0 |
| **Total across 19 files** | **896** | **890** | **6** |

Command: `NAV_GATE2_OUTPUT_DIR=/tmp/tarot-direction-a-gate2-34yu4maa/gate2-acceptance-896 npx playwright test --config=playwright.navigation-gate2.config.js`.

The complete acceptance run finished in 21.9 minutes with 890 passed, 6 skipped, 0 failures and 0 flaky results, with retries disabled. All 61 validation inputs stayed byte-for-byte frozen throughout the run; the source archive was verified before execution. `acceptance-exit.json` and `gate2-acceptance-896-summary.json` record successful completion and preservation. Only this report and the Gate 2 checklist were reconciled afterward. The preceding complete 892-case run recorded 885 passed, 1 failed, and 6 explicit capability skips on a byte-verified frozen checkout. Its long-label failure led to the native scroll-clamping fix above; all 18 focused navigation regressions and 20 PWA repetitions now pass. The complete 890-case run recorded 882 passed, 2 failed, and 6 capability skips. Its PWA focus boundary is corrected and covered by a deterministic regression. Its Journal handset test completed all 13 painted samples/assertions before final artifact capture hit the overall timeout; WebKit alone now gets a 120-second total budget, with every assertion/sample retained. The earlier complete 886-case run recorded 853 passed, 30 failed, and 3 skipped; its failures are retained. A 72-case remediation cohort recorded 65 passed, 4 failed, and 3 CDP skips. The remaining four were test/harness issues: an atomic geometry handoff, two contrast samples losing their saved entry during an unintended Vite reload, and a visual losing its execution context during that reload. With isolated caches, no concurrent Node canary writes, and a frozen checkout, all four affected cold-cache WebKit cases pass with the original 60-second timeout and every painted contrast sample retained. Earlier interrupted runs are diagnostic evidence and do not count as a completed matrix. These cohorts are reported separately, not added to the final pass count.

An attempted 896-case run ended with SIGTERM before its final JSON/report: its log records 874 passed, 2 failed, 6 skipped and 14 unfinished. All 61 source inputs remained byte-for-byte frozen. One failure exposed a test setup race: the delayed Journal Journey panel expanded after the test positioned its search field, pushing it fully offscreen before the dock resize. The regression now waits for the loaded panel and establishes/asserts partial intersection in the same browser task as the resize. A read-only differential probe confirms the old boundary leaves about 136px clipped in both engines while the current boundary clears it. All 18 navigation regressions and 20 repetitions of the corrected partial-input case pass. The other diagnostic failure was a WebKit saved-cue expectation after reload; five unchanged reruns pass. The original timeout and the incomplete run are retained, without counting them as an acceptance pass.

The six browser skips are explicit WebKit capability limits: carousel touch synthesis (1), card-swipe and notch/safe-area CDP probes (2), page-lifecycle suspension in desktop and handset projects (2), and the Chromium accessibility-tree live-region probe (1). Every corresponding Chromium case runs; separate cross-browser layout, keyboard, focus, safe-area-variable and live-region DOM cases remain enabled. No test is retried or silently omitted.

| Local check | Result |
| --- | --- |
| `npm test -- --test-concurrency=2` | Pass: 4,419 passed, 2 skipped, 0 failed; all 4,421 tests collected in 531 suites (130.317 seconds) |
| `npm run lint` | Pass |
| `npm run build` | Pass, 10.19 seconds |
| `npm run docs:check` | Pass, 195 maintained Markdown files |
| `npm run test:contrast` | Pass, 24/24 semantic-token checks |
| `npm run gate:design` | Existing failure: 2 literal colors in unchanged `src/components/TableuLogo.jsx` against baseline 0 |
| Final Impeccable scan | Pass, 26 changed UI files, zero static findings; rendered checks are covered separately |
| Focused checks after final test/documentation changes | Pass, 17 Node checks; 18 navigation regressions and 20 partial-input repetitions across both engines |
| Independent whole-change review | Two P2 findings reproduced and fixed; expanded 18-case navigation regression file passes across Chromium/WebKit |

The two Node skips are existing opt-in installed Codex CLI/app-server isolation checks (`TABLEU_CODEX_CLI_CHECK`); they are outside the navigation scope. The design-gate exception is verified against committed HEAD: the logo is unchanged. No logo edit, baseline increase, ignore rule, or unrelated config change was introduced to suppress it.

## Render and authentication evidence

The primary synthetic matrix captures setup and completed Reading, populated and empty Journal, and Account at 1440×1000 and 390×844 in dark/light, guest/Pro states. Additional integration coverage checks 320/768/769/1024/1440px boundaries, touch-first desktop-site behavior, 200% text, auth loading/long identity/failure, quiet-route loading/error/auth transitions, increased contrast, and desktop dirty-profile history.

The separate real-session pass uses the canonical local reviewer account only at `http://localhost:8787`, with an isolated copy of local D1. It performs real login, verifies active Pro through `/api/auth/me`, uses one task-owned deterministic reading, captures 32 cases across Chromium/WebKit, both themes and both primary viewports, deletes the task-owned reading, and logs out. Each state uses fresh page storage and explicit setup/completed assertions. No auth response or session cookie is mocked in this pass. Private credentials are read directly in the script, never printed or committed; screenshots mask identity fields.

Final local-Pro result: 32/32 geometry and state cases against the current built runtime, 56px header, one active destination placement, no horizontal overflow, brand/account alignment within 1 CSS pixel, and no observed page errors. Cleanup verifies deletion of the task-owned reading, HTTP 200 for logout and then HTTP 401 from `/api/auth/me` in both engines. Some Chromium handset captures show Journey's asynchronous loading state; loaded synthetic Journey states are covered separately.

The 64rem-header versus wider Reading-canvas offset is deliberate. Full-width captures preserve a stable app frame while the reading canvas uses its existing width; the canvas progress remains visibly separate from primary navigation. All 80 synthetic primary captures across both engines and all 32 real-Pro captures were inspected through contact sheets in both themes and widths, along with a full-width completed reading. Synthetic geometry records exactly 56px in all 80 cases and zero brand x/y or account-right spread across routes at each viewport/session/theme/engine. Header brand x=208 at 1440px and x=16 at 390px; the wider Reading content begins about x=104 on desktop. This intentional 104px offset retains the approved composition.

Two original Chromium guest empty-Journal captures preceded illustration decoding. They remain intact. A supplemental 16-case empty-state pass waits for `image.decode()` across both engines, themes, widths and guest/Pro states; all four contact sheets were inspected. `visual-inspection-896.json` records the actual inspected artifacts for runtime `fa93f7fee09cf4c120b595bfd549ba93b2fa92c72189a6bbf70ecb9c1227bce7`.

Current generating/follow-up budget measurements agree in both engines: at 320×700, generating uses 56px header + 109px bottom + 57px secondary; completed/follow-up moves its actions into flow and uses 56px header + 57px destinations + 153px secondary. At 700×360 both states release the header and actions and retain 57px destinations. All flow actions pass page-end hit testing. The provisional 25% bottom and 40% combined (25% on short screens) values remain supported by emulated evidence, with physical-device limits below.

## Acceptance mapping and limits

| Criteria | Evidence |
| --- | --- |
| NAV-01/02 | Shared primary-route frame geometry, real-Pro alignment, supporting-route and enlarged-text probes |
| NAV-03/04 | Guest Journal → Settings, 320px controls, loading/long identity, active nested route, modified links, one focusable placement and direct `hidden`/`inert` inactive copies |
| NAV-05/09 | Progress/milestone Node tests and browser revisit/skipped-ritual, generation/error/retry, saving/saved/follow-up, restoration, settings and tutorial cases |
| NAV-06/07 | Height budgets, safe-area changes, short landscape, keyboard hiding/focus handoff, reversible placement, long-label hit targets and final-control clearance |
| NAV-08 | Account stay/discard, brand/top/dock/menu/pricing/sign-out/replay/Back exits, normal history and direct/in-page subscription hashes |
| NAV-10 | Menus, auth, confirmations, onboarding, reading preparation, installation/native prompt/iOS guide lifecycles in both engines |
| NAV-11 | Dark/light and increased-contrast browser scans, normal/reduced motion, keyboard, 320px, 200% text and semantic-token contrast checks |
| NAV-12 | Scoped integration manifest, current validation, original spec/critique and worktree preservation, unchanged HEAD/index, uncommitted delivery |

Browser viewport, safe-area, keyboard, install-offer, orientation and gesture probes are emulated. They do not qualify physical iOS/Android browser chrome, keyboard/autofill, screen readers or gesture hardware. No live AI generation or external billing/email workflow is required for this navigation change; generation uses controlled deterministic transports. Public previews remain on their existing source identities.

The automated NAV-01 through NAV-12 evidence is complete with the explicitly stated capability/device limits. The approved specification and historical Gate 1 critiques remain unchanged. Final delivery checks verify the original main/prototype dirty files, HEADs, branches and indexes, the target's original spec, and the scoped integration paths. The report/checklist are the only post-run source-document updates; the tested runtime identity is unchanged.

## Implementation decisions and tradeoffs

- Use the existing header-navigation worktree and installed dependencies. Baseline and complete checks verify the shared environment; no new checkout or installation is needed.
- Carry the approved prototype and its original regression evidence, with fresh failing coverage for integration fixes. Gate 2 supplies the broader verification rather than rebuilding the accepted design.
- Keep changes and ledgers uncommitted as requested. Recovery archives and source hashes provide the durable record while HEAD/index remain unchanged.
- Preserve the unrelated logo and design-gate baseline. This leaves that existing gate red until its two literals are reconciled separately.
- Accept effective ancestor inertness for portal-modal backgrounds while requiring direct `hidden` and `inert` on inactive destinations. Keyboard and focus tests cover the behavior; physical assistive technology remains a separate limit.
- Keep visual-restoration feature flags in their own Vite lane and private cache. This adds a second local server while preserving ordinary feature settings elsewhere.
- Run Node runtime tests before browser validation because their public-file canaries trigger Vite reloads. Sequential execution costs time and preserves browser-fixture integrity.
- Cap the heavy WebKit visual projects at two workers and run acceptance through a detached completion recorder. This bounds contention and avoids command-session lifetime limits; it adds validation time and does not qualify physical-device timing.

