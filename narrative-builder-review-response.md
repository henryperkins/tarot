**Findings**
- ~~High: Eval gate is fail-closed by default and uses a 5s timeout; any eval timeout/parse failure blocks readings even when structural metrics pass, which is an availability risk during Workers AI instability.~~ **FIXED**: Default changed to `'open'` - trusts heuristic fallback when AI eval fails. Heuristic still enforces safety (doom language, medical/financial/death advice, hallucinations, low coverage). Override with `EVAL_GATE_FAILURE_MODE=closed` for maximum safety. refs: `functions/lib/evaluation.js:20`
- Medium: Prompt spread-key resolution ignores `spreadInfo.key` and relies on display name only, so renamed/custom spreads fall back to `general` prompt structure while analysis/gates use the key, desyncing prompt intent vs. gate logic. refs: `functions/lib/narrative/prompts.js:282`, `functions/lib/narrative/prompts.js:769`, `functions/lib/readingQuality.js:506`
- Medium: Structural gate uses a spine-completion ratio across all detected sections; heading parsing treats any heading/colon line as a section, so verbose outputs can fail ratio even when card sections are solid, triggering unnecessary backend fallback. refs: `functions/api/tarot-reading.js:969`, `functions/lib/narrativeSpine.js:377`
- Medium: GraphRAG telemetry falls back to analysis retrieval summary when promptMeta is absent (e.g., local composer), which can report GraphRAG usage even when it was not injected, skewing monitoring/experiments. refs: `functions/api/tarot-reading.js:86`, `functions/lib/narrative/prompts.js:742`
- Medium: Eval gate truncates readings at 10k chars; long outputs can hide safety or compliance issues in the tail from evaluation. refs: `functions/lib/evaluation.js:14`, `functions/lib/evaluation.js:614`
- Low: Heuristic safety fallback relies on English regex patterns, so non-English unsafe phrasing can slip through when eval is unavailable. refs: `functions/lib/evaluation.js:29`

**Resolved Questions**
- ~~Should production remain fail-closed for eval outages, or should structural-only fallback be allowed to preserve availability when evaluation fails?~~ **RESOLVED**: Changed default to fail-open. Heuristic safety checks (doom language, medical/financial/death advice, hallucinations >2, coverage <30%) still block unsafe content. Fail-closed available via `EVAL_GATE_FAILURE_MODE=closed`.

**System Map**
```text
Inputs (spreadInfo, cardsInfo, userQuestion, reflections, personalization, deckStyle, location, visionProof)
  -> schema/payload validation + limits + crisis check
  -> performSpreadAnalysis (themes + spread analysis + GraphRAG + ephemeris/forecast)
  -> inferContext
  -> build narrativePayload
  -> prompt assembly (buildEnhancedClaudePrompt: system+user, GraphRAG/ephemeris/deck cues, personalization, slimming+hard cap -> promptMeta)
  -> backend chain (Azure GPT-5 / Claude / local composer)
  -> structural quality gate (coverage + hallucinations + spine ratio)
  -> eval gate (Workers AI + heuristic fallback [fail-open default]; safe fallback on block)
  -> telemetry/persistence (prompt engineering payload, metrics, GraphRAG alerts, async eval)
  -> response (SSE stream or JSON)
```

**Strengths**
- Multi-layer safety and quality gating (crisis detection, structural gate, eval gate, safe fallback) reduces unsafe output exposure. refs: `functions/api/tarot-reading.js:596`, `functions/api/tarot-reading.js:930`, `functions/lib/evaluation.js:975`
- Prompt assembly is centralized and richly conditioned (agency/ethics, personalization, deck cues, GraphRAG, ephemeris) with sanitization and promptMeta instrumentation. refs: `functions/lib/narrative/prompts.js:781`, `functions/lib/narrative/prompts.js:1040`, `functions/lib/narrative/helpers.js:84`
- Deck-aware coverage/hallucination detection supports Thoth/Marseille aliases and avoids common false positives. refs: `functions/lib/readingQuality.js:557`, `functions/lib/readingQuality.js:692`

**Evaluation Coverage Gaps**
- `gate:narrative` defaults to `auto` backend and typically falls back to local composer in CI, so GPT-5/Claude prompt regressions are not exercised. refs: `scripts/evaluation/runNarrativeSamples.js:22`, `scripts/evaluation/runNarrativeSamples.js:152`
- No fixture-based tests for real LLM outputs to lock section parsing/spine detection; current tests are synthetic. refs: `tests/narrativeSpine.test.mjs`
- Prompt-assembly test covers slimming but not hard-cap truncation integrity (card list/instructions survival). refs: `scripts/evaluation/verifyNarrativePromptAssembly.js:114`

**Recommended Improvements (Impact/Effort)**
1. Align prompt spread-key resolution with `getSpreadKey(spreadInfo.name, spreadInfo.key)` to prevent name/key drift (High impact, Low effort). refs: `functions/lib/narrative/prompts.js:282`, `functions/lib/readingQuality.js:506`
2. Replace spine ratio gating with section-aware classification (card-like vs opening/closing/next steps) to reduce false rejections (High impact, Medium effort). refs: `functions/api/tarot-reading.js:969`, `functions/lib/narrativeSpine.js:377`
3. Add a nightly/CI narrative regression harness that runs GPT-5/Claude with real prompt assembly and gates on `buildNarrativeMetrics` deltas (High impact, Medium effort). refs: `scripts/evaluation/runNarrativeSamples.js:152`
4. ~~Make eval-gate resilience explicit: configurable fail-open or structural-only fallback when eval errors/time out, plus stricter eval JSON schema validation to reduce false blocks (Medium impact, Low/Medium effort).~~ **DONE**: Default changed to fail-open; heuristic fallback trusted when AI eval unavailable. refs: `functions/lib/evaluation.js:20`
5. Persist eval-truncation flags into metrics so tail-truncation is visible in dashboards (Medium impact, Low effort). refs: `functions/lib/evaluation.js:614`

**Missing Tests / Instrumentation**
- Fixture tests with redacted GPT-5/Claude outputs that should pass/fail spine/coverage/hallucination checks, stored under `tests/fixtures/`.
- A prompt-assembly test that forces hard-cap truncation and asserts card lists + core instructions remain intact.
- Per-backend attempt telemetry (accepted/rejected + qualityIssues + promptMeta.graphRAG inclusion flags) to debug backend fallbacks without storing full prompts.

If you want, I can take any recommendation and turn it into a concrete patch; just point me at the item numbers.
