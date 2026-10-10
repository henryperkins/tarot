# Reading Cue Model Qualification Decision Report

Dated: 2026-10-10

Plan reference: `docs/superpowers/plans/2026-10-09-reading-cue-model-qualification.md`

Portable evidence: [round closeout and restricted archive index](2026-10-10-reading-cue-round-closeout.md)

Branch: `codex/reading-cue-qualification-20261009` at `f24487d`

Execution round: `reading-cue-qualification-20261010-task6`

Semantic run identity: `cue:b864599f9127716a3c142ff500c8587a7cc8b852e99590159ef8d550c6547003`

---

## Executive Summary

Independent qualification evaluation of three visual cue candidate configurations was executed in the isolated `d970` worktree against frozen ground truth labels, authentic narrative recordings, negative trap passages, and live controlled browser reader timing.

**Final Decision: Retain the gated development baseline (`qualified: false`). Do not select a candidate or proceed to production integration, migration, or deployment.**

No candidate qualified: Flash configurations have measured failures; Full GLM High is budget-incomplete with unmeasured traps and zero-dispatch timing:

1. **`@cf/zai-org/glm-5.3-flash` (reasoning effort: `low`)** failed the Traps gate (9 negative trap failures), Integrity gate (26 hard failures), Semantic Quality gate (cue precision 0.8838 < 0.95; required recall 0.2298 < 0.80), Central Experience gate (missing required opportunities), Context gate, and controlled browser timing availability/accompaniment (Flash Low Star 0/6 in each mode).
2. **`@cf/zai-org/glm-5.3-flash` (reasoning effort: `high`)** failed the Traps gate (9 negative trap failures), Integrity gate (9 hard failures), Semantic Quality gate (cue precision 0.8485 < 0.95; target precision 0.8812 < 0.95; required recall 0.0783 < 0.80), Central Experience gate, and timing gates (Flash High Star burst 1/6). This configuration recorded 24 timeouts/failures out of 74 planned semantic evaluations; these observations do not isolate reasoning effort as the causal factor.
3. **`@cf/zai-org/glm-5.3` (full model, reasoning effort: `high`)** made seven semantic attempts and accepted/completed only 1 of 74 planned semantic evaluations before reservation ceiling rejection ($1.5040512 conservative reservation vs. $1.4024371 remaining headroom) halted further dispatches under the single $15 round budget. Required recall was 0.0000. It is budget-incomplete.
4. **Conditional Pro Codex streaming probes** were explicitly skipped because no candidate achieved semantic eligibility and the shared round budget had insufficient headroom. No streaming proof was fabricated.

**Aggregate controlled timing:** 0/18 planned accompaniment passes.

---

## Environment & Isolation Verification

- **Preservation of Live Beta:** The live beta worktree at `/home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge` remained strictly preserved. Protected ports `8787`, `5175`, `8789`, and `9235` and listener processes (workerd PID 217177, MainThread PID 217299, MainThread PID 216913) were completely untouched. No writes, builds, reloads, or API requests touched the live beta.
- **Isolated Worktree:** Execution was confined to `/home/ubuntu/.codex/worktrees/d970/tarot` (branch `codex/reading-cue-qualification-20261009`, HEAD `f24487d`).
- **Driver Execution & Owned Lifecycle:** The live driver ran as PID 370760 under execution directory `/tmp/reading-cue-qualification-20261009-qp96bltd/task6-execution/` with frozen orchestration (`driver.mjs` and `packets.mjs` mode 0400, pinned in `freeze.json`). The driver logged `live-complete` at 2026-10-10T01:19:55.900Z; no separate process-exit-code artifact is retained.
- **Owned Resource Cleanup Verified:** Owned frontend PID 375008 terminated, inert port 40749 released, temporary state directory `/tmp/cue-browser-owned-B08YU3` removed, and `cleanup.json` verified (`{ "pid": 375008, "closed": true }`). The final budget records 0 reserved attempts; historical PID numbers are provenance only and must not be signaled at closeout.
- **Preflight Authentication & Pricing:** Verified at 2026-10-10T00:06:33Z. Both models were present in the authenticated Workers AI catalog; official pricing documentation matched the frozen rates ($0.15/$0.50 per M tokens for Flash; $1.40/$4.40 per M tokens for full GLM).

---

## Retained Prior SDD Rulings

This milestone explicitly preserves four binding SDD rulings established during Tasks 1–5:
1. **Fixture Readiness Configuration:** Two intentional visual `ReadingJob` fixtures were corrected to supply explicit fake provider/model/AI configuration, retaining Task 1 production readiness guards and baseline test integrity (`99e7a4b..d475fba`).
2. **Byte Pins vs. Documentary Provenance:** Reviewer spec/plan document byte hashes are recorded as informational provenance, while raw corpus (`data/evaluations/narrative-samples.json` SHA-256 `b30c506a81f7cb360fb457fc2bd4825059d558b3a1f8862d5f0ab23f383fbe49`), catalog, registry, artwork assets, and manifest identity gates (`42071738c05223979622457bbc918215ba7e455d3d06bac170d969ae5ad799c3`) remain binding byte pins.
3. **Question Variants & Error Classification:** Question-only variants enforce per-trial thresholds (0.95 precision, 0.80 required recall). All incorrect targets require explicit independent error classification (`wrong-card` or `wrong-detail`) to enforce the zero wrong-card acceptance gate (`433b831..65e5faa`).
4. **Independent Blinded Review Substitution:** With the original pre-inference label reviewer unavailable in the collaboration registry, fresh independent blinded output review agents were deployed using the frozen rubric and label manifest. Candidate configuration, reasoning effort, latency, token usage, and prompts were strictly hidden. All cue verdicts and uncertainties are preserved.
- **Deferred Items Acknowledged:** Baseline full-suite warning noise from master and the ranking helper's default-order risk remain noted; actual execution explicitly passed `manifest.candidateOrder`.

---

## Independent Blinded Output Adjudication

Blinded adjudication was conducted in two lanes (semantic and timing) using anonymous review packets, `blind-reviewer-instructions.md`, and registered card details:
- **Reviewer Identity:** `independent-blinded-reviewer-20261010`
- **Role:** Independent agent textual output adjudicator
- **Attestations:** `authoredVisualPrompt: false`, `testedModel: false`, `blinded: true`

### Semantic Adjudication (3 anonymous packets, 122 accepted trials, 343 cues)
- **Supported cues in final blinded artifact:** 324
- **Incorrect cues in final blinded artifact:** 19
- **Uncertain cues:** 0 (all emitted cues adjudicated; qualification remains incomplete for undispatched trials)
- **Historical documentary discrepancy:** The prior report asserted 314 supported / 29 incorrect and an error breakdown totaling 29. The retained final `adjudication-blind.json` and scored provenance contain 324 / 19. The earlier wording's provenance is unresolved; its original bytes and final artifacts are preserved in the [closeout](2026-10-10-reading-cue-round-closeout.md). Candidate scoring separately applies structural/dependency validation and yields 300 supported cues; these counts must not be substituted for independent verdicts.

### Timing Adjudication (2 anonymous packets, 11 trials, 102 cues)
- **Supported cues:** 100
- **Incorrect cues:** 2 (both due to truncated `"the finished "` span in five-card creative project)
- **Uncertain cues:** 0

---

## Semantic Candidate Scoring & Gate Evaluation

Scores were calculated via `scoreReadingCueRun` using the 74-trial expected plan (62 cases in `repeat-1`, 12 primary cases in `repeat-2`), the complete 222-trial semantic plan denominator, and joined blinded adjudications:

| Candidate | Completed / Planned Trials | Accepted Cues | Supported Cues | Cue Precision (95% Wilson) | Target Precision (95% Wilson) | Required Recall (95% Wilson) | Hard Failures | Traps Gate | Semantic Passed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GLM 5.3 Flash (Low)** | 71 / 74 | 241 | 213 | 0.8838 [0.8372, 0.9184] | 0.9777 [0.9522, 0.9897] | 0.2298 [0.1911, 0.2737] | 26 | **FAIL** | **FAIL** |
| **GLM 5.3 Flash (High)** | 50 / 74 | 99 | 84 | 0.8485 [0.7650, 0.9060] | 0.8812 [0.8037, 0.9307] | 0.0783 [0.0557, 0.1090] | 9 | **FAIL** | **FAIL** |
| **GLM 5.3 (High)** | 1 / 74 | 3 | 3 | 1.0000 [0.4385, 1.0000] | 1.0000 [0.4385, 1.0000] | 0.0000 [0.0000, 0.0096] | 0 | **UNMEASURED** | **FAIL** (Incomplete) |

Full GLM High exercised no negative traps. The historical scorer returns a vacuous `passed: true`, which is unmeasured trap qualification, not a pass. Seven semantic attempts produced one accepted trial; 73 planned trials remain uncompleted.

### Gate-by-Gate Analysis
- **Integrity Gate (Zero hard failures):** FAILED for Flash Low (26 failures: 9 negative-trap, 17 invalid-dependency where interpretation/balance cues referenced unestablished or subsequent literal anchors) and Flash High (9 negative-trap failures).
- **Traps Gate (All 22 negative passages produce zero invented literal details):** FAILED for both Flash Low and Flash High. Both models repeatedly hallucinated literal detail associations from reader metaphors and hypothetical prose.
- **Semantic Quality Gate (Precision >= 0.95, Required Recall >= 0.80):** FAILED across all candidates. No candidate exceeded 0.23 required recall. Flash Low cue precision was 0.8838; Flash High was 0.8485.
- **Central Experience Gate (Star pours/balance, 5-card Ace/Queen relationship and returns):** FAILED. Required opportunities were omitted or misattributed.
- **Context Gate (Question-only variants complete without fabricated reflections):** FAILED. Question-only variants failed the per-trial recall threshold.
- **Spanish Support:** Declared `identity-only` across all candidates; detail qualification was not achieved on native Spanish spans.
- **Ranking:** `rankReadingCueCandidates` returned an empty list (`[]`) because zero candidates met `fullyQualified === true`.

---

## Controlled Browser Timing & Accompaniment Results

All 18 sequential reader windows (3 candidates × 2 cases × 3 delivery modes) completed; 12 dispatched live inference and six Full GLM sessions were budget-incomplete. Windows were run in Chromium on a 390×844 viewport with a fixed 180 wpm reader. Sessions were scored via `scoreCueBrowserReport({ report, opportunities, cues, matches, offline: false })` using same-session adjudicated matches:

| Scenario | Qualification Eligible | Cue Availability | Browser Receipt-Lag p95 (ms) | Meaningful Accompaniment | Qualified Exposures |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Flash Low: Star Paced** | true | 0/6 (FAIL) | null | **FAIL** | 0 |
| **Flash Low: Star Burst** | true | 0/6 (FAIL) | null | **FAIL** | 0 |
| **Flash Low: Star Final-Only** | true | 0/6 (FAIL) | null | **FAIL** | 0 |
| **Flash Low: Five-Card Paced** | true | 10/25 (FAIL) | 98,800.2 | **FAIL** | 0 |
| **Flash Low: Five-Card Burst** | true | 5/25 (FAIL) | 20,537.7 | **FAIL** | 1 |
| **Flash Low: Five-Card Final-Only** | true | 5/25 (FAIL) | 18,172.5 | **FAIL** | 1 |
| **Flash High: Star Paced** | true | 0/6 (FAIL) | null | **FAIL** | 0 |
| **Flash High: Star Burst** | true | 1/6 (FAIL) | 31,967.1 | **FAIL** | 0 |
| **Flash High: Star Final-Only** | true | 0/6 (FAIL) | null | **FAIL** | 0 |
| **Flash High: Five-Card Paced** | true | 5/25 (FAIL) | 67,728.8 | **FAIL** | 1 |
| **Flash High: Five-Card Burst** | true | 5/25 (FAIL) | 56,084.1 | **FAIL** | 0 |
| **Flash High: Five-Card Final-Only** | true | 0/25 (FAIL) | null | **FAIL** | 0 |
| **Full GLM: Star (all 3 modes)** | window valid; zero dispatch | 0/6 (budget-incomplete) | unmeasured | **INCOMPLETE** | 0 |
| **Full GLM: Five-Card (all 3 modes)** | window valid; zero dispatch | 0/25 (budget-incomplete) | unmeasured | **INCOMPLETE** | 0 |

### Key Browser Timing Findings

All 18 uncensored fixed-reader windows were measurement-valid; semantic eligibility is separate. Twelve Flash sessions have measured availability/accompaniment failures; six Full GLM zero-dispatch sessions are budget-incomplete. Their missed opportunities remain in the planned denominators. No planned session qualified either gate. Flash High Star burst received 1/6 required opportunities before their first visible interval ended.

Provider latency, scheduler wait, browser receipt lag and rendered exposure are distinct measurements. The p95 column is browser passage-receipt-to-cue-receipt lag, not model round-trip or display dwell. Null denotes no measurable matched receipt, not zero latency. See the [exact per-session sanitized scores and clock boundaries](2026-10-10-reading-cue-round-closeout.md#controlled-timing-reconciliation).

---

## Round Budget & Attempt Accounting

- **Ceiling Rules:** Single persistent round allowance of 600 calls / $15 maximum estimated cost across semantic, timing, and failure attempts. Unknown usage retained full conservative reservations.
- **Total Dispatched Attempts:** 183 (155 semantic + 28 timing dispatches)
- **Accepted Attempts:** 148
- **Failed Attempts:** 35 (including request timeouts against the 60,000 ms deadline)
- **Settled Unknown-Usage Attempts:** 35 (each holding conservative upper-bound reservations of $0.1614 for Flash or $1.5041 for full GLM)
- **Final Held Budget:** $13.7589453 / $15.0000000
- **Known Token-Derived Estimated Cost:** $0.0545485
- **Reserved Attempts Left:** 0
- **Measured Cost Complete:** `false` (unknown settlements retain reservations, preventing a cost-qualified verdict)
- **Orchestration Caveat Verified:** The reservation ceiling correctly rejected further dispatches for full GLM High ($1.5041 reservation > $1.4024 remaining headroom). As designed, zero-dispatch reader windows ran to completion and are reported accurately as budget-incomplete.

---

## Conditional Pro Codex Streaming Probes

Under the SDD qualification contract and Task 6 dispatch context, fresh Pro Codex streaming probes through the signed-in application were conditional upon:
1. A candidate configuration meeting all predeclared semantic qualification gates.
2. Sufficient remaining allowance in the single $15 round budget.

**Finding:** Neither condition was met. Neither Flash configuration passed semantic gates, and Full GLM remained budget-incomplete, and remaining round budget headroom was only $1.24 (insufficient for full 3-card and 5-card reservations).
**Action: SKIPPED: semantic ineligibility / insufficient allowance.** Fresh streaming and their independent review were not performed; no fresh authenticated/tier/streaming evidence exists.

---

## Proposed Bounded Follow-Up Experiment

To achieve viable reading cue performance, future work should address the identified failure modes through a bounded three-part experiment:
1. **Prefix Caching & Schema Slimming:** The round observed failed browser availability and accompaniment; provider round-trip, scheduler wait and browser lag must be analyzed separately. A future explicitly authorized round could compare a smaller schema and provider-supported caching. Caching support and latency benefit remain unverified; no sub-3-second result is established.
2. **Negative Constraint Few-Shots:** Negative-trap scoring recorded nine hard failures in each Flash configuration. An explicitly authorized later prompt comparison could test abstention instructions on named development cases, with unchanged qualification thresholds and frozen independent labels.
3. **Asynchronous/Post-Reading Pathway:** Because real-time accompaniment during streaming is highly sensitive to model speed, evaluating an asynchronous annotation architecture—where cues populate for saved/revisited readings rather than racing live prose—would deliver immediate value without requiring sub-second LLM inference.

---

## Downstream Milestones & Production Status

1. **Expiry & Failed-Attachment Re-Annotation:** Preparation is retained in the [re-annotation audit](2026-10-10-reading-visual-reannotation-audit.md). The design requires owned canonical prose verification, idempotent retry endpoints, and no automatic restore inference. Implementation remains pending.
2. **Physical iPhone 14 Pro Max & VoiceOver Validation:** Preparation is retained in the [physical checklist](2026-10-10-reading-iphone-voiceover-checklist.md). Real Safari, VoiceOver gesture navigation (rotor, double-tap, continuous reading), and physical touch targets remain untested on physical hardware. Emulation does not qualify physical devices.
3. **Full-Deck Artwork & Motion:** Authoring vector detail treatments across all 78 tarot cards remains a separate, open workstream.
4. **Production Gaps:** Migration 0036, Durable Object production deployment, and branch promotion remain unauthorized. Production configuration gates remain closed (`VISUAL_CUE_PROVIDER` unset).


## Closeout publication status

This corrected report and the [portable closeout](2026-10-10-reading-cue-round-closeout.md) are written locally, uncommitted and unpushed. Original scored artifacts remain immutable. Exact per-kind/partition/language/edition/repeat numerators, denominators and Wilson intervals are in the [sanitized semantic metric projection](2026-10-10-reading-cue-round-closeout/semantic-metrics.json). `qualified: false` remains unchanged.
