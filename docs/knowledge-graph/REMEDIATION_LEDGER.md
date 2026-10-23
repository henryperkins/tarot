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
| 1 | 1–2 | Complete | Validated transport and one authoritative context selection reviewed, including all accepted sources and bounded query projection. |
| 2 | 3–4 | Complete (editorial approval pending) | Matched-only partial references, verified provenance and deck projection reviewed; 525 editorial rows remain pending. |
| 3 | 5–6 | Complete | Full-set bounded ranking and compatible frozen memory selection independently reviewed. |
| 4 | 7–8 | Complete | Final provider retention and durable completion receipt independently reviewed. |
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

The authored Death–Star partial theme still said “skipping integration” even after its wrapper became conditional. That phrase can imply an absent stage was bypassed. A narrow graph-data and final-prompt regression fix is assigned to the offline documentation task before source freeze; all other authored pair meanings and the separate pending human editorial lane remain intact.
