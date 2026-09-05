# Qwen Context Remediation Implementation Checklist

> **For agentic workers:** Use `superpowers:executing-plans` to implement this checklist one finding at a time. This document records proposed work; creating it does not execute the changes or authorize a release.

**Status (2026-09-04):** The original first three checklist items (#1, #6, #7) and the latest review’s top three (journal trust boundary, residual vision prose, silent context clipping) are implemented locally. The latest context work also closes original finding #2 below. Release and live-provider checks remain pending.

**Goal:** Close the remaining Qwen context and prompt review findings with reproducible tests and explicit acceptance criteria.

**Architecture:** The reading API resolves request data and personalization, then runs spread analysis, GraphRAG, and ephemeris enrichment before the shared prompt builder sends two text messages to Modal Qwen. The quality evaluator is a separate Qwen deployment through the Worker AI binding; it needs an explicit contract for the context it judges.

**Tech Stack:** JavaScript ESM, Cloudflare Workers, Modal chat completions, Workers AI evaluation, Node test runner.

**Spec:** The 2026-09-04 Qwen context/prompt review in this conversation. Original finding numbers and their reproductions are preserved below so this checklist is self-contained.

**Source baseline:** `294a74adfe3107f15d008e25bd594905f4985804`, plus the local fixes for findings #4 and #5. Locations below were checked against the current source on 2026-09-04.

## Global constraints

- Preserve the existing card-name, orientation, response-language, user-agency, prompt-budget, and buffered SSE contracts.
- Preserve unrelated edits, including the existing change to `CLAUDE.md`.
- Keep prompt persistence opt-in through `PERSIST_PROMPTS=true`; do not add raw questions, reflections, or memories to ordinary logs or metrics.
- Use server-owned card facts and clearly distinguish user-authored context from instructions and reference material.
- Add a failing behavioral regression before changing each affected implementation. Mock external services for unit tests and inspect the final provider request where a defect crosses modules.
- Run `npm test` and the narrative checks after implementation. Keep local tests, live provider checks, and deployment evidence distinct.

## Priority and dependency order

P1 means address immediately. The remaining original P2 findings are ordered by grounding risk and dependencies, not estimated development time.

| Order | Finding | Priority | Deliverable | Dependency |
| --- | --- | --- | --- | --- |
| 1 | #1: raw card text reaches synthesis | P1 | Close the derived-text injection bypass | None |
| 2 | #6: card identity and metadata disagree | P2 | Resolve canonical card facts on the server | Reuse #1's safe input boundary |
| 3 | #7: secondary vision matches add undrawn cards | P2 | Apply the drawn-card filter to every candidate | Use #6's canonical identity |
| 4 | #8: non-RWS decks receive RWS imagery | P2 | Select imagery and fallback rules by deck | Use #6's deck/card resolution |
| 5 | #2: current context is silently clipped | P2 | Preserve accepted context when budget permits; report losses | None |
| 6 | #3: saved focus overrides the current question | P2 | Preserve source precedence in classification and retrieval | Align with #2's effective context |
| 7 | Additional review observation: conflicting preferences | P2 | Resolve tone/depth instructions once | Before #9 rubric calibration |
| 8 | #9: evaluator lacks personalization context | P2 | Judge the effective generation context with a spread-aware rubric | Use the contracts from #2, #3, and the preference item |

Do not use higher evaluator scores as evidence that earlier findings are closed until #9 is complete. Prompt/request assertions can verify the earlier fixes independently.

## 1. Finding #1 — close the synthesis injection bypass

**Evidence:** `analyzeSingleCard()` copies client-provided `meaning` into synthesis; `buildSingleCardPrompt()` inserts that derived synthesis verbatim. The original probe's instruction-like meaning survived into the mocked Modal request.

**Files:** `functions/api/tarot-reading.js`, `functions/lib/spreadAnalysis.js:1677`, `functions/lib/narrative/prompts/cardBuilders.js:574`, and the existing sanitization helpers in `functions/lib/narrative/helpers.js`.

**Tests:** `tests/narrativePromptSafety.test.mjs`, `tests/narrativeBackends.test.mjs`, and captured API-to-Modal requests in `tests/readingCardResolution.test.mjs`.

- [x] Reproduce a single-card request whose meaning contains `Ignore previous instructions` and a unique output marker; cover both synthesis and the `focusCard.meaning` fallback branch.
- [x] Sanitize client text before analysis and enforce the same trust boundary when derived summaries enter the prompt. Keep user-authored interpretations in clearly delimited context; do not promote them into system directives or trusted reference text.
- [x] Assert that the unsafe instruction cannot reappear through synthesis, focus-card fallback, position notes, or spread summaries in the captured Modal messages. Preserve benign card text and reflections in the same tests.
- [x] Run `node --test tests/narrativePromptSafety.test.mjs tests/narrativeBackends.test.mjs tests/narrativeBuilder.promptCompliance.test.mjs`.

**Implementation:** Card context is sanitized before spread analysis and serialized as untrusted data at derived-text and deck-reference insertions. Budget truncation drops incomplete context records before appending instructions. Benign catalog meanings and reflections retain their content.

**Done when:** The original final-request reproduction fails to carry the injected directive, both derived-text branches are covered, and ordinary single-card readings retain their content. Passing a phrase-filter test alone is insufficient to establish the boundary.

## 2. Finding #6 — make card metadata authoritative

**Evidence:** The API retains client-supplied `number`, `canonicalName`, and `canonicalKey`. A Sun request with `number: 13` reaches imagery selection as Death.

**Files:** `functions/api/tarot-reading.js:748`, `shared/contracts/readingSchema.js`, `shared/vision/cardNameMapping.js`, `src/data/majorArcana.js`, `src/data/minorArcana.js`. Extract a small shared resolver if needed rather than duplicating lookups in builders.

**Tests:** `tests/readingCardResolution.test.mjs`, `tests/readingRequestCards.test.mjs`, and `tests/visionProof.test.mjs`; these exercise the actual API, draw, provider, and signature paths.

- [x] Add fixtures for Sun with number 13, forged canonical keys, conflicting minor suits/ranks, and supported Thoth/Marseille aliases.
- [x] Resolve known card identity from the validated deck and submitted card label. Recompute number, canonical name/key, suit, rank, and rank value from the catalog; preserve the supported display label and requested orientation.
- [x] Normalize conflicting redundant metadata to the resolved identity; reject unknown or ambiguous identities with a clear validation error before analysis or provider calls. Prevent retained extra request fields from overriding resolved facts later.
- [x] Verify that the same resolved card objects drive spread analysis, GraphRAG keys, vision matching, prompt imagery, and output-quality checks.
- [x] Run `node --test tests/readingCardResolution.test.mjs tests/tarotReading.telemetry.test.mjs tests/narrativeInputGuards.test.mjs`.

**Implementation:** `readingCardResolution.js` derives card facts from the catalog. The app and draw endpoint share `shared/contracts/readingRequestCards.js` so canonical catalog cards are submitted with the selected deck label. All 78 cards round-trip in all three decks, including Thoth Prince/Knight identities. Version 2 vision proofs authenticate canonical primary/secondary identity; legacy verification retains its signed format. Output checks accept valid drawn aliases without reporting a second identity for the same name.

**Done when:** The Sun fixture resolves consistently to Sun and never receives Death's imagery; unknown or ambiguous identities are rejected before generation. Supported deck aliases still work.

## 3. Finding #7 — exclude undrawn vision candidates

**Evidence:** `visionValidation.js:308` filters secondary matches only when an upload is unverified. A verified Sun upload can add Moon to a Sun-only prompt.

**Files:** `functions/lib/narrative/prompts/visionValidation.js`; reuse the canonical identity helpers from #6 and existing vision-evidence eligibility logic.

**Tests:** Extend `tests/visionWeaving.test.mjs` and `tests/visionEvidence.test.mjs`.

- [x] Add Sun-only fixtures with Moon as a secondary match for verified, unverified, and telemetry-only uploads, including deck aliases.
- [x] Filter all primary/secondary names and associated interpretive cues against the canonical drawn-card set before prompt insertion. Verification confidence must not bypass membership checks.
- [x] Keep excluded candidates available only to existing diagnostic handling that cannot feed interpretation; preserve valid Sun observations and source attribution.
- [x] Run `node --test tests/visionWeaving.test.mjs tests/visionEvidence.test.mjs tests/promptBuilders.test.mjs`.

**Implementation:** Drawn-card membership applies to primary and secondary diagnostics, per-card cues, generated packets, and directly supplied evidence. Source metadata counts retained evidence headings after filtering and truncation. A signed Sun-plus-Moon fixture verifies both final Modal messages retain Sun evidence and exclude the undrawn Moon and its cues.

**Done when:** Moon and Moon-derived cues are absent from both final provider messages in every Sun-only fixture; valid Sun evidence remains.

## 4. Finding #8 — respect the selected deck throughout imagery assembly

**Evidence:** `helpers.js:962` selects a generic minor imagery hook before adding deck-specific notes. Marseille Eight of Cups and Four of Swords receive RWS narrative scenes. `systemPrompt.js:225` also defaults all decks to RWS meanings/imagery.

**Files:** `functions/lib/narrative/helpers.js`, `functions/lib/imageryHooks.js`, `functions/lib/narrative/prompts/cardBuilders.js`, `functions/lib/narrative/prompts/systemPrompt.js`, `shared/vision/deckProfiles.js`.

**Tests:** Extend `tests/promptBuilders.test.mjs`, `tests/narrativeBuilder.promptCompliance.test.mjs`, and `tests/visionWeaving.test.mjs`.

- [ ] Capture the final prompt for RWS, Marseille, and Thoth versions of the same cards, with and without verified uploaded evidence.
- [ ] Pass the effective deck through both major and minor imagery selection. Use that deck's supported profile; omit unsupported literal scenes instead of silently substituting RWS scenes.
- [ ] Update synthesis and image-evidence fallback instructions to respect the selected deck. Distinguish literal uploaded observations, deck tradition, and interpretive meaning.
- [ ] Assert that Marseille Eight of Cups/Four of Swords omit the RWS departing-traveler/tomb scenes, Thoth retains its supported titles, and RWS fixtures retain their expected imagery.
- [ ] Run `node --test tests/promptBuilders.test.mjs tests/narrativeBuilder.promptCompliance.test.mjs tests/visionWeaving.test.mjs`.

**Done when:** System instructions, card notes, and vision context agree on the selected deck without inventing missing imagery.

## 5. Finding #2 — preserve context and report actual truncation

**Evidence:** Prompt-only limits of 500 question characters, 600 reflection characters, and 100 characters per card reflection truncate accepted inputs before global budgeting. The original 682-character question and 747-character reflection lost final constraints while reporting `truncation: null`.

**Files:** `functions/lib/narrative/prompts/constants.js`, `userPrompt.js`, `cardBuilders.js`, `buildEnhancedClaudePrompt.js`, and `truncation.js` in the same directory; coordinate with `functions/lib/contextDetection.js` and the existing request limits in `shared/contracts/readingSchema.js`.

**Tests:** Extend `tests/promptBuilders.test.mjs`, `tests/promptEngineering.test.mjs`, and `tests/promptDebugHardening.test.mjs`.

- [x] Put explicit constraints at the ends of a 682-character question, 747-character global reflection, and a card reflection longer than 100 characters. Cover ample and deliberately constrained prompt budgets.
- [x] Separate sanitization from budget allocation. Preserve accepted current-session context when the budget permits, within the existing request-size limits; remove the unconditional shorter prompt-only clipping.
- [x] When budget reduction is necessary, preserve the question/task instructions and distribute remaining context deliberately. Add per-source original/effective lengths, whether trimming occurred, and the reason to prompt metadata, including per-card reflections.
- [x] Ensure `used` cannot be mistaken for fully retained. Reconcile source telemetry against the final serialized prompt after every slimming or truncation pass.
- [x] Run `node --test tests/promptBuilders.test.mjs tests/promptEngineering.test.mjs tests/promptDebugHardening.test.mjs tests/narrativePromptSafety.test.mjs`.

**Done when:** Tail constraints survive with sufficient budget; every actual omission is visible in metadata; constrained prompts remain within their cap and retain critical instructions.

## 6. Finding #3 — make current intent control context selection

**Evidence:** `buildContextInferenceInput()` concatenates question, reflections, and focus areas before scoring. The career interview question changes to love when a saved relationship focus is added. `countMatches()` treats `rest` inside `interests` as a wellbeing keyword.

**Files:** `functions/lib/contextDetection.js:420`, `functions/api/tarot-reading.js`, `functions/lib/spreadAnalysisOrchestrator.js`.

**Tests:** Extend `tests/contextDetection.test.mjs` and `tests/graphContext.test.mjs`.

- [ ] Add the interview question with and without `Love & relationships`, the `What interests me?` false match, and empty/ambiguous-question fixtures.
- [ ] Score sources separately with explicit precedence: a clear current question wins; current reflections clarify ambiguity; saved focus areas supply a fallback. Preserve the source that selected the context in diagnostics.
- [ ] Match complete tokens or phrases instead of arbitrary substrings. Cover inflections intentionally rather than restoring broad substring matching.
- [ ] Apply the same source precedence to the reading context and GraphRAG context mapping; do not change their existing public context labels merely to make the strings identical.
- [ ] Run `node --test tests/contextDetection.test.mjs tests/graphContext.test.mjs tests/graphRAG.test.mjs`.

**Done when:** The interview remains career-focused in both pipelines despite saved relationship interests, and `interests` alone does not imply wellbeing. Reflections/focus still help genuinely ambiguous or absent questions.

## 7. Additional review observation — resolve tone/depth contradictions

This was an unnumbered observation in the review, not a replacement for any numbered finding.

**Evidence:** `styleHelpers.js` requests one next step for quick readings and unhedged wording for blunt tone. `userPrompt.js:327` always requests 2–4 steps, while the evaluator rewards conditional language.

**Files:** `functions/lib/narrative/styleHelpers.js`, `functions/lib/narrative/prompts/systemPrompt.js`, `functions/lib/narrative/prompts/userPrompt.js`.

**Tests:** Extend `tests/promptBuilders.test.mjs` and `tests/narrativeBuilder.promptCompliance.test.mjs`.

- [ ] Build a prompt matrix across short/standard/deep depth and gentle/balanced/blunt tone; capture conflicting step counts and instructions.
- [ ] Resolve the output contract once: short requests one action; standard/deep retain the applicable 2–4-step contract. Feed the same resolved values to the system prompt, user footer, and evaluator context.
- [ ] Define blunt as concise and direct while preserving optional action, uncertainty about future outcomes, and the agency rules. Remove instructions that require unqualified certainty.
- [ ] Run `node --test tests/promptBuilders.test.mjs tests/narrativeBuilder.promptCompliance.test.mjs`.

**Done when:** Every matrix entry contains one consistent action-count contract and compatible tone/agency instructions.

## 8. Finding #9 — evaluate the context the generator actually received

**Evidence:** `tarot-reading.js:450` and `evaluation.js:1221` pass question, cards, reading, and metrics without reflections, memories, tone, frame, or depth. `evaluation.js:547` requires cross-card connections for high coherence even for a single-card spread.

**Files:** `functions/api/tarot-reading.js`, `functions/lib/evaluation.js`, `functions/lib/narrativeBackends.js`, and prompt metadata construction where the effective context must be captured.

**Tests:** Extend `tests/evaluation.test.mjs`, `tests/evaluationSyntheticFailures.test.mjs`, and `tests/tarotReading.telemetry.test.mjs`.

- [ ] Define an explicit, bounded evaluation-context object containing the effective question/reflections, eligible memories actually included, focus/context choice, tone, frame, depth, deck, card count, and omission metadata from generation.
- [ ] Thread that object through synchronous gates and scheduled evaluation. Keep requested-but-omitted inputs distinguishable from model-available inputs so assembly failures are not misattributed to the generator.
- [ ] Delimit supplied context as data. Preserve existing redaction/storage modes; do not persist raw memory/reflection text merely because it was added to the evaluator request.
- [ ] Make coherence spread-aware: a single-card reading can score highly through accurate position/orientation interpretation and a concrete synthesis without inventing another card. Keep multi-card connection requirements for multi-card spreads.
- [ ] Add paired fixtures that honor versus contradict a reflection or preference; assert the captured evaluator payload includes the relevant evidence. Test one-card versus multi-card rubric selection and trimmed/missing-context cases.
- [ ] Run `node --test tests/evaluation.test.mjs tests/evaluationSyntheticFailures.test.mjs tests/tarotReading.telemetry.test.mjs` and `node --test functions/__tests__/evaluationHeuristics.test.mjs`.

**Done when:** Payload tests establish context coverage, single-card readings are not structurally capped for lacking cross-card synthesis, and a live evaluator calibration distinguishes the paired fixtures. Unit mocks alone do not establish scoring quality.

## Already implemented and final verification

- [x] #4: Real-versus-fallback embedding provenance; failed embeddings use keyword scoring and propagate truthful semantic status into prompt metadata.
- [x] #5: Cache keys hash the full effective input plus endpoint, model, and API version; failures do not populate the cache.
- [x] Local verification after #4/#5: 1,651 unit tests, changed-file lint, and narrative prompt assembly passed on 2026-09-04. These changes remain uncommitted and undeployed.
- [x] Preserve #4/#5 regressions while completing the first three tasks, including failed-provider recovery and cache separation. Re-run them for subsequent changes.
- [x] Run `npm test`, changed-file ESLint, `git diff --check`, and `node scripts/evaluation/verifyNarrativePromptAssembly.js` on the first-three implementation. `npm run build` also passed. Re-run for subsequent changes.
- [ ] With the existing Modal configuration securely available to the process, run `NARRATIVE_EVAL_BACKEND=modal-qwen npm run ci:narrative-check`. Write generated evaluation artifacts to an isolated validation directory. The previous local-composer run stopped at the Spanish sample and did not complete the narrative gate.
- [ ] Run the applicable vision quality checks if changes reach the vision pipeline; include RWS, Thoth, and Marseille coverage.
- [ ] Run focused live generation checks for injection-boundary behavior, long tail constraints, conflicting focus, canonical card identity, verified secondary matches, deck fidelity, and tone/depth. Check final readings as well as captured prompt structure; keep raw personal data out of ordinary logs.
- [ ] Record separate generation and evaluator results, exact tested revision, and any remaining failures. Complete the new evaluator's paired-fixture calibration before using its scores to justify voice tuning.
- [ ] After integration/deployment is explicitly authorized, release the verified revision and confirm both JSON and buffered SSE readings use it. Verify that SSE reconstruction equals the final reading and neither response exposes hidden reasoning or prompt-debug data.

## First-three verification record (2026-09-04)

- Source: baseline `294a74adfe3107f15d008e25bd594905f4985804` plus uncommitted fixes for #1/#4/#5/#6/#7; no commit, push, migration, or deployment.
- Local checks: 1,731 unit tests, changed-file ESLint, prompt assembly, and diff checks passed. Production frontend build passed with its Browserslist-age and chunk-size warnings.
- Independent review reproduced and then verified closure of the deck-reference context boundary, frontend/draw card naming, signed vision identity, and overlapping Thoth output aliases.
- `NARRATIVE_EVAL_BACKEND=local-composer npm run ci:narrative-check` stopped at the Spanish fixture because the local composer supports English only; the complete narrative gate did not run. Modal configuration was unavailable to this session, so live Qwen generation/evaluator behavior is unverified.
- `npm run ci:vision-check` was attempted in an isolated directory and stopped after more than 12 minutes in the first RWS CLIP recognition run without a completed report. Full recognition metrics/gates are unverified; the changed proof, membership, and prompt paths passed focused tests with RWS, Thoth, and Marseille coverage.
- Validation logs and review reports: `/tmp/tarot-qwen-first-three-ieez_3zr/`. Existing unrelated `CLAUDE.md` edits and the earlier embedding/GraphRAG fixes were preserved.

## Latest review: top-three remediation (2026-09-04)

This round uses the latest review's numbering, distinct from the original findings above.

- [x] **#1 Journal context trust boundary:** Normalize journal context writes to the supported taxonomy, including relationship aliases. Invalid values remain nullable for compatibility. Treat legacy saved descriptions and contexts as bounded, escaped JSON reference data in the follow-up user input. System guidance is static. The save-to-Responses regression verifies the actual provider request.
- [x] **#2 Residual vision prose:** Project recognizer reasoning, details, tone/emotion, diagnostic labels, and modern/legacy evidence at prompt rendering. Remove sentences naming undrawn identities, including supported deck aliases and lower-case recognition comparisons. Preserve independent literal imagery, valid drawn aliases, raw diagnostic evidence, and signed proof bytes. The real vision-proof producer-to-Modal regression covers the complete path.
- [x] **#3 Silent context clipping:** Align inference/prompt limits with accepted 2,000-character questions, 5,000-character global reflections, and 2,000-character per-card reflections. Budget serialized sources separately, retain both ends when necessary, share reflection space, and return unused prose space to context. Compare complete sanitized sources for deduplication. Report per-source lengths, sanitation changes, physical inclusion, effective duplicate retention, and budget loss against the final prompt. Include per-card reflections in aggregate usage. Redact serialized context before prose substitutions, including response echoes.

**Verification:** `npm test` passed 1,759 tests; the separate Functions suite passed 58. Changed-file ESLint, `git diff --check`, narrative prompt assembly, and the production frontend build passed (existing Browserslist-age and chunk-size warnings). The new regressions were observed failing before their fixes. Review follow-ups also cover redaction ordering, per-card aggregate usage, available-budget reuse, and partial deduplication accounting.

**Quality-gate limit:** A fresh `NARRATIVE_EVAL_BACKEND=local-composer npm run ci:narrative-check` again stopped at the Spanish fixture because the local composer supports English only. The complete narrative quality gate and live LLM behavior remain unverified. Provider transports and D1 are stubbed in request-boundary regressions. The unchanged CLIP recognition benchmark was not repeated after the prior incomplete run.

**Scope:** Baseline `294a74adfe3107f15d008e25bd594905f4985804` plus the existing uncommitted work and these fixes. Source-precedence, deck-imagery, depth-contract, evaluator, and follow-up context-expansion findings remain open. No commit, push, migration, deployment, or live provider call. Validation logs: `/tmp/tarot-llm-top-three-mfot232u/`.

## Qwen thinking and token budgets (2026-09-05)

- Verified actual production reasoning on the two synthetic reading requests: 508 and 664 reasoning tokens, both with `finishReason: stop`. These counts came from provider completion logs correlated to the reading request IDs, not from the application's spread-analysis `reasoning` object.
- Qwen requests explicitly enable thinking and preserve-thinking template settings. The existing `medium` reasoning-effort preference remains in use; private reasoning content is excluded from returned readings and logs.
- Removed Qwen's application output-token cap and its inherited prompt slimming/hard-cap budget. The provider enforces its own model/context limits. Existing request validation and prompt word/depth guidance still apply. Azure and Claude retain their separate budgets.
- Reasoning usage survives telemetry as optional numeric counts and a content-presence boolean. Missing evidence is not interpreted as proof that thinking was disabled.
- Verification: 1,777 unit tests, 58 Functions tests, changed-file lint, narrative prompt assembly, and production build passed. The local-composer narrative quality run still stops at its unsupported Spanish fixture; it is not a complete model quality gate.
