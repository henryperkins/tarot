# Reading cue round closeout — October 10, 2026

## Superseded implementation/activation status — 2026-10-11

The finished round, restricted originals, public metric projections and **`qualified: false`** remain unchanged. Preparation-only statements below describe the historical inspected revision; current exact-source saved-reading retry/re-annotation is implemented locally in the consolidated candidate, with V9 RED and V10 NOT_RUN. See the [current readiness record and dated corrections](2026-10-10-reading-cue-readiness.md#2026-10-11-corrections-and-owner-decisions-before-v10) for the corrected latency/reservation record and open activation/release blockers. Prerequisites include **migrations 0036–0038**, the **`READING_VISUAL_JOBS` class migration**, **`VISUAL_CUE_PROVIDER`**, **`VISUAL_CUE_MODEL`**, **`VISUAL_INITIAL_LIMITS`** and **`VISUAL_REPLAY_LIMITS`**; migration 0036 plus a provider is insufficient. Physical/device, real-Pro, model and release evidence remain separately gated. This notice neither reopens the round nor authorizes inference or activation; all original text follows unchanged.

The finished round remains **`qualified: false`**. No candidate is selected. This documentation revision closes archival/status corrections only; it authorizes no new calls, production access, migration, deployment, commit or push.

## Historical round and documentation identity

- Round: `reading-cue-qualification-20261010-task6`; semantic identity: `cue:b864599f9127716a3c142ff500c8587a7cc8b852e99590159ef8d550c6547003`.
- Historical runtime/source HEAD: `f24487d089748c60716d61fe5f8b6c3056ca6eb9`; branch `codex/reading-cue-qualification-20261009`. This is the measured round identity, never a claim that the closeout text was in that revision.
- Documentation starting HEAD: the same `f24487d089748c60716d61fe5f8b6c3056ca6eb9`. Starting `git status --short --branch` had three modified parent plans and untracked remediation plan, decision report, cue-qualification evidence and test-results paths; no staged paths. Exact output is retained privately as `closeout-starting-status.txt` and in the current plan workspace.
- Closeout publication: **written locally: yes; committed: no; pushed: no**. Existing historical implementation revisions remain separate from this uncommitted revision.

## Portable evidence and privacy

The [archive index](2026-10-10-reading-cue-round-closeout/archive-index.json) names every retained artifact by relative path, SHA-256, provenance, privacy and disposition. Public retained artifacts are only the inspected allowlisted [semantic metric projection](2026-10-10-reading-cue-round-closeout/semantic-metrics.json) and [timing metric projection](2026-10-10-reading-cue-round-closeout/timing-metrics.json). Projections copy exact scored fields without rescoring. Original manifests, results, drivers and adjudications were not rewritten.

Restricted archive reference: `tableu/reading-cue-remediation/20261010-closeout`, currently `/home/ubuntu/.local/share/tableu/reading-cue-remediation/20261010-closeout`. Authorized storage access is required. Every archive directory is mode `0700` and every file `0600`. Transfer this directory through authorized private storage to the same logical reference on another machine. Credentials, authentication/session metadata, reviewer alias joins, blind packets, historical logs and source/runtime records remain restricted; none were added to Git. The public index discloses artifact identities and dispositions only. Sensitive credentials are historical retained evidence, never instructions to reuse them.

The index covers 385 immutable originals: individually inspected temporary handoff files, round evidence, prior SDD records, the four starting documents, source files pinned by the historical semantic identity, corpus/fixture inputs and starting Git status. Read `temporary-handoff/HANDOFF-20261010.md` and `prior-sdd/` privately for prior rulings. Existing ignored repository output may still exist, but portable interpretation uses the public projections and indexed restricted copies. No temporary-directory availability is required.

For reproduction, check out the historical HEAD, compare `round-evidence/semantic/identity.json` and its file digests with `pinned-source/`, then read the frozen labels/pricing/manifest, driver/packet sources, semantic plan, joined scoring and final ledger from the archive. Historical absolute paths inside immutable artifacts are provenance: map the temporary prefix to `temporary-handoff/` and round-output prefix to `round-evidence/`; do not edit frozen source files or rerun provider calls under the closed round identity. Offline interpretation/recalculation may use a separate copy. A new scored experiment requires a new identity and explicit authorization.

## Reconciled completion and allowance

Exactly **183 dispatches = 155 semantic + 28 timing = 148 accepted + 35 failed**. All **35 unknown-usage settlements** retain conservative reservations. Held allowance is **$13.7589453**; the known token-derived estimate is **$0.0545485**; measured cost is **incomplete**. These values must not be added. **Zero reserved attempts remain.** The ledger field `halted: false` does not imply sufficient next-call headroom: admission rejected the conservative next reservation.

Full GLM High made **seven semantic attempts**, of which **one trial was accepted/completed out of 74 planned**. The other six failed; budget prevented the remaining plan. Negative traps were not exercised, so its trap qualification is **unmeasured**, despite the historical scorer's vacuous `passed: true`. Its recall remains `0/396`, including missed planned opportunities. Flash candidates have measured semantic failures; Full GLM is budget-incomplete and cannot qualify.

The final source artifact `adjudication-blind.json` and `semantic-scored-report.json` top-level provenance both report **324 supported / 19 incorrect / 0 uncertain** among 343 independently adjudicated cues. The pre-closeout decision prose asserted **314 / 29**, including 26 negative-trap cues; that documentary claim does not reconcile with the retained final adjudication artifact. Its starting bytes are preserved. Final candidate scores separately count 300 supported cues (213 + 84 + 3) after scoring/structural gates, not the 324 independent verdicts. A deterministic join on `(trialId, caseId, cueId)` against the retained hard/semantic failures explains the 24-cue difference: Flash Low excludes 21 independently supported verdicts (17 invalid dependencies + four negative traps), Flash High excludes three (negative traps), and Full GLM excludes zero. Scoring requires a supported verdict and valid structural/trap checks; independent judgments remain unchanged. Detailed original judgments and rejection/dependency scoring remain available privately; the provenance of the earlier 314/29 wording is unresolved. Timing adjudication remains 100 supported / 2 incorrect / 0 uncertain among 102 cues.

Semantic numerators, denominators and 95% Wilson intervals are retained exactly for overall, cue-kind, partition, language, edition, repeat and reserved RWS English groups in the [semantic projection](2026-10-10-reading-cue-round-closeout/semantic-metrics.json). Denominators retain missed planned opportunities; no historical numerator was invented to fill an unmeasured lane.

## Controlled timing reconciliation

All 18 browser reader windows were valid/completed on Chromium at 390×844, with paced delivery 25 words/second and independent reader 180 words/minute. Only 12 sessions dispatched any inference. Six Full GLM zero-dispatch sessions are **budget-incomplete**, with their 6/25 required-opportunity denominators retained, and cannot establish provider-quality failure or passing latency. Zero of 18 planned sessions qualified availability or accompaniment. Flash High Star burst retains **1/6**, not a blanket Star `0/6` shorthand.

Provider round-trip is the server request start-to-finish interval. Scheduler wait is the pending-source delay before dispatch. Browser receipt lag is measured in the browser clock from passage receipt to matching cue receipt. Rendered exposure is adoption/visibility dwell, with at least 600 ms required for automatic qualifying exposures. These are distinct measurements; browser receipt-lag p95 below is not provider latency and clocks are not subtracted across domains. `null` latency means no matched measurable receipt, not zero delay. A completed uncensored reader window alone is not semantic eligibility.

| Session | Dispatches | Receipt availability | Browser receipt-lag p95 (ms) | Qualified exposures | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| glm-5.3-flash-low-star-2347-excerpt-paced | 3 | 0/6 | unmeasured | 0 | measured-gates-failed |
| glm-5.3-flash-low-star-2347-excerpt-burst | 2 | 0/6 | unmeasured | 0 | measured-gates-failed |
| glm-5.3-flash-low-star-2347-excerpt-final-only | 1 | 0/6 | unmeasured | 0 | measured-gates-failed |
| glm-5.3-flash-low-five-card-creative-project-paced | 7 | 10/25 | 98800.2 | 0 | measured-gates-failed |
| glm-5.3-flash-low-five-card-creative-project-burst | 2 | 5/25 | 20537.7 | 1 | measured-gates-failed |
| glm-5.3-flash-low-five-card-creative-project-final-only | 1 | 5/25 | 18172.5 | 1 | measured-gates-failed |
| glm-5.3-flash-high-star-2347-excerpt-paced | 2 | 0/6 | unmeasured | 0 | measured-gates-failed |
| glm-5.3-flash-high-star-2347-excerpt-burst | 2 | 1/6 | 31967.1 | 0 | measured-gates-failed |
| glm-5.3-flash-high-star-2347-excerpt-final-only | 1 | 0/6 | unmeasured | 0 | measured-gates-failed |
| glm-5.3-flash-high-five-card-creative-project-paced | 4 | 5/25 | 67728.8 | 1 | measured-gates-failed |
| glm-5.3-flash-high-five-card-creative-project-burst | 2 | 5/25 | 56084.1 | 0 | measured-gates-failed |
| glm-5.3-flash-high-five-card-creative-project-final-only | 1 | 0/25 | unmeasured | 0 | measured-gates-failed |
| glm-5.3-high-star-2347-excerpt-paced | 0 | 0/6 | unmeasured | 0 | budget-incomplete |
| glm-5.3-high-star-2347-excerpt-burst | 0 | 0/6 | unmeasured | 0 | budget-incomplete |
| glm-5.3-high-star-2347-excerpt-final-only | 0 | 0/6 | unmeasured | 0 | budget-incomplete |
| glm-5.3-high-five-card-creative-project-paced | 0 | 0/25 | unmeasured | 0 | budget-incomplete |
| glm-5.3-high-five-card-creative-project-burst | 0 | 0/25 | unmeasured | 0 | budget-incomplete |
| glm-5.3-high-five-card-creative-project-final-only | 0 | 0/25 | unmeasured | 0 | budget-incomplete |

## Skipped and pending lanes

Fresh Pro Codex streaming corroboration and independent review of those fresh readings: **SKIPPED: semantic ineligibility / insufficient allowance**. There are no fresh-reading numerators, authenticated Pro streaming results or physical observations to report. Temporary authentication preflights do not substitute for those skipped probes.

The portable [re-annotation audit](2026-10-10-reading-visual-reannotation-audit.md) and [iPhone/VoiceOver checklist](2026-10-10-reading-iphone-voiceover-checklist.md) retain their historical inspected HEAD `a7eb324a003c3f9d2f6be77aa049b0913a44216b` and preparation-only status. Re-annotation implementation, physical Safari/VoiceOver execution, artwork optimization, production readiness and release remain pending. They need fresh evidence after relevant implementation.

## Owned lifecycle evidence

Historical `cleanup.json` records owned frontend PID 375008 with `closed: true`; `ownership.json` records its inert port 40749 and temporary state directory. The pinned close routine terminates its owned frontend and removes its temporary state. The frozen driver writes cleanup and the final budget in `finally`; `live.log` ends with `live-complete` at `2026-10-10T01:19:55.900Z`. The recorded state path is absent at closeout inspection, and the final ledger has zero reserved attempts. These records support owned cleanup; current PID ownership was not inferred from old numbers, and no process was signaled. The artifacts do not provide a separate process-exit-code record; the earlier claim of a proven clean driver exit code is narrowed to recorded natural completion and cleanup. Protected beta services remain outside this task.

## Principal immutable artifact hashes

| Archive-relative original | SHA-256 |
| --- | --- |
| `temporary-handoff/task6-execution/driver.mjs` | `e0a1e09f5d7005df52b47769cb1d3d196a4f6d4edb591ea94f4f92011c729ba0` |
| `temporary-handoff/task6-execution/packets.mjs` | `4e6828aedb5da813821a5a3d5a83c12e5cdd399be6274801a73bfb6dc1411d01` |
| `round-evidence/orchestration-freeze.json` | `a5732e7f19b377030513b57de6b35258896e79fc1d20c4fcbd9f6b47df059b6b` |
| `round-evidence/semantic/identity.json` | `0420f132554a4a4bc2953c411847e417563ad19520797e1abaa407220b1ca5b6` |
| `round-evidence/semantic/plan.json` | `0db86fe830e8604e8925c9b404180cae4aeceaf8aa6333b8ea349f36602ba3b5` |
| `round-evidence/semantic-scored-report.json` | `67582bebe26687b509a3afcfe186871e393a9b7e39122a75947989751032cca7` |
| `round-evidence/timing-scored-report.json` | `2db755eaf25eb593664142d404fbb6f1a61d88f00cea1e9b8f5ef7467e2e6204` |
| `temporary-handoff/task6-execution/adjudication-blind.json` | `3ac454c4863f3b82137e6ed58c9d718b6449864f0554cee4b2aa755f07882140` |
| `temporary-handoff/task6-execution/adjudication-timing.json` | `1c8e3c150a37a3f81d9a164bd46186775ae1e93cbad4fe8f31c7b1d6a6339b21` |
| `round-evidence/final-budget.json` | `50b651175557f518fe884a9b0c39cefdce326f6e991380699d549fe64e0ef876` |
| `round-evidence/cleanup.json` | `28f010cc005abb0e23ec4c9d326f6bc8e8a355baa1267f41341f007f6f4531f9` |
| `round-evidence/ownership.json` | `36fd51dd928855258c44cc4477841ee8c819a800634cd69e97a0023a8ab93abc` |

## Local archival verification

All 385 restricted copies were read and SHA-256 checked using only archive-relative paths, independently of the temporary handoff. Frozen driver/packet digests match `orchestration-freeze.json`; archive permissions passed. Documentation/link/whitespace verification and remaining limitations are recorded in the task report. No provider, browser server, production system, commit or push was used for this closeout.
