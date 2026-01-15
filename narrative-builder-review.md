**Findings**
- High: `gate:narrative` samples are generated exclusively via local composer builders, so prompt/LLM regressions (GPT-5/Claude) aren't exercised by CI and can slip through. `scripts/evaluation/runNarrativeSamples.js:16` `scripts/evaluation/runNarrativeSamples.js:168`
- Medium: Prompt persistence redaction can miss user content when responses echo names not equal to `displayName`, and the inline reflection regex only matches straight quotes despite the comment claiming smart-quote handling; both can leak PII when `PERSIST_PROMPTS` is enabled. `functions/lib/promptEngineering.js:70` `functions/lib/promptEngineering.js:202` `functions/lib/promptEngineering.js:327`
- Medium: GraphRAG telemetry exposed downstream uses the analysis retrieval summary and omits prompt-level inclusion/truncation flags, so monitoring/UI can report GraphRAG "used" even if slimming drops it. `functions/api/tarot-reading.js:134` `functions/lib/narrative/prompts.js:629`
- Medium: Eval gate defaults to fail-open and, on eval failure/incomplete scores, only blocks when heuristics see >2 hallucinations or <30% coverage; safety/tone regressions can pass if eval is unavailable. `functions/lib/evaluation.js:20` `functions/lib/evaluation.js:939` `functions/lib/evaluation.js:1117`
- Low: Offline narrative metrics use regex-only card matching and don't reuse deck-aware logic from runtime, weakening regression signal for alias-heavy or non-RWS outputs. `scripts/evaluation/computeNarrativeMetrics.js:66` `scripts/evaluation/computeNarrativeMetrics.js:112`

**Coverage Notes**
- Flow: request orchestration and runtime quality gate live in `functions/api/tarot-reading.js`, analysis/GraphRAG in `functions/lib/spreadAnalysisOrchestrator.js`, prompt assembly + promptMeta in `functions/lib/narrative/prompts.js`.
- Gates/tests: `gate:narrative` runs `scripts/evaluation/runNarrativeSamples.js` -> `scripts/evaluation/computeNarrativeMetrics.js` -> `scripts/evaluation/verifyNarrativeGate.js` plus `scripts/evaluation/verifyNarrativePromptAssembly.js`; `gate:vision` runs `scripts/evaluation/runVisionConfidence.js` -> `scripts/evaluation/computeVisionMetrics.js` -> `scripts/evaluation/verifyVisionGate.js`.

**Questions / Assumptions**
- Is `PERSIST_PROMPTS` ever enabled outside dev? The PII gaps matter far more if yes.
- Should `gate:narrative` remain deterministic/local-composer-only, or do you want it to exercise GPT-5/Claude outputs?

**Recommendations (Priority Order)**
1. Add an LLM-backed narrative regression harness (same samples, real prompt assembly, GPT-5/Claude outputs) and gate on `buildNarrativeMetrics` deltas to catch prompt/model regressions.
2. Reuse runtime card coverage/hallucination detection in offline narrative metrics to keep `gate:narrative` aligned with production behavior.
3. Harden prompt persistence redaction: fix smart-quote handling in `stripUserContent`, handle nested quotes, and optionally redact proper names echoed in responses when prompt persistence is enabled; extend tests for these cases.
4. Surface `promptMeta.graphRAG` (or merge it into `graphRAGStats`) so inclusion/truncation is visible in metrics/UI.
5. Revisit eval-gate failure mode in production: consider fail-closed or block on narrativeMetrics thresholds when eval is unavailable.

**Change Summary**
- No code changes made.
