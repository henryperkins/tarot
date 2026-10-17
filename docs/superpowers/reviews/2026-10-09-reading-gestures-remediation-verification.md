# Reading gestures repair verification

Verified on 2026-10-09 in `codex/reading-gestures-react-bridge`, against the repaired working tree based on `f6bcfcd`. The [repair ledger](2026-10-09-reading-gestures-remediation.md) maps findings to changes and retains the production boundary.

## Final integrated checks

| Check | Result | Evidence and limits |
| --- | --- | --- |
| `npm test` | Passed: 3,086 tests, 515 suites, zero skipped | [Final output summary](../../../output/reading-motion/evidence/remediation-2026-10-09/unit-final.txt). Root Node suite; not every repository test lane. |
| `npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs` | Passed: 34 tests, 1.8 minutes | [Full final test log](../../../output/reading-motion/evidence/remediation-2026-10-09/browser-final.txt). 28 desktop Chromium tests and six emulated-phone WebKit tests, one worker. |
| `npm run build` | Passed | [Final build output summary](../../../output/reading-motion/evidence/remediation-2026-10-09/build-final.txt). Vite 7.3.6; dependency warning about `onnxruntime-web` using `eval` remains. |
| ESLint on all 46 changed/new application, contract, script and test JS/JSX/MJS paths | Passed, zero warnings | `npx eslint --max-warnings=0` with the explicit changed-file list. Historical output capture scripts excluded. |
| `npm run docs:check` and changed Markdown local-link inspection | Passed | Maintained-document checker plus local targets in the new reports and evidence READMEs. |
| Staged diff whitespace check | Repair paths passed | The verbatim external review retains seven original Markdown hard-break lines that `git diff --cached --check` reports as trailing spaces. That preserved source is excluded from the clean repair-path result. |
| Fresh `npm run ci:narrative-check` | **Failed: one existing evaluator false positive** | Eleven newly generated readings; exact retained output and baseline reproduction below. This is not a green narrative gate. |
| `node scripts/evaluation/verifyNarrativePromptAssembly.js` | Passed | Run separately because the failed narrative gate short-circuited the package script's `&&` chain. No new inference. |

Browser coverage includes continuous source arrival during inspection, late semantic metadata while a fallback phrase has keyboard focus, replacement invalidation, held/released water, early deadline callbacks, route departure, emergence, persistent spread positions, paired relationships, whole-card identity inspection, reduced motion, no-WAAPI fallback, short-screen crops and Spanish question-only associations. The SSE tests use controlled responses in the actual application route; they do not exercise deployed model streaming or a real signed-in Pro session.

Earlier integrated attempts exposed two outdated identity-button assertions, a test that expected an offscreen passage to activate, and transient browser protocol/crash failures under concurrent host load. Those cases were isolated before the final serial run. A later full run exposed five short-lived phrase transitions under reduced motion; CSS now disables those transitions, and the entire final suite passes. The final log is the completion evidence, not an aggregation of retries.

## Fresh production-prompt gate: preserved failure

The run [`2026-10-09T12-40-59.116Z-f4MXXE`](../../../output/reading-motion/evidence/remediation-2026-10-09/narrative-gate/result.json) generated 11 samples at `2026-10-09T12:40:58.896Z`, using the existing personal Claude subscription, Opus 5.5 and `xhigh`, with no paid API fallback. Outputs were isolated from the repository's authentic recorded fixtures.

The sole flag is `wellbeing-marseille-reset`, where the exact passage is:

> That improves the odds of relief, but it doesn't put relief on a guaranteed schedule.

The evaluator matches `guaranteed` but misses the longer negation. The same fresh samples were evaluated using a reconstructed `f6bcfcd` evaluator and its 29 local dependency files: it also exits 1 on this exact flag. All computed metrics and per-sample analyses match after excluding timestamps and output paths. See the [baseline comparison](../../../output/reading-motion/evidence/remediation-2026-10-09/narrative-gate/baseline-comparison.json), [fresh metrics](../../../output/reading-motion/evidence/remediation-2026-10-09/narrative-gate/narrative-metrics.json), and [unchanged generated readings](../../../output/reading-motion/evidence/remediation-2026-10-09/narrative-gate/narrative-samples.json). The gate and its thresholds have not been relaxed. Repairing that pre-existing evaluator behavior is separate work.

All other measured issue counts are zero; card coverage and spine pass rate are 1. These metrics are automated checks, not human narrative-quality certification. No Workers AI binding was present, so requested GraphRAG semantic scoring used keyword fallback. This was a direct subscription-backend check, not deployed Worker verification.

An initial isolated setup used symlinked scripts and inadvertently evaluated stale copied samples because the generator's entrypoint guard did not run. That setup result was discarded. Only the subsequent real generation run is included here. The source recorded fixture remains byte-identical to `f6bcfcd`; its hash is in the result record.

## Independent evidence and remaining limits

- [Conservative fallback benchmark](../../../output/reading-motion/evidence/remediation-2026-10-09/alignment-evaluation.json): zero of 22 negative cases falsely illuminated, compared with eight before repair. Positive recall remains incomplete and is reported without tuning away misses.
- [Fresh semantic experiment](../../../output/reading-motion/evidence/2026-10-09-generated-associations/README.md): 15 unchanged generated readings, 46 faces, two Spanish cases, 247 structurally accepted annotations. The separate qualitative review records wording and span-selection limitations. Structural acceptance is not semantic accuracy.
- [Rendered presentation evidence](../../../output/reading-motion/evidence/verified-finding-repairs/README.md): inspected desktop/phone captures and measured spread image payloads. Headless measurements do not establish physical-device performance or GPU compositing.
- A fresh-context final code review found no confirmed new P1/P2 defects. Its dependency-reproducibility suggestion was applied by explicitly pinning the already-used Sharp 0.32.6 development dependency.

The feature remains opt-in. Production providers do not yet emit the new semantic document. There was no deployment, hosted CI claim, real-account tier coverage, screen-reader study, physical-handset test, exhaustive 78-card visual review or all-card cinemagraph claim.
