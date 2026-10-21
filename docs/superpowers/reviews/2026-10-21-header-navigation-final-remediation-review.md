# Direction A final-review remediation evidence addendum

**Status:** FIN-01, FIN-02, and FIN-03 are closed. Fresh complete Gate 2 acceptance finished with **936 passed, 6 explicit capability skips, 0 failures, 0 flaky results, and 0 retries** across 942 collected cases. The 38-action checklist is complete, with the existing unchanged-logo design-gate exception and device evidence limits retained. All work remains unstaged and uncommitted.

**Authorization and scope:** The owner requested implementation of all 38 actions in the [final-review remediation checklist](../plans/2026-10-21-header-navigation-final-remediation.md), with no commit or publication. The [approved specification](../specs/2026-10-21-shared-app-navigation-design.md) remains the contract. This addendum supplements the [historical Gate 2 report](2026-10-21-header-navigation-gate2-review.md); its earlier results and critiques remain unchanged.

## Implementation and findings

| Finding | Current change | Focused proof |
| --- | --- | --- |
| FIN-01 | The handset list retains its existing wrapping flex layout; its items use content width as their basis and may grow. The four equal grid cells are removed. | 16 cases pass across Chromium/WebKit, 320/390px, setup/completed, dark/light, each visiting 100% → 200% → 100% text. Labels and skipped annotations stay inside their own 44px targets, with no overlap, correct center hit tests, keyboard order, step semantics, and restored relative geometry. |
| FIN-02 | Mobile preparation controls mount only while the drawer is open. Closing removes the descendant Skip confirmation and its guard/listeners. | Escape, close button, Done, backdrop, layered Back, and desktop transition pass in both engines. Tests verify released locks/isolation, visible focus, the original history index/key, one Back to Journal, and Forward without stale confirmation. |
| FIN-03 | Fresh preparation mounting initializes the tab from the current request. | Ritual opens correctly on first open and reopen in setup, pending, and completed phases; the existing Change deck opener explicitly requests Deck. Disabled rituals retain the Deck fallback. |

Only [navigation.css](../../../src/styles/navigation.css) and [TarotReading.jsx](../../../src/TarotReading.jsx) change application behavior. The drawer's original pending/completed `keepMounted` policy remains, and its sibling installation host has a stable key. Question, selected deck, performed knocks/cut, reading, and pending generation stay in their existing owners. No modal, global Back-guard, router, backend, entitlement, billing, or journal-storage change is needed.

The new regressions in [navigation-review-regressions](../../../e2e/navigation-review-regressions.spec.js) and [PWA installation](../../../e2e/pwa-install.spec.js) exercise the actual UI with deterministic synthetic APIs and controllable SSE. Pending tests verify one interpretation request, no cancellation, and completion of that same request. Deferred native-install tests close preparation before resolving the result, verify that the exact installation host stays connected, consume the result once, and return focus to visible reading settings. Existing iOS Later/Already added and native prompt lifecycle cases remain enabled.

The [navigation fixture helper](../../../e2e/helpers/navigationFixtures.js) adds optional `rituals=false` initialization for the correct preference owner and shares the label/target geometry assertions with the [existing 200% Gate 2 sweep](../../../e2e/navigation-gate2.spec.js).

## Source identity and preservation

Worktree: `/home/ubuntu/.codex/worktrees/1877/tarot`, branch `codex/header-navigation-revamp-20261019`, HEAD `804c84cd4356ae4ace801517390b60a66fc59bd3`.

Evidence directory: `/tmp/direction-a-remediation-2qf3nb4f/`. The three `*-before.json` manifests capture every tracked/nonignored file, HEAD, status and index hash for the main checkout, target and prototype before remediation. `target-before-dirty.tar.gz` preserves the target's original dirty files and was verified against those hashes before implementation. Private index copies are also retained. `remediation.diff` records the six-file application/test delta against that dirty baseline.

The complete run froze **2,959 source inputs**, with candidate identity `bfa3b3bc96f6c799eca612f0c7c334161d418234d3518e07a4a5ca7800ed36d4`. The affected and complete cohorts use that exact same source, and all four before/after manifests match byte-for-byte. Documentation updates are excluded from the browser source freeze so this addendum and the checklist can record results afterward. The comparable pre-remediation identity is `0845aeb0f3e513d79fcab7a80d49507c2cf8ab28e37053b143d081a2e6f16c21`; `remediation-source-identity.json` records both complete hash maps for the same input set.

| Application source | Before remediation SHA-256 | Qualified candidate SHA-256 |
| --- | --- | --- |
| `src/styles/navigation.css` | `969679e4ab9734bde4c28db4f0fc8c31ebd73d532dbc44853267a8d05853d37d` | `eb0fd96a79be862165fbe6dc6c6f4b662973593d0115ab1fa8faef4c617c1601` |
| `src/TarotReading.jsx` | `18d4fe661aaec97faea4d11dc8fe43a8b0e8d62a7d4e1f5b571df74eb48cd9fa` | `2049a2c67426c792ccbeff87a8bf9b4d8f677ad814151caa6cf526d628343dee` |

Final preservation checks confirm unchanged HEADs, branches and index bytes in all three worktrees. Main and prototype have no file/status changes. In the target, only the six application/test paths, this new addendum and the updated remediation checklist differ from the handoff baseline. The approved spec, existing critiques/reports and every unrelated file remain byte-for-byte unchanged. Comparison previews were not replaced. `preservation-final.json` and the three `*-after.json` manifests record the checks; `remediation-final-files.tar.gz` preserves the eight delivered files and is verified against their current bytes.

## Validation

| Local check | Result |
| --- | --- |
| Focused Node command from the checklist | 17 passed, 0 failed |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run docs:check` | Pass, 196 maintained Markdown files; explicit Superpowers link validation is separate |
| `npm run test:contrast` | Pass, 24 semantic-token pairs |
| `npm run gate:design` | Existing failure: 2 product literal colors in unchanged `TableuLogo.jsx`, baseline 0 |
| `npm test -- --test-concurrency=2` | 4,419 passed, 2 skipped, 0 failed; 4,421 tests in 531 suites, 129.860 seconds |
| Mechanical Impeccable scan of the two changed UI files | Zero findings |
| Required eight-suite affected browser run | 473 passed, 3 explicit WebKit capability skips, 0 failed/flaky/retries; 476 collected, 648.003 seconds |
| Final complete Gate 2 matrix | 936 passed, 6 explicit WebKit capability skips, 0 failed/flaky/retries; 942 collected in 19 files, 1,413.765 seconds (23.6 minutes) |
| Independent final read-only review | No Critical, Important or Minor issue; no fix pass requested |
| Final documentation/whitespace checks | Both documents' local links resolve; 38/38 actions checked; scoped whitespace and `git diff --check` pass |

The complete matrix ran once after the source was final, using the existing isolated-cache/feature-lane configuration and a detached completion recorder. Node checks finished before browser validation. There were no concurrent source/build/Node-canary changes, automatic retries, silent omissions or diagnostic results added to the acceptance count.

| Browser project | Collected | Passed | Skipped |
| --- | ---: | ---: | ---: |
| Chromium | 307 | 307 | 0 |
| Chromium handset | 143 | 143 | 0 |
| WebKit | 307 | 302 | 5 |
| WebKit handset | 143 | 142 | 1 |
| Chromium journal visual lane | 20 | 20 | 0 |
| Chromium handset journal visual lane | 1 | 1 | 0 |
| WebKit journal visual lane | 20 | 20 | 0 |
| WebKit handset journal visual lane | 1 | 1 | 0 |
| **Total** | **942** | **936** | **6** |

Commands, run from the header-navigation worktree:

```bash
node --test tests/navigationLayout.test.mjs tests/playwrightFrontendConfig.test.mjs tests/appChromeLayout.test.mjs tests/ritualProgress.test.mjs

NAV_GATE2_OUTPUT_DIR=/tmp/direction-a-remediation-2qf3nb4f/affected \
  npx playwright test --config=playwright.navigation-gate2.config.js \
  e2e/navigation-review-regressions.spec.js e2e/navigation-gate2.spec.js \
  e2e/navigation-integration.spec.js e2e/navigation-gate1.spec.js \
  e2e/responsive-adaptation.spec.js e2e/mobile-overlays.spec.js \
  e2e/pwa-install.spec.js e2e/pwa-install-lifecycle.spec.js

NAV_GATE2_OUTPUT_DIR=/tmp/direction-a-remediation-2qf3nb4f/gate2-acceptance \
  npx playwright test --config=playwright.navigation-gate2.config.js --list
NAV_GATE2_OUTPUT_DIR=/tmp/direction-a-remediation-2qf3nb4f/gate2-acceptance \
  npx playwright test --config=playwright.navigation-gate2.config.js
```

The exact local command argv, exit codes and logs are in `local-status.json`; the browser records are `affected-status.json`, `affected-summary.json`, `acceptance-status.json` and `acceptance-summary.json`. Both collection lists and full reports are retained. The six skips are individually declared:

| Project | Case | Capability limit |
| --- | --- | --- |
| WebKit | Journal carousel edge swipes | Touch synthesis requires Chromium CDP |
| WebKit | Card scrolling versus deliberate swipe | Touch synthesis requires Chromium CDP |
| WebKit | Toast status-bar/notch clearance | Safe-area synthesis requires Chromium CDP |
| WebKit | Suspended tab returns to a painted reading | Page lifecycle suspension requires Chromium CDP |
| WebKit handset | Suspended tab returns to a painted reading | Page lifecycle suspension requires Chromium CDP |
| WebKit | Repeated assertive install-error announcements in the accessibility tree | `Accessibility.getPartialAXTree` requires Chromium CDP |

All corresponding Chromium cases ran. Separate cross-browser DOM, layout, focus, safe-area-variable and live-region coverage remains enabled. All new FIN-01/02/03 and deferred-install cases pass; none is skipped.

The two Node skips are the existing opt-in installed Codex CLI/app-server isolation checks. The logo still matches committed HEAD byte-for-byte (SHA-256 `5e0e906bb791b817ccca0a266e478781dcb03eb5d205efaf6a2d774387418d14`). Its later token cleanup remains separate: no baseline increase, ignore rule, artwork change, or logo modification suppresses that failure.

### Diagnostic runs and red/green evidence

- `red/results.json`: exact hidden-confirmation and wrong-tab baseline failures in both engines. Its first progress attempt also exposed an incorrect test expectation for the existing optional suffix; that attempt is not the layout proof.
- `red-progress/results.json` and `red-setup/results.json`: meaningful completed/setup failures show label text painting outside the forced equal-width targets. Earlier setup semantics expectations were corrected to retain the existing skipped-ritual state.
- `focused/results.json`: 22 drawer/tab/fact cases and 8 deferred-install cases pass; 16 progress cases fail only on a test assertion that compared equal top edges despite the taller skipped annotation.
- `green-progress/results.json`: 14 pass; 2 fail on an absolute scroll-offset comparison after text shrinks. Browser scroll anchoring is separate from the required restored layout.
- `green-progress-final/results.json`: all 16 pass with normal-row intersection and canvas-relative restoration assertions, while retaining label containment, target separation, keyboard and hit tests.

These diagnostic runs remain separate from the final acceptance totals. No retry masks a failed result.

## Render and independent review

All 16 current enlarged-progress captures were inspected through four contact sheets normalized to CSS width, accounting for WebKit's screenshot pixel ratio. Setup uses two rows at 200% text. Completed readings use two rows at 390px and three at 320px; engine font metrics change the item grouping. Content determines wrapping, preserving readable typography, the skipped annotation, independent targets and Settings. At normal text all four steps share one row; reducing text restores the original relative geometry. All eight deferred-install captures were inspected as well. The 24 new captures were inspected again from the final acceptance run; `acceptance-visual-inspection.json` records their paths, hashes, source identity and observations. Raw screenshots remain intact.

The fresh-context independent read-only reviewer compared the six-file delta with the recovery archive, traced the modal/history/install/lifted-state integration, inspected the new captures, and found **no Critical, Important or Minor issue**. No fix pass was requested. The reviewer judged the content-driven three-row narrow completed state consistent with the specification and plan. The review is saved in `final-independent-review.md` in the evidence directory. Its remaining validation and preservation conditions are now satisfied, with the original logo exception and physical-device limits explicitly retained.

The new coverage uses guest and synthetic Pro states. Historical real local-Pro evidence remains in the original Gate 2 report; it is not relabeled as a new real-session run for this remediation. Viewport, keyboard traversal, safe-area, installation events and orientation evidence are emulated. Physical iOS/Android browser chrome, onscreen keyboard/autofill, native installation, gestures and assistive technology remain separate release evidence.

## Decisions and delivery boundary

- Retain the execution ledger and recovery evidence because this delivery is uncommitted; generic skill-template commit and cleanup steps do not apply.
- Use the existing Change deck opener for explicit Deck verification. Canvas Settings preserves its current requested tab; it does not explicitly request Deck, so no extra opener behavior is introduced.
- Keep physical-device qualification separate from browser evidence; device-specific failures remain possible until those checks are performed.
- Keep the existing logo exception separate; `gate:design` remains red until the approved later token cleanup.

Commit, push, PR update, comparison-preview replacement, merge and deployment remain subsequent separately requested stages.
