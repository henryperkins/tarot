# Knowledge Graph and Reading Context Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reading prompts whose graph interpretations match the drawn cards and selected deck, whose retrieval reflects all relevant current inputs, and whose remembered context is selected and reported accurately.

**Architecture:** Keep the existing curated graph, Workers AI embeddings, shared prompt builders, and provider adapters. Introduce a shared representation of current context sources, separate passage candidate collection from final passage selection, project references for the selected deck before scoring and rendering, and select memories before prompt assembly. Preserve distinct accounting for detected highlights, retrieved passages, retrieval-query excerpts, and material actually retained in the final prompt.

**Tech Stack:** ESM JavaScript, React/Vite, Cloudflare Workers and D1, Workers AI embeddings, Node `node:test`, existing subscription-authenticated narrative evaluation.

**Spec:** [Consolidated review requirements](#consolidated-review-requirements) in this document, derived from the October 22 review and its local reproductions. Consult the [October 8 reading-context plan](2026-10-08-reading-context-fixes.md) for the subject-attribution regression cases referenced below.

**Status:** Implementation and deterministic qualification are complete on October 22, 2026, in the isolated implementation branch from `7164fc21`. Independent code review is approved. **Subscription-authenticated generated-reading qualification is blocked and remains pending; human editorial review of all 145 projections remains pending.** Commit and push of this implementation branch are authorized with those qualifications still open. See the [qualification status](../../knowledge-graph/QUALIFICATION_STATUS.md) and [human editorial checklist](../../knowledge-graph/CANON_PROJECTION_REVIEW.md). Branch publication does not establish generated-reading acceptance or production qualification.

## Global Constraints

- Preserve unrelated dirty files and evidence. At implementation time, inventory the checkout and use an isolated worktree if the primary checkout remains dirty; do not reset or stage unrelated work.
- Keep canonical card identity, selected deck, card orientation, and spread-position identity intact. Graph relationships supply context and cannot establish an undrawn card or an unprovided fact about a person.
- Existing accepted input limits remain: question 2,000 characters, general reflections 5,000, each card reflection 2,000, and at most 78 cards. Apply these limits per source; never reuse the general-reflection limit for their concatenation.
- Keep the existing final passage limits: paid single 1, threeCard 2, fiveCard 3, celtic 5, decision 3, relationship 2, general 3; free `max(1, floor(paid / 2))`. Candidate scoring must be independent of these presentation limits.
- Keep prompt slimming opt-in. Preserve provider budget behavior: Claude hard cap 25,000 estimated tokens, OpenAI 20,000, default 15,000, and Modal without an application prompt cap. This plan does not raise caps to hide context-selection defects.
- Current question and current notes take precedence over saved interests and memories. Preserve field identity before topic analysis, memory subject matching, and truncation.
- Do not log or persist raw questions, reflections, path labels, memory text, embedding inputs, names, or memory IDs in ordinary telemetry. Prompt persistence remains opt-in and redacted; prompt debugging retains its existing access restrictions.
- Server tests use synthetic inputs and stub external services. Narrative gates use the owner's existing Claude subscription or the approved subscription gateway, never paid API fallback. Workers AI integrations retain their configured provider.
- Run targeted tests per task and the full root suite at final integration. Run `npm run ci:narrative-check` for the implemented prompt changes. GitHub Actions billing is unavailable and is not a release prerequisite.
- This is one coherent context-pipeline plan. Implementing it does not require a graph database, a new model provider, automatic memory extraction, or a new decision-authoring UI.

## Review Focus

1. A useful note on the last card of a maximum-size request must participate in topic selection even when general notes already fill their own limit. Tasks 2 and 7 own this regression.
2. Optional, one-sided, identical, malicious, and omitted decision labels must preserve A/B identity across request validation, safety checks, provider fallback, and hard-cap rebuilding. Tasks 3 and 7 own these regressions.
3. A partial arc, a cross-deck quotation, or an unverified legacy reference must not become asserted card evidence through the separate highlight path, a summary, or the relevance floor. Tasks 1, 4, 5, and 7 own these regressions.
4. An embedding timeout, malformed vector, tied score, multilingual question, or candidate beyond the old shortlist must produce deterministic, accurately labeled selection. Task 5 owns these regressions.
5. Old but relevant memories, wrong-subject details, malformed rows, cancelled requests, and failed provider attempts must neither leak unrelated context nor falsely mark memories as used. Tasks 6 and 7 own these regressions.

## Consolidated review requirements

The October 22 review established the following against local source and assembled prompts. Its 356 passing focused tests are a baseline, not evidence that these missing cases are already covered.

| ID | Finding and reproduction | Required result | Tasks |
|---|---|---|---|
| F1 | 16 of 30 defined partial-triad pairs miss their authored pair interpretation because lookup keys disagree with stored keys. | Every pair selects its exact authored partial narrative; complete arcs remain complete; both prompt routes preserve partial status. | 1, 7 |
| F2 | A valid 4,991-character general note followed by a 56-character career card reflection selects saved relationship focus, although the career note remains in the prompt. | Analyze each accepted current source before query-size budgeting; current career evidence wins and reaches retrieval. | 2, 7 |
| F3 | Career options expressed only in custom decision positions appear in card prose but do not inform retrieval. | Explicit named paths and existing custom path positions participate in current-context precedence, query construction, memory selection, and safe rendering. | 2, 3, 6, 7 |
| F4 | RWS-tagged references and visual anchors enter Thoth/Marseille prompts without source-deck qualification. | Preserve source tradition; project meaning separately from incompatible concrete imagery; enforce the rule at every generation entrypoint. | 4, 5, 7 |
| F5 | Only twice the final passage allowance reaches semantic scoring; a stronger third candidate can never win a one-passage reading. Context variants are also discarded before scoring. | Score all eligible variants of triggered patterns before selecting one variant per pattern and applying the final spread/tier cap. | 5, 7 |
| F6 | The eight newest global memories are loaded without question relevance; all retrieved rows receive access stamps. | Load the bounded candidate set, select relevant safe notes, and stamp only memories retained by the final successful reading. | 6, 7 |
| F7 | The reference wrapper claims internally authored passages come from respected tarot literature. | Identify the material accurately as internally authored Tableu Tarot Canon, with no invented book citations. | 4, 8 |
| F8 | Direct archetypal highlights and retrieved references are separate prompt inputs; passage filtering cannot repair incorrect highlights. | Validate and report both paths separately, including after budget trimming and fallback. | 1, 7 |

The existing feature flags, final passage caps, weak-match safeguards, embedding fallback, and final-prompt accounting are behaviors to preserve and test. A graph with no matching pattern may legitimately return no passages; card meanings and other valid context remain available. Expanding Minor Arcana coverage is a separate feature, not a prerequisite for these fixes.

### Relationship to earlier work

For the findings above, this document replaces the implementation directions in October 8 Task 5 (provenance), Task 8's backend path/context handling, and Task 9 (memory selection). Retain that plan's subject/detail test cases, with the explicit interface adaptation in Task 6 below. Do not make this work depend on its historical production-data investigation.

The earlier plan's timezone, journal exports, orientation prose, timing, length enforcement, continuity, new path-entry UI, and repeated-rank expansion remain separate work. If another branch has implemented an overlapping item, reconcile its actual code and tests instead of applying both designs or assuming the older plan is implemented.

## Target data flow and interfaces

```text
validated request + resolved cards + effective preferences
  -> structured current sources
  -> topic selection over complete accepted sources
  -> bounded retrieval query with per-source coverage

drawn-card patterns
  -> validated direct highlights ------------------------------+
  -> all matching passage variants                            |
  -> deck-specific prompt projection                          |
  -> keyword/semantic scoring                                 |
  -> best variant per pattern + exact-content deduplication    |
  -> final spread/tier passage cap ----------------------------+
                                                              |
bounded global memory candidates -> safe relevance selection -+
                                                              v
                  common prompt assembly -> provider budget controls
                    -> parse final retained sources -> provider request
                    -> final successful reading -> selected access stamps
```

Use JSDoc types in the existing JavaScript code; no TypeScript migration is required.

- `ReadingContextSource`: `{ id, kind, text, originalLength, sanitizedLength, cardIndex?, pathKey?, origin? }`. IDs are `question`, `reflections`, `card-0` through `card-77`, `pathA`, `pathB`, and `focus-0` through `focus-5`. `kind` is `question | reflection | cardReflection | decisionPath | savedFocus`. `origin` distinguishes an explicit path field from a custom position. Sources are request-local and contain private text.
- `ContextSelection`: retain `context`, `graphRAGContext`, `source`, `clarifiedBy`, and `retrievalQuery`; add `selectedSourceIds` and `queryCoverage`. Coverage contains source IDs, lengths, inclusion/truncation flags, and reason codes only. Topic selection is computed before excerpting.
- `PassageCandidate`: retain existing passage fields; add stable `candidateId`, `patternKey`, `sourceDeck`, `archetypalText`, `promptText`, `promptVisualAnchors`, and `crossDeckReference`. `text` and `visualAnchors` remain the authored reference for display; only projected fields feed ranking and generation.
- `MemorySelection`: `{ memories, selectedIds, stats }`. IDs and memory objects stay server-side; bounded counts/reasons may enter telemetry. Memory IDs never become public source identifiers.
- `promptMeta.sourceUsage` continues to describe final retained prompt material. `queryCoverage` describes retrieval-query representation, which is a distinct event. Do not use either as a claim that the model followed the material correctly.

## File responsibilities

Paths marked **new** are implementation deliverables and intentionally do not exist yet.

| Area | Files and responsibility |
|---|---|
| Pattern correctness | `src/data/knowledgeGraphData.js`, `functions/lib/knowledgeGraph.js`, `functions/lib/graphContext.js`: numeric partial-pair keys, matched-card metadata, highlights. |
| Structured inputs | **New** `functions/lib/readingContextSources.js` and **new** `functions/lib/readingRetrievalQuery.js`: source preparation and bounded query formatting; `functions/lib/contextDetection.js`: precedence and topic selection. |
| Decision inputs | **New** `functions/lib/decisionPathContext.js`; `shared/contracts/readingSchema.js`, `shared/contracts/readingRequestLimits.js`, `functions/api/tarot-reading.js`: explicit fields, custom-position fallback, validation and safety. |
| Canon projection | **New** `functions/lib/graphRAGProjection.js`; `functions/lib/knowledgeBase.js`, `shared/passageSource.js`, `functions/lib/narrative/prompts/graphRAGReferenceBlock.js`: meaning-only text, provenance, deck-qualified formatting. |
| Candidate ranking | **New** `functions/lib/graphRAGCandidates.js`; `functions/lib/graphRAG.js`, `functions/lib/embeddings.js`, `functions/lib/spreadAnalysisOrchestrator.js`: enumerate, project, score, select, report. |
| Memory selection | **New** `functions/lib/readingMemorySelection.js`; `functions/lib/userMemory.js` and `functions/lib/userPersonalization.js`: pure relevance/subject checks, candidate loading, scoped access updates. |
| Prompt integration | `functions/lib/narrativeBackends.js` and `functions/lib/narrative/prompts/{buildEnhancedClaudePrompt,userPrompt,systemPrompt,cardBuilders,userContext,truncation}.js`; `functions/lib/narrative/spreads/decision.js`: common context, rendering and fallback. |
| Provenance and consumers | `functions/lib/narrative/sourceUsage.js`, `shared/readingSourceUsage.js`, `functions/lib/{readingTelemetry,telemetrySchema,promptEngineering,graphRAGAlerts}.js`, `src/hooks/narrativeReadingModelUtils.js`, `src/components/reading/complete/sourceUsageSummary.js`: bounded metadata, redaction, retained-passage display. |
| Qualification | Tests named in each task; **new** `tests/fixtures/knowledge-graph-context-cases.json`; `scripts/evaluation/verifyNarrativePromptAssembly.js`, `scripts/evaluation/runNarrativeSamples.js`, `functions/lib/promptVersioning.js`; maintained graph/context documentation. |

## Implementation tasks

### Task 1: Correct every partial-triad lookup and direct highlight

**Files:** Modify the three pattern files above; add `tests/knowledgeGraphPartialTriads.test.mjs`; extend `tests/graphContext.test.mjs` and `tests/graphRAGPatternCoverage.test.mjs`.

**Interfaces:** Export `getMajorPairKey(cardNumbers) -> string | null` from `knowledgeGraph.js`. It accepts exactly two distinct canonical integers in 0–21 and returns an ascending numeric key such as `14-17`. Each triad's existing `partialNarrative` map uses these keys. Graph keys additionally carry `partialTriads: [{ id, matchedCards, missingCards }]` while retaining existing ID arrays for compatibility.

- [x] **Write the failing regression:** `all 30 authored partial pairs resolve without complete-description fallback`. Build an explicit fixture mapping each triad's three pairs to its current intended pair text; do not derive expected values through the new key helper.
- [x] **Add boundary assertions:** reverse pair order; exercise all upright/reversed combinations; confirm all ten complete triads retain their complete narrative; reject duplicate IDs and invalid Major numbers; verify Temperance + Star selects `Patient integration leading to renewal` in the assembled highlight.
- [x] **Run the regression before implementation:** `node --test tests/knowledgeGraphPartialTriads.test.mjs`. Expect the existing mismatched pairs to fail.
- [x] **Migrate all 30 authored keys and implement numeric lookup.** Preserve their intended copy. A missing pair entry is a data-integrity failure in tests; runtime uses a neutral statement naming only the matched cards, never the complete arc description. Populate explicit matched/missing metadata for partial retrieval candidates.
- [x] **Verify both paths:** the direct highlight names only the matched cards and correct partial meaning; reference candidates remain explicitly partial and retain the absent-card guardrail. Legacy graph keys may still retrieve a guarded partial reference, but may not invent matched-card identities.
- [x] **Run:** `node --test tests/knowledgeGraphPartialTriads.test.mjs tests/graphContext.test.mjs tests/graphRAGPatternCoverage.test.mjs functions/__tests__/knowledgeGraph.test.js`. Expected: all pass.

**Deliverable:** All 30 pairs have deterministic, authored interpretations; neither prompt path silently upgrades a pair into a complete arc.


### Task 2: Preserve complete current-source evidence before building the query

**Files:** Create `readingContextSources.js` and `readingRetrievalQuery.js`; modify `contextDetection.js`, `querentReflections.js` only where needed for compatibility, `spreadAnalysisOrchestrator.js`, and the common prompt builder. Add `tests/readingContextSources.test.mjs` and `tests/readingRetrievalQuery.test.mjs`; extend existing context tests.

**Interfaces:**

- `prepareReadingContextSources({ userQuestion, reflectionsText, cardsInfo = [], decisionPaths = {}, focusAreas = [] }) -> ReadingContextSource[]`. Reuse existing sanitizers; handle raw decision-path normalization in Task 3.
- Extend `resolveContextSelection(input, spreadKey, options = {})` to accept `input.sources` or the existing individual fields, plus `cardsInfo` and `decisionPaths`. Structured fields take precedence over legacy `contextInputText`.
- `buildReadingRetrievalQuery(sources, selection, { maxLength = 8000 } = {}) -> { text, coverage }`. Retain `buildContextInferenceInput` as a compatibility adapter, not the source of truth for topic selection.

- [x] **Write the failing regression:** `full general notes do not suppress a later career card reflection`, using the schema-valid 4,991-character note, the 56-character career reflection, a generic question, and relationship focus. Assert reading context `career`, graph context `career`, source `reflections`, the career terms in the query, and the intact reflection in the final prompt.
- [x] **Add source-order tests:** put the only topic clue on card 0, card 9, and card 77; test 2,000-character notes with the clue near the end; combine full question/general/card limits; test duplicate notes, blank fields, non-Latin text, and a legacy combined-only caller.
- [x] **Run:** `node --test tests/readingContextSources.test.mjs tests/readingRetrievalQuery.test.mjs tests/contextDetection.test.mjs tests/readingContextPrecedence.test.mjs`. Confirm the new preservation cases fail on the baseline.
- [x] **Implement source preparation and precedence.** Analyze each source at its own accepted limit. Rank topic sources as a specific question, then current general/card notes, then named paths, then saved focus, then spread defaults. A generic decision question does not suppress topical notes or paths. Within the current-note group, count distinct matched phrases rather than repeated copies across cards. Resolve ties using current reflections, then paths, then the existing deterministic taxonomy priority; saved focus cannot resolve a current-topic tie.
- [x] **Implement the query budget separately.** Keep the serialized query at most 8,000 characters, including labels and separators, without splitting Unicode surrogate pairs. Reserve the accepted question and both normalized path labels first. For a specific question, include at most 750 characters of relevant current-note excerpts in total; never fill that allowance with an unrelated saved focus. Without a specific question, allocate the remaining space across relevant current notes: one topic-bearing excerpt per source first, then deterministic expansion in source order. Start with 32-character excerpts, include the matched phrase when one exists, and expand round-robin; when there is no lexical topic evidence, use head/tail excerpts and retain text from each nonempty source while space permits. Smaller explicit budgets reduce these allocations and record omissions.
- [x] **Record truthful coverage.** `source_char_limit`, `query_budget`, `unrelated_to_current_topic`, `duplicate`, and `sanitized_empty` are separate reasons. Query truncation never changes the already selected topic. The narrative still receives its separately prepared full accepted sources, subject only to its own provider budget.
- [x] **Wire the reading route, asynchronous analysis, synchronous retrieval fallback, and local composer to the same selection.** Keep `collectQuerentReflections` available for existing whole-request safety/language checks; do not feed its concatenation through the global-note limit again when structured fields exist.
- [x] **Run the task command again**, plus `node --test tests/localComposerContextPriority.test.mjs tests/promptContextRetention.test.mjs`. Expected: all pass, including existing question-over-saved-focus behavior.

**Deliverable:** Every accepted current note can affect topic selection; a bounded query is an explicit projection of that decision rather than a replacement for the underlying sources.


### Task 3: Carry named decision paths through the complete request lifecycle

**Files:** Create `decisionPathContext.js`; modify the request schema/limits, reading route, shared context helpers, provider handoff, prompt context/card builders/truncation, local decision composer, evaluator inputs, redaction, and source-usage consumers. Inspect `functions/lib/readingJobs.js` and `src/worker/readingJob.js` for forwarding. Add `tests/decisionPathContext.test.mjs` and extend request, retention, safety, and telemetry tests.

**Interfaces:**

- Optional request field `decisionPaths: { a?: string, b?: string }`; each explicit label has a maximum of 80 characters. Add `DECISION_PATH_MAX_LENGTH = 80` to the shared limits.
- `resolveDecisionPathContext({ spreadKey, cardsInfo, decisionPaths }) -> { decisionPaths, sources, inputStats, rawSafetyText }`. Only decision spreads produce path sources.
- Extend `prepareUserContext(userQuestion, reflectionsText, cardsInfo, inputStats = {}, decisionPaths = {})` with the fifth argument. Rendering/parsing IDs are `pathA` and `pathB`; the wire shape remains `a` and `b`.

- [x] **Write the failing regression:** `generic decision questions retrieve career context from custom path positions`. Use named positions on cards 1 and 2 without a separate label field; assert the labels reach the query, prompt, and memory selector.
- [x] **Add normalization tests:** explicit labels take precedence per path; an explicitly supplied empty label is a deliberate clear; absent fields may use custom positions. Strip a recognized `Path A/B` prefix and delimiter, ignore the standard spread's boilerplate positions, and accept another custom position as its label. Never infer labels from card names or meanings. Bound legacy-position excerpts to 80 characters with input statistics. Preserve distinct path identity even when both labels have identical text.
- [x] **Run:** `node --test tests/decisionPathContext.test.mjs tests/readingSchema.test.mjs tests/readingContextPrecedence.test.mjs`. Verify missing propagation fails before changes.
- [x] **Implement schema and boundary handling.** Screen raw schema-valid explicit labels and relevant custom positions for crisis signals before instruction filtering or legacy-label truncation. Normalize safe labels once, forward them through direct and job-based requests, and supply them to the existing sensitive-topic evaluation policy. Non-decision requests do not use decision labels.
- [x] **Implement prompt/evaluator/local-fallback propagation.** A named path remains attached to its own card. An unnamed path is described as unnamed; neither narrator nor fallback may invent its job, partner, location, or other concrete content. The evaluator receives the same normalized path facts. Include path text in existing name-redaction hints and opt-in prompt-persistence redaction.
- [x] **Extend retention and usage.** Parse path context blocks explicitly. Hard-cap rebuilding must never treat `pathA` as `card-0`. Preserve partial labels with the existing head/tail representation; distinguish absent, sanitized-empty, and wholly omitted labels. Extend `USER_INPUT_KEYS`, field allowlists, and the usage-summary labels with `pathA`/`pathB`. Use the shared 78-card bound for per-card provenance instead of silently dropping cards after index 29.
- [x] **Verify safety and lifecycle cases:** one-sided/identical labels, unknown fields, injection delimiters, crisis language only in a label, sensitive-topic routing only from a label, names appearing only in paths, direct and Durable Object requests, provider fallback, and hard-cap truncation. Public metadata contains only permitted counts/flags.
- [x] **Run:** `node --test tests/decisionPathContext.test.mjs tests/readingSchema.test.mjs tests/readingContextPrecedence.test.mjs tests/promptContextRetention.test.mjs tests/localComposerContextPriority.test.mjs tests/sourceUsageSummary.test.mjs tests/promptEngineering.test.mjs tests/readingJob.test.mjs tests/tarotReading.telemetry.test.mjs`. Expected: all pass.

**Deliverable:** Existing custom path positions and optional API labels influence context consistently without adding an authoring UI or a new journal column. Current journal source-usage snapshots retain bounded path-use metadata; richer path authoring/export remains the older plan's separate feature.


### Task 4: Project canon references for the selected deck and correct attribution

**Files:** Create `graphRAGProjection.js`; modify `knowledgeBase.js`, `shared/passageSource.js`, `graphRAG.js`, `graphRAGReferenceBlock.js`, and the common prompt/deck fallback rules. Add `tests/graphRAGDeckProjection.test.mjs`; extend provenance and prompt-assembly tests.

**Interfaces:** `projectPassageForDeck(passage, deckStyle) -> PassageCandidate | null`. Add `archetypalText` to every canon passage: the same authored meaning without concrete scene claims. Where existing prose is already meaning-only, the values may be identical. Projection preserves `text` for display and creates `promptText`/`promptVisualAnchors` for generation.

- [x] **Write the failing regression:** `Thoth and Marseille prompts do not present the RWS white horse as drawn-card imagery`. Assemble the same Death/Temperance/Star spread for all three decks through the real shared prompt builder. Check the reference block and the entire assembled prompt.
- [x] **Audit and author the projection for all 145 existing passages.** Keep original display prose intact. Use full meaning-only prose for cross-deck references and an empty `promptVisualAnchors` list. Same-deck references may retain their authored scene descriptions. Do not attempt to remove visual claims with a keyword blacklist or only by hiding the separate anchor line.
- [x] **Implement provenance-aware formatting.** Every projected passage identifies `Tableu Tarot Canon` and its source tradition. Cross-deck passages state that their archetypal meaning is background and their imagery is not evidence of the selected deck. Unknown source tradition is never guessed from the selected deck.
- [x] **Replace the misleading wrapper sentence with:** `These passages are internally authored Tableu Tarot Canon, supplied as archetypal background.` Retain the no-verbatim-copy, instruction-isolation, absent-card, partial-pattern, and weak-match guardrails.
- [x] **Close adjacent prompt bypasses.** `cardBuilders.js` calls a shared RWS imagery hook; permit that hook as concrete imagery only for its supported deck, otherwise use verified deck-specific data already available or omit the hook. Make the system fallback refer to the selected tradition and provided evidence rather than universally requiring RWS imagery. No new visual claims should be authored from model guesses.
- [x] **Handle legacy inputs conservatively.** Structured old passages can resolve their source from the existing type map; cross-deck use still requires an authored meaning-only projection. A `formattedBlock`-only payload with unverifiable provenance cannot supply a full generation reference: omit it with `unverified_reference_provenance` and retain only an independently supported graph summary if available. Preserve historical quotation display. Update legacy injection tests to assert this deliberate generation boundary.
- [ ] **Verify:** every corpus entry has a projection; same-deck content survives; cross-deck markers survive trimming; invalid decks/unknown types fail safely; uploaded matching visual evidence is still usable; source delimiters cannot escape the reference block. Human-review the 145 meaning-only projections for semantic fidelity.
- [x] **Run:** `node --test tests/graphRAGDeckProjection.test.mjs tests/graphRAGProvenance.test.mjs tests/graphRAGFallback.test.mjs tests/narrativeBuilder.promptCompliance.test.mjs tests/visionPromptProjection.test.mjs`. Expected: all pass.

**Deliverable:** Both the ranking text and generated-reading prompt use deck-qualified references; the prompt accurately names the internally authored source.


### Task 5: Score the complete eligible candidate set before final selection

**Files:** Create `graphRAGCandidates.js`; modify `graphRAG.js`, `embeddings.js` where batching metadata needs extension, `spreadAnalysisOrchestrator.js`, and synchronous prompt fallback. Add `tests/graphRAGCandidateSelection.test.mjs`; extend retrieval, fallback, and provenance tests.

**Interfaces:**

- `collectPassageCandidates(graphKeys, { deckStyle }) -> PassageCandidate[]` enumerates every context variant belonging to a triggered pattern and applies Task 4 projection. Move the existing dispatch logic here; do not maintain a second competing list of supported pattern families.
- `candidateId` is the JSON encoding of `[type, patternId, passageContext, sourceDeck]`; a corpus invariant requires these tuples to be unique. `patternKey` encodes `[type, patternId, sourceDeck]`. Identifiers remain stable across sorting and filtering.
- `selectPassageCandidates(scoredCandidates, { maxPassages = 5, minRelevanceScore = 0.3, enableDeduplication = true, qualityFilteringDisabled = false } = {}) -> PassageCandidate[]` is pure and shared by asynchronous quality retrieval and synchronous keyword retrieval. An explicit zero, negative, noninteger, or nonfinite limit returns no passages; retrieval exits before embedding when that limit cannot select anything.

- [x] **Write the failing regression:** `a best candidate beyond twice the final allowance can win`. Use Death/Temperance/Star, `maxPassages: 1`, and controlled embeddings making the previously excluded Death/Star dyad the strongest candidate. Assert it was embedded and selected.
- [x] **Add variant and equivalence tests:** a semantic match can choose a non-default context variant; only one variant of a pattern survives; two different passages sharing their first 100 characters remain distinct; repeated keys and repeated identical projected text do not consume slots.
- [x] **Run:** `node --test tests/graphRAGCandidateSelection.test.mjs tests/graphRAG.test.mjs tests/graphRAGFallback.test.mjs`. Confirm shortlist/variant regressions fail first.
- [x] **Enumerate, project, then score.** Remove the `maxPassages * 2` candidate cutoff and early context-variant choice from quality retrieval. Current data bounds the corpus at 145 passages. Use the existing 100-text embedding batch bound, cache, and timeout, and embed full projected prose up to the existing 8,000-character per-text limit rather than an arbitrary 500-character prefix. Reuse one query embedding across batches.
- [x] **Keep scoring policy explicit.** Successful runs retain the 0.3 keyword / 0.7 cosine blend and 0.3 relevance threshold. Use deterministic keyword-only scoring when semantic scoring is disabled or unavailable. Valid semantic vectors have finite components, nonzero norm, matching query/candidate dimensions, and metadata identifying real embeddings rather than fallback placeholders. If the query or any required candidate vector fails validation, rank the entire candidate set on keyword scores for that run, with a precise partial-failure/outage reason; do not compare scores from incompatible methods. Empty queries use existing pattern priority and context defaults with semantic-attempted false.
- [x] **Select in this order:** best variant per `patternKey`; deduplicate exact normalized full projected text when `enableDeduplication` is true; apply relevance threshold; if all eligible candidates miss it, retain the best one with the weak-match flag; apply the existing final spread/tier cap. Break equal scores by context match, pattern priority, then `candidateId`. The weak-match floor cannot restore a passage rejected by provenance/projection checks. Repeated candidate identities never consume slots, even when text deduplication is disabled.
- [x] **Preserve the explicit quality-filtering bypass.** `DISABLE_QUALITY_FILTERING` skips embeddings, relevance thresholds, and text deduplication. It still enumerates eligible candidates, enforces deck/provenance safety, chooses one context/default variant per pattern, orders by existing pattern priority and stable identity, and applies the final cap. Retain the compatibility flag and nominal score only as needed by existing callers; telemetry must label the method as bypassed, never as measured semantic relevance.
- [x] **Apply the same candidate coverage to keyword fallback.** The synchronous path may use its documented keyword/context score, but it must enumerate all eligible variants and share deduplication and final-cap semantics. Paid/free tiers alter final selection count, not which candidates can be considered.
- [x] **Report:** candidates discovered/projected/scored, patterns represented, candidates removed by projection/deduplication/threshold, final selected count, embedding batch/cache counts, scoring method, and fallback reason. Keep user query text and candidate embeddings out of telemetry.
- [x] **Bound and measure retrieval work.** For the current 145-passage corpus, an uncached query plus all candidates requires at most two 100-text batches; cache hits reduce that work. Assert these call counts and existing timeout behavior with stubs, and record candidate count, input size, cache reuse, and elapsed time in qualification evidence. Do not reintroduce a relevance-blind shortlist to conceal a latency regression.
- [x] **Run task tests plus** `node --test tests/embeddings.test.mjs tests/graphRAGPatternCoverage.test.mjs tests/graphRAGProvenance.test.mjs tests/graphRAGRetention.test.mjs`. Include timeouts, zero/wrong-sized/nonfinite vectors, mixed-batch failures, cache recovery, multilingual queries, ties, no query, no patterns, quality-filtering bypass, and explicit `maxPassages: 0`.

**Deliverable:** Every eligible triggered passage variant can compete for the existing final allowance; fallback and telemetry accurately describe how that competition was resolved.


### Task 6: Select safe relevant memories and stamp actual successful use

**Files:** Create `readingMemorySelection.js`; modify `userMemory.js`, `userPersonalization.js`, reading-route finalization, shared prompt assembly, memory rendering, and telemetry. Add `tests/readingMemorySelection.test.mjs` and `tests/readingMemoryAccess.test.mjs`; extend existing memory/personalization tests.

**Interfaces:**

- Extend `getMemories(db, userId, options)` with `markAccess = true` for existing callers. Initial-reading candidate loads use `scope: 'global'`, `limit: 100` (the current store maximum), and `markAccess: false`.
- `extractPersonalDetailClaims(text, { displayName = '', source = 'memory' } = {}) -> { hasPersonalDetails, ambiguous, claims }`, with claims `{ kind: 'age' | 'birthday', value: number | null, subjectKey: string }`; birthdays use `null`. Implement this pure helper in the new `readingMemorySelection.js`, adapting the older plan's proposed location. Pass each current source's ID explicitly, including `card-0` through `card-77`; those IDs are current-input sources, while `memory` remains the stored-note source. Saved focus is excluded from detail ownership.
- `selectMemoriesForReading(candidates, { sources, displayName = '', limit = 3 }) -> MemorySelection` consumes Task 2's current sources separately. Saved focus cannot authorize a remembered personal detail.
- `markReadingMemoriesAccessed(db, userId, ids, accessedAt) -> Promise<void>` updates only matching global, unexpired rows for that user. Selection IDs remain internal.

- [x] **Write the failing regressions:** `an older relevant memory outranks eight newer unrelated notes`; `retrieving candidates performs no access write`; `only memories retained by a successful final attempt are stamped`.
- [x] **Implement pure safety filtering before ranking.** Ignore null/malformed rows and non-string keyword entries, exclude expired/non-global/unsafe notes, and deduplicate IDs and normalized text. Require current-source relevance for life-context, theme, affinity, and general notes. Permit at most one communication-style note without topic overlap, applied silently and subordinate to current explicit preferences.
- [x] **Implement conservative detail ownership.** Use the older plan's entire Task 9 subject/detail regression table as synthetic tests. Evaluate each question, general reflection, card reflection, and path label separately; never borrow a subject across fields. First-person and the unambiguous supplied display name map to `self`; named people retain distinct normalized names; relation aliases stay specific; ambiguous plurals/pronouns or unattributed stored fragments authorize nothing. Every age/birthday claim in a candidate must match the same current `kind/value/subjectKey`; extra unmatched detail rejects that note regardless of category or keyword overlap.
- [x] **Define ranking and cap.** Eligible detail-matching notes rank first by distinct matching claims, then lexical overlap. Other relevant notes rank by distinct meaningful current-token overlap; communication status only breaks a tie. Use recency and stable ID as final deterministic tie-breakers. Tokenize Unicode letters/numbers consistently in text and keywords and exclude the older plan's listed stop words. Keywords can improve relevance but cannot establish subject ownership. Apply `limit = 3` last; zero or invalid limits return no memories.
- [x] **Wire selection once per reading.** Treat the personalization loader's `memories` result as candidates until selection. Freeze the selected set in the narrative payload for provider attempts. Direct prompt-builder callers run the same pure selector; they perform no DB writes. Already selected sets must remain idempotent under the same context and cap.
- [x] **Render with auditable retention.** Give selected notes request-local `memory-0`, `memory-1`, `memory-2` slots in delimited JSON data blocks, preserving category labels. Add a dedicated parser for complete memory blocks and ensure truncation drops a memory atomically rather than leaving an untracked fragment. Carry the private slot-to-ID mapping outside prompt/public telemetry. Record candidate/selected/retained counts and exclusion reasons only.
- [x] **Add exact usage guidance:** mention at most one remembered note when it changes the application to the current question; apply communication preferences silently; current question/notes/path labels/preferences override older context. Do not restate personal details not raised about the same subject now.
- [x] **Stamp at final successful use.** In successful reading finalization, intersect final retained slots with selected IDs and update them through the user-scoped helper. Cancelled jobs, blocked evaluations, failed attempts, and discarded provider fallbacks stamp nothing. Local composer stamps only notes it actually renders; safe-fallback stamps nothing. Use the accepted result's fixed completion timestamp, a monotonic update, and the job's existing terminal-state guard so retries/status/SSE replay neither refresh stamps nor undo a newer access. Test cancellation immediately before completion. Treat access-update failure as nonfatal to the reading and log a text-free failure reason; bounded persistence retries may reuse that completion timestamp without generating another reading.
- [x] **Run:** `node --test tests/readingMemorySelection.test.mjs tests/readingMemoryAccess.test.mjs tests/userMemory.test.mjs tests/userPersonalization.test.mjs tests/promptContextRetention.test.mjs tests/localComposerContextPriority.test.mjs`. Cover wrong-user IDs, D1 failures, malformed rows, one-sided labels, swapped ages/owners, repeated candidate IDs, empty current context, notes excluded by final budgets, and provider retries.

**Deliverable:** A small, relevant memory set personalizes the reading; unrelated recent notes do not crowd it out, and database access metadata reflects final successful inclusion.

### Task 7: Verify final prompt provenance across providers, budgets, and consumers

**Files:** Integrate the common prompt builders, `narrativeBackends.js`, `tarot-reading.js`, `readingTelemetry.js`, `telemetrySchema.js`, `graphRAGAlerts.js`, `promptEngineering.js`, both source-usage modules, reading-job forwarding, and the two UI source consumers in the file map. Add `tests/knowledgeGraphContextPipeline.test.mjs`; extend existing retention/source-usage/job tests.

**Interfaces:** Extend existing metadata additively with `queryCoverage` and candidate-count/scoring fields. `sourceUsage.memories` is `{ requested, used, candidatesProvided, memoriesSelected, memoriesUsedInPrompt, skippedReason? }`, with integer counts bounded by 100, 3, and 3 respectively for the initial-reading contract. `used` means inclusion in the final prompt, not proven influence on model output; a local composer reports actual rendered inclusion. Add a request-local internal `memoryRetention` result for finalization. Persist no private source text or stable memory IDs in public metadata or ordinary telemetry.

- [x] **Write end-to-end fixture tests before integration.** Capture final Claude, OpenAI, and Modal payloads through send/fetch stubs using the F1–F7 cases. Verify context, provenance, selected candidate identities, complete reference delimiters, and actual retained memory slots rather than only helper outputs.
- [x] **Integrate the same sources and selected data into every path.** Cover normal JSON generation, streaming generation, Durable Object job start/status/stream, provider fallback, synchronous prompt fallback, and local composition. A backend that does not use a source reports it honestly; it must not inherit another attempt's metadata.
- [x] **Separate all four counts:** detected highlights, eligible/scored passage candidates, selected references, and final retained references. Preserve existing `passagesProvided` as the selected payload count and `passagesUsedInPrompt` as parsed final inclusion. A summary-only block has zero full passages retained. Detect malformed/partial reference blocks as incomplete, never as successful inclusion.
- [x] **Keep identity stable through projection and trimming.** Map retained `candidateId` values back to indices in the selected payload exposed to the client; avoid object-reference identity assumptions when projection creates copies. The UI/journal selects these retained indices, not the separate unconditioned frontend preview list.
- [x] **Extend bounded sanitizers and summaries.** Allow only known source IDs, numeric counts, flags, and reason codes, including path IDs, memory counts, and `unverified_reference_provenance`. Unknown keys and any raw text are dropped. A request whose personal note informs topic selection but is excerpted from retrieval must show that distinction without claiming the note vanished from the narrative prompt.
- [x] **Exercise budget boundaries:** slimming off/on, summary-only GraphRAG, removed GraphRAG, removed direct highlights, one-sided/partly retained paths, atomically removed memories, oversized valid custom spreads, and each provider's real hard-cap policy. Preserve card identity, footer ethics, reference guards, and selected-deck provenance.
- [x] **Exercise privacy and failure boundaries:** names only in paths/memories, injected reference delimiters, hidden roles in notes, safe-fallback responses, cancellation, evaluation replacement, and embedding failure. Required alerts distinguish missing patterns, unavailable embeddings, projection rejection, empty retrieval, and removal for budget.
- [x] **Run:** `node --test tests/knowledgeGraphContextPipeline.test.mjs tests/graphRAGRetention.test.mjs tests/graphRAGProvenance.test.mjs tests/graphRAGAlerts.test.mjs tests/promptContextRetention.test.mjs tests/promptEngineering.test.mjs tests/sourceUsageSummary.test.mjs tests/narrativeReadingModelUtils.test.mjs tests/readingJob.test.mjs tests/readingJobStream.test.mjs tests/tarotReading.telemetry.test.mjs`. Expected: all pass.

**Deliverable:** Prompt text, server metadata, memory access updates, and displayed source usage describe the same final reading attempt.

### Task 8: Qualify the complete change and update maintained documentation

**Files:** Add `tests/fixtures/knowledge-graph-context-cases.json`; extend `scripts/evaluation/verifyNarrativePromptAssembly.js` and `scripts/evaluation/runNarrativeSamples.js`; update `functions/lib/promptVersioning.js`, `docs/knowledge-graph/README.md`, `docs/knowledge-graph/ARCHETYPAL_TRIADS.md`, and `docs/context_personalization.md`.

**Interfaces:** Each synthetic fixture has `id`, fixed `referenceTime`, spread/cards/deck, current inputs, synthetic memory candidates, and expected invariants. Saved qualification manifests record the source revision, fixture hash/order, canon/projection hash, prompt version, provider/model, embedding mode, and final source-usage metadata.

- [x] **Create the deterministic qualification set.** Include all 30 partial pairs and ten complete triads; RWS/Thoth/Marseille projection cases; the 4,991-character-note reproduction; late card-77 evidence; explicit/custom/one-sided decision paths; stale-focus conflicts; the old-memory-beyond-eight case; wrong-subject details; an excluded-shortlist candidate; multilingual questions; and each fallback/budget boundary. Use synthetic personal text throughout.
- [x] **Upgrade the prompt-assembly gate and sample plumbing.** It currently injects hand-built reference samples; route the new corpus through real pattern detection, candidate enumeration, projection, selection, and final builders. Forward synthetic `sample.memories`, `sample.decisionPaths`, and individual card reflections through the same preparation/selection helpers into the sample's narrative payload; assert selected and retained memory counts so a memory case cannot silently exercise the no-memory path. Keep external services stubbed in the deterministic lane. Update artificial passages to satisfy provenance requirements instead of creating a test-only bypass.
- [x] **Bump the reading prompt version once for the integrated release**, using the next unused minor version from the implementation branch (baseline is `1.2.0`). Add a history entry naming partial patterns, structured context, deck projection, full candidate scoring, and memory relevance. Bump the evaluator version if Task 3 changes evaluator wording, following its existing convention.
- [x] **Run final local verification:** `npm test`; `node --test functions/__tests__/knowledgeGraph.test.js`; targeted ESLint on changed JavaScript; `npm run lint`; `node scripts/evaluation/verifyNarrativePromptAssembly.js`; `npm run docs:check`; `git diff --check`. Record unrelated lint/documentation failures against the captured baseline and require zero new errors in changed files. The documentation checker excludes `docs/superpowers`, so manually validate this plan's links as well.
- [x] **Run the required narrative gate once the implementation is ready:** `npm run ci:narrative-check` through the existing subscription authentication. Save run evidence before another invocation can overwrite default artifacts. Missing subscription access is an unrun gate, never permission for paid API fallback.
- [ ] **Run a bounded paired quality comparison** on six synthetic scenarios per deck: partial arc, full arc, long-note conflict, named decision, relevant old memory, and a multilingual candidate-selection case. Freeze 18 case IDs and their order; one baseline and one candidate output per case, 36 outputs total. Use the same subscription model/settings and reference times. Keep the embedding mode identical within a pair; use stubs for deterministic causality and a separately recorded authorized Workers AI lane for real retrieval relevance. Reuse matching saved baseline evidence when its revision/fixture/model identity is exact.
- [ ] **Review the generated readings against the inputs.** Require no undrawn-card assertions, no incompatible deck imagery attributed to drawn cards, correct question/path framing, no unrelated or wrong-subject memory disclosures, accurate source attribution, and no regression in existing ethics/card-coverage/depth gates. Record reviewer judgments alongside automated metrics; prompt inclusion alone is not proof of useful generated prose. Any failure is a failed case, not grounds to silently exclude it or rerun until it passes.
- [x] **Update maintained docs and this checklist with actual results.** Explain both graph-to-prompt paths, current-source precedence, the 8,000-character query projection, candidate versus final passage limits, source-deck handling, memory selection/stamping, and interpretation of provenance fields.

**Deliverable:** A reproducible evidence bundle supports the implemented behavior and its generated-reading quality; documentation states the actual contract.

## Completion criteria and release handoff

The implementation is complete only when every F1–F8 row has passing deterministic coverage, all 30 partial pairs resolve correctly, the full corpus has reviewed deck projections, current-source selection remains correct under accepted limits, full candidate selection and memory relevance pass their regression cases, and final prompt/source-usage/access metadata agree.

Execute Tasks 1–3 in order, Task 4 before Task 5, Task 6 after Tasks 2–3, and Task 7 after Tasks 1–6. Task 8 qualifies the integrated result. Each task is a focused review/commit unit when Git publication is in the authorized execution scope; no commit, push, merge, or deployment is performed by writing this plan.

Before a later authorized release, retain the previous source/Worker version and the qualification manifest. The design requires no new D1 columns, so rollback can return to the prior code version without a schema reversal. Use the repository's local deployment workflow and verify the active Worker version, expected live assets, and controlled live source-usage behavior after deployment. Keep local tests, subscription narrative evaluation, Workers AI verification, deployment, and live proof as separate recorded results.

Do not treat historical memory access stamps as proof of use or try to repair them retrospectively. New telemetry and access semantics begin with the versioned implementation.

## Historical plan validation before implementation on October 22

The plan was self-reviewed against all eight requirement rows, interface compatibility, execution order, failure handling, and completion criteria. Its two Markdown links resolve, and 80 referenced repository paths were checked: 64 exist and 16 are explicitly planned additions. A read-only corpus check confirms 145 passages with 145 unique proposed candidate identity tuples. The plan has no trailing whitespace.

`npm run docs:check` currently fails on 26 links in two pre-existing `.impeccable/critique/` reports dated October 20 and October 22. Those reports are outside this change. All 29 pre-existing changed regular files retain their baseline hashes; the only added Git-status entry is this plan. These are documentation checks, not implementation or generated-reading qualification.


## Implementation and qualification record — October 22

Implementation lives in the managed worktree `/home/ubuntu/.codex/worktrees/knowledge-graph-context/tarot`, branch `codex/knowledge-graph-context-20261022`, from `7164fc21c6c9e5988c0c4ac368f843cc5cd0c1df`. The user authorized committing and pushing this implementation branch while retaining the pending qualifications. Merge, database migration and deployment are outside this publication step.

Tasks 1–7 are implemented. Independent scoped reviews approved the decision lifecycle, projection corpus, candidate selection and memory lifecycle after targeted corrections. The broad production review approved the consolidated privacy/telemetry fix wave. A later sample-export reference-time mismatch was reproduced through the real offline CLI and corrected; single-clock and mixed-clock exports now identify their actual clocks. Prompt version is **1.3.0**; evaluator version is **2.5.0**.

The deterministic corpus contains **73 synthetic cases** and passes **219 final provider builds**, **30 authored partial pairs**, **ten complete arcs**, **145 canon passages / 435 deck projections**, and **eleven explicit boundaries**. The eighteen paired case IDs, order and objects remain frozen at SHA-256 `ae2ab4ee406b7b085d6e6f9887b32c7159bb9bf9522b1e33b7f040106acc1c95`. The fixture file hash is `b0636009bccc517d71e9ebc3c07e2292c24945cf188667487226d170ffed9641`; the canon/projection hash is `77bc5a94ee589040318842e12174728403bb670bcfb73e9a71890a432a7f204f`.

Final local verification after the sample-clock export correction passed **4,714 root tests with two skips and zero failures**, 47 Worker graph tests, the deterministic prompt gate, the Vite build, repository/scoped ESLint with no errors or warnings, and the maintained documentation checker (220 Markdown files). The plan's relative links are checked separately because `docs:check` excludes `docs/superpowers`.

`npm run ci:narrative-check` was attempted once through the existing personal Claude subscription (Opus 5.5, `xhigh`). Its first sample failed because the subscription usage limit had been reached. No paid API fallback was used. This is a blocked narrative-quality gate, not a pass.

The frozen baseline comparison attempted all eighteen cases once: **five outputs, thirteen CLI failures, zero retries**. Independent generated-content review passed three available outputs and failed two baseline outputs: named decision options were lost, and an irrelevant coastal-walk memory was disclosed. All five passed the existing saved coverage/spine checks, demonstrating why editorial review remains separate. Candidate narrative generation is **unrun while the confirmed subscription limit remains in effect**. The required 36-output paired quality comparison is incomplete; failed/unavailable cases are retained and were not excluded or rerun. Final candidate prompts and source-usage metadata can be inspected without claiming generated-prose qualification.

A separate authorized Workers AI lane fetched complete real `@cf/baai/bge-m3` vectors for nineteen unique synthetic texts. Actual retrieval used semantic scoring in sixteen paired cases; one case had no detected graph patterns and one had no eligible canon passages. Those two omissions are accurately reported. The connector truncated the first batch tensor transfers, so complete tensors were transferred one input at a time and validated as 1,024 finite values before replaying the real vectors into retrieval. This evidence does not establish production network latency, cache behavior, or generated-reading usefulness.

All 145 authored projections were reviewed independently by agents. The requested **human editorial review remains outstanding**; a complete original/projection review artifact is retained in the evidence bundle. No historical memory access stamps were repaired.

The replay scripts, exact source snapshots, manifests, test logs and review reports live under `.superpowers/sdd/2026-10-22-knowledge-graph-context-remediation/`. Frozen source archives are stored outside maintained Markdown traversal at `/home/ubuntu/.codex/artifacts/knowledge-graph-context-20261022/`, with evidence-directory symlinks. Task 8 is locally implemented and deterministically verified, but full generated-reading qualification and human editorial approval remain incomplete.


### Resumed qualification check at 17:24 UTC

The user requested resumption after the local implementation/checks finished. A read-only live subscription usage check returned HTTP 200: five-hour use 2%, weekly use **100%**, weekly reset **2026-10-24T03:59:59.562918Z**. No additional narrative generation was attempted during that resumption while the confirmed limit persisted. The eighteen frozen candidate prompt previews report their actual final context, retained references and memories, with zero model-generated candidate outputs. At that snapshot, application files matched the frozen candidate exactly. The broad review's verdict was **code approved; generated-reading qualification incomplete**. Later review fixes and their failed subscription attempts retain separate source identities in the qualification status.

### PR #121 measurement and selective-evaluation follow-up

The re-review of `7dec3846` found two further P2 issues. The memory selector now rejects measurement-only age evidence, preserves numeric commas and mixed fractions before attribution, keeps unsupported continuations ambiguous, and retains separate supported age clauses. The reading route now flattens post-crisis decision notes with stable A/B roles while supplying normalized path labels separately. Explicit clears and replacements no longer force selective evaluation through obsolete position labels; raw crisis screening and current restricted-input gating remain intact.

The fixes add 48 regression tests. Independent bounded review passes 215 focused tests and fifteen asserted route probes. The failed subscription-only gate attempt, original generated-reading evidence and all prior failed probes are preserved separately. The eighteen-pair generated-reading comparison and human editorial review of all 145 canon projections remain pending; the PR stays in draft. See the [qualification status](../../knowledge-graph/QUALIFICATION_STATUS.md) for current verification counts and evidence identities.
