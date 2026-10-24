# Reading context remediation execution ledger

## October 24 GraphRAG continuation — Tasks 7–8

This section records the continuation from `a3c115c0c3abf414c78e085528664aa3c88d99c6` on `claude/graphrag-complete-remediation-20261024`. ChatGPT prepared commits `88e01b18`, `96e9e004` and `19f9004d` from the pasted handoff in a separate checkout that did not have the original worktree, cache logs or plan. Those commits were then applied to the original worktree with identical hashes and reconciled there against the plan and the preserved Task 1–6 evidence; see [original-host reconciliation](#original-host-reconciliation).

### Task 7 checkpoint

Commit **`88e01b18ce4f7aec02b6cbede722112f4ee3bafa`** applies final GraphRAG integrity before final token accounting, source usage, memory parsing and provider handoff. Shared sanitization carries bounded removal counts, fixed reasons and measured guardrail completeness. The shared enum is re-exported from the existing server helper; reader handling adds the requested integrity omission copy without exposing arbitrary diagnostic text. Conditional guardrails use the final capped passage set, so an unseen weak candidate cannot invalidate an otherwise complete retained block.

The required five-file suite first ran red with **95 passed / 28 failed** across 123 tests, before production changes. The completed checkpoint passed **123/123**, zero skipped, including the real API provider-attempt control: a rejected Modal request has reference and memory blocks, an accepted capped OpenAI request has neither, and only the accepted attempt supplies public provenance and access receipts.

### Task 8 implementation and qualification

Prompt version **1.6.0** and [remediation v1 fixtures](../../tests/fixtures/graph-rag-remediation-v1-cases.json) integrate all eight registry-backed families and every final retention mode with the existing qualification corpus. The fixture's 23 cases (16 from `96e9e004` plus seven paired finding cases from the reconciliation) are built for all three providers and also sent through real request serializers with mocked transport. Negative expectation controls reject wrong modes, removal counts, claimed family evidence, reversed equal-evidence order, weak short-word matches and unmatched enrichment wins. Synthetic registry mutation is restored on success and failure.

The current verification results are in [qualification status](QUALIFICATION_STATUS.md#current-offline-verification). On the original host, the standalone credential-free evaluator passes 874 existing cases / 2,541 builds plus the separate remediation 23 / 69 lane, with 525 deck projections, 21 passage caps and 13 grounding probes. The Worker suites pass 64/64. Lint passes with zero warnings and the production build passes. The full root run passes **5,876 tests**, zero failed/cancelled, with two intentional installed-CLI opt-in skips (5,878 total). Documentation and whitespace checks pass.

Observed integration failures and decisions in the ChatGPT checkout:

- The offline preview's explicit source allowlist omitted the shared integrity enum and the earlier lexical, scoring and summary modules, including the lexical vocabulary dependency. Five actual preview-startup regressions exposed the missing imports. Add these five concrete dependencies to `scripts/lib/readingCueValidationSource.json`; retain the explicit allowlist and blocked-provider environment.
- A pre-existing telemetry assertion omitted the three additive Task 5 pattern fields. Update its expected shape to include zero counts for Major Arcana, Thoth suit and Marseille numerology when absent; preserve all existing assertions.
- The initial root run could not launch two Chromium tests and skipped a third browser control because the locked browser executable was missing. The normal Playwright CDN returned a 195-byte unavailable HTML page. Provision the exact locked Playwright 1.62.1 / Chromium 151.0.7922.34 artifacts from official Google version metadata, validating upstream MD5, ZIP CRC, safe paths and executable versions. The final root rerun executes all three browser cases; only the two installed-CLI opt-in skips remain. No tests or package versions were changed for this dependency.
- The frozen summary-only fixture's old 5,960 test budget no longer retained its complete guardrails. Use 6,200, inside the measured 6,003–6,533 summary interval, preserving frozen fixture bytes and production budgets.
- Final guardrail verification at the synthetic quality-bypass boundary now uses that attempt's selected passages instead of the earlier retrieval payload. It validates the actual request under test.

### Independent review follow-up

In the ChatGPT checkout, the fresh read-only reviewer inspected all 19 changed files and coupled callers and independently passed six targeted checks. It found no Critical or Minor issues and one Important issue: unanchored header parsing disagreed with line-based artifact discovery, so an inline heading in a theme or preselected memory could erase the whole prompt while spread-card usage remained true. The fix (`19f9004d`) anchors both header parsers and disallows removal without a recognized artifact. Thirteen new regression tests first failed, then passed; existing actual malformed-block controls remain green. This is a verified builder-level data-loss regression, not a demonstrated remote HTTP exploit. No second review or live approval is implied.

### Original-host reconciliation

The three ChatGPT commits were applied with `git am` to the original worktree and reproduced their hashes exactly. On this host the Task 7 red run (95 passed / 28 failed of 123 against the Task 6 code), the as-applied root suite (5,852 passed, two skips) and the assembly evaluator all matched ChatGPT's report. The reconciliation then completed the Task 7–8 items that need the original evidence or were still open:

- Compared the candidate with the frozen `7cd329a5` preservation baseline and classified every changed selection; no regression was found.
- Added the seven paired F1, F2 and F3a remediation cases and their negative controls.
- Extended the provider-attempt control from JSON to buffered SSE, the durable job path and a rejected OpenAI token stream, and confirmed with a mutation run that the controls detect leaked attempt metadata.
- Recorded actual embedding inputs and batches for the expanded Major corpus.
- Removed the unused `countGraphRAGPassagesInPrompt` import and trimmed extra blank lines at the end of four earlier test files.
- Verified that the primary checkout and both plan files are unchanged.

Results, evidence paths and the two selection changes flagged for the Task 9 output review are in [qualification status](QUALIFICATION_STATUS.md#original-host-reconciliation). The reconciliation changed no runtime selection or prompt code, so the selection comparison taken at `19f9004d` also describes the reconciled source.

### F1–F5 subfinding ledger

| Subfinding | Correction or disposition | Commits | Changed source | Regression evidence | Status |
| --- | --- | --- | --- | --- | --- |
| F1 — per-card Majors unavailable with several Majors | `graphKeys.majorNumbers`; every distinct drawn Major is eligible at priority 7, single-Major priorities 2/3 kept; preview retrieval also accepts an explicit `questionContext`. | `96d0b369` | `graphContext.js`, `graphRAGCandidates.js`, `spreadAnalysis.js` | Candidate-selection and enrichment-projection tests; five targeted F1 fixtures; 74-fixture baseline comparison; actual-source frozen-vector replay and valid request-preparation probe | **Relevance blocker open:** `REL04` adds irrelevant Lovers at 0.327584. Paired readings retain useful card relationships, including S01, but do not waive this retrieval regression. |
| F2 — enrichment displaces canon | Documented contract: approved enrichment supplements the registry; one variant per pattern competes on relevance and context. Generator template and compiled header corrected; no runtime change. | `e5c4dc2f` (with prerequisite `7cd329a5`) | `applyPassageCandidates.js`, `knowledgeBaseEnrichment.js` header, knowledge-graph README | `enrichmentApply` and enrichment-projection tests; `remediation-f2-approved-enrichment-wins-matching-context`, `remediation-f2-canon-wins-unmatched-context` | Offline-qualified; no real enrichment activated |
| F3a — short words and inflections score zero | Shared `normalizeRetrievalTerms()`: NFKC, three-letter content words, recognized plurals, `grieving → grief` and `working → work`. | `c2007be9` | `graphRAGLexical.js`, `graphRAGCandidates.js`, `graphRAG.js` | `graphRAGLexical` tests; `remediation-f3a-short-words-match`, `remediation-f3a-unrelated-short-words-stay-weak`; two lexical-tie fixtures in the baseline comparison | Offline-qualified |
| F3b — semantic matches penalized by zero overlap | Proposed `s + 0.3·k·(1 − s)` rejected; owner-approved continuation restores `0.3·k + 0.7·s` with policy `legacy-weighted-v1`. Explicit custom weights and lexical fallback are preserved. | Original proposal `1ca9a45a`; rollback `a510194c` follows `734fe475` | `graphRAGScoring.js`, `graphRAG.js`, `verifyGraphRAGRelevance.js` | Scoring/threshold boundaries, cosine-0.4 weak-floor regression, custom-weight and recovery/cache behavior, unchanged fail-closed semantic-improvement gate | **Unresolved; rejected formula withdrawn.** Original gate remains failed; no claim of improved multilingual retrieval. All bounded output qualification is executed, with separate failures retained. |
| F3c — context only a tie-breaker | Intentional safeguard retained; unmatched context variants are gated; exact-context unknown synonyms stay on the weak floor. | `7cd329a5`, `c2007be9` | `graphRAGCandidates.js`, `readingContextVocabulary.js` | `graphRAGContextVariants` and `graphRAGLexical` tests; `remediation-f2-canon-wins-unmatched-context` | Offline-qualified |
| F3d — duplicated lexical calculation | One keyword score per candidate, reused for `relevance` and `relevanceScore`; query terms computed once per retrieval. | `c2007be9` | `graphRAG.js`, `graphRAGLexical.js` | Single-pass reuse and bypass test | Offline-qualified |
| F4 — summaries omit four families | Shared `summarizeProjectedPatterns()` covers all eight registry-backed families; validated `majorArcana`, `thothSuitPatterns` and `marseilleNumerologyPatterns` counts. | `f18f2f4c` (telemetry test shape in `96e9e004`) | `graphRAGPatternSummary.js`, `graphRAGReferenceBlock.js`, `graphRAG.js`, `telemetrySchema.js` | Summary-provenance, pattern-coverage and telemetry tests; the seven `remediation-summary-*` cases | Offline-qualified |
| F5a — incomplete GraphRAG through truncation | Trusted envelopes, reserved instruction marker, delimiter neutralization, atomic packing, graph-free prefix fallbacks and final budget checks. | `a3c115c0`, `19f9004d` | `graphRAGPromptIntegrity.js`, `graphRAGReferenceBlock.js`, `userPrompt.js`, `truncation.js`, `buildEnhancedClaudePrompt.js` | GraphRAG-only helper reproduction, cut and budget sweeps, forged-footer and inline-heading tests; `remediation-budget-summary`, `remediation-budget-omitted` | Offline-qualified |
| F5b — telemetry can disagree with malformed content | Final integrity enforcement before token totals, parsing, source usage, memory retention and handoff; bounded diagnostics, `reference_integrity_failed` reader copy and alert. | `88e01b18`, reconciliation | `buildEnhancedClaudePrompt.js`, `shared/graphRAGIntegrity.js`, `shared/readingSourceUsage.js`, `telemetrySchema.js`, `graphRAGAlerts.js`, `sourceUsageSummary.js` | Retention, source-usage, alert and pipeline tests; `remediation-integrity-removed`; JSON, SSE, job and token-stream attempt controls | Offline-qualified |

**Task 9 stopped at the relevance gate on October 24.** With owner authorization (deployment excluded), it made 73 Workers AI embedding requests and no subscription generations, deployments or merges; see [qualification status](QUALIFICATION_STATUS.md#october-24-graphrag-task-9-live-qualification). Historical release authorizations and narrative approvals below do not transfer to this changed source.

**Task 9 continuation ruling:** The owner approved the legacy-default rollback and remaining qualification. Preserve the failed gate and mark F3b unresolved; do not weaken its multilingual requirement. Reuse matching frozen vectors and compare the revised pipeline against `7cd329a5` as well as the same-candidate formula comparison. Preserve the 35 planned subscription outputs and 50-attempt cap, unchanged editorial judgments only when text/source/deck identities match, and separate publication from deployment. All other fixes remain subject to output preservation review.

**Continuation execution complete; acceptance not passed.** Runtime source `a510194c` is frozen and verified across 3,467 tracked blobs. The 24 paired plus 11 standard readings used exactly 35 observed subscription attempts, with no failed generation, retry/replacement, additional live embedding request or paid API call. Candidate paired metrics pass; actual-output review finds unsupported certainty in S02 and an unsupported recovery timescale in S09, alongside shared grounding limitations. The baseline paired gate and standard CI gate fail on documented evaluator false positives; neither exit status is relabeled as passing. The [continuation record](GRAPHRAG_TASK9_LEGACY_DEFAULT_2026-10-24.md) preserves all twelve comparisons, exact source identities, tests, editorial refresh and limitations.

**Ruling: retain F1's observed regression as a release blocker.** The same-candidate formula comparison cannot detect new irrelevant candidates introduced by F1. The real-source comparison and a valid three-card preparation probe both select irrelevant Lovers above threshold for REL04. Complete the already approved bounded reading evidence, but do not redesign eligibility or tune the formula against these seen cases during the rollback.

**Ruling: preserve output and evaluator failures without spending spare attempts.** Successful outputs are not replaced for quality. The standard false guarantee flag and baseline Fool's Journey flag remain reproducible from frozen outputs; correcting the evaluator is separate work. Manual grounding findings remain material even though candidate automated metrics are green. The four summary budgets were measured and frozen before generation; all four candidate family labels survived. The 1.6.0 editorial refresh revalidates unchanged prior agent judgments only; it is not new human approval.

**Publication boundary:** The owner authorized pushing `734fe475`, the rollback and this qualification record to the existing branch. No merge, deployment, production verification or release record is included. The existing primary checkout and its unrelated work are preserved. The new evidence archive is separate from the original failed-policy archive.

## Historical October 24 correctness remediation

October 24 plan: [correctness remediation](../superpowers/plans/2026-10-24-reading-pipeline-correctness-remediation.md).

Current status: the E1–E5 canon corrections and grouped review remain complete: **191 accepted groups / 1,167 mechanically valid variants / zero owner decisions**. The subsequently authorized [47-output subscription review](READING_PIPELINE_NARRATIVE_REVIEW_2026-10-24.md) is also complete. Eleven standard outputs pass; four initial candidate comparison outputs had blocking findings across three families. Rank-based artwork assertions, non-present age conversion and fitted card loss are corrected in prompt **1.5.2**, evaluator **2.6.0**, and confirmed by eight focused subscription generations with zero blocking findings. The current full root suite passes **5,736**, zero failures and two intentional skips; Worker suites pass **64**, assembly passes **874 cases / 2,541 builds**, and lint/build pass. Exact source, checks and preserved failures are recorded in `subscription-qualification/qualification-manifest.json` and the [execution record](READING_PIPELINE_CORRECTNESS_2026-10-24.md).

The original 47-generation ceiling is used. Exactly eight corrected prompts differ, with 39 unchanged. The eight separately authorized focused confirmations ran once each and were all accepted; the standard and candidate comparison gates pass on the source-matched datasets. Evidence is in `subscription-qualification/focused-confirmations/qualification-manifest.json`. The narrative qualification made zero embedding calls. The candidate was merged to `master` (`f5f69f39`) and released on October 24 as Worker version `8d00f495`; the [release record](READING_PIPELINE_CORRECTNESS_2026-10-24.md) separates the verified live identity, admission and readings from the provider and device work that remains pending, including the pre-existing Claude API failure. This work made no writes to the primary checkout.

The following ledger is the historical October 23 execution record.

Plan: [October 23 implementation specification](../superpowers/plans/2026-10-23-reading-context-complete-remediation.md).

## Execution scope and identities

The user authorized phase-by-phase implementation in an isolated worktree on October 23, 2026. Live qualification, publication, merging and deployment remain separate. Local implementation and deterministic checks are authorized. Human editorial approval cannot be supplied by an agent.

- Integration branch: `codex/reading-context-remediation-20261023`.
- Integration worktree: `/home/ubuntu/tarot/.worktrees/reading-context-remediation-20261023`.
- Current base: `680516f0c13054f1a86b3f60d824e46427dec803`.
- Reused candidate: `8546284b884dcb56466f247a38f5d5b974e2f078`.
- Candidate merge base: `7164fc21c6c9e5988c0c4ac368f843cc5cd0c1df`.
- Recovery evidence: `/home/ubuntu/.cache/tarot-reading-context-remediation-20261023/` (private, outside the checkout).
- Initial preservation inventory: 92 modified/untracked primary files; candidate clean. SHA-256 hashes, index hashes, refs, worktrees, stashes, binary patches and verified source archives are recorded in the recovery directory.
- Existing dependencies are reused through a `node_modules` symlink. No credentials or provider configuration are copied into the worktree.

## Phase status

| Phase | Tasks | State | Evidence / next action |
| --- | --- | --- | --- |
| 0 | 0 | Complete | 73 code/test files ported; 575 integrated tests and deterministic gate pass; independent integration review clean. |
| 1 | 1–2 | Complete | Validated transport and one authoritative context selection reviewed, including all accepted sources and bounded query projection. |
| 2 | 3–4 | Complete (editorial approval pending) | Matched-only partial references, verified provenance and deck projection reviewed; 525 editorial rows remain pending. |
| 3 | 5–6 | Complete | Full-set bounded ranking and compatible frozen memory selection independently reviewed. |
| 4 | 7–8 | Complete | Final provider retention and durable completion receipt independently reviewed. |
| 5 deterministic | 9 | Complete | Final source e51022f3 passes the full root/Worker/prompt/lint/build/docs/identity gate; failed first attempt preserved. |
| 5 editorial/live | 10 | Offline preparation complete; live unrun | V4 captures all 24 baseline + 24 candidate requests; 48 live output rows unrun; 525 + 30 human reviews pending. |
| 6 | 11 | Offline documentation complete; release separate | Prompt 1.4.0 and maintained contracts reviewed. Publication/deployment/live verification remain unrun. |

## Requirement-to-test ownership

This table maps the combined reviews to the implemented contracts and regression ownership. The records below retain earlier failures and review corrections; final whole-source qualification is a separate gate.

| Requirement | Owner tasks | Regression coverage | Implemented contract / remaining boundary |
| --- | --- | --- | --- |
| F1 partial arcs | 3, 4, 7, 9 | `knowledgeGraphPartialTriads`, `graphRAGDeckProjection`, qualification corpus | All 30 numeric pairs and ten complete controls; matched-only final references and conditional direct themes. Human semantic approval pending. |
| F2 deck fidelity | 1, 4, 7, 10 | `graphRAGDeckProjection`, `knowledgeGraphContextPipeline` | Verified pattern/deck projection, selected aliases, enrichment provenance and provider builds; 525 human review rows pending. |
| F3 complete classification | 2, 9 | `readingContextSources`, `readingRetrievalQuery` | Every accepted source classified before a separate query budget, including 78 notes and decisive late clauses. |
| F4 decision labels | 1, 2, 6, 7 | `decisionPathContext`, `readingContextTransport` | Validated A/B labels, explicit clears, request identity, MCP/jobs/journal propagation and one authoritative selection. |
| F5 memory relevance/access | 6, 7, 8 | `readingMemorySelection`, `readingMemoryAccess`, `userMemoryAccess`, job suites | Bounded compatible frozen selection, final complete-block retention and durable accepted-attempt receipts. W5 persistence-redaction follow-up is resolved below. |
| F6 full candidate recall | 4, 5 | `graphRAGCandidateSelection`, `graphRAGProvenance` | All eligible projected variants compete before allowance; coherent whole-set fallback and shared embedding deadline. |
| F7 attribution | 4 | `graphRAGDeckProjection`, `passageCandidates` | Internal canon wording and verified distinct enrichment/source-tradition provenance. |
| F8 context/count metadata | 2, 3, 7 | `graphContext`, `promptContextRetention` | Authoritative selection provenance; total Major slots independent of journey ties. |
| V1 mixed spans | 2 | `readingRetrievalQuery`, `readingMemorySelection` | Compatible sentence/clause projection with preserved negatives, complete-source coverage and bounded excerpts. Limited grammar remains explicit. |
| V2 opaque legacy counts | 7 | `graphRAGRetention`, `sourceUsageSummary` | Unknown counts stay unknown; unverified legacy prose cannot enter generation. |
| V3 normalized ranking | 5 | `graphRAGCandidateSelection`, `graphRAG` | Distinct Unicode terms, no generated lexical scaffolding, explicit modes and relevance-first deterministic ties. |
| V4 conditional pattern prose | 3, 4, 7 | `knowledgeGraphPartialTriads`, `knowledgeGraphContextPipeline` | Positions/reversals remain authoritative; local missing-card guards and actual lower-level fallback use. |
| V5 MCP parity | 1, 7 | `mcpServer`, `mcpReadingTools`, `readingContextTransport` | Real strict handlers accept bounded fields and forward them through jobs with principal isolation. |
| V6 interpretation provenance | 1, 7 | `readingCardResolution`, `readingSchema`, `readingInputUsage` | Server catalog meaning plus separately bounded untrusted caller interpretation; actual retention only. |
| V7 local/UI truthfulness | 7 | `sourceUsageSummary`, `narrativeBackends`, `readingInputUsage` | Reasoning-local omission, preview separation and accepted-attempt indices. Legacy fixture follow-up is resolved below. |
| V8 memory reuse/control | 1, 6, 7 | `userMemory`, `userPersonalization`, `readingContextTransport` | Request boolean and signed-in UI, no candidate read on opt-out, conservative supported-fact admission. |

## Phase 0 integration decisions

- Port the complete five-commit candidate **code and regression** delta as 73 files; do not replace the working tree with the candidate. The only overlapping committed file is `functions/lib/knowledgeBase.js`; patch application preserves the newer enrichment import, merge and generated module.
- Preserve both primary plan files byte-for-byte. Keep the candidate's different historical plan and its other documentation in the verified candidate source archive. Retain its qualification status and projection checklist unchanged initially; these explicitly record unfinished live/editorial lanes.
- Retain all four candidate review-fix waves, especially subject/age/measurement, decision clear/language screening, graph flags and 98-ID D1 binding regressions.
- Ruling: Treat already passing candidate cases as verified reuse, not manufactured red tests. New behavior requires a failing boundary regression before its fix, as the plan explicitly permits.
- Ruling: Do not import the candidate's broad replacement of maintained context/graph documentation. Update those current documents against the final implementation in Task 11; historical versions remain archived.
- Ruling: Local checkpoint commits are reversible implementation records on the new branch. No shared branch, remote, primary index or existing candidate is changed. No publication is implied.
- Ruling: Task 10 and deployment portions of Task 11 remain pending under the user's explicit separation of live qualification and deployment. Offline preparation does not count as live success.

## Preflight: task consistency and shared interfaces

| Task | Internal consistency / ruling |
| --- | --- |
| 0 | Reuse is compatible with new regressions; preserve current enrichment and historical failed evidence. |
| 1 | Canonical meaning must coexist with MCP's documented caller interpretation; neither authorizes memory facts. |
| 2 | Full classification and bounded query are separate; query need not retain every classified source. |
| 3 | Membership is orientation-independent; presentation is conditional and uses real positions/orientations. |
| 4 | Agent-authored projections can pass deterministic checks while human semantic approval remains pending. |
| 5 | Relevance wins before structural ties; no universal complete-over-partial ranking requirement. |
| 6 | Conservative unsupported-fact omission is deliberate; no universal language/health classifier is promised. |
| 7 | Final prompt inclusion is not model reliance; normal local composition has no reference/highlight use. |
| 8 | Successful server finalization, not client observation, defines access. Durable jobs differ from best-effort direct responses. |
| 9 | Run offline checks and fixed output probes; never invoke live narrative gates as a side effect. |
| 10 | Prepare manifests only; actual editorial/live lanes remain separate. |
| 11 | Prepare maintained docs/version/rollback instructions; no merge/push/deploy during implementation. |

| Producer / consumer tasks | Shared interface | Ordering / finding |
| --- | --- | --- |
| 0 → 1–9 | Integrated candidate modules/tests | Review baseline before downstream edits. |
| 1 → 2, 6, 7 | Wire labels, canonical/caller meanings, reuse flag | Preserve raw crisis input separately from effective labels. |
| 1 ↔ 7 | MCP/jobs/provider inputs and user-context rendering | One transport contract; coordinate shared route/builder files serially. |
| 2 → 5, 6, 7 | Authoritative selection and content-only query | Consumers must not reconstruct a smaller input set. |
| 2 ↔ 7 | Route/analysis/backend/builder arguments and telemetry | Thread selection once; no client-authoritative selection. |
| 3 → 4, 7 | Matched/missing IDs, counts, safe highlights | Projection consumes canonical identities, not name guesses. |
| 4 → 5, 7 | Verified pattern then deck projections | Only projected content is scored/formatted; weak floors cannot restore rejected text. |
| 4 ↔ 9, 10 | Corpus/projection and enrichment identities | Deterministic coverage does not approve authored semantics. |
| 5 ↔ 7, 9 | Selection statistics and passage IDs | Counts distinguish discovered/projected/scored/selected/retained. |
| 6 → 7, 8 | Frozen selected memories/private IDs | Budgets may remove, never re-add rejected memories. |
| 7 → 8 | Accepted attempt retention | Stage only final accepted usage; public metadata excludes DB IDs. |
| 8 ↔ 9 | Durable terminal receipt/restart tests | Replay persistence only, never generation; independent concurrency review. |
| 9 → 10 → 11 | Frozen source identity and qualification manifest | No historical source evidence substitutes for changed source. |

## Verification record

Recorded commands and complete logs are retained in the external evidence directory. This section is updated only after observing the actual results.

- Current-base focused tests: 228 passed, zero failures/skips (nine files, outbound network blocked).
- Ported-candidate deterministic baseline: 575 passed, zero failures/skips (17 files, outbound network blocked).
- Reused deterministic prompt gate: 73 fixtures, 219 provider builds, 30 partial pairs, ten full triads, 435 deck projections and 12 boundaries passed. These are baseline regression checks, not closure of the missing v2 requirements.
- Integration review: spec and quality pass; 72 of 73 ported paths exactly match the candidate, and the only difference in `knowledgeBase.js` preserves the newer enrichment merge. Review artifact: `phase0-review.md` in the evidence directory.
- Preservation: all 92 captured primary files, both original plans, primary/candidate HEAD/status/index and historical fixture bytes unchanged.
- Phase 0 diff check passed.

## Historical Phase 0 candidate gaps

At Phase 0, partial references still contained full arcs; Major counts depended on journey detection; prompt selection was recomputed; mixed sources and negated memories remained unsafe; opaque legacy retention fallback remained; memory receipts were not durable; enriched projections were not yet adapted. These baseline gaps drove the implemented tasks below. They are historical observations, not the current implementation status.

## Task 3 — Graph facts and direct highlights

Implemented independently alongside Task 1 under the plan's explicit dependency allowance, with disjoint file ownership. Numeric pair keys and all 30 explicit authored expectations were verified reuse. New red regressions established independent Major counts (including ties/no patterns), unique membership versus duplicate slots, conditional highlight text, and exact matched slot indices. Every direct-highlight family now carries its detector's slot indices, and themes remain subordinate to actual positions/orientations without imposing chronology. Partial highlights explicitly reject missing arc members as drawn evidence.

- Final focused result: **221 passed, zero failed/skipped**, including Worker graph and real shared builder regression suites.
- Independent review R1 identified absent indices in non-triad families; fixed with interleaved/duplicate/equal-rank/court/deck-specific tests. Fix round 1/5: one addressed, zero open. Final spec and quality review approved.
- Review/report and red/green logs are in this plan's workspace and external evidence directory. Full prompt boundary qualification remains Task 7/9.

## Task 1 — Input authority and transport

Task 1 core scope is implemented and independently approved. Resolved meanings are catalog-owned; differing caller interpretations remain labelled untrusted narrative context and cannot become classification or memory-support evidence. Strict MCP/public jobs transport effective decision labels, per-card notes and optional memory reuse. The native signed-in checkbox persists opt-out through initial draw/retry and restores true for a new reading. Minimal existing MCP save plumbing preserves the accepted notes/labels using existing storage columns.

- Final focused gate: **251 passed, zero failed**. Mocked Chromium keyboard/submission/retry/new-reading E2E: **one passed**. Owned-source lint and diff checks passed. Real-account/device coverage is not claimed.
- A full-suite attempt with the strict network blocker was stopped after it also blocked localhost gateway lifecycle tests. This is incomplete harness evidence, not full qualification or a source regression. Preserve its log; Task 9 uses an externally blocked, loopback-allowed harness.
- Independent review: core specification/quality accepted; one concrete integration defect is assigned below to required Task 7, not waived.

### Required follow-on finding T1-R1 (P2, owner Task 7)

A prompt with only Sun caller interpretation `defeat and betrayal` reports `interpretation-0.includedLength: 19` but aggregate `sourceUsage.userContext.requested/used` false and `skippedReason: not_provided`. Update aggregate accounting from final interpretation fields, and cover both provider inclusion and local-composer deliberate omission. This must be fixed before integrated qualification.

## Task 4 — Pattern/deck projection and provenance

Pattern projection now precedes deck adaptation/scoring. Thirty independent general pair references replace complete-arc variants for partial patterns; unsafe/unknown subsets are omitted. Exact registry content authorizes generation fields, with authored history kept separate. Canonical and enriched variants have distinct source identities but share their graph-pattern selection slot. Enrichment preserves the current merge/general-context exclusion and reviewed rows, while full-text approval and cross-deck projection approval remain distinct.

- Final focused gate: **102 passed, zero failed**; scoped lint/diff checks pass.
- Review round 1/5: two P2 findings addressed, zero open. Legacy summaries now derive only validated graph facts, and selected-deck suit/short-name aliases are covered by independent literal tests. No unverified summary prose/counts or nominal confidence survives. Independent re-review approved.
- Actual editorial matrix: **435 full + 90 pair = 525 pending rows**; zero active enriched additions. This matrix and agent review do not supply human approval.
- Original frozen fixture unchanged. Old formatter/retention fixtures that inject arbitrary unregistered prose must migrate to verified registry content in Tasks 5/7/9 while retaining their behavioral assertions. Alias expectations in the qualification harness must use explicit selected-deck names.
- A prematurely started root test run was stopped and preserved as interrupted, not qualification. Broad verification remains Task 9 on final integrated source.

### Parallel work boundary

Task 6 pure selector work is prepared against Task 2's agreed full-span interface, with disjoint ownership. Its route/builder integration and completion are gated on reviewed Task 2. No pending partial task is represented as a completed phase.

Task 6 selector review round 1/5: three P2 findings addressed, zero open (same-subject age retractions, uncertain current age authorization, and punctuated/multiclause style conflicts). Complete selector suite: **195 passed**; independent scoped re-review: seven regression tests and 21 additional assertions passed. Pure selector accepted for integration only; route loading, frozen propagation and final Task 6 review remain pending.

Interim preservation check: all 92 captured primary files and its HEAD/index still match; the original candidate HEAD/index remains unchanged. Evidence: `preservation-interim.json` in the private recovery directory.

## Task 2 — Authoritative context and bounded query

Every accepted current source participates in classification before query allocation. A private versioned selection is resolved once and shared by analysis, retrieval, provider builds, fallback and text-free telemetry. The semantic query and content-only keyword projection remain separate; full compatible spans are available to memory selection before query budgeting. All 78 card notes and 12 saved interests retain independent coverage.

- Initial expanded validation: **192 passed**. Final review-fix covering suite: **143 passed**; changed-file lint and diff checks passed.
- Review round 1/5: three P2 findings addressed, zero open. Saturated queries preserve complete negative clauses or omit them explicitly; ordinary excerpts respect word/grapheme boundaries; typographic apostrophes preserve topic exclusions; internal/grouped decision sources retain effective legacy labels and cached selection identity.
- Independent re-review: **13 targeted tests passed**; spec and quality approved. Narrow grammar/keyword classification limitations remain explicit; this is not a general multilingual semantic classifier.
- Shared file ownership is released to Tasks 5 and 6. Task 5 owns retrieval/embeddings/orchestration; Task 6 owns memory admission, route loading and frozen selection propagation. Neither task is complete until its integration review passes.

## Task 6 — Compatible frozen memory selection

Preferences load separately before safety/context handling. The generation path loads up to 100 owner-bound global candidates without access writes only after crisis, entitlement, vision and quota exits; explicit opt-out performs no memory read or selection. At most three compatible notes are selected once from full accepted compatible spans and frozen for all provider attempts. Direct builders use the same selector without database access, and supplied private selections retain their original candidate counts.

- Final enforced-network-blocked covering gate: **303 passed**, zero failures; scoped lint and diff checks pass. Earlier failed and stubs-only runs remain preserved.
- The whole-note guard rejects unsupported/ambiguous facts, conflicting subjects or current preferences, recognized restricted health details, and bounded same-subject negations/retractions. It preserves numeric/measurement and unrelated-person controls. This deliberately limited grammar is not universal language or health classification.
- Pure-selector review round 1/5 addressed three P2 findings; the parent subsequently found and verified a bounded employment-contraction gap, fixed with direct-guard and selector regressions before final review. Full independent integration review: **spec and quality pass**, with **11 targeted tests passed**.
- Existing save/delete behavior and completion/access implementation are unchanged by this task. Final retention and durable accepted-result receipts remain Tasks 7 and 8.

## Task 5 — Full eligible ranking and bounded embeddings

All eligible registry-backed variants are projected before comparable content scoring and final allowance. Distinct normalized Unicode terms replace repeated raw counts. Global selection can choose a nonduplicate alternate variant; modes resolve disabled, bypass, semantic, keyword and priority explicitly. Semantic failure falls back over the complete eligible set. The shared deadline is at most 3,000 ms, batches at most 100 texts, concurrency at most two, and ignored cancellation cannot leave a pending caller or admit late cache writes.

- Final enforced-network-blocked gate: **296 passed**, zero failures/cancellations; scoped lint and diff checks pass. Independent spec/quality review passed with **11 targeted tests**.
- The explicit compiled-registry semantic budget is 1,000 passages. Overflow scores the entire eligible set lexically and never embeds a first-N shortlist. Current registry: 145 passages. A bulk graph projects 122 variants; cold query plus passages uses batches 100 + 23, and repeat execution reuses 100 cached vectors and sends 23. The cache remains 100; full-corpus warmth is not claimed.
- Inherited Task 4 synthetic fixtures were replaced by verified records and numeric matched subsets while retaining negative provenance tests. Old failed evidence is preserved.
- Task 7 owns bounded public retention of new diagnostics/reason enums. Real embedding relevance, latency and editorial quality remain unqualified.

## Phase 4 interface and parallel ownership

Ruling: Tasks 7 and 8 may develop disjoint pieces against the plan's fixed private usage contract `{ userId, ids, completedAt, requestId, attemptId }`. Task 7 owns route/backend accepted-attempt identity and final retention; Task 8 owns durable storage/replay, the memory persistence outcome and job test helpers. Task 8 integration/review must use the completed Task 7 producer and may not infer acceptance from public metadata. Shared route changes are serialized through Task 7; no two agents edit the same file. Phase 4 closes only after both final integration reviews pass.

## Qualification infrastructure findings and rulings

Task 9 infrastructure is being prepared during Phase 4; final qualification remains pending until integrated source and the offline documentation/version update are complete. The old 73-case fixture bytes, order and historical expectations remain unchanged. Intentional contract changes require a separately hashed versioned expectation migration with old/new values and reasons; failed cases may not be silently removed.

- Old rehearsal-memory prose is outside the new whole-fact grammar. Omission is intentional; new versioned fixtures must still prove supported/relevant positive selection and selected-then-budget-removed retention.
- The old `wrong-subject-memory` question contains a separate parenting clause and a transition question. Executed current selection is `general/transition`, and compatible-span projection excludes the separate parenting clause. The pure subject guard still correctly supports the child, but the selector deliberately declines that nonselected-topic evidence. Ruling: record this conservative omission explicitly, preserve/assert the full current question in the final narrative input, and add a parenting-context positive-child/wrong-self control. Do not weaken compatible-span admission or change the frozen historical fixture.
- A source-URL-only enrichment fixture exposed provenance loss when an empty `sourceUrls` array shadows `sourceUrl`. This is a required projection integration fix, assigned narrowly to the Task 9 infrastructure agent with a failing regression and independent review. Do not hide it by changing the fixture to the generated array shape.

## Task 8 — Durable accepted-result accounting

The consumer is implemented and independently approved against the current Task 7 private producer. Accepted terminal result, fixed expiry and a separate private `readingMemoryReceipt` key commit atomically before public completion or D1 dispatch. Restart replays only the idempotent access update; run/attempt/request guards prevent stale streams, progress writes and acknowledgments from replacing a newer run or recreating purged storage. Three persisted rounds with at most two D1 attempts each bound optional retries without extending retention.

- Implementer gate: **133 prescribed tests plus 17 visual-configuration tests passed**. Independent concurrency review: **133 prescribed tests plus 11 actual transport tests passed**; scoped lint/diff checks pass. Tests use synthetic storage/providers, not live Cloudflare runtime evidence.
- Cancellation ruling: cancellation observed before the accepted transaction's guard wins. An overlapping cancellation after that serialization point can receive success after durable completion. Physical network arrival before a storage acknowledgment is not a guarantee of winning cancellation. This explicitly clarifies the plan's “before terminal commit” wording. The [Cloudflare input-gate definition](https://developers.cloudflare.com/durable-objects/reference/glossary/) supports the ordering premise; the offline fake does not emulate those runtime gates.
- Rollback limitation: older code ignores the separate key but can erase matching run/attempt identities from the job envelope. Accounting-compatible rollback requires a receipt-aware target or verified draining; keeping receipt bytes alone does not ensure later replay. Identity checks are not relaxed to recover an unverifiable receipt.
- Producer source reviewed: SHA-256 `9f7a29ef99996c33ec88143c690cf763b7b729ffe7541bf033b8cdeeafc459db`. Earlier manifest identity is preserved as historical evidence.

## Task 7 — Final retention and transport integration

Final parsed blocks determine reference and memory inclusion for each provider attempt. Unverified legacy reference prose cannot enter generation, and opaque historical counts remain unknown. Caller interpretations now participate in aggregate user-context retention, closing T1-R1. The UI distinguishes retained references from labeled historical previews and links projected card names using the selected deck while retaining source-tradition credit. Normal local reasoning, lower-level pattern composition and explicit debug reference rendering report their actual distinct behavior.

- Frozen implementer gate: **254 prescribed tests plus 64 UI/model/render/spread tests passed**; all 27 owned files pass lint/diff checks. Independent review: **305 covering tests passed**, followed by **47 overlapping pipeline tests** after the final positive-memory fixture correction. These counts are separate overlapping evidence, not an additive total.
- Actual handlers and captured mocked transports cover Claude, Modal and OpenAI across direct JSON/SSE, public job start/status/stream and authenticated MCP. Large-input builds cover ten Japanese card notes and 78-card custom spreads with and without slimming. This is offline construction/static-render evidence, not live providers or device validation.
- A real-route cancellation regression exposed a missing analysis signal. The route now passes the task signal into retrieval and checks abort around analysis; ignored late embedding completion cannot start generation or populate the cache.
- Task 7 and Task 8 share one local Phase 4 checkpoint because the producer/consumer contract and transaction-aware transport fixtures depend on one another. Both tasks received explicit independent approval before integration. No remote publication or deployment is implied.

## Final documentation inspection follow-up

The authored Death–Star partial theme still said “skipping integration” even after its wrapper became conditional. That phrase can imply an absent stage was bypassed. The reviewed replacement is “Change accompanied by renewed possibility,” with a final-highlight/provider-prompt regression. Independent partial-triad suite: **41 passed**; implementer overlapping partial/pipeline suite: **88 passed**. All other authored pair meanings and the separate pending human editorial lane remain intact. Frozen historical fixture bytes are unchanged; a sixth typed migration records this new expectation in the v2 fixture.

## Offline Task 11 documentation/version preparation

Maintained runtime, input, API/MCP, provider, source-usage and release/rollback documentation is reviewed. Reading prompt version is **1.4.0**, locally unused before this change; the full historical 1.3.0 entry and evaluator 2.5.0 are preserved. A draft OpenAPI mismatch was corrected before freeze: the direct API still requires a nonempty legacy `meaning` field and exact `Upright`/`Reversed`; MCP's optional meaning/lowercase adapter is a distinct contract. Actual schema probes and all 13 owned hashes were independently checked. The implementer validated 238 maintained Markdown files, 13 OpenAPI schemas and 27 local references. These checks do not close the final qualification or release lanes.

## Fresh whole-change review: resolved integration fixes

- **W1, P1, resolved:** A leading contrast conjunction on a projected current clause hid explicit employment, wedding and age retractions. Actual direct/job probes reproduced obsolete final prompt inclusion and timestamp stamping. Current-claim parsing now normalizes the preserved contrast boundary without changing source/query text, topic precedence or stored-memory grammar. Full-path regressions prevent retained obsolete blocks and access writes.
- **W2, test integration, resolved:** Older decision-context and safety-delivery tests manually constructed jobs without transactional storage or active-run identity. They now use the existing transaction-aware helper and real lifecycle while retaining original behavior assertions. This was a fixture incompatibility, not a demonstrated runtime defect.
- **W3, documentation, resolved:** The old enrichment-merge comment now reflects full-variant relevance ranking; the merge implementation is preserved.
- **W4, P2, resolved:** `Alice canceled my wedding` was incorrectly attributed only to actor Alice, allowing the user's obsolete wedding memory. A bounded current-source veto now recognizes the explicit user-owned event without creating positive factual authority or general coreference. Negated-cancellation, unrelated-event and existing same-actor controls remain covered.

Corrective round 1: **434 implementer tests passed**. Fresh independent whole-change review approved all 133 changed/new files after **648 focused tests** and **14 saved corrective probes** passed, including eight actual direct/job cases. No actionable review finding remained open at that review; W5 was discovered by the later root qualification attempt below. Earlier failures are preserved. The reviewed file-map SHA-256 is `ba7a8074a2ecb13f8f49075903ddbe3655fbb26af0405dd8c74edc929685421b`; subsequent parent edits to this ledger and qualification status record the verdict without changing executable/test bytes.

The expanded development gate passed 849 fixtures, 2,523 provider-target builds, 525 projections and 21 actual cap selections before the corrective review. Those earlier results were development evidence; the subsequent frozen-source attempt is recorded below.


## First frozen-source qualification attempt

Commit `115bbd02ecc1d4f15b563d4871764993ba1266e6`, tree `05878e1c48dd6aaab629e9e462b571734460ca96`, remained identical across all 3,363 captured source paths. The root runner reported 5,278 passed, nine failed and two intentional installed-CLI skips. One relay test file was incomplete after a verified owned child was terminated; these counts do not establish complete root coverage. Worker graph (47), expanded deterministic prompt gate (849 fixtures / 2,523 provider builds / 525 projections / 21 cap selections), lint, build, docs, diff, plan links and corpus capture passed. No live model or production call occurred.

The immutable failed-attempt manifest is retained under `task9-final-115bbd02-qualification-1/` in the private evidence directory, SHA-256 `c1490342a05b744e4f7438e5e2b923a99151f30fa6e563ff05df1cefda349783`. The root failures are not waived or called baseline-only. Repairs require a new source identity and qualification attempt.

- **W5, P2:** Generation selection removed an already-loaded private name from persistence-redaction hints. A canned provider response independently containing that name then stored it unredacted. The repair must keep private candidate-name coverage separate from memory generation eligibility, without injecting omitted notes or changing retention/access accounting.
- **Evaluation relay integration:** The cue relay's storage fake lacks the transactional methods required by the real job completion path. Update the fake to the shared storage contract and make relay tests terminate within explicit bounds.
- **Fixture contract migrations:** Verified references must replace forged reference pressure/inclusion fixtures; positive advisory memory must satisfy the supported grammar; local-composer retention must match actual rendering; frozen published plugin instructions must remain distinct from the maintained future contract. Preserve the original behavioral assertions and historical package bytes.

Ruling: Apply W5's private candidate-name hints to optional redacted prompt/response persistence as well as ordinary evaluation storage. A name already known to the same request must not lose protection merely because a different persistence option is enabled. Keep the existing explicit unredacted-storage authorization contract and generic hint cap unchanged. The additional lane is a consistency correction; no baseline comparison establishes that it was newly introduced by this branch.

### Qualification repairs: independently approved

W5 is resolved: current/selected name hints keep their existing priority, with a separate bounded private candidate union used only for default evaluation storage and optional redacted prompt/response storage. All four finalizer paths carry the hints; opt-out, generation inputs, memory retention and access receipts remain unchanged. A narrow possessive-regex escape correction was also required for current-name coverage; the original base independently confirms that error predates this remediation.

The relay now uses the existing transaction-aware storage helper, and bounded tests cover durable JSON completion, independent simultaneous SSE streams, cursor replay and subscriber cleanup. The full previously incomplete file and its direct qualification consumer pass. Fixture changes retain the intended budget, advisory memory, note retention and package-integrity assertions. Frozen published plugin bytes remain unchanged.

Implementer evidence: 554 privacy covering tests; 85 fixture tests; 73 relay tests plus 24 direct-consumer tests. Independent review passed 158 fixture/relay tests and 173 privacy/prompt/access tests, plus a maximum-union optional-archive probe. Counts overlap and are not additive. All 12 pending paths were hash-verified; review file-map SHA-256 `c317300362d575e9827bc1d51ccfc38f74e37cd95389b599b0d24ca6c6a4504e`. No actionable finding remains in this repair review. Parent edits after that snapshot only record this verdict in status documentation. These focused results do not replace the new whole-source gate.

## Final frozen-source deterministic qualification

Task 9 passes on commit `e51022f3661b4a07c6c0f0b92af28f1a7e3e1da3`, tree `66b7e89f9dc7b8e6215610caba639a109e204070`. Root: **5,305 passed, zero failed/cancelled, two intentional installed-CLI skips** (5,307 total). Worker graph: **47 passed**. Expanded gate: **849 fixtures, 2,523 provider-target builds, 525 projections, 21 actual caps**. Lint, Vite build, 245 maintained Markdown files, both plans' five links/anchors, diff and corpus identity checks all pass. The build emits an `onnxruntime-web` eval warning; no baseline attribution is assumed.

All 3,364 source paths, toolchain/guard/harness hashes and index bytes matched before/after; post-run status was clean. Source digest: `7f321e7993bac3048d7c2e12d8ed0fd65baf3340f038118fb8e852b7470b8ff1`. The raw development-labelled gate remains unchanged and is externally bound to this source. Exact receipts and artifacts are in `task9-final-e51022f3-qualification-2/` in the private evidence directory. No required offline failure remains unclassified or waived. Final ledger/status edits record these results without changing executable or test bytes.

Qualification manifest SHA-256: `ee71fa578293c4a7f2ac81259358b800080d02a88db7ee9fea9768ad6193c367`; report SHA-256: `3f1ed7e8ba6394392bcccd334ab17b7e094c354a93655e229642721893983ded`.

## Task 10 offline handoff and separate live boundary

V4 uniformly recaptures all 24 original-base and 24 final-candidate cases using the same blocked-network capture-only harness and inputs. Candidate identity is the qualified checkpoint above; baseline remains `680516f0`. All before/after source checks pass, all 48 prompt hashes match the corresponding fresh v3 comparison, and all 72 new indexed artifacts were independently rehashed. Actual SQL verifies older relevant memory selection; all three decks exclude the retracted employer memory and its access stamp. Three multilingual cases per source intentionally stop with `reading_safety_unavailable` after provider-input capture; no accepted multilingual reading is claimed.

The new manifest is `task10-preparation/comparison-manifest-v4.json`, SHA-256 `523c9ced708dd056a55da7d8866e020cecbc28723a3494ff1687ffda669699d7`; the artifact index is `artifact-index-v4.json`, SHA-256 `2aa7b2e75f967d9aef9400c4bd54ad72a2a37f8f801060caf609cd8422202511`. Every future live output row remains **UNRUN with zero attempts**. Human approval of 525 projections and 30 direct themes, subscription narrative gates/comparison, real embeddings, provider capacity and release stages remain separate. The capture harness has no live mode; preparing it does not authorize or claim a subscription executor or successful generated readings. All old failures and manifests remain intact.

## Follow-up review: preserve corrections outside the selected topic

**W6, P2, resolved locally:** Topic projection could discard a current correction before memory compatibility checked it. The direct API and durable job both retained and stamped `I am 42 years old` when the question repeated that age with a career question and the reflection said `I am not 42 years old and my partner is planning a wedding.` Updating the reflection to age 43 failed similarly; sentence-separated controls passed.

The approved correction preserves topic-filtered positive admission and ranking, then vetoes supported factual notes against the union of projected evidence and all accepted current inputs. Saved focus and caller interpretations remain excluded. The frozen-selection cache also includes all accepted current inputs, so a newly supplied correction cannot reuse an earlier compatible decision. Claim grammar, access-finalization mechanics and retrieval projection are unchanged.

The initial regression run reproduced **23 failures** against the pre-fix implementation. They pass with the fix. The final diff adds **32 tests**: six correction/retraction forms across general reflections, card reflections and decision paths; cache, ownership, positive-authority and ranking controls; and ten real direct/job provider-input and database-access cases. The eight original external review probes pass, including both unchanged positive controls. The full root suite passes **5,337 tests**, zero failed/cancelled, with two intentional installed-CLI opt-in skips. The deterministic gate passes **849 fixtures, 2,523 provider builds, 525 projections and 12 exercised boundaries**; scoped ESLint passes.

Evidence is stored separately in `/home/ubuntu/.codex/artifacts/tarot-memory-veto-fix-20261023-01a1697e/`, with baseline commit `2d76a50d951c92fb30537d29ee5001bb483cae8c`, the follow-up diff, source hashes and retained red/green logs. This offline validation used a credential-free environment and blocked external network access. The earlier `e51022f3` qualification and v4 captures remain historical source-specific evidence; the subsequent pre-push subscription attempt is recorded separately below.

### Requested commit and push: subscription check

The required `npm run ci:narrative-check` was attempted once through the existing Claude subscription with paid API credentials absent. It failed with exit 1 on `single-new-role`: `Claude Code request failed. Check subscription login and usage limits.` Of the standard 11 samples, one was attempted and zero completed; metrics computation and downstream gates were not reached. No retry or paid fallback occurred. All 21 tracked evaluation files retain their pre-run hashes; the failed log and preservation records are in `/home/ubuntu/.codex/artifacts/tarot-memory-veto-push-20261023-01a1697e/`. Implementation/test hashes match the passing offline manifest. Publication of the reviewed branch does not qualify it for release; the failed subscription gate, separate 48-output comparison, human review and other live requirements remain open.

### Authorized merge, deployment and production reading evaluation

The user authorized merging into current `master`, deployment with the Claude gate skipped once, and subsequent evaluation of live readings. Integration includes the intervening journal commit `37b6a540` and preserves the dirty primary checkout through an isolated release worktree. A one-run external wrapper records the waiver and retains the remaining release checks and normal preserving deployment flow. No permanent gate bypass is added. Source, deployment, preservation and bounded live-reading evidence are kept in `/home/ubuntu/.codex/artifacts/tarot-context-release-20261023-01a1697e/`. Earlier failed and unrun qualification records remain intact.
