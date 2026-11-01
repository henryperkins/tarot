# Symbol interpretation scope — November 1, 2026

Prompt **1.6.12** makes symbol glosses explicitly possible where they enter a card's narrative context. It is a separate local source checkpoint. **Generated content qualification remains open.** No reading, embedding request, push or deployment was made in this pass.

## Observed defect and bounded correction

The [1.6.11 diagnostic](NARRATIVE_FOUR_CASE_DIAGNOSTIC_2026-11-01.md) failed D02: the creative-project reading asked which pieces of the plan had not been picked up, then asserted an unfinished plan. The supplied question and reflection established neither fact.

The actual frozen Challenge context contained `two swords (incomplete plan)`. Its path is the Seven of Swords annotation in `shared/symbols/symbolAnnotations.js`, `getKeySymbols`, `buildKeySymbolText`, and the serialized `reading_context` in the provider prompt. The general system/premise instructions already forbid unsupplied deficits, including in questions and later synthesis. The bare local gloss is a concrete source pressure point; this trace does not prove the stochastic cause of the generated sentence.

The formatter now emits `May symbolize: two swords → incomplete plan` within the full symbol list. Every symbol gloss has this local possibility scope. Objects, reviewed object positions, canonical image facts, canonical interpretations, role labels, reader context, global instructions and output validation are unchanged. The scope also applies when reviewed symbol relationships appear in custom roles. Non-RWS decks still receive no RWS symbol scenes.

This removes an ambiguous source projection, not arbitrary unsupported assertions from model output. In particular, a generated question can still violate the rule. D02's original failure and D03/D04's unstarted status remain intact until separately authorized content review.

## Offline evidence

| Check | Result |
| --- | --- |
| New final-prompt regression, old source | 3 intended failures, one per provider budget; 18 existing tests pass |
| Focused grounding, scene projection and GraphRAG budgets | 237 pass |
| Root suite, credentials stripped | 6,241 pass, 0 fail, 2 skipped |
| Established Worker lane | 70 pass |
| Prompt assembly | 874 fixtures / 2,541 builds pass |
| Build and seven-file ESLint | Pass |
| Four frozen diagnostic inputs plus eleven standard inputs, three provider budgets, before/after | 90 builds / 45 comparisons; exactly the expected symbol formatting changes in 30 user prompts; all system text unchanged |

The four diagnostic baseline prompts reproduce their frozen 1.6.11 hashes exactly. All compared prompts retain identical trimming steps, GraphRAG metadata and scene contracts. Accepted questions and supplied reflections remain intact, including explicit completeness and a supplied incomplete plan with a literal future date. The initial longer label displaced a GraphRAG summary at the existing 6,200-token budget; its failure is preserved. The final compact label passes without raising a budget or weakening an assertion.

An expanded check also ran the legacy `functions/__tests__/telemetry.test.js`. Four failures reproduce on the unchanged integration baseline: unknown-context diagnostics, two reflection-retention expectations, and conflicting deck metadata. Those failures are retained separately; the established 70-test Worker lane does not include that file. They are not reported as passing or repaired in this change.

## Ownership and next evidence

The runtime change is one symbol formatter and the version record. Five test files cover the new behavior and updated version/label expectations. The new narrative code is excluded from both arms of the independently prepared F3b comparison, which shares prompt 1.6.11. A future decision to use 1.6.12 in that comparison must put it in both arms and freeze a new experiment.

The Japanese prose-quality-only waiver remains; every other accepted criterion remains. The next content step is a separately authorized bounded diagnostic on these exact source bytes, with original inputs, full-output review, immutable first attempts and no automatic retry. Offline prompt checks alone cannot clear H1 or justify release.

Private evidence and recovery: `/home/ubuntu/.local/state/tarot/integration-grounding-20261101T051522Z`, especially `narrative/prompt-comparison.json`, `checks/narrative-*`, and `progress.md`.
