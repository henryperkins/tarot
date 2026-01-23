**Findings**
- **High** `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js:444` User-prompt hard-cap trimming drops the tail, which currently contains the only explicit “write the reading” and per-card/next-steps requirements in `functions/lib/narrative/prompts/userPrompt.js:165`; if truncation triggers, those guardrails disappear. This is amplified by prefix-only truncation in `functions/lib/narrative/prompts/truncation.js:27`.
- **Medium** `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js:542` GraphRAG telemetry assumes all passages are present if the header survives, so a partially truncated block can overstate `passagesUsedInPrompt` and hide trimming; detection relies on a header substring and ignores mid-block truncation driven by `functions/lib/narrative/prompts/truncation.js:27`.
- **Medium** `functions/lib/narrative/prompts/truncation.js:153` `truncateSystemPromptSafely` throws when critical sections exceed remaining budget, and the caller doesn’t catch it in `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js:464`, which can hard-fail prompt construction if budgets are tightened or the system prompt grows.
- **Low** Missing tests for hard-cap trimming and GraphRAG inclusion/telemetry in `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js:383`; regressions in truncation behavior won’t be caught by `tests/promptEngineering.test.mjs`.

**Open Questions/Assumptions**
- Are prompt budgets ever set below defaults (e.g., for smaller models) where hard-cap trimming is expected to trigger regularly?
- Is GraphRAG telemetry used for alerting/KPI dashboards that would be skewed by partial truncation?
- Is it acceptable to move/duplicate “must-follow” user instructions into the system prompt without impacting tone/length targets?

**Roadmap (Impact/Effort)**
1) Preserve critical user-prompt footer (move key instructions to system prompt or adopt head+tail truncation). Impact: High, Effort: Low–Med.
2) Make truncation GraphRAG-aware (trim passages before building the prompt and/or parse final user prompt to count actual passages used). Impact: High, Effort: Med.
3) Catch `PROMPT_SAFETY_BUDGET_EXCEEDED` and fall back to a minimal safe system prompt or more aggressive user truncation with telemetry. Impact: Med, Effort: Low.
4) Add unit tests for hard-cap behavior (user prompt footer retention, system prompt section preservation, GraphRAG inclusion counts). Impact: Med, Effort: Med.
5) Add a prompt-adherence regression check (ensure each card name appears at least once; question referenced in Opening/Synthesis). Impact: Med, Effort: Med.

**Change Summary**
- No code changes made; review only.
