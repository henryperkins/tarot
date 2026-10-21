# Direction A logo-token cleanup evidence addendum

**Status:** GATE-01 is closed. The fresh design gate passes with **zero product hex color literals**, preserving its zero-literal baseline. The fixed logo variants, explicit color overrides and SVG artwork retain their previous rendered behavior. All work remains unstaged and uncommitted.

The owner authorized the planned token cleanup in the [remediation checklist](../plans/2026-10-21-header-navigation-final-remediation.md). This addendum supplements the [completed three-regression remediation report](2026-10-21-header-navigation-final-remediation-review.md) and [historical Gate 2 report](2026-10-21-header-navigation-gate2-review.md). Those reports, the [approved specification](../specs/2026-10-21-shared-app-navigation-design.md) and existing critiques remain byte-for-byte unchanged.

## Change and preserved behavior

[TableuLogo.jsx](../../../src/components/TableuLogo.jsx) replaces its two literal defaults with fixed brand tokens in the canonical [theme.css](../../../src/styles/theme.css):

| Variant | Token | Preserved color |
| --- | --- | --- |
| `mono` | `--brand-logo-ink` | `#1A1A1A` |
| `dark` | `--brand-logo-ivory` | `#E8DAC3` |

Existing palette variables change under light mode or increased contrast, so reusing them would alter these fixed variants. The two new tokens have no theme or contrast overrides. The existing `color || variantDefault` expression keeps explicit nonempty `color` props first. `primary`, `icon`, `full` and `favicon` retain their existing theme-dependent colors. SVG paths, viewboxes, dimensions, aspect ratio, accessibility attributes and variant selection are unchanged. [tableuMark.js](../../../shared/brand/tableuMark.js) remains byte-identical to HEAD.

Only those two application files change in this follow-up. No gate baseline, scanner, ignore rule, artwork, navigation behavior or application test file is changed.

## Fresh validation

Evidence directory: `/tmp/direction-a-logo-cleanup-gys9icvh/`.

| Check | Result |
| --- | --- |
| `npm run gate:design`, before edit | Expected RED: `Product hex color literals increased: 0 → 2` |
| `npm run gate:design`, after edit | GREEN: `productHexColorLiterals: { count: 0, byFile: {} }` |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run docs:check` | Pass, 196 maintained Markdown files; explicit Superpowers links checked separately |
| `npm run test:contrast` | 24 semantic-token pairs passed, 0 failed |
| `npm test -- --test-concurrency=2` | 4,419 passed, 2 existing opt-in skips, 0 failed; 4,421 tests in 531 suites, 131.288 seconds |
| Impeccable mechanical scan of both changed UI files | Zero findings |
| Focused Chromium/WebKit logo comparisons | 96 observations passed; zero page errors; before/after computed colors, geometry, path attributes, fills/strokes and semantics identical |
| Screenshot parity | All eight paired PNGs byte-identical; all eight candidate captures visually inspected |
| Existing navigation smoke checks | 6 passed in 2 files, 0 failed/skipped/flaky/retries, 28.560 seconds |
| Fresh independent read-only code review | No Critical, Important or Minor issue; no fix requested |

The two Node skips are the existing opt-in installed Codex CLI and app-server isolation tests. They are unrelated to logo rendering. Node and build checks finished before candidate browser validation, avoiding reload interference from Node public-file probes.

The logo harness uses the real component, shared artwork and complete application stylesheet through a Vite-served virtual module with ordinary package imports and an owned dependency cache. It lives entirely in the evidence directory. For each engine it visits six variants × default/custom color × dark/light theme × normal/increased contrast: 48 observations per engine, 96 total. Every custom override resolves to the supplied `rgb(42, 85, 128)`. `mono` stays `rgb(26, 26, 26)` and `dark` stays `rgb(232, 218, 195)` in every theme/contrast combination. Other defaults follow their prior theme and contrast values.

The baseline captures completed before the application edit. With HMR disabled, their still-open original documents also supplied the saved measurement JSON without reloading edited source. Candidate documents were then loaded afresh after local checks. `before-{chromium,webkit}.json`, `after-{chromium,webkit}.json` and `logo-parity.json` retain the full observations, screenshot paths and hashes. Each of the eight before/after PNG pairs has identical file bytes. Visual inspection confirms the icon and full wordmark retain their shape and proportions, the fixed variants retain their colors and explicit overrides work throughout. These are controlled component-render checks, not additional Playwright test cases added to the navigation acceptance total.

A preliminary ad hoc harness failed before rendering because direct `/@id/` package requests did not provide the expected `createRoot` export. It was replaced by the Vite-served module with ordinary imports; the diagnostic logs remain separate. No application code or dependency workaround was introduced for that harness error.

The six existing navigation cases ran through the existing Gate 2 configuration, with no retries and separate caches/outputs. They cover primary route-frame alignment on handsets in both engines, plus the desktop header/logo dimensions and canvas-progress behavior in all four browser projects. Collection and execution used:

```bash
NAV_GATE2_OUTPUT_DIR=/tmp/direction-a-logo-cleanup-gys9icvh/navigation-smoke \
  npx playwright test --config=playwright.navigation-gate2.config.js \
  e2e/responsive-adaptation.spec.js e2e/navigation-gate1.spec.js \
  --grep 'desktop header stays quiet|primary route frames align on handsets' --list

NAV_GATE2_OUTPUT_DIR=/tmp/direction-a-logo-cleanup-gys9icvh/navigation-smoke \
  npx playwright test --config=playwright.navigation-gate2.config.js \
  e2e/responsive-adaptation.spec.js e2e/navigation-gate1.spec.js \
  --grep 'desktop header stays quiet|primary route frames align on handsets'
```

Exact local commands, exit codes and durations are in `local-status.json`. Browser commands and reports are in `navigation-status.json`, `navigation-list.log` and `navigation-smoke/results.json`. The logo harness, CLI configurations and per-engine runner scripts/logs remain available alongside the parity verifier.

## Source identity and preservation

Worktree: `/home/ubuntu/.codex/worktrees/1877/tarot`, branch `codex/header-navigation-revamp-20261019`, HEAD `804c84cd4356ae4ace801517390b60a66fc59bd3`.

The fresh three-worktree baseline matches the completed 38-action handoff exactly. Each `*-before.json` records tracked/nonignored file hashes and modes, status, branch, HEAD and raw index hash. Private index copies and `target-before-recovery.tar.gz` were verified before the edit.

The same **2,959 source inputs** used by the previous acceptance run now have candidate identity `f7465afdce5bf7e4906e63254fbc7b68a34c45314b6ccbdfcea1ca052f34d78c`. The prior identity is `bfa3b3bc96f6c799eca612f0c7c334161d418234d3518e07a4a5ca7800ed36d4`; exactly the two application files differ. Documentation is excluded from this source freeze so evidence can be recorded after testing. Before/after local and final manifests confirm the qualified source remained unchanged throughout verification.

| Source | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `src/components/TableuLogo.jsx` | `5e0e906bb791b817ccca0a266e478781dcb03eb5d205efaf6a2d774387418d14` | `672cb89272e24dcc002741feab827b3e8ecdad56d15717e5b3787a754213fb67` |
| `src/styles/theme.css` | `18222513a1325274118518d21f887c891a318fe25f4a16530a65631a9b75bc30` | `d0ee8dabf35e2dfddad12b51ee303522b6f3dd40a6c337e6f5a3193b91cc0e5f` |

The unchanged design baseline has SHA-256 `67c57e57be5ca852acc6ebf0e80d6970cd2462f1e58c5524067b19aaa497815c`. The unchanged artwork has SHA-256 `9ff29e6cdf962140eff1c8a5b8a74250c50eb85990330b3a5c653cc1882f3d70`.

Final preservation verification records unchanged HEADs, branches, index bytes and unrelated file bytes/modes in main, target and prototype. Main/prototype status and files are unchanged. In the target, only the two application files, the current checklist and this new addendum differ from the fresh baseline. All original critiques, specifications and historical reports remain unchanged. `preservation-final.json` and the three `*-after.json` manifests record this result; `cleanup-final-files.tar.gz` verifies the four delivered files. Explicit local links, 38/38 checked actions, scoped whitespace and `git diff --check` pass. Owned browser sessions and test listeners are closed; comparison previews were not replaced.

## Independent review and evidence boundary

The fresh-context reviewer checked the two-file diff, CSS cascade, callers, artwork and explicit override priority, finding no issue. The original fixed-color/background choices and the application's stylesheet dependency are retained requirements; standalone use without that stylesheet has no demonstrated supported caller. Unrelated navigation changes, publication readiness and final test/render completion were outside that code review. The executor separately completed the test, render and preservation checks recorded above. `independent-review.md` preserves the review and its limits.

The prior complete Gate 2 result remains **936 passed, 6 capability skips across 942 cases**, qualified to its recorded pre-token source. This behavior-preserving follow-up runs the relevant logo checks and six existing navigation cases; it does not rerun the full matrix or relabel the prior report. The original FIN-01/02/03 application and test files remain unchanged from their qualified remediation candidate.

The logo render evidence uses a controlled component harness; the navigation smoke checks use synthetic guest APIs. These are emulated browser results. Physical-device, native installation and assistive-technology qualification remain separate evidence. Commit, push, merge, preview replacement and deployment were not performed.
