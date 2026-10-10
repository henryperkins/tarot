# Reading cue playback diagnosis — 2026-10-10

Local offline fixture diagnosis. Task 2 adds controls and measurements; it changes no production selection, artwork, prose pacing or reader pacing. The prescribed full browser run is closed: seven tests passed and three strict positive controls failed; their assertions and evidence are retained.

## Confirmed result

The unchanged fast-adapter paced Star and five-card tests pass while accompaniment fails. Availability alone is insufficient: all six Star and all 25 five-card opportunities receive valid cues on time, but the automatic companion misses required passages. A separately scheduled, availability-compatible Star control passes all positive assertions and exposes all six exact occurrence/detail target sets for at least 600 ms.

The fast Star replay now records the committed reducer state. Pool, memory and ground are **consumed without ever becoming the current cue or automatic stage**, despite timely receipts, exact source projection and true reducer passage visibility. This confirms a selection/coalescing miss. It is not inferred from transport adoption: `cueAdoptions` measures ledger adoption, while `stageAdoptions` and the read-only committed-state probe independently measure actual playback selection.

## Environment and scope

Starting HEAD: `f24487d089748c60716d61fe5f8b6c3056ca6eb9`, with the root's preserved starting dirty snapshot. Owned frontend and relay use OS-assigned loopback ports and isolated state. HMR and dotenv loading are disabled; no original beta ports or primary dotenv are used. Chromium at 1100×1000; actual `matchMedia` is `no-preference`. Recorded raw Markdown, source delivery at 25 words/s, independent reader at 180 words/minute, full uncensored endpoints, retries zero, minimum uninterrupted qualifying exposure 600 ms.

Auth is the existing mock Pro fixture. The relay forces the selected frozen case metadata; the ordinary app start request still has empty general `reflectionsText`, so this does not verify the ordinary application context contract. The deterministic model-output adapter still goes through the production prompt, job and ledger validator. Ideal transport releases only already validated cumulative cue subsets and uses an explicitly separate fixture revision sequence. It never changes source Markdown, selection, artwork, visibility or the independent reader. These controls prove local fixture behavior and instrumentation, not live semantics, a real provider, application identity, actual Pro authentication, physical devices or production behavior. Browser plugin unavailable; regular repository Playwright is used. No paid/live calls, actual login, commit, staging, deployment or production access.

## Evidence and commands

Before any code edit:

```sh
CUE_QUALIFICATION=true npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-cue-qualification.spec.js --grep 'paced: independent Star passage timing|full five-card paced'
```

Both tests pass (5.8 minutes); both accompaniment scores fail. An earlier anchored grep found no tests because the qualified title includes the file path; it produced no playback evidence. Immutable baseline evidence: [Star report](../../../output/reading-motion/evidence/cue-qualification/task5-browser-t8tLmI/paced/report.json), [Star score](../../../output/reading-motion/evidence/cue-qualification/task5-browser-t8tLmI/paced/scores.json), [five-card report](../../../output/reading-motion/evidence/cue-qualification/task5-browser-t8tLmI/five-card-paced/report.json), [five-card score](../../../output/reading-motion/evidence/cue-qualification/task5-browser-t8tLmI/five-card-paced/scores.json).

After the test/measurement changes and before final measurements:

```sh
node --test tests/readingCueBrowserMeasurement.test.mjs
npx eslint e2e/reading-cue-qualification.spec.js e2e/helpers/readingCueBrowserSession.mjs e2e/helpers/readingCueBrowserCollector.mjs e2e/helpers/readingCueBrowserScoring.mjs tests/readingCueBrowserMeasurement.test.mjs
CUE_QUALIFICATION=true npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-cue-qualification.spec.js --grep 'paced Star correct cues|reader-aligned Star arrival'
```

Measurement units: 12/12 pass. Scoped ESLint: pass. Star control run: one expected strict fast-scheduler failure, two passes (source-active-phase positive and reader-aligned diagnostic), all full endpoints. The failing positive assertions remain in the spec. No source/helper edits during measured sessions. Fast replay: [opportunity traces](../../../output/reading-motion/evidence/cue-qualification/task5-browser-jL15hf/positive-star-production-scheduler/opportunity-traces.json). Genuine ideal positive: [report](../../../output/reading-motion/evidence/cue-qualification/task5-browser-fTr99a/positive-star-source-active-phase/report.json), [score](../../../output/reading-motion/evidence/cue-qualification/task5-browser-fTr99a/positive-star-source-active-phase/scores.json), [opportunity traces](../../../output/reading-motion/evidence/cue-qualification/task5-browser-fTr99a/positive-star-source-active-phase/opportunity-traces.json).

The prescribed final command completed with exit 1, seven passed and three failed (29.3 minutes), without modified retries or shortened endpoints:

```sh
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-cue-qualification.spec.js --grep 'independent Star passage timing|full five-card|correct cues'
```

The three failures are the production-scheduler Star positive, production-scheduler five-card positive, and derived source-active-phase five-card positive. The genuine source-active-phase Star positive passes again. All six original Star/five-card paced, burst and final-only tests pass, including their existing explicit revisit assertions. All five-card sessions reach the independent 904-step / 301333.333 ms endpoint; Star sessions reach 97 steps / 32333.333 ms. All seven owned frontend sessions report `closed: true`. The final unit rerun remains 12/12; scoped ESLint passes. Existing negative/lifecycle definitions were retained, but cases outside this exact grep were not rerun by Task 2.

These results belong to the immutable per-run `identity.json` provenance captured before the parent integrated Tasks 4/9. They do not qualify the subsequently integrated candidate. No whole-runtime identity was recomputed after unfreezing. The five owned test/helper final bytes were copied and hashed before unfreezing; later integrations are outside this evidence.

## Joined Star trace

Unchanged baseline: complete 97-word window (32333.333 ms), eligibility true, availability 6/6, receipt-lag p95 21.2 ms, accompaniment false. The current fast replay confirms the actual state transition for each miss:

| Opportunity | Fast playback | Classification | Ideal exact automatic exposure |
| --- | --- | --- | --- |
| arrival, occurrence 2 identity | selected and exposed | qualified | 1762.5 ms |
| pool, occurrence 2 `pool-pour` | ledger revision 2; pool and land both visible; pool consumed, land pending while identity remains active | selection/coalescing | 1736.6 ms |
| land, occurrence 2 `land-pour` | selected and exposed | qualified | 1727.1 ms |
| memory, occurrence 2 `pool-pour` | ledger revision 3; memory and ground visible; memory consumed, ground pending while land remains active | selection/coalescing | 1722.7 ms |
| ground, occurrence 2 `land-pour` | ledger revision 4; ground consumed, balance pending while land remains active | selection/coalescing | 1709.7 ms |
| balance, occurrence 2 both pours | selected and exposed | qualified | 3222.6 ms |

Fast probe browser timestamps: pool first consumed at 5766.9 ms; memory at 6850.3 ms; ground at 7000.0 ms. Corresponding current/pending IDs, validated cue IDs, source spans, binding/revision, passage visibility and remaining deadline are in the linked traces. All three skipped cues remain consumed through the full reader endpoint and never become current. Sampling gaps are recorded and split exposures; they do not explain an absent selection. The probe traverses the committed React root rather than an arbitrary alternate fiber. This is version-specific, fixture-only diagnostic evidence; the independent DOM projection/geometry collector remains the scoring authority.

The reducer's `reconcile()` computes all fully rendered visible unconsumed associations, keeps the latest, and consumes every earlier candidate **before** deciding whether the active cue blocks adoption. Co-received visible pool/land therefore discards pool regardless of a shorter active duration. Memory is discarded against ground; ground is then discarded against balance while waiting. Changing phase duration alone cannot recover co-received candidates already consumed by that rule.

## Explicitly separated schedules

`production-scheduler`: unchanged deterministic fast adapter and real production job scheduling. No injection, delay or throttling.

`source-active-phase`: predeclared earliest source-order schedule from the frozen delivery events, spaced by the existing `ACTIVE_MS = 1800` read from the reducer source. Browser deadlines are relative to first actual source render; a scheduled release can only include a cue already validated by the real job. Actual release receipts, server ledger revision and separate fixture revision are logged.

Star scheduled releases after first source render are 0, 1800, 3600, 5400, 7200 and 9000 ms. Theoretical maximum source lag is 7000 ms. Actual p95 is 7039 ms; availability 6/6 and accompaniment pass, with all six exact target exposures above 600 ms. This is genuine availability-compatible positive evidence.

Five-card earliest all-25 full-active-phase schedule starts at source time 5440 ms and ends at 48640 ms. The fourteenth opportunity (`pentacles-group`) already has theoretical source lag 10680 ms; maximum is 13760 ms and p95 13560 ms. These bounds concern **one full-1800-ms-per-cue schedule for all 25 cues**, not the accepted contract in general. They do not prove a minimum-600-ms schedule or another policy impossible, nor exclude a subset satisfying the original accompaniment requirements. The separately measured five-card result must be assessed using its actual receipts, first visibility and exposures.

`reader-aligned`: a separate diagnostic release at each independent 180-wpm anchor-start deadline. It does not slow source or reader. Its known long source-to-receipt lag is deliberately different from availability-compatible timing and is not qualification proof or proof that the accepted contract is intrinsically impossible.

## Five-card baseline and measured attribution

Unchanged baseline: complete 904-word window (301333.333 ms), eligibility true, availability 25/25, p95 32.9 ms, accompaniment false. Exact qualifying automatic exposures: Ace castle, Swords left-behind detail, Pentacles collaborators, Wheel loop, momentum return and closing spark. All five identity introductions and the Ace/Queen relationship have no qualifying automatic exposure. The subsequent committed-state replay separates those categories below.

The strict fast five-card replay completed all 904 steps with availability 25/25, p95 36.8 ms, eligibility true and accompaniment false. [All 25 joined traces](../../../output/reading-motion/evidence/cue-qualification/task5-browser-kGxeaX/positive-five-production-scheduler/opportunity-traces.json) show 15 cues actually consumed without selection, including all five identity introductions and the Ace/Queen pair. At first Ace visibility, arrival/sprout/castle are all visible and the first two are consumed while castle becomes current. At pair visibility, pair/readiness/collaboration-return are all visible; the first two are consumed while collaboration becomes current.

| Fast five-card category | Count | Evidence |
| --- | --- | --- |
| selected, exact automatic exposure qualified | 7 | castle, two-swords, collaborators, Wheel loop, collaboration return, tone-check return, closing spark |
| consumed without selection | 15 | includes all five identity introductions and the Ace/Queen pair |
| source-passage visibility mismatch | 1 | Queen cup current at 75381.3 ms; first exact source visibility only at 107337.7 ms |
| conservative first-window dwell/continuity miss | 2 | Wheel image 107.5 ms and momentum return 163.5 ms before observed frame gaps |

The Queen screenshot below shows Queen art while the reader is in Seven of Swords and the Queen heading is entering at the bottom; the cup phrase remains below the viewport. Runtime span bounding-box/IntersectionObserver intersection differs from the collector's exact source-range/unobscured geometry test. This confirms the boundary mismatch without guessing a more specific unmeasured cause.

The two dwell misses **do not show that the 1800 ms phase is too short**: their first visible intervals end on unobserved-frame gaps, and later independently observed exact automatic exposures last about 2981/2929 ms but do not overlap the scorer's authoritative first interval. No gap is bridged or credited. Baseline sampling already had 62 gaps (p95 167.3 ms); replay had 68 (p95 171.7 ms), so the new probe alone cannot be blamed from this comparison.

The derived source-active-phase five-card control also completed all 904 steps, unchanged snapshot and complete validated-cue release. Its [report](../../../output/reading-motion/evidence/cue-qualification/task5-browser-p9ln5m/positive-five-source-active-phase/report.json) and [traces](../../../output/reading-motion/evidence/cue-qualification/task5-browser-p9ln5m/positive-five-source-active-phase/opportunity-traces.json) show availability numerator 25/25 but controlled-gate failure at actual p95 13616.1 ms (maximum 13807.2 ms). Accompaniment fails with the same 15 selection losses, including all introductions and the pair. Thirteen measured source lags exceed 10000 ms. The known arrival-policy limitation and the independently confirmed selection losses remain separate findings. Both strict positives retain every failed assertion.

No baseline source-projection errors or source mutation invalidation occurred. Receipt, rendered visibility, ledger adoption, actual stage selection, exact geometry and clipped uninterrupted exposure are joined by validated cue ID in `opportunity-traces.json`. Classification distinguishes source projection, late dispatch/receipt, selection/coalescing, renderer visibility, inadequate dwell and invalid measurement. A transport adoption is never treated as proof of visible artwork.

## Contract decision before Task 3

The frozen Task 2 runtime's latest-visible consumption rule loses timely required opportunities even while their later replacement has not been selected. This conflicts with the paced six-Star experience for co-received visible cues. A production remedy requires an explicit selection-policy decision consistent with accepted cues surviving coalescing, one in-flight annotation request/one latest pending source snapshot, explicit hold precedence, and no forced scroll or captured playback backlog. This task preserves failing positive tests and evidence; it does not weaken gates, alter motion thresholds, manufacture visibility or implement a production policy.

## Screenshots

These endpoint screenshots prove rendered fixture page/prose and final companion state, not earlier automatic dwell. Earlier dwell is proved by the independent sampled intervals and retained Playwright failure trace.

![Unchanged Star endpoint](../../../output/reading-motion/evidence/cue-qualification/task5-browser-t8tLmI/paced/desktop.png)
![Ideal Star endpoint](../../../output/reading-motion/evidence/cue-qualification/task5-browser-fTr99a/positive-star-source-active-phase/desktop-endpoint.png)
![Five-card explicit pair revisit after the automatic endpoint](../../../output/reading-motion/evidence/cue-qualification/task5-browser-t8tLmI/five-card-paced/pair-revisit.png)

![Verbatim fast five-card trace frame, visual context only](../../../output/reading-motion/evidence/cue-qualification/task2-diagnostic-trace-frames/fast-five-trace-frame-about76s.jpeg)
