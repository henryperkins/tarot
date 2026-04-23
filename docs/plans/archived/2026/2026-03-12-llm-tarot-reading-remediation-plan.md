Type: plan
Status: archived snapshot
Last reviewed: 2026-04-23

> Historical note: this plan preserves the original review content, but its file references have been normalized to repo-relative links for portability. Treat it as an audit snapshot, not maintained cross-references.

**Execution Order**

1. Fix vision prompt eligibility first, because it can actively distort LLM tone/meaning on the primary path. The main edit points are [readingQuality.js](../../functions/lib/readingQuality.js), [cardBuilders.js](../../functions/lib/narrative/prompts/cardBuilders.js), [visionValidation.js](../../functions/lib/narrative/prompts/visionValidation.js), and [tarot-reading.js](../../functions/api/tarot-reading.js).

2. Fix local-composer parity second, because it is already user-visible both with no Azure config and after LLM quality-gate fallback. The main edit points are [reasoningIntegration.js](../../functions/lib/narrative/reasoningIntegration.js), [helpers.js](../../functions/lib/narrative/helpers.js), [narrativeBackends.js](../../functions/lib/narrativeBackends.js), and [tarot-reading.js](../../functions/api/tarot-reading.js).

3. Fix GraphRAG source-of-truth drift third, because it is a robustness bug but appears latent on the current first-party producer path. The main edit points are [graphRAGReferenceBlock.js](../../functions/lib/narrative/prompts/graphRAGReferenceBlock.js), [spreadAnalysisOrchestrator.js](../../functions/lib/spreadAnalysisOrchestrator.js), and [buildEnhancedClaudePrompt.js](../../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js).

**Step-by-Step Plan**

1. Freeze a baseline before edits. Re-run the focused suites that already pass and save the current probe outputs for comparison: `tests/narrativeBuilder.promptCompliance.test.mjs`, `tests/narrativeBackends.test.mjs`, `tests/api.vision.test.mjs`, `tests/graphRAGFallback.test.mjs`, `tests/readingQuality.test.mjs`, and `tests/azureResponses.test.mjs`.

2. Add one shared vision-policy helper instead of sprinkling thresholds inline. Put it in [readingQuality.js](../../functions/lib/readingQuality.js) or a new small module beside it, and have it classify each insight into `promptEligible`, `telemetryOnly`, and `suppressionReason`. Require at minimum `matchesDrawnCard === true`; then gate on a confidence floor and, when present, symbol-verification quality. Make the confidence floor env-configurable, but give it a safe default.

3. Attach that classification during annotation, not later in the prompt layer. Update [readingQuality.js](../../functions/lib/readingQuality.js) so `annotateVisionInsights()` returns the original telemetry plus the new prompt-eligibility fields. Do not discard weak insights entirely; keep them for metrics and debugging.

4. Enforce the policy in the actual prompt-shaping code. Update [cardBuilders.js](../../functions/lib/narrative/prompts/cardBuilders.js) so `findVisionInsightForCard()` ignores any insight that is not `promptEligible`. This is the critical fix that stops low-confidence `visualProfile` values from changing the reading voice.

5. Keep the diagnostics block honest. Update [visionValidation.js](../../functions/lib/narrative/prompts/visionValidation.js) so weak but matched uploads are described as untrusted or telemetry-only evidence instead of being presented the same way as prompt-eligible evidence. Do not let the diagnostics block imply that all matched uploads are equally strong.

6. Update response telemetry so the UI and admin tools can tell the difference between “vision uploaded” and “vision used to steer the narrative.” Extend `sourceUsage` in [buildEnhancedClaudePrompt.js](../../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js) and, if needed, `visionMetrics` in [readingQuality.js](../../functions/lib/readingQuality.js) with counts for eligible vs suppressed insights and a top-level suppression reason summary.

7. Add regression tests for the vision path. Add one test that a matched `confidence: 0.01` insight does not emit `Vision-detected tone` or `Emotional quality` in the prompt, one test that high-confidence verified insights still do, and one API-level test in [api.vision.test.mjs](../../tests/api.vision.test.mjs) that the reading still succeeds while weak evidence remains telemetry-only.

8. Define a single opening contract for fallback output. Write the rule down in code comments next to [reasoningIntegration.js](../../functions/lib/narrative/reasoningIntegration.js) and [helpers.js](../../functions/lib/narrative/helpers.js): local-composer output must not start with a spread-title banner or meta-preface, and it should start the same way the LLM prompt contract expects a reading to start.

9. Refactor the local-composer opening paths to follow that contract. Remove the bold spread-title intro from [reasoningIntegration.js](../../functions/lib/narrative/reasoningIntegration.js) and adjust [helpers.js](../../functions/lib/narrative/helpers.js) so the opening starts directly with the reading voice. Keep spread metadata in the API payload and UI, not in the first line of fallback prose.

10. Make fallback parity explicit in tests. Add one direct local-composer test in [narrativeBackends.test.mjs](../../tests/narrativeBackends.test.mjs) asserting the first line is not `**<spread name>**`, and add one route-level test that simulates an Azure quality-gate failure and verifies the returned `provider` is `local-composer` while the opening still follows the new contract.

11. Consolidate GraphRAG to one source of truth. In [graphRAGReferenceBlock.js](../../functions/lib/narrative/prompts/graphRAGReferenceBlock.js), stop trusting `payload.formattedBlock` blindly once passage slicing or budget trimming is in play. Always render the final block from the effective `retrievedPassages`, or remove `formattedBlock` from prompt assembly entirely and treat it as debug/cache-only.

12. Simplify the producer to match that rule. In [spreadAnalysisOrchestrator.js](../../functions/lib/spreadAnalysisOrchestrator.js), either stop storing `formattedBlock` entirely or mark it clearly as a non-authoritative cache. The important invariant is that `passagesUsedInPrompt` must be derived from the same passage list that generated the actual prompt text.

13. Add a defensive invariant for GraphRAG drift. In [buildEnhancedClaudePrompt.js](../../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js), log a diagnostic or throw in test mode if `formattedBlock` implies more passages than the effective capped list. This prevents a silent reintroduction of the bug.

14. Add the missing negative tests for GraphRAG. Extend [graphRAGFallback.test.mjs](../../tests/graphRAGFallback.test.mjs) or [narrativeBuilder.promptCompliance.test.mjs](../../tests/narrativeBuilder.promptCompliance.test.mjs) with a payload whose `formattedBlock` contains more passages than `maxPassages`, and assert that the prompt and telemetry both honor the effective cap.

15. Finish with one regression sweep and two runtime probes. Re-run the focused suites plus two live probes: one no-Azure request that should still return `provider: local-composer` but with the new opening style, and one Azure-bad-response probe that quality-gates into local-composer without changing the reading voice contract.

```bash
node --test \
  tests/narrativeBuilder.promptCompliance.test.mjs \
  tests/narrativeBackends.test.mjs \
  tests/api.vision.test.mjs \
  tests/graphRAGFallback.test.mjs \
  tests/readingQuality.test.mjs \
  tests/azureResponses.test.mjs
```

**Acceptance Criteria**

1. A matched low-confidence vision proof can appear in telemetry, but it cannot inject `visualProfile` tone/emotion into the prompt.

2. A local-composer reading no longer starts with `**<spread name>**` or similar meta-preface, whether it is the primary backend or a fallback after Azure rejection.

3. `promptMeta.graphRAG.passagesUsedInPrompt` can never exceed the effective passage cap, even when a stale `formattedBlock` is supplied.

4. The response payload still preserves `provider`, `backendErrors`, `sourceUsage`, and the current quality-gate behavior.

5. The new tests fail before the fixes and pass after them.

<oai-mem-citation>
<citation_entries>
MEMORY.md:2111-2154|note=[used prior tarot narrative UX and test-contract context to shape remediation order]
MEMORY.md:2385-2404|note=[used prior tarot shared-contract notes to keep spread-layer fixes consistent]
</citation_entries>
<rollout_ids>
019c3142-0393-72f2-8c78-36ecaa997672
</rollout_ids>
</oai-mem-citation>
