# GraphRAG Complete Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task, or `superpowers:subagent-driven-development` if delegated execution is selected. Track the steps with the checkboxes below. This document specifies future implementation; the current request authorizes writing the plan.

**Goal:** Resolve all five reviewed GraphRAG findings while preserving useful graph patterns, canon and approved enrichment, reading depth, selected-deck fidelity, subscription limits, provider availability, and accurate source accounting.

**Architecture:** Extend the existing candidate pipeline, share conservative lexical normalization and score composition, cover every registry-backed pattern in summaries, and make GraphRAG an atomic guarded section through final prompt assembly. Keep one selected variant per pattern and derive retained references from the final accepted provider prompt. Qualify scoring changes against fixed relevance judgments before release.

**Tech Stack:** JavaScript ESM, Cloudflare Workers, React consumers of reading metadata, Node's test runner, the existing Workers AI embedding adapter, and the existing subscription-backed narrative qualification tools. No new runtime dependency, database migration, vector database, or production evaluation service is required.

**Spec:** The [design contract](#design-contract), [capability preservation requirements](#capability-preservation-requirements), and [finding-to-task map](#finding-to-task-map) in this document are the implementation specification. The [reading input contract](../../reading-context-inputs.md) and [existing qualification record](../../knowledge-graph/QUALIFICATION_STATUS.md) remain applicable.

**Reviewed source:** `a2b7d7f6b8af5bf97a435d81b5e6d26c389a5b0a`, inspected locally on 2026-10-24. The preceding review ran 203 focused tests successfully and 980 structured-prompt budget probes without reproducing the proposed final-overflow failure. It did reproduce the GraphRAG-only empty-result fallback defect. These results establish the starting behavior, not qualification of the changes below. All implementation tasks are pending.

## Global constraints

- Preserve ESM, two-space indentation, single quotes, and terminal semicolons. Keep changes focused on the files and interfaces below.
- Preserve the explicit graph enablement flags and their precedence. Disabled GraphRAG must not retrieve, embed, regenerate graph content, or inject a summary.
- Preserve paid passage caps: single 1; three-card 2; five-card 3; decision 3; relationship 2; Celtic Cross 5; general 3. Free uses half rounded down, minimum one. Plus and Pro remain equal. Candidate eligibility is separate from the final allowance.
- Preserve registry re-verification, matched-only partial-triad projection, selected-deck projection before scoring, full-text deduplication, and one variant per pattern. Enrichment requires its existing human approval; cross-deck enrichment also requires approved meaning-only projection.
- Preserve the default relevance threshold of 0.3, the explicitly labeled one-passage weak-match floor, priority-only retrieval, and quality-filtering bypass. A context label alone does not establish textual relevance or a personal fact.
- Preserve all-candidate scoring and whole-set semantic fallback. Keep the three-second embedding deadline, 100 texts per batch, maximum two concurrent batches, 8,000-character embedding inputs, 100-entry cache, and 1,000-passage registry bound. Do not hide added work with a preselection cap.
- Preserve provider order and configured subscription modes. Claude API, Modal Qwen, OpenAI Responses, local composition, streaming, reading jobs, cancellation, and retries retain their existing availability and acceptance contracts.
- Preserve default soft/hard budgets: Claude 16,000/25,000; OpenAI 12,000/20,000. Modal has no application token cap. Soft slimming remains opt-in. Use one request-local estimator configuration if the parallel estimator remediation is integrated.
- Preserve question, reflections, card notes, positions, reversals, effective decision labels, eligible personalization, memory receipts, ethics, and final writing instructions. Removing a malformed optional graph block must not remove those inputs or invalidate the whole reading.
- Keep raw query text, passage text, embedding vectors, source URLs, and personal details out of ordinary telemetry. New diagnostics use bounded counts, booleans, and fixed enums.
- Preserve historical readings, approved editorial records, provenance, and previews. This plan does not rewrite saved readings or apply the real enrichment queue as a test.
- Use an isolated worktree for implementation because the primary checkout contains unrelated journal/UI work and another untracked remediation plan. Inventory and preserve the actual checkout state at execution time; do not rely on a historical dirty-file list.
- Run local verification; GitHub Actions billing is unavailable and Actions success is not required. Narrative generation gates use the owner's Claude subscription, never a paid API fallback. Record unrun or failed qualification honestly.

## Relationship to the existing remediation plan

The [Reading Pipeline Correctness Remediation plan](2026-10-24-reading-pipeline-correctness-remediation.md) addresses a broader, separate set of findings. Preserve its pending work and integrate overlapping files deliberately.

This plan supersedes only its requirement to retain the single-Major-only retrieval path: Task 1 below intentionally makes per-card references eligible for every distinct drawn Major. Its one-variant-per-pattern requirement remains in force. Its context tie-breaker and 0.3 threshold also remain; Task 4 below proposes a separately qualified change to semantic score composition.

Reuse that plan's request-local estimator interface if implemented first; do not create a second environment-resolution policy in the truncation work. Coordinate enrichment-generator edits with its approval-validation/revocation task. Coordinate preview propagation with its preview task; neither plan may restore RWS defaults for non-RWS readings. Task 8 owns a separate `graph-rag-remediation-v1` fixture corpus consumed by the same qualification manifest; preserve the historical v1/v2 corpus files and the other plan's pending v3 corpus. Task 8 also owns the reading-prompt version update for these changes. Do not treat this document as completion of the other plan's findings.

## Review focus

1. **A multi-Major spread with an existing strong relationship pattern:** newly eligible individual cards must not remove that pattern from enumeration, outrank it merely by a new structural priority, or consume duplicate slots. Task 1 owns the controls.
2. **An enriched variant with strong apparent relevance but unapproved cross-deck prose:** it must be excluded before scoring while compatible canon remains usable. Tasks 1 and 2 own the controls.
3. **Short words, vocabulary variants, multilingual semantic matches, and misleading topic labels:** recall improvements must not promote unrelated or explicitly excluded subject matter. Tasks 3 and 4 own the controls.
4. **A budget cut immediately after a reference closes but before its guardrails finish:** the complete block must survive or the entire block must be removed, with adjacent instructions retained. Tasks 6 and 7 own the controls.
5. **A reordered payload, a rejected provider attempt, and an older saved reading:** new retention indices must identify the accepted prompt only, while historical narrative and preview functionality remain available. Tasks 7 and 8 own the controls.

## Finding-to-task map

| Finding | Verified scope and disposition | Owner | Required evidence |
| --- | --- | --- | --- |
| F1: per-card Major passages unavailable with multiple Majors | Confirmed eligibility gap. The current generated enrichment export is empty, so production enrichment loss is not established. Extend eligibility for canon and approved enrichment. | Tasks 1, 8 | Every distinct drawn Major is eligible; multi-card families, ranking, caps, and deck rules still work. |
| F2: enrichment displaces canon in selection | Current selection deliberately allows one variant per pattern; tests explicitly require competition. Preserve both in the registry and correct the misleading generator/documentation wording. | Tasks 2, 8 | Canon survives merge; either variant can win on relevance; same pattern never takes two slots; regenerated comments agree with behavior. |
| F3a: short words and inflections score zero | Confirmed. Queries with no remaining terms currently enter priority mode rather than universally failing the threshold. Improve normalization without changing reader wording. | Task 3 | Positive lexical examples, substring/negation controls, and empty-query/priority/bypass behavior. |
| F3b: semantic matches are penalized by zero lexical overlap | The arithmetic is confirmed; a different scoring policy requires actual relevance qualification. Use the proposed semantic-primary formula only after Task 4's acceptance criteria pass. | Tasks 4, 8, 9 | Mathematical boundary tests plus fixed, independently judged relevance cases using real embedding evidence. |
| F3c: context contributes only a tie-breaker | Intentional safeguard: a topic label is weak evidence. Retain it; support known vocabulary variants and semantic matches without granting every same-topic passage a passing score. | Tasks 3, 4 | Exact-context synonyms can match when content supports them; metadata-only matches remain weak or excluded. |
| F3d: duplicated synchronous lexical calculation | Confirmed minor inefficiency. Calculate once and reuse the result. | Task 3 | Identical public score fields and no extra embedding/provider work. |
| F4: summary omits four pattern families | Confirmed for isolated major-arcana, emerging progression, Thoth suit, and Marseille numerology candidates. Ordinary single-Major spreads may still retain their journey signal. | Tasks 5, 8 | All supported families survive summary mode when space permits; invalid identities cannot manufacture signals. |
| F5a: incomplete GraphRAG through truncation | Reproduced through the empty-result fallback when the helper receives only a GraphRAG block. The reported final-overflow route was not reproduced; the main builder removes GraphRAG before hard truncation. Harden every return path without claiming an observed production exploit. | Task 6 | Budget-boundary sweeps, isolated helper reproduction, and actual builder fixtures all yield complete guarded blocks or none. |
| F5b: telemetry can disagree with malformed content | Final metadata counts complete references, but the full parser does not verify trailing guardrails. Remove malformed sections before accounting and preserve text-free removal diagnostics. | Tasks 6, 7 | Zero residual graph prose on an integrity rejection; correct final mode/count/indices and accepted-attempt accounting. |

## Design contract

### Approach and tradeoffs

Use targeted extensions to the existing pipeline. A broad retrieval rewrite, unconditional context bonuses, lower global thresholds, or additional per-pattern variants would change unrelated ranking and token behavior. Those approaches are excluded from this implementation. Merely changing comments would leave eligibility, lexical, summary, and integrity gaps open.

The decisions below are this plan's proposed implementation contract. They do not imply earlier user approval of a scoring policy or authorization to run live providers. Exact selected references may change because better candidates become eligible; preserving functionality means maintaining capability, coverage, safety, and useful output under the same caps, not freezing every old ranking.

### Candidate identity and Major eligibility

Add `graphKeys.majorNumbers`, a sorted, distinct array of canonical integers from 0 through 21 derived from the actual cards, independent of journey detection. Preserve `totalMajors` and the legacy `singleMajorNumber`/`singleMajorName` fields for compatibility; this change must not silently redefine the existing total's slot-count meaning.

In `collectPassageCandidates()`, use a supplied `majorNumbers` array as the authority for individual-Major enumeration. An explicitly supplied empty array stays empty; a present non-array value admits no individual Major and must not fall back to contradictory legacy keys. If the property is absent, retain the existing valid single-Major fallback. Reject malformed array members individually, deduplicate valid members, and never infer membership from a pattern title, count, or missing triad card. Normal request entrypoints build these keys from canonical resolved cards rather than trusting new client claims.

Keep the single-Major structural priority at 2 and its journey priority at 3 when `totalMajors === 1` and exactly one valid individual identity is resolved. Assign other newly eligible per-card candidates priority 7, after the existing pattern priorities 1–6. Leave relevance/context ordering unchanged: a demonstrably more relevant per-card reference can win, but equal evidence does not gain preference just because it is new. Preserve existing candidate IDs, projection IDs, and pattern keys. New fields are additive.

### Canon and enrichment semantics

Canon and approved enrichment supplement the eligible registry. At retrieval time, their projected variants compete for one pattern slot. Neither source has an unconditional selection entitlement. Never overwrite or remove hand-written canon to make enrichment visible, and never split the pattern key by source/context to force multiple variants into a bounded prompt.

Replace the generated comment in both its template and generated output with: “Approved context-specific passages supplement the eligible registry without replacing hand-written canon. Retrieval selects one variant per pattern according to relevance, context, and the passage budget.” Regenerate or patch only that header from the existing compiled export; do not invoke the live review queue for a documentation change.

### Lexical evidence and semantic score composition

Introduce retrieval-specific normalization in `functions/lib/graphRAGLexical.js`. Reuse `normalizeContextWords()` for recognized plurals; apply NFKC and Unicode whole-token matching to both passage and query. Keep content words of at least three Unicode code points and a reviewed stop-word set. Explicitly cover `job`, `law`, `art`, `end`, `joy`, and `new`. Add narrow inflection aliases `grieving → grief` and `working → work`; do not equate entire context categories or stem arbitrary words. Keep original query/passage text unchanged for embeddings, prompts, display, and provenance. This is bounded vocabulary normalization, not general multilingual language understanding.

Retain query deduplication and the matched-query-term ratio. Exclude existing scaffolding labels as today. No usable query terms means priority mode unless semantic vectors are successfully available. Unknown synonyms with no measured support remain weak; an exact `questionContext` match remains a tie-breaker, not an automatic threshold pass.

For successfully validated semantic vectors, propose `score = s + 0.3 * k * (1 - s)`, where `k` is lexical overlap in `[0, 1]` and `s` is finite cosine similarity in `[-1, 1]` (clamp only floating-point excursions). This lets semantic evidence stand on its own while lexical overlap adds bounded corroboration. Keep the threshold at 0.3. Examples: `(k=0,s=0.4) → 0.4`; `(0,0.2) → 0.2`; `(1,0.4) → 0.58`; `(1,-0.2) → 0.16`. Negative semantic evidence does not become a context-based pass.

This formula is a proposal requiring Task 4 qualification, not an established quality improvement. If its held-out precision/preservation controls fail, the scoring task and release remain incomplete; do not silently relax the rubric or claim the original weighting concern is resolved. Deterministic fixes can be reviewed independently with the scoring qualification status explicit.

Share the default composition between batch retrieval and `scorePassageRelevance()`. Preserve callers that explicitly supply `keywordWeight` or `semanticWeight`: those calls continue to use the existing weighted formula. Whole-set embedding failure still yields lexical or priority ranking for every candidate. Disabled quality filtering performs no scoring. No new provider/model request is introduced by score composition itself.

### Complete summary coverage

Derive summary facts from distinct, successfully projected registry candidates, independent of the final passage cap. Support complete/partial triads; high, medium-high, and medium dyads; court lineages; strong and emerging suit progressions; journey stages; distinct Major-card references; Thoth suit patterns; and Marseille rank patterns. Use a shared family classifier so renderer and additive coverage telemetry cannot diverge.

A summary can describe detected patterns whose passages were not retained. Keep that distinction explicit: summary mode always has zero retained passage indices and zero quoted passages. Only validated pattern IDs contribute; cached `retrievalSummary` prose and counts have no authority. Retain the security note and complete card guardrail. If a complete guarded summary cannot fit, omit it under the existing budget rules rather than cutting it.

### Atomic prompt sections and truthful accounting

Create `functions/lib/narrative/prompts/graphRAGPromptIntegrity.js` for shared markers, guardrail text, parsers, and final integrity enforcement. It must not import the prompt builder or renderer. Preserve existing parser exports through re-exports from `buildEnhancedClaudePrompt.js` to avoid breaking callers.

Keep the current readable headings and `<reference>` delimiters. Add trusted envelope markers around the entire generated full or summary section, including every trailing guardrail: `<!-- graphrag:full:start -->` / `<!-- graphrag:full:end -->` and corresponding `summary` markers. When a graph section is present, `buildUserPrompt()` also inserts the reserved marker `<!-- reading-instructions:start -->` immediately before the real instruction header. The renderer must neutralize every reserved graph/instruction marker inside reference data before inserting its own markers, including whitespace/case variants recognized by the parser. Preserve original authored/display text; escaping changes only prompt rendering. Serialized user context already escapes angle brackets. Identify generated markers at line boundaries; marker-looking user/reference data must never create a trusted boundary.

`parseGraphRAGReferenceBlock(text)` retains its existing fields and adds `guardrailsComplete`. A new full block is complete only with a well-formed envelope, closed reference, security note, complete card guardrail, and required partial/weak-match instructions. `parseGraphRAGSummaryBlock(text)` retains `present`/`complete` and requires the full summary envelope, signals, security note, and complete guardrail. Test cut-off guardrail bodies, not just presence of their labels. Parsing an old diagnostic string may report incomplete; this must not retrospectively erase saved historical reading data.

`enforceGraphRAGPromptIntegrity(text, { expectedPassages = [] } = {})` returns `{ text, changed, removedBlockCount, removalReasons }`. Required partial/weak guardrails come from re-verified expected passages, with visible per-passage weak labels also checked. Unknown, duplicate, nested, unclosed, or guardrail-incomplete generated graph sections are removed as whole sections. GraphRAG remains immediately before the final instructions, as in the current builder. If its closing envelope is missing, remove through the reserved `reading-instructions:start` boundary, excluding that boundary and its suffix from removal; if that boundary is absent, remove the graph suffix through end of input. Never infer a recovery boundary from a plain footer-looking line or a heading inside the reference. This grammar is safe because only the constructor may emit an unescaped reserved footer marker. Arbitrary malformed legacy helper strings without a reserved boundary cannot establish a trusted suffix; actual newly built prompts always carry it.

Section packing must reserve GraphRAG as one indivisible value. For the new format, section splitting and instruction fitting use the reserved footer marker rather than a plain header match inside reference prose. Keep that marker with any retained instruction block until final integrity enforcement is complete, and include its token cost in reservations. Every prefix fallback excludes the graph segment before slicing; a graph-only helper input returns either its complete guarded section or an empty string. Every return path, including the user-context allocation branch, checks the final assembled token estimate. If concatenation exceeds budget, repack with a reduced budget and preserve the existing section priorities; do not slice the assembled graph or drop unrelated context by broad regular expression. Bound repacking and finish with the largest safe priority-ordered result. Record the small envelope/boundary overhead in budget comparisons; do not enlarge caps or conceal a boundary-driven retention change.

Apply final integrity enforcement before token totals, GraphRAG parsing, source usage, memory retention, and provider handoff are finalized. Valid complete blocks remain byte-for-byte unchanged. An integrity removal leaves no graph header, envelope, reference text, or graph-specific trailing instructions, while preserving other sources. Keep the main builder's existing full → trimmed → summary → omitted budget sequence.

Add bounded diagnostics: `integrityRemovedBlocks` (count), `integrityRemovalReasons` (fixed enum array), and `referenceGuardrailsComplete` (boolean when measured). Allowed reasons are `unclosed_reference`, `missing_envelope_end`, `missing_security_note`, `missing_card_guardrail`, `missing_partial_guardrail`, `missing_weak_guardrail`, `incomplete_summary`, and `invalid_envelope`. Record these before removal; report `parseStatus`, `includedInPrompt`, mode, counts, and indices from the sanitized final prompt. Use `reference_integrity_failed` as a source-usage omission reason, with reader copy “Reference passages could not be included.” Historical records lacking new diagnostics keep those fields absent.

## Capability preservation requirements

| Capability | Required positive and negative controls | Owner |
| --- | --- | --- |
| Multi-card insight and reading depth | Existing triad/dyad/journey/court/suit candidates remain available; equal-evidence structural order is preserved; relevant individual Majors may win without increasing caps. Generated comparisons retain useful card relationships. | Tasks 1, 8, 9 |
| Canon and enrichment | General canon survives merge, context-specific enrichment can win, canon can still win, and unapproved cross-deck enrichment cannot suppress a valid canon option. Actual approval/provenance data stay intact. | Tasks 1–2 |
| Deck fidelity and missing-card safety | All three decks, aliases, complete triads, all 30 partial pairs, reversed cards, and Minor-only spreads retain their existing safeguards and interpretive inputs. | Tasks 1, 5, 8 |
| Relevance without invented circumstances | Short-word/inflection positives improve; substring, excluded-topic, unrelated, and context-label-only negatives remain excluded or explicitly weak. Foreign-language semantic fixtures never imply full product-language support. | Tasks 3–4, 9 |
| Availability and cost bounds | No new inference service; one query embedding shared across all candidates; bounded batches/deadline; partial failures fall back coherently; cancel and disabled/bypass paths avoid extra work. | Tasks 1, 4, 8 |
| Prompt content and guards | Complete blocks survive when they fit; malformed blocks are atomic removals; question, reflections, cards, personalization, memories, ethics, and footer controls survive according to existing priorities. | Tasks 6–8 |
| Previews, journals, and source display | Preliminary previews use the selected deck/context; historical narratives/previews stay readable; only accepted full-reference indices appear as generation sources; summary mode never masquerades as quoted passages. | Tasks 7–8 |
| Privacy and receipts | Fixed diagnostic enums only; no prompts/vectors/URLs in ordinary telemetry; removed/rejected references and unretained memories cannot claim usage or stamp access. | Tasks 7–8 |

## Implementation tasks

### Task 1: Enumerate every drawn Major without weakening pattern selection

**Files:** Modify `functions/lib/graphContext.js`, `functions/lib/graphRAGCandidates.js`, `functions/lib/spreadAnalysis.js`, and `functions/lib/graphRAG.js`. Extend `tests/graphContext.test.mjs`, `tests/graphRAGCandidateSelection.test.mjs`, `tests/graphRAGEnrichmentProjection.test.mjs`, and `functions/__tests__/spreadAnalysis.test.js`.

**Interfaces:** `buildGraphContext(cardsInfo, options)` adds `graphKeys.majorNumbers: number[]`. `collectPassageCandidates(graphKeys, options)` accepts that field and preserves its returned array/statistics contract. `retrievePassages()` and `retrievePassagesWithQuality()` retain their signatures.

- [ ] Add failing cases for one Major, `[0,8]` with no journey winner, `[13,14,17]`, mixed Minor/Major spreads, duplicate Major slots, invalid numbers, empty arrays, and legacy keys without `majorNumbers`. Assert distinct eligibility, canonical matched-card metadata, and unchanged legacy fields.
- [ ] Add a synthetic approved enrichment case on one card in a multi-Major spread. Assert same-deck eligibility, cross-deck approval rejection/acceptance, and availability of canon when the enriched projection is rejected. Restore the in-memory registry after each test.
- [ ] Run `node --test tests/graphContext.test.mjs tests/graphRAGCandidateSelection.test.mjs tests/graphRAGEnrichmentProjection.test.mjs functions/__tests__/spreadAnalysis.test.js` and retain the expected new failures.
- [ ] Implement the Major-key contract and priorities. Pass selected `deckStyle` and the available authoritative `questionContext` into preliminary display retrieval; coordinate this small propagation change with the older plan's preview task rather than creating a competing preview implementation.
- [ ] Assert unchanged ordering among pre-existing candidates when new candidates have equal or weaker evidence; a strongly relevant new Major can still win. Assert all paid/free caps, invalid limits without embeddings, and no new per-source pattern slots.
- [ ] Update registry enumeration/performance fixtures to include all 22 Majors and derive corpus counts from the actual registry instead of the old fixed `<=145` assumption. Keep the existing registry bound and batch/deadline limits.
- [ ] Re-run the focused command and deck/partial-projection suites. Record a scoped checkpoint with the Major eligibility contract documented.

**Acceptance:** Every canonical drawn Major is discoverable; existing graph families remain discoverable; invalid/missing-card identities are not introduced; final caps and projection rules hold across all three decks.

### Task 2: Make enrichment documentation and tests express the actual contract

**Files:** Create `tests/enrichmentApply.test.mjs` if it has not already been added by the older plan's enrichment task. Modify `scripts/enrichment/applyPassageCandidates.js`, the header of `functions/lib/knowledgeBaseEnrichment.js`, and `docs/knowledge-graph/README.md`. Extend `tests/graphRAGEnrichmentProjection.test.mjs`. Retain `mergeEnrichedPassages()` in `functions/lib/knowledgeBase.js` unless a new test exposes an actual contract defect.

**Interfaces:** No runtime selection or public API change. The generator and compiled header use the exact wording in the design contract.

- [ ] Add generator-output assertions for the corrected contract, and selection cases where either canon or approved enrichment wins. Assert exactly one retained variant per pattern and unchanged hand-written canon bytes/entries.
- [ ] Run `node --test tests/enrichmentApply.test.mjs tests/graphRAGEnrichmentProjection.test.mjs`; distinguish the new header failure from already-passing intentional selection behavior.
- [ ] Correct the generator template and generated header without reading/applying the real review queue. Preserve the compiled export and provenance data exactly.
- [ ] Document that registry supplementation differs from prompt co-inclusion; approved enrichment remains optional, context-specific, and independently reviewed for cross-deck use.
- [ ] Re-run the focused command, verify a generated temporary module imports, and check that repeated generation cannot restore the misleading comment. Record a scoped checkpoint.

**Acceptance:** Documentation, generated comments, merge behavior, and selection tests agree; no canon, enrichment, or unrelated graph pattern loses a supported path.

### Task 3: Normalize lexical evidence conservatively and once

**Files:** Create `functions/lib/graphRAGLexical.js` and `tests/graphRAGLexical.test.mjs`. Modify `functions/lib/graphRAGCandidates.js` and `functions/lib/graphRAG.js`. Read and reuse `functions/lib/readingContextVocabulary.js`; avoid altering shared context-detection semantics incidentally.

**Interfaces:** New `normalizeRetrievalTerms(text) -> string[]` performs the shared passage/query normalization. Keep the existing exported `retrievalQueryTerms(query) -> string[]` and `scoreKeywordRelevance(text, query) -> number` signatures, delegating to the new module. Preserve stop-word/label filtering as a query concern.

- [ ] Add failing assertions: `scoreKeywordRelevance('job', 'job') === 1`; `('job','jobs') === 1`; `('boundary','boundaries') === 1`; `('grief','grieving') === 1`; all six named three-letter words remain usable. Test NFKC, punctuation, mixed case, repeated terms, and the explicit `working/work` alias.
- [ ] Add preservation controls: `rest` must not match `interests`; `art` must not match `partner`; empty/stop-word-only queries enter priority mode; the raw query, passage, negation, dates, and Unicode are unchanged outside scoring. Do not turn `new` alone into a whole-topic classifier.
- [ ] Run `node --test tests/graphRAGLexical.test.mjs tests/graphRAGCandidateSelection.test.mjs tests/contextDetection.test.mjs` and retain the failing cases.
- [ ] Implement the shared normalization and compute the synchronous keyword score once per candidate, reusing it for `relevance` and `relevanceScore`. Cache normalized query terms once per retrieval operation where practical; do not add a cross-request cache containing user text.
- [ ] Add sync/async lexical-fallback parity, exact-context unknown-synonym weak-floor behavior, and `DISABLE_QUALITY_FILTERING` controls. Context evidence must not be manufactured by inserting the context label into the query.
- [ ] Re-run the focused tests plus `tests/graphRAGFallback.test.mjs` and `tests/graphRAGPatternCoverage.test.mjs`. Record a scoped checkpoint.

**Acceptance:** Known lexical variants and short content words match without substring expansion, altered reader text, changed context precedence, or loss of priority/bypass modes.

### Task 4: Qualify semantic-primary scoring and preserve fallback semantics

**Files:** Create `functions/lib/graphRAGScoring.js`, `tests/graphRAGScoring.test.mjs`, `tests/fixtures/graph-rag-relevance-cases.json`, and `scripts/evaluation/verifyGraphRAGRelevance.js`. Modify `functions/lib/graphRAG.js`; extend `tests/graphRAGCandidateSelection.test.mjs` and `tests/graphRAGFallback.test.mjs`. Add a qualification section to `docs/knowledge-graph/QUALIFICATION_STATUS.md` during execution.

**Interfaces:** `composeRelevanceScore({ keywordScore, semanticScore = null }) -> number` implements the proposed formula; null semantic score returns the lexical score. Invalid semantic vectors are handled by the existing whole-set fallback before composition. Explicit custom-weight `scorePassageRelevance()` calls retain their current formula. The offline evaluator consumes the fixed fixture JSON and frozen embedding evidence and emits per-case IDs, score components, selected IDs, recall, false positives, and baseline/candidate differences.

- [ ] Freeze fixtures before tuning: relevant paraphrases, multilingual retrieval strings, short-word/plural cases, exact-context but unrelated passages, negated/excluded topics, mixed topics, partial triads, cross-deck projections, and common-word collisions. Each case includes canonical cards, deck, accepted query, expected relevant/irrelevant candidate IDs, and a written judgment rationale independent of the score.
- [ ] Add exact numeric boundary tests from the design contract, values immediately around 0.3, negative cosine, perfect similarity, and custom-weight compatibility. Add an integration case with a valid mocked cosine of 0.4 and zero lexical overlap that must survive the default threshold.
- [ ] Run `node --test tests/graphRAGScoring.test.mjs tests/graphRAGCandidateSelection.test.mjs tests/graphRAGFallback.test.mjs` against the old composition and preserve the intended failures.
- [ ] Implement shared composition and default-policy parity across batch and standalone scoring. Do not mix successful semantic candidates with lexical-only candidates after any failed vector. Preserve weak-floor flags, context tie-breakers, bypass, no-query, no-provider, timeout, cancellation, and registry-overflow diagnostics.
- [ ] Make `node scripts/evaluation/verifyGraphRAGRelevance.js --fixtures tests/fixtures/graph-rag-relevance-cases.json --embeddings <frozen-evidence-path> --json` fail when evidence is missing or mismatched. The evaluator has no implicit live-provider mode. Record embedding model, source/corpus/query hashes, selected deck, projection version, case order, and provider metadata.
- [ ] For real relevance qualification, reuse matching saved evidence where possible. If missing, prepare a bounded Workers AI capture: one embedding per distinct query/projected text, existing batch/concurrency limits, explicit maximum input count, no hidden retries, and no narrative generation. Run it only as an authorized provider-evaluation stage; mocked cosine tests alone cannot qualify semantic relevance.
- [ ] Compare baseline and proposed scores on the same frozen vectors. Acceptance requires all designated zero-overlap semantic positives to meet their expected selection assertions, no new strongly selected irrelevant/excluded-topic cases, no loss of predesignated useful pattern coverage, and no cap or fallback regression. Report macro recall/precision by fixture class and review every changed selection; do not average away a failed class.
- [ ] Record the exact chosen default formula, threshold, lexical version, evidence identity, and qualification result. If the proposed policy fails, leave this task explicitly incomplete and revise the design with counterexamples before release. Record the code checkpoint only with that status visible.

**Acceptance:** Measured semantic evidence can pass without English token overlap, while negative/context-only cases and availability controls remain sound. Synthetic tests and real relevance qualification are separately recorded.

### Task 5: Cover every registry-backed family in summary mode

**Files:** Create `functions/lib/graphRAGPatternSummary.js`. Modify `functions/lib/narrative/prompts/graphRAGReferenceBlock.js`, `functions/lib/graphRAG.js`, and `functions/lib/telemetrySchema.js`. Extend `tests/graphRAGSummaryProvenance.test.mjs` and `tests/graphRAGPatternCoverage.test.mjs`.

**Interfaces:** `summarizeProjectedPatterns(candidates) -> { segments: string[], counts: Record<string, number> }` deduplicates by existing `patternKey` and emits only fixed family labels and validated journey labels. Add counts `majorArcana`, `thothSuitPatterns`, and `marseilleNumerologyPatterns`; preserve existing telemetry keys and their meanings.

- [ ] Add isolated fixtures for all eight candidate types, both triad completeness states, three dyad priorities, and both progression priorities. Assert nonempty guarded summaries for each valid family, including a Major-only key object without a journey field.
- [ ] Add a normal single-Star fixture proving its journey signal remains, and Minor-heavy Thoth/Marseille fixtures proving supported summaries survive without Majors. Assert duplicate variants count once and contradictory cached summaries contribute nothing.
- [ ] Run `node --test tests/graphRAGSummaryProvenance.test.mjs tests/graphRAGPatternCoverage.test.mjs` and capture the omitted-family failures.
- [ ] Implement the shared classifier and use it for summary text and the new validated coverage counts. Preserve existing raw graph diagnostics where compatibility requires them; name/document the validated counts rather than silently changing old count semantics.
- [ ] Exercise both unverified-provenance fallback and budget-driven full-to-summary reduction. Assert registry/deck projection still precedes summary facts and no absent card or external-source quotation is introduced.
- [ ] Re-run focused tests and `tests/graphRAGProvenance.test.mjs`. Record a scoped checkpoint.

**Acceptance:** Every eligible family can produce a complete summary; invalid/unprojectable candidates cannot. Summary-only source usage retains zero quoted passages and indices.

### Task 6: Preserve graph blocks atomically through every truncation path

**Files:** Create `functions/lib/narrative/prompts/graphRAGPromptIntegrity.js` and `tests/graphRAGPromptIntegrity.test.mjs`. Modify `functions/lib/narrative/prompts/graphRAGReferenceBlock.js`, `functions/lib/narrative/prompts/userPrompt.js`, `functions/lib/narrative/prompts/truncation.js`, and `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`. Extend `tests/promptEngineering.test.mjs`, `tests/promptContextRetention.test.mjs`, and `tests/narrativePromptSafety.test.mjs`.

**Interfaces:** Implement the parser/enforcement signatures and envelope contract above. Preserve `truncateUserPromptSafely(text, maxTokens, options)` and its result fields. Any estimator/context options must be optional and compatible with the parallel request-local budgeting change.

- [ ] Persist the actual GraphRAG-only helper reproduction as a failing regression using a real registry-generated block. Cover both full and summary input, no other body content, zero/tiny budgets, exact fit, and one token below fit.
- [ ] Add cuts inside the opening/closing reference, security note, complete card guardrail, partial-pattern instruction, weak-match instruction, and end envelope. A closed reference with a missing guardrail body must fail completeness.
- [ ] Add controls with real card markers and `USER_PROMPT_INSTRUCTION_HEADER`, serialized question/reflections/decision labels, long Unicode text, many headings, and marker-looking user data. Include a registry-backed synthetic passage containing the exact plain footer header and forged reserved footer marker, followed by the genuine footer; remove both graph closers in the rendered fixture. Require all reference prose to disappear while the genuine instructions survive byte-for-byte. Assert neighboring context/footer retention and unchanged valid blocks.
- [ ] Run `node --test tests/graphRAGPromptIntegrity.test.mjs tests/promptEngineering.test.mjs tests/promptContextRetention.test.mjs tests/narrativePromptSafety.test.mjs` before implementation and record the reproduced failures separately from unproven hypothetical branches.
- [ ] Extract the dependency-safe shared constants/parsers, render full envelopes, neutralize delimiter-like reference data, and prevent every raw prefix fallback from slicing a graph section. Add the final-budget check to the context-allocation return path using the same estimator as packing.
- [ ] Add a deterministic sweep over every token budget up to the representative block/prompt size and targeted character cuts around each boundary. Assert `estimatedTokens <= budget`; each graph section is complete or wholly absent; repeated truncation/integrity enforcement is idempotent; complete fit preserves original content.
- [ ] Exercise actual enhanced prompt builds for Claude/OpenAI hard caps, soft slimming enabled/disabled, and Modal without application caps. Verify the existing early graph-removal sequence and that optional graph failure never aborts the reading or strips required instructions.
- [ ] Re-run focused tests plus `tests/modalPromptBudget.test.mjs` and `tests/preferencePromptContract.test.mjs`. Record a scoped checkpoint.

**Acceptance:** No truncation path returns partial graph prose or incomplete graph guardrails; fitting sections remain useful; other prompt sources and provider budget behavior are preserved.

### Task 7: Derive retained sources and integrity diagnostics from the final prompt

**Files:** Modify `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`, `shared/readingSourceUsage.js`, and `functions/lib/telemetrySchema.js`. Extend `tests/graphRAGRetention.test.mjs`, `tests/sourceUsageSummary.test.mjs`, `tests/graphRAGAlerts.test.mjs`, and `tests/knowledgeGraphContextPipeline.test.mjs`. Inspect `src/hooks/narrativeReadingModelUtils.js` and `src/components/reading/complete/sourceUsageSummary.js`; change them only if additive reason/metadata handling requires it.

**Interfaces:** Add the integrity diagnostics and `reference_integrity_failed` reason defined above. Keep existing `mode`, `used`, `includedInPrompt`, `parseStatus`, `passagesProvided`, `passagesUsedInPrompt`, `retainedPassageCount`, and `passageIndices` contracts. Propagate only allowlisted diagnostics through server telemetry and shared sanitization.

- [ ] Add final-prompt tests for full, summary, budget-omitted, integrity-removed, disabled, empty, and projection-rejected cases. Assert exact retained indices after reranking, trimming, and dropping an invalid payload entry; do not infer retention from pre-build array length.
- [ ] Add a provider-attempt control: a rejected attempt with references followed by an accepted summary/no-reference attempt must report only the accepted attempt's references and memory receipts. Cover both buffered and streaming/job completion paths through existing route helpers.
- [ ] Run `node --test tests/graphRAGRetention.test.mjs tests/sourceUsageSummary.test.mjs tests/knowledgeGraphContextPipeline.test.mjs` and preserve new failures.
- [ ] Apply integrity enforcement before all final accounting, recalculate token totals and usage from its result, and carry fixed removal diagnostics separately from final absence. Ensure repeated budget/integrity passes do not double-count a removed block.
- [ ] Extend allowlists and reader-safe omission copy. Assert unknown reasons, raw prose, URLs, vectors, and private source text cannot survive sanitization; absent historical fields remain absent.
- [ ] Verify valid historical narratives/previews and current retained-reference display. Summary or removed content cannot appear as generation evidence; historical display must not require new envelope metadata that was never stored.
- [ ] Re-run focused tests plus `tests/graphRAGAlerts.test.mjs` and `tests/narrativeReadingModelUtils.test.mjs`. Record a scoped checkpoint.

**Acceptance:** Final provider text, prompt metadata, public source usage, retained-reference display, and accepted-attempt receipts agree; historical utility and privacy remain intact.

### Task 8: Integrate preservation checks across the complete pipeline

**Files:** Create `tests/fixtures/graph-rag-remediation-v1-cases.json`. Modify `functions/lib/promptVersioning.js`. Extend `tests/knowledgeGraphContextPipeline.test.mjs`, `tests/knowledgeGraphContextQualification.test.mjs`, and `scripts/evaluation/verifyNarrativePromptAssembly.js` using the existing manifest/corpus mechanism. Add a source-bound execution record in `docs/knowledge-graph/QUALIFICATION_STATUS.md` and update `docs/knowledge-graph/REMEDIATION_LEDGER.md` during implementation.

**Interfaces:** Reuse the actual request → canonical context → retrieval → projection → prompt → provider/retention path. Extend existing qualification reports with explicit assertions for F1–F5 and the preservation table, not only successful fixture counts.

- [ ] Before freezing candidate evidence, version the new corpus separately and add its hash/order to the qualification manifest. Preserve all historical fixture bytes/hashes. Record expectation migrations for intentionally changed ranking, Major eligibility, summaries, and parser completeness without rewriting baseline fixtures.
- [ ] Advance `READING_PROMPT_VERSION` from the inspected 1.4.0 to 1.5.0 and add history covering Major eligibility, lexical/scoring policy, summary coverage, and guarded envelopes. If both plans are implemented in one still-unqualified release, use one combined 1.5.0 history entry. If 1.5.0 has already been qualified/published by the other work, use the next unused minor version (normally 1.6.0); never overwrite or relabel frozen evidence. Keep the existing evaluator prompt version unless its prompt/rubric actually changes; record the version supplied by any integrated older-plan evaluator changes.
- [ ] Add paired cases for every finding: one that failed before remediation and one proving useful existing behavior still works. Cover three decks, free/Plus/Pro, every spread cap, custom spreads, reversed cards, partial triads, Minor-only readings, enrichment approval states, semantic/keyword/priority/bypass modes, and full/summary/none prompt modes. Use a targeted pairwise matrix plus exhaustive local identity/boundary tests rather than an unnecessary full Cartesian product.
- [ ] Add explicit semantic assertions to the deterministic gate: actual card identities only; all eligible family coverage; no unclosed graph section; complete required guardrails; truthful retained indices; unchanged question/notes/decision labels/preferences; no rejected-attempt usage. A gate that merely builds the prompts is insufficient.
- [ ] Freeze a preservation baseline from the reviewed source and compare unchanged fixtures. Classify each changed selection as intended eligibility/normalization/scoring behavior or a regression. Reduced passage counts, fewer previews, or shorter readings alone are not evidence of improvement.
- [ ] Recheck embedding work with the expanded Major corpus: cold/warm cache, largest eligible set, overflow, failed/slow batch, cancellation, and invalid vectors. Require existing bounds, complete fallback, no synchronous-preview embeddings, and no duplicate query embedding. Record actual input/batch counts rather than promising the old two-batch corpus size.
- [ ] Run one complete offline verification after focused tests pass: `npm test`; `node --test functions/__tests__/knowledgeGraph.test.js functions/__tests__/spreadAnalysis.test.js`; `node scripts/evaluation/verifyNarrativePromptAssembly.js --json`; `npm run lint`; `npm run build`; `npm run docs:check`; `git diff --check`. Run deterministic work without provider credentials/network access and record failures without replacing external services with unreported live calls.
- [ ] Verify that baseline unrelated dirty files and the older plan have not been altered. Review the combined diff for duplicate normalization, inconsistent score defaults, circular parser imports, accidental cap changes, broad text deletion, and real enrichment-queue writes.
- [ ] Update the ledger with every F1–F5 subfinding, changed files, regression case IDs, evidence/source identity, and qualification status. Mark this task complete only when the offline preservation controls pass.

**Acceptance:** The implementation is integrated and offline-qualified across actual boundaries. This status does not by itself qualify real embedding relevance or generated reading quality.

### Task 9: Qualify useful output and prepare a reversible release

**Files:** Update the execution sections of `docs/knowledge-graph/QUALIFICATION_STATUS.md` and `docs/knowledge-graph/REMEDIATION_LEDGER.md`; use existing sample preparation, subscription-generation, and narrative metric tools. Store new evidence with a manifest under an execution-specific evidence directory; preserve earlier attempts.

**Interfaces:** Evidence records identify baseline/candidate source hashes, fixture version/order, prompt version, embedding model/evidence, selected candidate/projection IDs, final prompt retention, provider/model, attempt count, and actual usage. Public telemetry remains text-free; synthetic qualification artifacts may contain their fixed nonprivate inputs/outputs.

- [ ] Complete Task 4's real embedding qualification and review all selection changes. Measure retrieval latency under matching baseline/candidate conditions; require unchanged hard timeout/concurrency limits and no unexplained p95 regression greater than 10% on the fixed workload. A larger eligible set may use more bounded work; disclose it and resolve failed latency controls without silently dropping candidates.
- [ ] Freeze 12 representative synthetic reading scenarios covering multi-Major canon/enrichment, retained strong patterns, lexical corrections, a semantically relevant paraphrase, each omitted summary family, and tight-budget full/summary behavior. Compare baseline and candidate once per scenario through the existing Claude subscription: 24 planned outputs. Verify the actual runner's retry/evaluator behavior and set a total attempt limit before execution; retries are separate recorded attempts, never invisible replacements.
- [ ] Run the required `npm run ci:narrative-check` using the owner's existing Claude subscription. Inventory its current sample/evaluator calls before starting and add them to the declared attempt budget. Missing login/access must fail without a paid API fallback. Keep deterministic provider-adapter coverage separate from live provider qualification.
- [ ] Review actual outputs for recognizable card meaning, useful optional guidance, specific relationships between drawn cards, positions/reversals, preserved reader constraints, deck fidelity, missing-card claims, unsupported personal details, instruction obedience, and correct source treatment. Require zero new grounding/safety failures and no material loss of usefulness or detail in the paired preservation scenarios. Do not use length or provenance alone as quality metrics.
- [ ] Review newly exposed canon/enrichment projections where editorial approval is required. Agent checks do not count as human approval, and synthetic enrichment fixtures do not activate real enrichment. Record unresolved editorial cases explicitly.
- [ ] Write the release record only after deterministic, relevance, generated-output, and applicable editorial requirements are satisfied. Keep local implementation, branch publication, deployment, and live verification as separate statuses. Deployment requires its own authorization; the plan-writing task does not publish anything.
- [ ] For an authorized release, capture the active Worker/source/config identity and recovery artifacts, check pending migrations, deploy using `npm run deploy` on the subscription-authenticated host, and verify the active Worker version/live assets and a representative authenticated reading. Observe actual graph enablement, embedding mode/fallback, final source usage, and provider behavior without logging private inputs.
- [ ] Define rollback triggers before release: partial graph content, incorrect retained indices, lost valid previews/context, increased false grounding claims, failure to honor caps/deadlines, or material availability/quality regression. Roll back to the previously qualified source/config; preserve new journal entries, evidence, approved content, and pending receipts. Do not use globally disabling GraphRAG as the default remediation.

**Acceptance:** The changed source has measured relevance and useful-output evidence, all preservation requirements pass, and any authorized release has verified identity and a recoverable rollback path.

## Completion checklist

- [ ] Every F1–F5 subfinding has an implemented correction or the explicit tested/documented disposition specified above.
- [ ] Every capability-preservation row has positive and negative evidence tied to the candidate source.
- [ ] Canon and approved enrichment remain usable; no automatic source duplication or content activation occurred.
- [ ] Every supported summary family is represented when eligible and within budget.
- [ ] Every new provider prompt contains complete guarded graph sections or none; metadata agrees with the final text.
- [ ] Lexical and semantic improvements have separate deterministic and real-relevance qualification; context labels do not become factual evidence.
- [ ] Existing feature flags, limits, providers, previews, personalization, memory receipts, and privacy protections pass their controls.
- [ ] The ledger distinguishes planned, implemented, offline-qualified, relevance-qualified, output/editorially qualified, deployed, and live-verified states. Any unmet requirement remains visible.

## Planning verification

Planning checks completed on 2026-10-24: all nine task interfaces and acceptance blocks are present; every F1–F5 subfinding has an owner; all six local links/anchors and 40 existing file paths resolve; eleven proposed files are explicitly identified. The independent builder check found no important question remaining after the reserved-footer boundary, historical-corpus preservation, and prompt-version ownership were made explicit. `npm run docs:check` passed for 216 maintained Markdown files; because it excludes `docs/superpowers`, this plan received the separate link/path/coverage check. Whitespace checks passed. All 72 execution/completion checkboxes remain open. Product tests and provider qualification are execution tasks; writing this file does not constitute implementation.
