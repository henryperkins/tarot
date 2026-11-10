# Reading Context and Knowledge Graph Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every reading's selected context, graph interpretation, reference material, remembered context, provider payload, and reported source usage agree with its actual cards, deck, current inputs, and accepted result.

**Architecture:** Retain the authored graph and shared reading route. Prepare one authoritative structured context bundle; project graph references for the actual matched cards and selected deck before ranking; score the complete eligible candidate set; select conservative relevant memories; and derive retention from each final provider payload. Reuse the existing remediation candidate selectively, preserving newer enrichment work and adding the missing contracts and regressions identified below.

**Tech Stack:** ESM JavaScript, React/Vite, Cloudflare Workers, ReadingJob Durable Objects, D1, Workers AI embeddings, Node `node:test`, existing subscription-authenticated narrative evaluation.

**Spec:** The [consolidated requirements and review dispositions](#consolidated-requirements-and-review-dispositions), [target contracts](#target-contracts), and task acceptance criteria in this document constitute the implementation specification. They incorporate both supplied reviews and independent offline verification. The [October 22 plan](2026-10-22-knowledge-graph-context-remediation.md) remains historical reference; this plan supersedes its directions for this scope without changing that file.

**Status:** Planning only, October 23, 2026. No implementation, integration, live generation, publication, or deployment is authorized or performed by creating this document. Every implementation checkbox is open. Reference baseline: `680516f0c13054f1a86b3f60d824e46427dec803`.

## Global Constraints

- Preserve unrelated dirty work, both existing plans, the existing implementation worktree, and prior failed qualification records. Implement in a new isolated worktree from the then-approved base; do not reset or stage the primary checkout's unrelated changes.
- Preserve canonical identity, request-level deck precedence, orientation, and original position identity. Pattern membership is not evidence that an undrawn card or an unprovided life event occurred.
- Accepted current-input limits remain question 2,000 characters, general notes 5,000, each card reflection 2,000, and 78 cards. Apply limits independently before classification. Do not interpret an 8,000-character retrieval query as a limit on which accepted sources can influence classification.
- Preserve final passage allowances: paid single/threeCard/fiveCard/celtic/decision/relationship/general = `1/2/3/5/3/2/3`; free = `max(1, floor(paid / 2))`; Plus and Pro share allowances. Candidate enumeration is independent of these allowances. Direct highlights have their separate maximum of five.
- Preserve GraphRAG flag precedence and disabled defaults. Explicit semantic-off performs no embedding call. Quality-filtering bypass never bypasses card, deck, provenance, or data-safety checks.
- Preserve existing Claude/OpenAI soft budgets, opt-in slimming, and hard caps of 25,000/20,000 estimated tokens. Modal's current uncapped application policy is an explicit qualification item, not proof that its serving stack accepts every schema-valid request.
- Current inputs override saved interests and memories. Ordinary telemetry must contain no questions, notes, labels, memory text/IDs, names, embedding inputs/vectors, or credentials. Retain protected, opt-in prompt debugging and existing sanitization/delimiter defenses.
- Tests and deterministic qualification stub external services. Live generation uses the owner's existing Claude subscription, never paid API fallback. Workers AI verification is a separate, explicitly bounded live lane. Writing this plan authorizes neither lane.
- GitHub Actions billing is unavailable. Local checks and the repository's local deployment workflow are authoritative release prerequisites; do not ask to remove the billing lock.
- This work introduces no graph database, general semantic corpus search, new Minor Arcana corpus, new decision authoring workflow, or follow-up/journal narrative redesign. Update existing consumers only where necessary to preserve the new contracts.

## Review Focus

1. A decisive late clause in `card-77` must affect classification despite maximum-length general and earlier card notes; query omission must be explicit rather than hidden. Tasks 2 and 9.
2. Explicit decision-label clears/replacements must survive jobs, MCP, local fallback, language/evaluation screening, and budget rebuilding without restoring old labels; raw crisis screening remains independent. Tasks 1, 2, and 7.
3. A partial reference must not describe the missing card even after removing its imagery; neither summaries, highlights, weak-match retention, nor legacy blocks may restore the complete arc. Tasks 3, 4, 5, and 7.
4. Repeated keywords, query labels, duplicate variants, invalid vectors, or enrichment growth must not create unbounded scores or silently restrict candidate eligibility. Tasks 4, 5, and 9.
5. Negated/retracted facts, wrong subjects, uncertain personal details, cancellation, retries, and object restart must not expose a contradictory memory or stamp a discarded reading attempt. Tasks 6, 8, and 9.

---

## Consolidated requirements and review dispositions

The first verification reproduced all eight findings with 518 existing tests across 25 files, all 30 partial pairs, independent prompt builds, and a real public-job/reading-handler flow with mocked provider and database. These passing tests describe the baseline, not fixes. Exact historical prompt lengths and test totals in the supplied reviews are not new qualification evidence.

| ID | Required outcome | Tasks |
|---|---|---|
| F1 / second C1 | All 30 pair narratives resolve correctly; both highlights and reference passages describe only the matched pattern. | 3, 4, 7, 9 |
| F2 / C2 | References and fallback instructions respect the selected deck, source tradition, and display names; foreign scenes are not represented as drawn artwork. | 1, 4, 7, 10 |
| F3 / C3 | Every independently accepted current source participates in topic classification before query excerpting. | 2, 9 |
| F4 / C9 | Effective decision labels participate in context, retrieval, memory matching, provider/fallback rendering, and relevant transports. | 1, 2, 6, 7 |
| F5 / C5 | Relevant, compatible memories are selected from a bounded pool; final retention and initial-reading access semantics are explicit. | 6, 7, 8 |
| F6 / C4 | All eligible variants of triggered patterns compete after safe projection; final caps do not determine semantic candidate recall. | 4, 5 |
| F7 / C6 | Prompt source attribution says internally authored interpretive references; enriched provenance remains distinguishable and auditable. | 4 |
| F8 / C8 | One context decision supplies both behavior and provenance; actual Major counts do not depend on journey-stage detection. | 2, 3, 7 |
| V1 | Mixed-topic reflection sources are projected by meaningful spans; compatible text must not automatically admit an unrelated sentence. | 2 |
| V2 | Final reference counts never substitute upstream selected counts for verified final retention of an opaque legacy block. | 7 |
| V3 / C7 | Keyword ranking excludes scaffolding, normalizes repetition, and has an explicit relevance/structural-priority policy. | 5 |
| V4 / C10 | Graph membership may remain orientation-independent, while its prose is conditional and subordinate to actual positions/reversals. | 3, 4, 7 |
| V5 | MCP inputs and snapshots must carry newly supported context intentionally; strict schemas cannot silently prevent promised parity. | 1, 7 |
| V6 | Caller-authored `meaning` must not masquerade as authoritative card meaning. | 1 |
| V7 | Local-composer and UI metadata describe their actual inputs, not the model-prompt path or preview retrieval. | 7 |
| V8 | Readers can disable saved-memory reuse for a reading; restricted personal facts are screened for reading admission without claiming the existing filter is a general health-data classifier. | 1, 6, 7 |

### Corrections that govern implementation

- The initial review's claim that question-led retrieval excludes conflicting reflection topics is too broad: current code checks a whole reflection source, then takes a prefix. A mixed career/wedding source can retain both. This plan deliberately adds span selection; it does not describe that as existing behavior.
- The second review's direct-highlight section has no adjacent partial-pattern guard, but global absent-card rules do exist in `systemPrompt.js` and the user-prompt footer. The defect is contradictory supplied content and missing matched-card projection, not absence of all guardrails.
- Long-note probes establish truncation. A relationship-heavy current note does not, by itself, establish that a career note must win. Use neutral-long-note counterfactuals to prove the defect; pin mixed-current-topic precedence explicitly in Task 2.
- Normal routed local composition uses the reasoning branch and does not normally render direct graph highlights or reference passages. A lower-level spread builder without reasoning can render pattern synthesis. Preserve accurate behavior/accounting for both; do not add references to fallback merely to make it resemble model prompts.
- Complete-versus-partial ordering under `priority - 2 * matches` is a reproduced ranking behavior, not proof that complete patterns must always win. Task 5 chooses bounded relevance-first ranking with structural priority as a tie-breaker. A safely projected partial reference may beat a less relevant complete reference; repeated words and field labels cannot manufacture that result.
- Memory creation/management and memory formatting/redaction tests exist. No dedicated per-user/per-reading reuse setting was found; automatic follow-up capture is controlled by a deployment flag and is distinct from manual saving and later reuse. Do not describe every memory as unauthorized. This plan adds a per-reading reuse toggle without a blocking consent dialog; it does not redesign follow-up capture or remove saved notes.
- `last_accessed_at` currently records retrieval. For initial readings, this plan deliberately changes that path to successful final inclusion; other callers retain their current semantics. It still does not prove model reliance or that a person read the answer.
- A Thoth canonical alias such as Temperance is not a different card from Art. Generation should prefer selected-deck display names, while internal canonical identifiers and explicitly qualified mappings may remain. Do not implement a blanket string ban that breaks identity validation or aliases.
- MCP explicitly documents its `meaning` field as the user's own interpretation. Preserve that supported input, but label it as caller interpretation alongside a server-derived canonical meaning; do not silently delete it or continue representing it as canon.

### Unique claims from the second review: independently verified disposition

| Claim | Current-source evidence and consequence |
|---|---|
| Keyword priority inversion and repeated-term inflation | Reproduced: priority-6 partial with ten matches scores `-14`, ahead of priority-1 complete at `1`; twenty repeated `wolf` terms score twenty matches. `graphRAG.js:447` promises a stronger completeness hierarchy than its comparator enforces, while `tests/graphRAG.test.mjs:361` deliberately tests relevance overriding structural rank. Fix repetition/scaffolding and document Task 5's explicit policy. |
| Query-label contamination | Reproduced: `question: Zebra.` gives two corpus entries a match that plain `Zebra.` does not. Extract terms from source values; do not globally remove a word the user may actually have written. |
| Corpus measurements | Recounted 87 entries, 145 passages, 28 multi-context entries, 30 passages with visual anchors, and zero duplicate normalized 100-character prefixes. The last fact does not validate prefix-based deduplication against future content. |
| Bypass behavior | Verified: semantic-off takes the basic path, where the bypass flag has no effect. In the quality path, bypass assigns nominal scores but raw keyword ranking already ran; missing-binding telemetry can mask the actual bypass reason. Task 5 deliberately resolves one mode before dispatch. |
| Orientation | Switching upright/reversed leaves membership, structural strength and direct pattern prose unchanged. Some graph objects retain oriented cards, and spread analysis/prompting use orientation. Do not call the entire pipeline orientation-blind. |
| Local composition | Sentinel probe and real offline route confirm reasoning-based local composition does not use direct graph highlights; the no-reasoning lower-level builder does. Task 7 covers both. |
| MCP context gap | Real in-memory MCP calls reject both tools' `decisionPaths` and supplied-card `userReflection` before a job is created. Extend `tests/mcpServer.test.mjs` and `tests/mcpReadingTools.test.mjs` with the actual contracts. |
| Shellfish memory and absent accounting | New save/load/prompt/transport probe confirms an allergy note survives the narrow existing filter and reaches a career prompt, with early access stamping and no memory source-usage field. The original contrast injected a memory directly; the added probe verifies storage/loading too. |
| Relationship-heavy truncation fixture | Exact saved fixture has a 65-character card reflection and 5,063-character combined source. Shortening its relationship note preserves career text but still selects relationship. This supports omitted evidence, not the proposed mandatory career outcome; neutral-note controls prove the saved-focus defect. |
| Existing safeguards/tests | Global absent-card rules, memory formatting tests and memory redaction tests exist. The required additions are content-selection/final-retention regressions, not claims that those safeguards/tests are absent. |
| Output quality gate | Source inspection confirms hallucination detection and spread-dependent allowances: one for common small spreads, two for Celtic Cross. This is not a guarantee against a single absent-card assertion. Task 9 probes actual detection; Task 10 applies strict editorial fidelity criteria. |
| Captured transport and budget numbers | The inspected offline harness reproduces 10,105 system / 5,707 user characters, output allowance 32,000, and no recorded estimate for the short Claude fixture. It also reproduces the 40-card reduction from 37,138 to 24,977 estimated tokens. After reference removal, raw `passagesUsedInPrompt` is `null`, not the second review's soft-budget `0`; normalized usage is zero. The large case explicitly reports `userContextTruncated: true`: surviving blocks do not imply every original character survived. |

These planning probes used local mocks with outbound fetch blocked. Their artifacts are outside the repository under `/tmp/tarot-context-plan-l8nw1slk/`; the task regressions below must make the evidence reproducible without depending on that temporary directory.

### Existing candidate: reuse, adapt, and incomplete work

The clean candidate at `/home/ubuntu/.codex/worktrees/knowledge-graph-context/tarot` was inspected at `8546284b884dcb56466f247a38f5d5b974e2f078`, based on `7164fc21c6c9e5988c0c4ac368f843cc5cd0c1df`. It is not an ancestor of the inspected primary HEAD. Its recorded tests and reviews are historical, not rerun by this planning task.

Reuse its numeric pair keys, source/query modules, decision-label contracts, candidate/projection separation, memory selection/retention helpers, and extensive regression cases. Do not assume it closes this plan:

| Candidate gap verified during planning | Required adaptation |
|---|---|
| Partial Healing Arc references still describe absent Death even in meaning-only text. | Add matched-pattern projection before deck projection; review 30 pair-specific meanings. |
| `totalMajors` still depends on a journey stage. | Count canonical Major slots independently. |
| Prompt assembly still reconstructs context selection. | Pass one authoritative result through every attempt. |
| Mixed-topic notes remain source-level; current negated wedding text can admit a positive wedding memory. | Span projection and conservative contradiction checks. |
| Legacy count fallback remains. | Normalize verified structured references or omit the unverified block. |
| Pending memory usage is held in memory. | Add durable private completion receipts if claiming restart-resilient accounting. |
| Candidate predates current enrichment scripts and merge. | Reconcile `knowledgeBase.js`; preserve and extend the current enrichment contract. |

The candidate's `docs/knowledge-graph/QUALIFICATION_STATUS.md` records an unpassed subscription gate, an incomplete 36-output comparison with five baseline outputs and no candidate generated outputs, and 145 pending human editorial reviews. Preserve those facts. Old previews and Workers AI observations do not qualify the reconciled implementation.

## Phases, dependencies, and review units

| Phase | Tasks | Deliverable and exit gate |
|---|---|---|
| 0 — Reconcile evidence and candidate | 0 | Isolated current-base integration, preserved history, and a requirement-to-test ledger. |
| 1 — Authoritative current inputs | 1–2 | Validated decision/meaning contracts and a single context decision with bounded query coverage. |
| 2 — Faithful graph content | 3–4 | Correct graph facts, matched-only partial references, reviewed deck/source projections. |
| 3 — Relevant selection | 5–6 | Full eligible passage ranking and conservative relevant memory selection. |
| 4 — Final request and completion | 7–8 | Provider/job/MCP/local-consumer parity, truthful retention, terminal-safe memory accounting. |
| 5 — Qualification | 9–10 | Deterministic regression evidence, editorial approval, bounded generated-reading and provider-contract evidence. |
| 6 — Release handoff | 11 | Versioned documentation, reviewed integration, and separately authorized deployment verification/rollback. |

After Task 0, Tasks 1 and 3 can proceed independently. Task 2 follows 1; Task 4 follows 3. Task 5 follows 2 and 4; Task 6 follows 2. Task 7 integrates 1–6; Task 8 follows 6–7. Task 9 then runs the complete deterministic gate; Task 10 requires its frozen source and fixtures. Task 11 requires both qualification lanes. Do not run agents against the same shared integration file concurrently; use subsystem branches or serialized integration. Each task is a focused review/commit unit when implementation/Git work is authorized.

For each implementation task, write the specified regression first, run that task's command to establish the expected failure, implement only its contract, rerun the command, and obtain the task review before recording it complete. If reused candidate code already passes a case, record it as verified reuse and add the missing boundary cases instead of manufacturing a failure. Commit only the reviewed task's files; this plan does not authorize commits by itself.

## File responsibilities

“Candidate-only” means present in the existing candidate but not the inspected primary checkout; port/adapt rather than create a competing implementation.

| Area | Existing primary files | Candidate-only or new files |
|---|---|---|
| Input contracts | `shared/contracts/readingSchema.js`, `shared/contracts/readingRequestLimits.js`, `functions/lib/readingCardResolution.js`, `src/contexts/ReadingContext.jsx`, `src/components/reading/ReadingPreparationScreen.jsx`, `functions/lib/mcp/tools/readings.js` | Candidate `functions/lib/decisionPathContext.js` |
| Context/query | `functions/lib/contextDetection.js`, `functions/lib/querentReflections.js`, `functions/api/tarot-reading.js`, `functions/lib/spreadAnalysisOrchestrator.js` | Candidate `readingContextSources.js`, `readingContextVocabulary.js`, `readingRetrievalQuery.js` under `functions/lib/` |
| Graph/projection | `src/data/knowledgeGraphData.js`, `functions/lib/knowledgeGraph.js`, `functions/lib/graphContext.js`, `functions/lib/knowledgeBase.js`, `shared/passageSource.js` | Candidate `functions/lib/graphRAGProjection.js`; new `functions/lib/knowledgeBasePartialProjections.js` |
| Retrieval | `functions/lib/graphRAG.js`, `functions/lib/embeddings.js`, `functions/lib/spreadAnalysis.js` | Candidate `functions/lib/graphRAGCandidates.js` |
| Enrichment | `functions/lib/knowledgeBaseEnrichment.js`, `scripts/enrichment/applyPassageCandidates.js`, `scripts/enrichment/buildPassageCandidates.js`, `scripts/enrichment/lib/passageDraft.js` | Extend existing queue/provenance helpers rather than replace the workflow |
| Memories | `functions/lib/userPersonalization.js`, `functions/lib/userMemory.js` | Candidate `functions/lib/readingMemorySelection.js` |
| Prompt/provider/fallback | `functions/lib/narrativeBackends.js`, `functions/lib/narrative/prompts/{buildEnhancedClaudePrompt,systemPrompt,userPrompt,cardBuilders,userContext,truncation,budgeting,graphRAGReferenceBlock}.js`, `functions/lib/narrative/reasoningIntegration.js`, `functions/lib/narrative/spreads/decision.js` | Reuse candidate memory-slot rendering/parser |
| Completion/transports | `functions/api/tarot-reading.js`, `functions/lib/readingJobs.js`, `src/worker/readingJob.js`, `functions/lib/mcp/tools/readings.js` | Private receipt stored in existing job storage; no new public route |
| Metadata/UI | `functions/lib/{readingTelemetry,telemetrySchema,promptEngineering,graphRAGAlerts}.js`, `functions/lib/narrative/sourceUsage.js`, `shared/readingSourceUsage.js`, `src/hooks/narrativeReadingModelUtils.js`, `src/components/reading/complete/sourceUsageSummary.js` | Additive bounded schemas; no private IDs in public usage |
| Qualification | `scripts/evaluation/verifyNarrativePromptAssembly.js`, `scripts/evaluation/runNarrativeSamples.js`, `functions/lib/promptVersioning.js`, `functions/lib/readingQuality.js`, `functions/lib/evaluation.js` | Candidate fixture/gate tests; new versioned qualification manifest and gap regressions listed below |

## Target contracts

Use JSDoc and existing ESM conventions. These are internal contracts unless explicitly identified as wire fields.

1. **Decision wire fields:** `decisionPaths: { a?: string, b?: string }`, each at most 80 characters. Empty string is an explicit clear; omission permits a nonboilerplate legacy decision-position fallback. Reject null, nonstrings, oversized explicit values, and unknown nested keys. For nondecision spreads, ignore the field with `not_applicable` diagnostics rather than reinterpret positions. Internal source IDs are `pathA` and `pathB`; normalize prefixes once.
2. **Sources:** `prepareReadingContextSources({ userQuestion, reflectionsText, cardsInfo, decisionPaths, spreadKey, focusAreas }) -> Source[]`. Source = `{ id, kind, text, originalLength, sanitizedLength, cardIndex?, pathKey?, origin? }`. IDs cover question, general notes, all 78 cards, both paths, and the existing sanitized focus-list limit of 12. Full accepted current sources participate before excerpting; focus rendering retains its existing separate cap.
3. **Authoritative decision:** `resolveContextSelection({ sources, ...legacyFields }, spreadKey, options) -> ContextSelection`, with `{ version: 1, context, graphRAGContext, source, clarifiedBy, selectedSourceIds, retrievalQuery, queryCoverage }`. Only server-prepared objects are authoritative. The route passes this result into analysis, builders, fallback and telemetry; clients cannot inject it through JSON. Direct internal builders derive it once only when absent.
4. **Query projection:** `buildReadingRetrievalQuery(sources, selection, { maxLength: 8000 }) -> { text, contentText, coverage }`. `text` has bounded source labels for semantic context; `contentText` contains only selected source spans for keyword ranking. Coverage distinguishes classification, topic eligibility, excerpting and omission. Question-led note text remains capped at 750 total characters; this is not a guarantee that all 79 notes fit.
5. **Pattern projection:** `projectPassageForPattern(passage, { isComplete, matchedCards, missingCards, matchedNames }) -> PatternPassage | null`, followed by `projectPassageForDeck(passage, deckStyle) -> PassageCandidate | null`. Stable `candidateId` distinguishes family/pattern/context/matched subset; `projectionId` includes projection version and selected deck. Preserve original authored display text separately. Only projected title/theme/text/anchors feed scoring or prompts.
6. **Retrieval:** `collectPassageCandidates(graphKeys, { deckStyle, includeMetadata })` enumerates registry-backed eligible variants; `selectPassageCandidates(scoredCandidates, { maxPassages, minRelevanceScore: 0.3, enableDeduplication, qualityFilteringDisabled })` performs the documented final selection. No earlier tier-dependent cap.
7. **Memory selection:** `selectMemoriesForReading(candidates, { sources, contextSelection, displayName, limit: 3, referenceTime }) -> { memories, selectedIds, stats }`. `checkMemoryCompatibility(memory, currentSources) -> { status: 'supported' | 'conflicting' | 'ambiguous' | 'nonfactual', reason }` is a pure conservative guard; unsupported factual interpretations are omitted. Reuse `extractPersonalDetailClaims` and its subject/numeric regressions.
8. **Private memory completion:** retain `markReadingMemoriesAccessed(db, userId, ids, accessedAt)` and `persistReadingMemoryAccess(db, usage)`. Usage = `{ userId, ids, completedAt, requestId, attemptId }`; IDs never enter public metadata. Jobs stage a private receipt tied to the accepted terminal result and replay only its idempotent DB update.
9. **Retention:** `sourceUsage.memories = { requested, used, candidatesProvided, memoriesSelected, memoriesUsedInPrompt, skippedReason }`, bounded by 100/3/3. GraphRAG carries separate discovered/projected/scored/selected/retained counts, scoring method, and final selected indices. Caller-interpretation retention uses `sourceUsage.userContext.fields['interpretation-0']` through `interpretation-77`, separately from card reflections and canonical meaning; these IDs are retention fields, not topic-classification sources. `used` describes final input inclusion, or actual rendered inclusion for deterministic composition, never model attention.
10. **Memory reuse wire field:** optional boolean `useSavedMemories`, default true for backward compatibility; explicit false bypasses memory candidate loading, selection and access writes and reports `disabled_by_request`. Forward through direct/jobs/MCP; expose a signed-in reading-preparation checkbox labelled “Use saved memories in this reading.” It governs this reading, not storage or follow-up capture; it requires no D1 migration. Malformed nonboolean values fail schema validation.

## Phase 0 — Reconcile evidence and candidate

### Task 0: Establish a recoverable integration baseline

**Files:** Read both worktrees and candidate qualification documents; create `docs/knowledge-graph/REMEDIATION_LEDGER.md` in the implementation worktree. Preserve source/evidence snapshots outside the checkout.

**Interfaces:** Produces the approved base/candidate/source identities and a ledger mapping every F/V row to reused tests, missing tests, implementation task, and qualification status.

- [ ] Capture primary/candidate HEADs, merge base, status, worktrees and dirty-file hashes; record concurrent unrelated work rather than attempting to clean it.
- [ ] Create an isolated integration worktree from the approved current base. Inspect the candidate's complete commit series and port the relevant coherent changes/regressions; never overwrite current `knowledgeBase.js` with the older copy.
- [ ] Reconcile the enrichment merge, prompt/evaluator versions, transport schemas, source-usage schemas, and candidate-only modules. Preserve all subject/age/measurement, label-clear, language-screening, graph-flag and D1-binding regressions from the candidate's review-fix waves.
- [ ] Run the reused deterministic tests to establish the integrated baseline. Add the verified unresolved cases to the ledger as failing/unimplemented, not waived because historical candidate tests passed.
- [ ] Record candidate generation/editorial requirements as pending and preserve the old manifests, failed runs and corpus identities. Check disk space before snapshots; create and verify a source-only archive instead of copying caches/build artifacts.

**Exit gate:** Every requirement has an owner/test target; existing newer code is preserved; no implementation status is inferred from old test counts. Review the integration diff before downstream tasks.

## Phase 1 — Authoritative current inputs

### Task 1: Define decision labels and canonical card-meaning authority

**Files:** Input-contract row above; `functions/lib/readingJobs.js`; MCP fixtures/tests. Reuse `tests/decisionPathContext.test.mjs`; extend `tests/readingSchema.test.mjs`, `tests/readingCardResolution.test.mjs`, and the existing MCP reading-tool suites. Add `tests/readingContextTransport.test.mjs` if no existing suite covers complete transport parity.

**Interfaces:** Implements target contracts 1 and 10 and preserves `resolveReadingCards(rawCards, deckStyle)`. Resolved `meaning` is the canonical orientation-aware catalog meaning; a differing sanitized incoming `meaning` is preserved separately as `callerMeaning` (maximum 1,000 characters), clearly labelled untrusted user interpretation. Client-supplied internal `callerMeaning` metadata cannot override the server derivation. Caller interpretations inform narrative wording but not graph identity, topic scoring, or authorization of remembered personal facts.

- [ ] Add regressions named `explicit_clear_does_not_restore_position`, `decision_context_survives_public_job_and_mcp`, and `client_meaning_cannot_replace_catalog_meaning`. Assert `decisionPaths.a === ''` stays cleared, both effective labels survive all supported transports, and Sun upright with the supplied defeat/betrayal meaning keeps canonical Sun meaning while the supplied words appear only as labelled caller interpretation.
- [ ] Implement the 80-character A/B schema and explicit-clear semantics. Derive missing labels only from decision slots 1 and 2, strip one role prefix, retain A/B identity for identical labels, and create presentation copies with stable role names so raw long labels cannot bypass the limit. Preserve original card positions for storage/identity.
- [ ] Perform crisis screening on raw schema-accepted question, notes, explicit labels and relevant legacy positions before filtering, shortening or clear/replacement suppression. Use only effective labels for ordinary context/language/evaluation handling. Do not mutate input cards.
- [ ] Extend existing UI request construction and strict MCP schemas deliberately: draw/start tools accept optional `decisionPaths`; supplied-card tools accept each `userReflection` at the existing 2,000 limit. Drawing tools need no speculative per-card-reflection API before cards exist. Preserve raw/effective labels and notes through jobs and MCP snapshots/saves; never accept an internal context-selection object from clients.
- [ ] Derive meaning server-side using canonical identity/orientation, applying available selected-deck meaning data without importing foreign scene descriptions. Preserve supported caller interpretation separately through sanitization, prompt-data blocks, budgeting/redaction and MCP snapshots. Avoid duplicating catalog-identical meanings as artificial personal input. Document both provenances and update web/MCP fixtures together.
- [ ] Implement `useSavedMemories` and the unobtrusive signed-in reading-preparation control. A false value must survive jobs, MCP and retries and cause zero candidate DB reads/access writes; absent values retain compatibility. Include it in the request identity so changing it does not reuse a stale generated reading.
- [ ] Extend `e2e/reading-personal-context.spec.js` for keyboard-accessible memory reuse toggling, checked state carried into the submitted job, and state during retry/new-reading transitions. Use mocked request capture for the transport assertion; authenticated interactive review follows `docs/local-reviewer-account.md` and logs out afterward.
- [ ] Run `node --test tests/decisionPathContext.test.mjs tests/readingSchema.test.mjs tests/readingCardResolution.test.mjs tests/readingContextTransport.test.mjs tests/mcpServer.test.mjs tests/mcpReadingTools.test.mjs`. Expected: all pass, including nondecision, missing, empty, null, oversize, injected and unsupported-language cases.

**Exit gate:** Accepted meanings and effective labels have one explicit authority and are transported consistently. No new path-entry UI is required.

### Task 2: Classify all sources once and construct a separate bounded query

**Files:** Context/query row; shared prompt-builder arguments; `tests/readingContextSources.test.mjs`, `tests/readingRetrievalQuery.test.mjs`, `tests/readingContextPrecedence.test.mjs`, `tests/contextDetection.test.mjs`.

**Interfaces:** Target contracts 2–4. Preserve existing lens vocabularies, including `love` versus `relationship`; pass the exact authoritative selection object through downstream code.

- [ ] Add failing assertions for the neutral 5,000-character general note plus career card note: `selection.context === 'career'`, `selection.source === 'reflections'`, retrieval contains the career evidence, final note is retained, and prompt provenance equals the original selection. Repeat at 4,991 characters, with decisive text at the end of a 2,000-character note, and at `card-77`.
- [ ] Classify independently sanitized full sources. Topic-bearing question wins; tied question topics can be narrowed by current notes and effective paths. If the question has no topic, classify current notes, then paths, then saved focus, then spread defaults. Within a source group use distinct normalized topic evidence, not repeated-word frequency or duplicated notes. Pin the existing fixed tie priority when current evidence remains tied. Explicit topic exclusions differ from topical action constraints: “not asking about career” excludes that topic; “not ready for a career change” remains career.
- [ ] Add span extraction within `readingRetrievalQuery.js`, preserving offsets, sentences/clauses, negation and qualifiers. Retain selected-topic spans plus useful neutral constraints; omit solely conflicting spans. The career-plus-wedding example must retain the job sentence and omit the wedding sentence. An inseparable mixed clause stays explicitly marked mixed rather than being rewritten into a false statement. Do not strip negation by keeping isolated keywords.
- [ ] Allocate complete question and effective A/B labels first within 8,000 characters including separators. Question-led notes share at most 750 text characters. Prioritize decision/clarification sources, then topical spans, then neutral constraints; retain a complete short clause or at least a 48-character contextual excerpt when available. Omit with a budget reason instead of allocating unreadable fragments to all 79 note sources. Break ties deterministically, then expand remaining excerpts round-robin.
- [ ] Record source coverage with lengths and reason codes only. Keep full separately bounded notes for narrative assembly. Use Unicode-safe offsets and cuts; unknown-language evidence must not be described as semantically classified merely because it was tokenized. Keep unknown-language current text in the narrative and neutral query excerpts, and label limited classification support.
- [ ] Thread the route selection through `performSpreadAnalysis`, every provider build/rebuild, local composition and telemetry. Internal builders may resolve missing inputs once; supplied server selection must not be recomputed from a smaller source set. Legacy combined strings remain a documented lower-fidelity compatibility input, never authoritative over structured fields.
- [ ] Run `node --test tests/readingContextSources.test.mjs tests/readingRetrievalQuery.test.mjs tests/contextDetection.test.mjs tests/readingContextPrecedence.test.mjs tests/promptContextRetention.test.mjs`. Include mixed current topics, duplicate notes, neutral constraints, explicit exclusions, all 78 cards, CJK/emoji/combining characters, and metadata equality.

**Exit gate:** Topic selection, retrieval query provenance and prompt lens agree; classification coverage and query-text coverage remain distinct.

## Phase 2 — Faithful graph content

### Task 3: Correct all partial highlights and independent graph facts

**Files:** `src/data/knowledgeGraphData.js`, `functions/lib/knowledgeGraph.js`, `functions/lib/graphContext.js`; `tests/knowledgeGraphPartialTriads.test.mjs`, `tests/graphContext.test.mjs`, `functions/__tests__/knowledgeGraph.test.js`.

**Interfaces:** Reuse `getMajorPairKey(cardNumbers) -> string | null`; graph patterns carry matched/missing canonical identities and card indices. Count valid Major card slots for telemetry; deduplicate canonical identities only for membership detection.

- [ ] Assert every authored pair resolves to its own text for all 30 pairs in both input orders and four orientation combinations; all ten complete triads retain complete behavior. Add `two_major_stage_tie_reports_two` and zero/single/four-Major controls.
- [ ] Replace name-based partial lookup with canonical ascending numeric pair keys. Validate definitions at test/build time for missing, duplicate, malformed or foreign keys. Runtime fallback uses only matched cards and neutral shared-theme wording; never `triad.description`.
- [ ] Compute Major counts independently of `patterns.foolsJourney`. Keep zero, one, ties, aliases, invalid metadata and duplicate-slot semantics explicit.
- [ ] Make direct highlights conditional shared themes with matched-card indices; include partial status and a local guard that missing arc members are not drawn evidence. Reconcile selected-deck display names through existing alias helpers. Preserve the global guards as well.
- [ ] Keep identity-based membership and structural ranking independent of orientation, but require prompt application to honor actual positions/reversals. Test reversed pairs, reordered complete arcs, relationship positions and decision paths; an authored arc's ordering must not assert chronological spread order.
- [ ] Run `node --test tests/knowledgeGraphPartialTriads.test.mjs tests/graphContext.test.mjs tests/graphRAGPatternCoverage.test.mjs functions/__tests__/knowledgeGraph.test.js`. Expected: all pair, count and final-highlight assertions pass.

**Exit gate:** Both direct highlights and graph facts describe the real matched cards, including no-stage cases.

### Task 4: Project matched patterns, deck meanings, and honest provenance

**Files:** Graph/projection and enrichment rows; `functions/lib/narrative/prompts/{graphRAGReferenceBlock,systemPrompt}.js`; `tests/graphRAGDeckProjection.test.mjs`, new `tests/graphRAGPartialProjection.test.mjs`, existing passage-enrichment tests; `docs/knowledge-graph/CANON_PROJECTION_REVIEW.md`.

**Interfaces:** Target contract 5. Add a reviewed registry of 30 general pair projections in `knowledgeBasePartialProjections.js`; context-specific pair prose is optional only when separately authored/reviewed. A partial pattern must not inherit all complete-triad context variants.

- [ ] Add the failing Art/Star reference regression across all three decks: matched `[14,17]`, missing `[13]`; title/theme/text/anchors must not mention Death or assert its completed stage. Assert this before scoring and in every final provider build, including RWS where cross-deck projection would otherwise do nothing.
- [ ] Implement pattern projection first. Use the reviewed matched-pair meaning/title/anchors or the neutral authored numeric-pair fallback; unverifiable matched identities omit the passage. Never generate a projection by deleting names or regex-editing the full arc. Preserve full authored prose separately for reference/history display, clearly distinguished from the material supplied to generation.
- [ ] Adapt all existing canon entries with reviewed meaning-only projections and source identity. For cross-deck generation use those meanings and no foreign visual anchors; for selected-deck references allow only card-matched, deck-matched anchors. Titles/themes and any projected metadata must obey the same rule. Prefer selected-deck display names; retain canonical IDs internally and label any explicit cross-tradition mapping.
- [ ] Replace the wrapper claim with: “These are internally authored Tableu Tarot Canon interpretive references. Use them as background for the matched cards; they are not quotations from external tarot literature.” Render source tradition separately. Make system fallback guidance selected-deck-aware; absent verified image evidence must not authorize invented visual details.
- [ ] Preserve the current approved-enrichment merge and its general-context exclusion. Extend draft/review/apply records with stable source IDs, source URLs/provenance, reviewed meaning-only text and projection version. Approval of old full prose is not approval of a new projection; retain reviewed rows exactly. A synthetic approved enriched passage must survive runtime merge and selection, while missing/unapproved cross-deck projection is omitted with an explicit reason. Do not fetch or apply real sources during implementation tests.
- [ ] Validate registry identity and content before treating legacy payloads as canon. Reject unverifiable `formattedBlock` text from generation; a valid graph-derived summary may survive independently. Preserve delimiter neutralization and instruction-as-data treatment.
- [ ] Build the editorial matrix from the actual merged registry: baseline 145 full passages × three decks = 435 projections, plus 30 pair projections × three decks = 90, and any active enriched additions. Human review covers meaning fidelity and absent-stage assumptions, not only a scene-word blacklist. Keep unreviewed rows visibly pending.
- [ ] Run `node --test tests/graphRAGPartialProjection.test.mjs tests/graphRAGDeckProjection.test.mjs tests/graphRAGProvenance.test.mjs tests/graphRAGFallback.test.mjs tests/passageCandidates.test.mjs tests/visionPromptProjection.test.mjs`. Require all aliases, source tags, unknown decks, partial subsets and synthetic enrichment cases to pass.

**Exit gate:** Every generation reference has verified origin, safe matched-card content, and deck-appropriate representation. Human semantic approval is still required in Task 10.

## Phase 3 — Relevant selection

### Task 5: Rank the full eligible set with bounded, comparable scores

**Files:** Retrieval row and `spreadAnalysisOrchestrator.js`; `tests/graphRAGCandidateSelection.test.mjs`, `tests/embeddings.test.mjs`, `tests/graphRAG.test.mjs`, `tests/graphRAGProvenance.test.mjs`.

**Interfaces:** Target contract 6; `contentText` from Task 2 is the keyword query. Sparse graph eligibility remains intentional; do not add unrelated corpus passages to compensate for an empty graph.

- [ ] Add regressions for the five-candidate Fool/Magician/World case at cap one, a winning nondefault context variant, repeated query terms, literal `question:`/`reflections:` labels, and a candidate whose relevant projected content lies beyond character 500. Assert all eligible safe candidates are considered and scaffolding/repetition cannot alter content relevance.
- [ ] Enumerate all registry-backed variants for triggered patterns, then project before scoring. A contextual variant may compete without asserting an unprovided life event; reject unsafe conditional assumptions in Task 4's editorial gate. Invalid/zero passage limits return no passages and make no embedding calls.
- [ ] Replace unbounded raw keyword counts with unique meaningful content-term overlap normalized to `[0,1]`; use shared Unicode tokenization and explicit stop words. Exclude labels, original unprojected scene text and arbitrary client metadata. Define ranking as relevance first, context compatibility second, structural priority third, stable candidate ID last. Complete patterns win structural ties, not every relevance comparison.
- [ ] In semantic mode score `0.3 * keyword + 0.7 * cosine` using the full safe projected passage up to the embedding helper's 8,000-character bound, not the first 500 characters. Validate finite vectors, nonzero norms, consistent dimensions and real-vector provenance. If any required query/candidate vector is unavailable or invalid, rank the entire set with keyword scores; report attempted/used/fallback and a precise reason. Do not compare incompatible mixed scales or call pseudo-vectors semantic results.
- [ ] Sort globally, then accept the best candidate that adds a pattern and nonduplicate normalized full text. If a pattern's highest variant duplicates another accepted passage, allow its next nonduplicate variant to compete. Keep stable identities independent of object references. Apply the 0.3 threshold, explicit one-best weak-match floor, and final tier/spread cap; the floor cannot restore a rejected provenance/card/deck projection.
- [ ] Resolve one mode before helper dispatch: graph-disabled first; otherwise explicit bypass; otherwise semantic if requested; otherwise keyword when there is content; otherwise priority. Missing/failed embeddings fall back to keyword. Bypass skips relevance/threshold/text-dedup work but still validates projections, chooses a deterministic context/default variant, and applies structural ordering/final caps. This intentionally makes bypass effective even without semantic mode and removes its old raw-keyword side effect. Report `quality-filtering-disabled`, attempted=false and used=false accurately; nominal scores are not confidence.
- [ ] Bound work by the compiled reviewed registry and request-wide retrieval deadline of 3,000 ms, batches of at most 100 texts, and at most two concurrent batches. Abort/ignore late results and fall back across the complete eligible set on timeout. Record registry/candidate counts, cache hit counts and elapsed time without text. Corpus growth must not silently reintroduce a first-N shortlist; build validation and explicit overflow/fallback behavior protect runtime limits. Measure the current 100-entry cache before resizing or claiming a warm corpus.
- [ ] Run `node --test tests/graphRAGCandidateSelection.test.mjs tests/graphRAG.test.mjs tests/graphRAGFallback.test.mjs tests/graphRAGProvenance.test.mjs tests/embeddings.test.mjs`. Cover all 21 caps, duplicate prefixes/different bodies, exact duplicates, ties, no query, no patterns, disabled flags, missing binding, partial batch failure, cancellation and enrichment growth.

**Exit gate:** Eligibility, scoring, variant choice and final allowance are independently observable; no user text repetition or scaffolding defeats the ranking contract.

### Task 6: Select compatible memories from a bounded candidate pool

**Files:** Memory row and route personalization order; `tests/readingMemorySelection.test.mjs`, `tests/userPersonalization.test.mjs`, `tests/userMemory.test.mjs`.

**Interfaces:** Target contracts 7 and 10. Initial readings use `getMemories(db, userId, { scope: 'global', limit: 100, markAccess: false })` after the crisis-return branch and only when reuse is enabled. Split preference loading from memory loading so early exits and explicit opt-outs do not touch memory storage. Existing unrelated callers retain default access behavior.

- [ ] Add assertions that an older relevant note beats eight newer unrelated notes, candidate loading writes nothing, a shellfish note is excluded from grief/career input, and “I am not planning a wedding” rejects “I am planning a wedding with my partner.” Include “I no longer work there,” different named subjects, changed numeric details, and one relevant clause attached to an unrelated personal claim.
- [ ] Filter unsafe, malformed, expired, nonglobal, wrong-owner and duplicate rows before ranking. Add reading-admission rejection for explicit health facts such as the verified allergy note, even if lexical overlap would otherwise admit them; preserve existing stored notes and manual controls. Document that the existing sensitive-content helper detects a limited set of identifiers/instructions, not every health fact. Test allergy versus ordinary food preference and ambiguous restricted details; do not claim a universal semantic classifier. Require relevance to selected current context and retained compatible current spans, not merely any keyword in the original question. Saved interests and graph references cannot authorize personal facts.
- [ ] Implement `checkMemoryCompatibility` before ranking. Preserve candidate age/birthday same-subject matching; add explicit negated/retracted-event and employment conflicts. Ambiguous pronouns, inconsistent subjects, unknown factual grammar/language, unsupported numbers/dates or extra uncorroborated personal details reject the whole memory. Conservative omission is preferable to lexical inference. Theme/affinity notes must not bypass this check by category.
- [ ] Reuse all candidate regressions for self/named/relation subjects, multiple children, possessives, decimal/fraction/range ages, infant ages, measurement units and Unicode number continuations. Unicode token matching is not multilingual subject or negation understanding; unsupported factual claims remain omitted and diagnosed.
- [ ] Rank supported facts by same-subject/current-claim agreement, then distinct selected-context overlap, then recency and stable ID. Nonfactual relevant themes may follow; allow at most one communication-style note without topic overlap, applied silently and subordinate to current preferences. Apply final cap three after filtering. Invalid or zero limits return none.
- [ ] Freeze the selected memories for the request; final provider budgets may reduce retention but cannot reintroduce rejected candidates. Pure direct-builder callers use the same selector and no DB writes. Preserve existing user-controlled save/remember/delete behavior and document the distinction between saving and automatic relevance selection.
- [ ] Run `node --test tests/readingMemorySelection.test.mjs tests/userMemory.test.mjs tests/userPersonalization.test.mjs tests/localComposerContextPriority.test.mjs`. Include no current topic, solely saved focus, conflict with explicit current preferences, expiry boundaries at fixed time and malformed keywords.

**Exit gate:** Current compatible evidence, not recency or raw lexical coincidence, determines which at-most-three memories may enter a request.

## Phase 4 — Final request and completion

### Task 7: Integrate provider, local, UI, and legacy retention contracts

**Files:** Prompt/provider/fallback and metadata/UI rows; `tests/knowledgeGraphContextPipeline.test.mjs`, `tests/graphRAGRetention.test.mjs`, `tests/promptContextRetention.test.mjs`, `tests/sourceUsageSummary.test.mjs`, `tests/narrativeBackends.test.mjs`, `tests/modalPromptBudget.test.mjs`.

**Interfaces:** Authoritative context and selected candidates/memories flow through the common builder; each attempt returns its own final usage and private memory retention. No discarded attempt's metadata is reused for the accepted result.

- [ ] Capture actual Claude `system/messages`, Modal chat messages and OpenAI `instructions/input` through transport stubs. Assert identical authoritative selection/provenance, safe partial/deck projections and selected memory identities before provider-specific budgeting. Exercise direct JSON, streaming, public jobs and MCP jobs with real internal handlers and mocked external boundaries.
- [ ] Render selected memories as complete request-local `memory-0`…`memory-2` blocks. Parse final blocks after budgeting and omit a memory atomically if it cannot fit. Keep slot-to-private-ID mapping server-side. Add exact guidance that current inputs override memories and at most one relevant remembered note is mentioned; communication preferences are applied silently.
- [ ] Normalize legacy references to verified structured registry records when possible. Otherwise omit the opaque block and report `unverified_reference_provenance`; never substitute `initialPassageCount` for final parsed retention. Summary-only means zero full passages; absent/incomplete blocks yield normalized zero with distinct parse status; verified indices refer to the selected payload after reordering.
- [ ] Separate counts for discovered/projected/scored/selected/retained references, direct highlights and memories. Track caller-interpretation retention separately from canonical card meaning and card reflections, including its redaction and budgeting. Record selected-deck/source tradition and scoring/fallback method accurately. Keep `budgetTrimmedTo` explicitly intermediate or rename/add a final field without breaking historical decoding. Ensure privacy sanitizers, prompt redaction and journal/UI summaries accept only bounded new fields.
- [ ] Preserve normal local composition's reasoning path and `graphRAG: not_used_by_backend`. Its pattern usage is actual rendered inclusion, not merely detected highlights. Audit lower-level no-reasoning fallback calls: any pattern synthesis there must use Task 3's safe highlights. Do not append canon references unless an existing explicit debug mode requests them, and do not label debug text as normal reading use.
- [ ] Make UI/journal reference display use final selected indices and projected identities. Keep the earlier five-passage context-independent preview labelled as preview; never substitute it when generation metadata is absent or counts disagree.
- [ ] Reproduce the ten-card, 1,000-character-per-card Japanese-note case and large valid custom spreads for every backend, slimming on/off. Expect honest per-provider retention, not identical surviving references. Cover summary-only, graph-disabled versus removed-for-budget, removed highlights, partial/unclosed delimiters, path clears, and memory removal. Unknown legacy counts must not become false precision.
- [ ] Run `node --test tests/knowledgeGraphContextPipeline.test.mjs tests/graphRAGRetention.test.mjs tests/graphRAGProvenance.test.mjs tests/promptContextRetention.test.mjs tests/promptEngineering.test.mjs tests/sourceUsageSummary.test.mjs tests/narrativeBackends.test.mjs tests/modalPromptBudget.test.mjs tests/readingContextTransport.test.mjs`.

**Exit gate:** Captured final payloads, public metadata and displayed sources describe the same accepted attempt without overstating model use.

### Task 8: Record memory inclusion only after accepted terminal completion

**Files:** `functions/lib/userMemory.js`, `functions/api/tarot-reading.js`, `src/worker/readingJob.js`; `tests/readingMemoryAccess.test.mjs`, `tests/userMemoryAccess.test.mjs`, `tests/readingJob.test.mjs`, `tests/readingJobRetention.test.mjs`.

**Interfaces:** Target contract 8; retain the internal route-to-job `onReadingMemoryUsage(usage)` callback rather than a public payload field. Add a private job-storage receipt containing accepted attempt identity, final retained IDs and fixed completion time, separate from public result/events.

- [ ] Test that rejected provider A, budget-omitted memories, evaluation replacement, crisis returns, cancelled jobs and safe fallback stamp nothing. Provider B can stamp only its own retained slots. A deterministic backend stamps only notes actually rendered.
- [ ] For direct responses, schedule the idempotent write only after the accepted final result and final abort check; completion means successful server finalization, not client observation. For jobs, stage usage privately and atomically persist accepted terminal result plus receipt after the cancellation/status guard before scheduling DB persistence. Cancellation before terminal commit removes pending usage.
- [ ] On object restart, resume only a pending receipt for a persisted successful terminal result. Replay the DB update with the original timestamp; never regenerate a reading. Clear/mark the receipt after success; bounded failure retries remain nonfatal and may expire with job retention. Status/SSE reads must not refresh timestamps.
- [ ] Scope every update to owner/global/unexpired rows and use a monotonic timestamp. Batch at most 98 IDs when two bindings are reserved for timestamp and owner; initial-reading selections are at most three. Expiry/deletion between selection and completion must be harmless. Do not rewrite historical access timestamps or rename the field as evidence of model reliance.
- [ ] Test cancellation immediately before and after terminal commit, duplicate completion, replay, object restart, provider fallback, D1 partial failure, wrong-user IDs and 98/99/100-item ordinary-memory loads. Preserve already delivered reading success if optional persistence fails; emit only fixed text-free diagnostics.
- [ ] Run `node --test tests/readingMemoryAccess.test.mjs tests/userMemoryAccess.test.mjs tests/readingJob.test.mjs tests/readingJobRetention.test.mjs tests/readingJobPrincipal.test.mjs tests/readingJobStream.test.mjs`. Require an independent reviewer for completion/replay/concurrency behavior before integration.

**Exit gate:** Durable jobs provide restart-resilient, idempotent inclusion accounting; direct-request best-effort persistence and its limits are documented separately.

## Phase 5 — Qualification

### Task 9: Freeze and pass deterministic regression qualification

**Files:** Candidate `tests/fixtures/knowledge-graph-context-cases.json`, `tests/knowledgeGraphContextQualification.test.mjs`, `scripts/evaluation/verifyNarrativePromptAssembly.js`; new `tests/fixtures/knowledge-graph-context-v2-cases.json`; `docs/knowledge-graph/REMEDIATION_LEDGER.md`.

**Interfaces:** Each fixture has stable ID, fixed reference time, deck/spread/cards, structured current inputs, synthetic memories, flags/tier, and expected invariants. Manifest includes source tree/commit, fixture bytes and order, corpus/projection hash, prompt/evaluator version, provider/model/settings, embedding mode and test commands.

- [ ] Preserve the candidate's old frozen corpus unchanged. Add a versioned fixture file for verified gaps: partial references in all decks, Major ties, mixed and excluded topics, negated memories, ranking scaffolding/repetition, MCP fields, legacy counts, enrichment integration and completion restart.
- [ ] Exercise all 30 pairs × both orders × four orientation combinations, ten complete triads, the actual full-corpus deck matrix, all 21 passage caps, 78-note classification, final three-provider builds, quality/bypass/flag modes, and deterministic local composition. Counts are computed from the frozen manifest; do not silently drop failed fixtures.
- [ ] Extend the prompt-assembly gate through real resolution, context, detection, enumeration, projection, selection and final builders. Confirm memory/path fixtures actually reach their intended code paths; a fixture silently stripped by schema is a failed test. Block unstubbed network calls and verify no secrets are loaded.
- [ ] Verify the existing output quality/evaluation boundary with fixed synthetic provider outputs: explicit undrawn card, deck-alias equivalence, foreign scene without a card name, unrelated memory, and irrelevant-but-structurally-valid prose. Record what deterministic gates detect and what requires editorial judgment. Existing spread-dependent hallucination allowances must not be misrepresented as zero-tolerance protection; release editorial criteria below remain stricter.
- [ ] Run `npm test`, `node --test functions/__tests__/knowledgeGraph.test.js`, `node scripts/evaluation/verifyNarrativePromptAssembly.js`, `npm run lint`, `npm run build`, `npm run docs:check`, and `git diff --check`. Keep independent-review results and identify pre-existing failures against the captured base. The maintained docs checker excludes plan directories; validate plan links separately.
- [ ] Obtain a fresh independent whole-change review after integration, including enrichment, legacy compatibility, memory subject/negation boundaries, job completion and source-usage consumers. Preserve failed probes and fix/retest under a new source identity when necessary.

**Exit gate:** Every requirement maps to passing final-source deterministic coverage, with no unclassified failures. This gate alone does not establish useful generated readings.

### Task 10: Complete editorial and bounded live qualification

**Files:** `docs/knowledge-graph/CANON_PROJECTION_REVIEW.md`, `docs/knowledge-graph/QUALIFICATION_STATUS.md`, `scripts/evaluation/runNarrativeSamples.js`, new versioned qualification manifests under the local evidence directory.

**Interfaces:** Separate lanes for authored-text editorial review, subscription generation, real embedding relevance/performance, and provider input-limit verification. No lane's success substitutes for another.

- [ ] Finish human editorial review of every active full-passage meaning-only projection and all 30 partial meanings, including conditional language, deck identity, source claims and context variants. Agent checks prepare the checklist but do not mark human approval. Any edited projection invalidates its previous approval/hash until rereviewed.
- [ ] Run the required `npm run ci:narrative-check` on the final candidate through existing subscription authentication when execution includes that authorization. Preserve artifacts before any rerun. Missing login/usage availability is an unrun or failed gate, not permission for paid fallback or a reason to erase old failures.
- [ ] Prepare a new bounded comparison manifest: eight scenarios × three decks = 24 cases, one baseline and one candidate reading each = **48 outputs maximum for the initial comparison**. Scenarios: partial arc, complete arc control, long-note conflict, named decision, older relevant memory, multilingual retrieval, mixed-topic reflection, negated remembered fact. Freeze case order, baseline/candidate source identities, model/settings and reference time. Keep old 18-case evidence separately; reuse outputs only on exact matching identity, never merely matching a title.
- [ ] Run the comparison only under explicit execution authorization for that bounded lane. Capture final prompts, provider-reported usage, output/failure state, source usage and editorial verdicts. Do not silently rerun failures, omit failed cases, or increase the count; record a separately bounded repair run if needed.
- [ ] Require no undrawn-card assertions, no foreign scenes attributed to drawn artwork, correct question/path/current-note framing, no irrelevant or wrong-subject memory disclosure, accurate attribution, and no regression in ethics/card coverage/depth. Grade usefulness as well as correctness: meaningful card interpretation and practical optional direction, not only source retention. Human review must distinguish an alias mapping from an invented card and an archetypal theme from a claimed life event.
- [ ] In a separately authorized Workers AI lane, measure final-source relevance, cache behavior, embedding failures, candidate latency and p95 retrieval time against the 3,000 ms work budget. Include current full corpus and approved-enrichment growth. Real embeddings must improve or preserve the reviewed case outcomes; mocked vectors alone establish mechanics.
- [ ] Verify Modal's actual serving model/context window, tokenizer, output reserve and truncation policy from its deployment configuration, then bounded provider probes. For accepted large requests, require full acceptance or an explicit overflow failure that triggers controlled fallback; silent truncation fails qualification. If a serving limit requires an application cap, add a provider-specific configured cap using that verified limit and output reserve, rerun Task 7/9, and record the intentional policy change. Do not invent an arbitrary cap or claim uncapped safety from HTTP success.
- [ ] Refresh `QUALIFICATION_STATUS.md` with final identities and exact passed/failed/pending lane counts. Production flags/bindings and live provider behavior remain unknown until checked in the separately authorized release stage.

**Exit gate:** Editorial approval and final-source generated-reading evidence support card/deck/question/memory fidelity; provider limits and retrieval performance are understood. Any missing required lane leaves the candidate unqualified for release.

## Phase 6 — Release handoff

### Task 11: Document, integrate, release, and verify each stage separately

**Files:** `docs/knowledge-graph/README.md`, `docs/knowledge-graph/ARCHETYPAL_TRIADS.md`, `docs/context_personalization.md`, relevant API/MCP contract documentation, `functions/lib/promptVersioning.js`, the ledger and qualification status.

**Interfaces:** Versioned contracts, qualification manifest and exact release source identity. New metadata remains additive; old consumers must tolerate missing fields. No D1 schema migration is expected for private job receipts or reuse of existing access timestamps.

- [ ] Update maintained docs for both graph paths, current-source precedence, mixed-span query projection, partial/deck projection, canonical meaning authority, decision fields, full candidate ranking, memory inclusion semantics and limitations, MCP parity, local-composer behavior and final usage interpretation.
- [ ] Bump the reading prompt version to the next unused version on the integrated branch; candidate 1.3.0 is historical, not a guaranteed available target. Bump the evaluator version if its rubric changes. Record behavior changes to meanings, ranking and initial-reading memory timestamps explicitly.
- [ ] Complete the concrete integration review with source diff, tests, editorial results, generated-reading evidence, privacy-preserving telemetry examples and known limits. Commit/push/merge only within the user's authorized execution stages; writing this plan performs none of them.
- [ ] Before a separately authorized deployment, preserve the previous release source and active Worker version, confirm actual GraphRAG/semantic flags and AI binding, and run the local release/deployment workflow. Do not infer production configuration from `wrangler.jsonc` or infer release success from a push.
- [ ] Verify the active Worker version and live assets, then an authorized controlled direct/job reading with known source identity. Check context provenance, reference/memory retention, provider fallback, errors and relevant latency separately. Report application deployment and actual reading behavior as different evidence.
- [ ] Define rollback against the recorded previous Worker/source version. New private receipt keys and additive metadata must be safe for older readers to ignore; receipts cannot trigger generation. Monitor unresolved receipt failures, empty projections, unexpected zero-Major counts, fallback rates and context-source drift without logging private inputs.

**Exit gate:** Approved source, deployed identity, live behavior and rollback evidence are recorded independently. A code-only merge or prompt preview cannot close the release ledger.

## Completion checklist

- [ ] All F1–F8 and V1–V8 requirements have final-source tests and documented outcomes.
- [ ] All partial highlights and references use matched-only meanings; all Major counts are correct independently of journey detection.
- [ ] Full accepted inputs inform one authoritative context decision; query omissions are explicit and mixed/negated context tests pass.
- [ ] Decision/API/MCP contracts, canonical meanings and source provenance are documented and consistent.
- [ ] Full eligible ranking is bounded and reproducible; tiers affect final allowance rather than candidate recall.
- [ ] Relevant compatible memories alone can survive; accepted-attempt retention and completion accounting agree.
- [ ] Provider, local composer, UI and legacy metadata distinguish selected content, final inclusion and actual deterministic rendering.
- [ ] Deterministic checks, independent review, human editorial review and authorized live qualification are complete for the final source identity.
- [ ] Deployment/live verification is complete only if that stage was authorized; otherwise the deliverable is explicitly a qualified implementation awaiting release.

## Planning validation

The plan was self-reviewed against both supplied reviews, the first verification's corrections, and the second review's independently checked unique claims. Every F/V row maps to an implementation task and acceptance tests. The dependency order preserves graph projection before ranking and final retention before memory completion accounting. There are seven phases, twelve tasks and 92 checklist items. All three Markdown links resolve; 107 referenced paths were checked: 84 exist in the primary checkout, 18 in the candidate, and five are explicitly planned additions. No trailing whitespace was found. All 91 pre-existing modified/untracked files retained their starting hashes; the only added path was this plan. These planning checks and offline claim probes do not qualify implementation or authorize live calls.
