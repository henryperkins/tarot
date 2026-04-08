# Personalized Tarot Narrative Review Prompt

```text
Review the personalized tarot reading / narrative-generation system in this repository as a code reviewer, not as a copy editor.

If there is an active diff, prioritize the changed files first, but trace into surrounding modules and tests so you can judge behavioral regressions end to end.

Focus on the actual reading pipeline in this repo:
- API orchestration: `functions/api/tarot-reading.js`, `functions/api/tarot-reading-job-*.js`, `functions/api/reading-followup.js`
- Backend dispatch and fallbacks: `functions/lib/narrativeBackends.js`, `functions/lib/narrativeBuilder.js`
- Prompt construction: `functions/lib/narrative/prompts/*`, `functions/lib/promptEngineering.js`
- Local reasoning and spread logic: `functions/lib/narrative/reasoning.js`, `functions/lib/narrative/spreads/*`, `functions/lib/narrative/helpers.js`
- Quality, telemetry, and safety: `functions/lib/readingQuality.js`, `functions/lib/readingTelemetry.js`, `functions/lib/graphRAGAlerts.js`, `functions/lib/promptInjectionDetector.js`
- User-facing narrative and source-usage surfaces: `src/components/reading/**`, `src/components/journal/**`, `src/components/reading/complete/sourceUsageSummary.js`
- Relevant tests: `tests/narrativeBackends.test.mjs`, `tests/narrativeBuilder.promptCompliance.test.mjs`, `tests/narrativePromptSafety.test.mjs`, `tests/promptEngineering.test.mjs`, `tests/readingQuality.test.mjs`, `tests/tarotReading.telemetry.test.mjs`, `tests/graphRAG*.test.mjs`, `tests/sourceUsageSummary.test.mjs`

Evaluate whether the implementation actually delivers personalized, safe, and internally consistent readings. In particular, check:
- Whether the user's question, reflections, display name, onboarding focus areas, `readingTone`, `spiritualFrame`, `preferredSpreadDepth`, deck style, spread metadata, and card-level details materially influence the final reading.
- Whether spread-specific composers (`single`, `threeCard`, `fiveCard`, `relationship`, `decision`, `celtic`) preserve positional meaning, reversal framework, narrative spine, and high-weight positions.
- Whether Azure GPT-5, Claude Opus 4.5, and `local-composer` dispatch, streaming, fallback, and non-English fail-closed behavior are correct and user-safe.
- Whether GraphRAG, vision cues, ephemeris/forecast, and deck-specific context are included intentionally, slimmed or truncated safely, and reflected accurately in `promptMeta` and `sourceUsage`.
- Whether prompt injection hardening, display-name sanitization, question/reflection sanitization, PII redaction, and prompt persistence rules (`PERSIST_PROMPTS`, unredacted storage controls) are enforced correctly.
- Whether quality gates catch hallucinated cards, low card coverage, missing high-weight positions, incomplete narrative spine, deck-alias edge cases, and misleading source-usage reporting.
- Whether `promptMeta.graphRAG` and related telemetry are internally consistent, especially `includedInPrompt`, `passagesProvided`, `passagesUsedInPrompt`, `truncatedPassages`, `semanticScoringRequested`, `semanticScoringUsed`, and `semanticScoringFallback`.
- Whether UI/source-usage summaries accurately communicate what inputs or knowledge sources were actually used versus requested-but-skipped.
- Whether journal, follow-up, share, and persistence flows preserve the right narrative data without leaking private prompt content or misleading the user about what informed the reading.
- Whether the existing tests cover the highest-risk paths and edge cases, or whether important gaps remain.

Do not spend time on generic style nitpicks or purely cosmetic CSS unless it affects reading correctness, safety, telemetry accuracy, or the user's understanding of source usage.

Output:
1. Findings first, ordered by severity.
2. For each finding, include file/line references, why it matters, and the likely user-facing impact.
3. Call out missing or weak tests separately.
4. List open questions or assumptions.
5. End with a brief summary of the overall health of the reading pipeline.
```
