# Reading context remediation execution ledger

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
| 1 | 1–2 | Task 1 complete; Task 2 pending | Canonical/caller meaning, validated transport and memory reuse control reviewed; authoritative context next. |
| 2 | 3–4 | Task 3 complete; Task 4 pending | Major counts and conditional highlights reviewed; passage/enrichment projection next. |
| 3 | 5–6 | Pending | Bounded ranking and compatible memory selection. |
| 4 | 7–8 | Pending | Accepted-attempt retention and durable completion receipt. |
| 5 deterministic | 9 | Pending | Final-source frozen regressions and independent whole-change review. |
| 5 editorial/live | 10 | Separate, unrun | Human approval, subscription generation, Workers AI and provider-limit verification. |
| 6 | 11 | Separate | Documentation can be prepared; integration/release actions require their own authorization. |

## Requirement-to-test ownership

All entries below remain open until their task's final-source checks and review pass. Candidate tests are reusable evidence targets, not proof that this specification is already satisfied.

| Requirement | Owner tasks | Reused regression coverage | Missing acceptance coverage / status |
| --- | --- | --- | --- |
| F1 partial arcs | 3, 4, 7, 9 | `knowledgeGraphPartialTriads`, `graphRAGDeckProjection` | Partial references still contain absent-stage prose; add all-pair final projection tests. |
| F2 deck fidelity | 1, 4, 7, 10 | `graphRAGDeckProjection`, `knowledgeGraphContextPipeline` | Matched subset, aliases, enrichment and provider-boundary projections; human review pending. |
| F3 complete classification | 2, 9 | `readingContextSources`, `readingRetrievalQuery` | Decisive late clauses and all 78 sources independent of query budget. |
| F4 decision labels | 1, 2, 6, 7 | `decisionPathContext` | MCP parity, request identity, effective-label transport and new context object. |
| F5 memory relevance/access | 6, 7, 8 | `readingMemorySelection`, `readingMemoryAccess`, `userMemoryAccess` | Negation, health admission, opt-out, accepted-attempt retention and crash receipt. |
| F6 full candidate recall | 4, 5 | `graphRAGCandidateSelection`, `graphRAGProvenance` | Comparable fallback, full projected embeddings, deadline and all-variant competition. |
| F7 attribution | 4 | `graphRAGDeckProjection`, `passageCandidates` | Verified source identity, explicit internal canon wrapper and enriched provenance. |
| F8 context/count metadata | 2, 3, 7 | `graphContext`, `promptContextRetention` | Single selection object; Major count independent of journey ties. |
| V1 mixed spans | 2 | `readingRetrievalQuery` | Sentence/clause selection with negation, source coverage and bounded excerpts. |
| V2 opaque legacy counts | 7 | `graphRAGRetention`, `sourceUsageSummary` | Remove selected-count fallback; only verified registry content may enter generation. |
| V3 normalized ranking | 5 | `graphRAGCandidateSelection`, `graphRAG` | Repetition/scaffolding, mode ordering and bounded relevance-first policy. |
| V4 conditional pattern prose | 3, 4, 7 | `knowledgeGraphPartialTriads`, `knowledgeGraphContextPipeline` | Positions/reversals and missing-card local guards; actual lower-level fallback use. |
| V5 MCP parity | 1, 7 | `mcpServer`, `mcpReadingTools` | New fields accepted by actual strict tool handlers and forwarded to jobs. |
| V6 interpretation provenance | 1, 7 | `readingCardResolution`, `readingSchema` | Canonical catalog meaning plus bounded caller interpretation and retention. |
| V7 local/UI truthfulness | 7 | `sourceUsageSummary`, `narrativeBackends` | Reasoning local path, preview separation and accepted-attempt indices. |
| V8 memory reuse/control | 1, 6, 7 | `userMemory`, `userPersonalization` | Request boolean/UI, zero reads on opt-out, restricted fact admission. |

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

## Known unresolved candidate gaps

Partial references still contain full arcs; Major counts still depend on journey detection; prompt selection is recomputed; mixed sources and negated memories remain unsafe; opaque legacy retention fallback remains; memory receipts are not durable; enriched projections are not yet adapted. These are required follow-on work, not waived findings.

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
