**Findings**
- High: Eval gate fails closed on eval errors or malformed output; greedy JSON parsing increases error rate, which can block all readings when the gate is enabled. `functions/lib/evaluation.js:606` `functions/lib/evaluation.js:895`
- High: Token streaming explicitly disables gate blocking, so when streaming is allowed under the gate, unsafe output can reach users before any block is possible. `functions/api/tarot-reading.js:801`
- Medium: Redacted metrics can still retain display names because the redaction patterns do not catch the prompt’s "Remember, NAME," closing. `functions/lib/narrative/prompts.js:1027` `functions/lib/evaluation.js:83`
- Medium: Prompt persistence strips questions/reflections but leaves onboarding focus areas; with `PERSIST_PROMPTS` enabled this can still store sensitive user content. `functions/lib/narrative/prompts.js:1048` `functions/lib/promptEngineering.js:208`
- Medium: Hard-cap truncation can occur while slimming is disabled, but token estimates are only emitted when slimming is enabled, so truncations can be invisible in telemetry. `functions/lib/narrative/prompts.js:545` `functions/lib/narrative/prompts.js:581`
- Low: `gate:narrative` only evaluates local composer samples, so LLM prompt regressions (GraphRAG injection, slimming, personalization) are not covered. `scripts/evaluation/runNarrativeSamples.js:203`

**Open Questions**
- Do you want eval gate to fail open on eval errors/timeouts in production, or is strict blocking intended?
- Should token streaming be disabled or buffered whenever the eval gate is enabled?
- Are focus areas and memory/journal context considered safe to persist in prompt engineering payloads?
- Do you want `gate:narrative` to validate LLM prompt assembly in addition to local composer outputs?

**Prioritized Fixes**
1. Make eval gate behavior configurable (fail open vs closed) and harden eval parsing (JSON-only response or schema) to reduce false blocks.
2. When eval gate is enabled, avoid token streaming unless the response is buffered and can still be blocked or replaced.
3. Extend redaction to catch "Remember, Name," and pass displayName into eval redaction where available; add tests for this case.
4. Expand prompt persistence redaction to remove focus areas and other personalization fields (or make it opt-in), with tests.
5. Emit truncation telemetry even when slimming is disabled (e.g., always populate promptMeta truncation fields when hard cap triggers).

**Stack Notes**
- Request flow: validation -> spread analysis -> narrative backend -> local quality gate -> eval gate -> metrics persistence. `functions/api/tarot-reading.js:651`
- Prompt assembly is centralized in `buildEnhancedClaudePrompt` (system + user prompt, deck style, reversal lens, GraphRAG, ephemeris, personalization). `functions/lib/narrative/prompts.js:244`
- GraphRAG metadata is attached to `promptMeta.graphRAG` with semantic scoring flags, passage counts, and includedInPrompt. `functions/lib/narrative/prompts.js:641`
- Slimming is opt-in (`ENABLE_PROMPT_SLIMMING`) with ordered drop steps; hard cap truncation is always enforced. `functions/lib/narrative/prompts.js:444`
- PII handling: prompt logging uses `redactPII` and is disabled in prod; prompt persistence uses strip+redact; eval storage uses redacted reading/question. `functions/lib/readingTelemetry.js:303` `functions/lib/promptEngineering.js:208` `functions/lib/evaluation.js:222`
