# Reading cue requalification (Task 7): frozen regression and controlled browser timing

Status: **local freeze and offline dry run complete; live requalification NOT_RUN.** No inference, budget or live dispatch was authorized for this round, so no candidate is qualified (`qualified: false`). Read the [2026-10-09 round decision](2026-10-09-reading-cue-model-qualification.md) and the [playback contract](2026-10-10-reading-cue-playback-contract-decision.md) first.

## Frozen inputs

- **Manifest:** `scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json`, `manifestSha256` `a058bae059a90a84dbcd5bef5f33b418628381f01c15986fb879c1b33d2a4fe2`, status `frozen-before-inference`, source HEAD `f24487d` plus the recorded dirty-source digest (98 runtime/test files).
- **Labels:** the 62 cases, 284 opportunities, partitions, gates and candidate order of the preserved `independent-text-review-20261009-r2` manifest, copied unchanged (`labelContentSha256` `efd4f3b7…`). The prior reserved set remains a reserved regression set, not an unseen holdout.
- **Why a new identity:** Task 12 corrected three artwork frames/crops and declared detail treatments, so the four artwork pins changed. Detail IDs, order, ownership and every model-facing prompt are unchanged (independent check: 0 prompt diffs across 78 cards). The r2 manifest is byte-identical (`8b58dae6…`) and is recorded under `supersedes`; it is never re-pinned.
- **Run identity:** 207 binding pins (runtime, prompt/schema builders, catalogs, browser helpers, migrations), the configuration (`glm-5.3-flash-low`, `glm-5.3-flash-high`, `glm-5.3-high`; temperature 0; 8,192 completion tokens; 60 s deadline; 25 words/s paced delivery; 180 wpm reader; 600 ms minimum exposure), response-format and envelope schema digests, and the per-edition system-prompt digests.
- **Verification after integration:** all 207 binding pins match the integrated tree, and the dirty-source digest matches once the manifest itself and the post-freeze identity constant in `tests/readingCueEvaluation.test.mjs` are accounted for. Root suite on that tree: 3,723 tests, 3,721 pass, 0 fail, 2 opt-in skips.
- The loader, harness and round runner now default to this manifest.
- **Post-freeze delta (test files only):** after the freeze, five test files changed: the identity constant in `tests/readingCueEvaluation.test.mjs`, the warm-pass fixture fix and lane guard in `e2e/reading-cue-artwork-performance.spec.js`, the lane guard in `e2e/reading-cue-runtime-lane.spec.js`, the touch tap-point helper in `e2e/reading-gestures.spec.js`, and a projection unit test in `tests/readingVisualStorage.test.mjs`. All 207 binding pins still match, and the recorded dirty digest is reproduced exactly when those edits are reverted (`root-integration-11-12-13-7/verify-freeze-post-4.json`), so no runtime source changed. Any separately authorized live round must freeze a new identity first.

## Predeclared plan and offline dry run

`node scripts/evaluation/evaluateReadingCueModel.mjs --dry-run --phase all --manifest scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json --repeats 2 --max-calls 600 --max-estimated-usd 15 --output <unique>` (integrated revision; the command, not the log, cleared the environment with `env -i`): run `cue:12168280…`, identity bound to manifest `a058bae0…`; **222 planned semantic calls, 0 model calls, 252 fake dispatches, `qualified: false`** with incomplete reasons `independent-output-adjudication-required`, `browser-timing-and-accompaniment-unmeasured` and `offline-fake-not-model-quality-evidence`. Evidence: remediation workspace `post-integration/task7-dry-run/` and `task7-dry-run.log` (the exit status was observed in the shell, not saved). Browser lanes were running on the host at the time; the dry run uses fake adapters and records no timing.

The offline fake adapter exercises the plan and accounting; it is not model-quality evidence.

## Live semantic round: NOT_RUN

Requires a newly authorized persistent budget for the whole round (including failures, timing and Task 8 corroboration), the owner's provider access, and independent blinded adjudication of every output. None was authorized; nothing was dispatched.

## Controlled browser timing (offline fixtures)

The complete 25-case qualification spec ran on the final integrated revision (byte-verified isolated worktree, zero retries, trace off; no other browser work ran; 1-minute load mean 1.28, max 2.24) and **passed 25/25**. Strict production-scheduler controls: Star 6/6 and five-card 25/25 qualified with availability passed (receipt p95 24 ms and 33 ms). Star paced/burst/final-only 6/6 each and full five-card paced/burst/final-only 25/25 each; no connection was consumed unseen in any session. The full-phase ideal-arrival diagnostic exceeds the 10 s receipt-lag gate by construction (p95 13.6 s) and is recorded as that rejection, not relaxed.

The complete-geometry visibility rule remains sensitive to sporadic late frame gaps: an earlier run of the same controls (v5) had eight such gaps and qualified 19/25 five-card connections. Whether to start highlights earlier is an owner decision recorded in the playback contract.

These are offline controls of the renderer and playback contract with the production scheduler and fixture cues; they do not measure a live model's receipt lag or semantics.

## Not established

Model semantic eligibility, live accompaniment, live accounting, real Pro corroboration (Task 8), physical devices (Task 15), and production behavior.
