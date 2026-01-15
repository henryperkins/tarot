**Findings**
- Medium: Azure token streaming emits unvetted output because structural and eval gates cannot block and `gateBlocked` is forced false, so unsafe/low-quality text can reach users when streaming is enabled; see `functions/api/tarot-reading.js:678` and `functions/api/tarot-reading.js:791`.
- Medium: Hard-cap truncation slices prompts by length and appends a marker, which can drop critical guardrails or card lists and degrade adherence; see `functions/lib/narrative/prompts.js:545` and `functions/lib/narrative/prompts.js:564`.
- Medium: Coverage/hallucination checks rely on literal name/alias matches with word boundaries, so numeric/roman shorthand or minor typos (e.g., "4 of Cups", "IV of Cups") will be treated as missing/hallucinated and can fail the quality gate; see `functions/lib/readingQuality.js:363` and `functions/lib/readingQuality.js:435`.
- Low: Spine validation only recognizes Markdown or bold line headers; if a backend responds in prose without headings (common after truncation or prompt drift), totalSections=0 and the backend is rejected; see `functions/lib/narrativeSpine.js:351`.
- Low: Backend failure reasons/qualityIssues are logged and returned to clients but not persisted in metrics, limiting regression analysis across providers; see `functions/api/tarot-reading.js:265` and `functions/api/tarot-reading.js:935`.

**System Map**
- Input assembly -> client builds cardsInfo/reflections/personalization/location/vision proof and submits streaming request; `src/contexts/ReadingContext.jsx:144`, `functions/api/tarot-reading.js:371`.
- Validation + safety -> schema + payload checks, subscription/limits, crisis gate fallback; `functions/api/tarot-reading.js:371`, `functions/api/tarot-reading.js:594`.
- Analysis + enrichment -> spread analysis + GraphRAG + ephemeris + context inference; `functions/lib/spreadAnalysisOrchestrator.js:155`, `functions/api/tarot-reading.js:559`.
- Prompt construction -> system/user prompts with tone/ethics/length/deck/GraphRAG/vision plus slimming/hard-cap metadata; `functions/lib/narrative/prompts.js:755`, `functions/lib/narrative/prompts.js:545`.
- Generation + gating -> backend chain (Azure/Claude/local) -> structural quality gate -> eval gate + fallback -> metrics + response/stream; `functions/lib/narrativeBackends.js:857`, `functions/api/tarot-reading.js:879`, `functions/lib/evaluation.js:970`.

**Strengths**
- Strong prompt contract with explicit specificity, formatting, and output-style constraints; `functions/lib/narrative/prompts.js:755`, `functions/lib/narrative/prompts.js:766`.
- Deck-aware coverage/hallucination logic (Thoth/Marseille aliases) reduces false positives; `functions/lib/readingQuality.js:363`.
- Multi-backend fallback plus local composer reasoning chain keeps availability high; `functions/lib/narrativeBackends.js:42`, `functions/lib/narrative/reasoning.js:1`.
- Prompt persistence is opt-in with layered PII redaction and display-name sanitization; `functions/lib/promptEngineering.js:285`, `functions/lib/readingTelemetry.js:120`, `functions/lib/narrative/styleHelpers.js:1`.
- Tests cover prompt compliance, spine heuristics, and eval gate behavior; `tests/narrativeBuilder.promptCompliance.test.mjs:157`, `tests/narrativeSpine.test.mjs:10`, `tests/evaluation.test.mjs:78`.

**Gaps in Evaluation Coverage**
- No automated coverage for numeric/roman card shorthand in coverage/hallucination checks; add cases to `tests/readingQuality.test.mjs:107`.
- No tests for token-streaming path behavior when `canUseAzureStreaming` is true (quality gate bypass, gateBlocked signaling); `functions/api/tarot-reading.js:678`.
- Hard-cap truncation tests only verify promptMeta, not that critical sections (card list, reversal framework, ethics) survive; `functions/lib/narrative/prompts.js:545`.
- No telemetry/tests for backend fallback rate or quality gate failure reasons, making regressions provider-specific harder to detect; `functions/api/tarot-reading.js:265`.

**Recommended Improvements**
1. (High impact, low effort) Add a streaming safety mode: buffer first N tokens or short-circuit to buffered streaming when safety gates are configured; optionally surface `gateBlocked`/gateReason in stream meta for monitoring. References: `functions/api/tarot-reading.js:678`, `functions/api/tarot-reading.js:791`.
2. (High impact, medium effort) Normalize numeric/roman/abbrev card references in coverage/hallucination checks (e.g., "4 of Cups", "IV of Cups", "K of Wands"); update alias generation or add canonicalization step. References: `functions/lib/readingQuality.js:363`, `functions/lib/readingQuality.js:435`.
3. (Medium impact, low effort) Make hard-cap truncation section-aware so optional blocks drop first and required sections remain intact; avoid injecting the truncation marker into the model-visible prompt. References: `functions/lib/narrative/prompts.js:545`.
4. (Medium impact, low effort) Persist backendErrors/qualityIssues into metrics payload for regression tracking and provider comparison. References: `functions/api/tarot-reading.js:265`, `functions/api/tarot-reading.js:935`.
5. (Low impact, low effort) Relax spine section detection to accept colon headings (e.g., "Opening:") to reduce false negatives when models drift. References: `functions/lib/narrativeSpine.js:351`.

**Missing Tests / Instrumentation**
- Add numeric/roman card coverage/hallucination tests in `tests/readingQuality.test.mjs:107`.
- Add an integration-style test for token streaming gate behavior and metadata in `functions/lib/readingStream.js:40` or a new server test around `functions/api/tarot-reading.js:678`.
- Add truncation content-preservation tests (card list, reversal framework) in `tests/narrativeBuilder.promptCompliance.test.mjs:787`.
- Persist and assert backend fallback reasons in metrics (new assertions near `tests/evaluation.test.mjs:1123`).

**Questions / Assumptions**
- Is Azure token streaming enabled in production, and should gateBlocked metadata ever be surfaced to clients when `allowGateBlocking` is false? `functions/api/tarot-reading.js:791`.
- Should numeric/roman card shorthands be considered valid coverage for all decks or only RWS? `functions/lib/readingQuality.js:363`.

**Change Summary**
- No code changes made.

**Next Steps**
1. I can draft a patch to harden card normalization + truncation order.
2. I can add the missing tests/instrumentation above.
