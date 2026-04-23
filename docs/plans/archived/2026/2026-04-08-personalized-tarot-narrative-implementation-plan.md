# Personalized Tarot Narrative Implementation Plan (2026-04-08)

## Scope

This plan turns the three findings from the personalized narrative review into implementation work:

1. Streamed follow-up repairs are diagnostics-only, but the unrepaired text is persisted and later reused as stored conversation history.
2. Local-composer non-English fail-closed logic only checks `userQuestion`, so reflections-only non-English inputs can still fall through to English output.
3. `sourceUsage.userContext` is availability-based and incomplete, so it can overstate what personalization inputs actually influenced the reading.

This plan is grounded in static analysis. Local runtime probing was blocked by the current missing `@opentelemetry/api` import path, so the validation section includes a runtime check once the environment is fixed.

## Goals

- Keep follow-up history safe and internally consistent when streamed repairs succeed.
- Make local-composer fail closed on unsupported non-English inputs even when the signal comes from reflections instead of the question field.
- Make `sourceUsage.userContext` truthful about what was provided, what was actually used, and what was skipped.
- Add regression tests that fail before the changes and pass after them.

## Non-goals

- No broad redesign of the reading pipeline or prompt architecture.
- No retroactive rewrite of existing journal follow-up rows.
- No UI redesign beyond the minimum needed to surface more accurate `sourceUsage` details.

## Execution Order

1. Fix follow-up persistence and conversation-history integrity first, because it affects stored assistant turns that are later replayed into the model.
2. Introduce a shared user-context/language-analysis helper and use it to close the reflections-only non-English gap.
3. Rework `sourceUsage.userContext` to use actual inclusion data rather than raw availability flags, then update the UI summary and tests.

## Workstream A: Follow-up persistence and history integrity

### Problem

`functions/api/reading-followup.js` currently persists the exact streamed text even when the post-hoc repair step produces a safer, card-accurate replacement. That raw answer is later reloaded by `buildConversationHistoryFromFollowUps()` and fed back into follow-up context, so a hallucinated or otherwise repaired answer can become durable model history.

### Target contract

- Distinguish between what the user saw during streaming and what the backend should reuse as canonical assistant history.
- When a streamed follow-up repair succeeds and passes safety checks, later model turns should use the repaired canonical text, not the raw streamed draft.
- User-facing history should remain explainable. If product wants strict replay fidelity, preserve the delivered text separately from the canonical history text.

### Proposed code changes

1. Replace `resolveStreamingPersistenceText()` with a helper that returns a structured result, for example:
   - `deliveredText`
   - `canonicalText`
   - `repairApplied`
   - `canonicalSource` (`streamed` or `repaired`)
2. In the streaming `onComplete` path in `functions/api/reading-followup.js`, choose `canonicalText` only after:
   - running hallucination repair,
   - verifying the repaired variant passed `checkFollowUpSafety()`,
   - falling back to the streamed text if repair failed or produced an unsafe result.
3. Add a new migration for `journal_followups`, with a preferred schema like:
   - keep `answer` as the delivered/user-visible text,
   - add `canonical_answer` for server-side history reuse,
   - optionally add `answer_source` or `repair_applied` if diagnostics are needed later.
4. Update follow-up persistence/loading code:
   - `functions/lib/journalFollowups.js` should sanitize and persist `canonicalAnswer` additively.
   - `loadFollowUpsByEntry()` should return `canonicalAnswer` when present.
   - `buildConversationHistoryFromFollowUps()` should prefer `canonicalAnswer ?? answer`.
   - `persistFollowUpToJournal()` should pass both delivered and canonical forms.
5. Audit downstream renderers:
   - `src/components/FollowUpChat.jsx`
   - `src/components/journal/entry-card/**`
   - `src/lib/pdfExport.js`
   These should continue displaying the delivered `answer` unless product explicitly wants repaired text shown to the user retroactively.
6. Add telemetry/logging so repaired-stream events are visible without requiring raw text inspection.

### Tests

- Update `tests/streamingWrapper.test.mjs` so it no longer locks in "persist the exact streamed text" as the only valid behavior.
- Add a focused unit test for the new persistence helper:
  - repaired and safe response -> canonical text uses repaired variant,
  - repair failure or unsafe repair -> canonical text falls back to streamed text.
- Add a persistence/history test proving `buildConversationHistoryFromFollowUps()` uses canonical text when available.
- Add a journal follow-up sanitization test covering the additive `canonicalAnswer` field.

### Migration and rollout notes

- Do not backfill old rows initially. Existing rows can continue to replay `answer` because they have no canonical variant.
- Keep the new schema additive so old rows and old loaders still work during rollout.
- The main product decision is whether journal/chat/PDF surfaces should show delivered text or repaired canonical text. This plan recommends delivered text for UI fidelity and canonical text for backend history reuse.

## Workstream B: Expand non-English fail-closed coverage

### Problem

`getLocalComposerLanguageSupport()` only inspects `userQuestion`. If `userQuestion` is empty but `reflectionsText` is clearly non-English, `composeReadingEnhanced()` still allows the local composer path, which then emits English wrapper text around the reflection content.

### Target contract

- Local composer should evaluate all user-authored text that can materially steer language choice before generating output.
- Reflections-only non-English inputs should fail closed with the same unsupported-language behavior as question-based detection.
- The detector should remain conservative and avoid false positives from names, single borrowed nouns, or short mixed-language fragments.

### Proposed code changes

1. Replace the single-string detector input with a small helper that builds a combined language-analysis sample from:
   - `userQuestion`
   - `reflectionsText`
   - optionally other free-text user inputs if they can independently drive prose language later
2. Update `getLocalComposerLanguageSupport()` in `functions/lib/narrativeBackends.js` to accept either:
   - a structured object, or
   - a normalized combined string plus source metadata.
3. Update `composeReadingEnhanced()` to pass the combined language sample instead of only `userQuestion`.
4. Keep fail-closed semantics narrow:
   - block on clear unsupported-script or high-confidence non-English signals,
   - keep the current bias against weak-token false positives.
5. Audit any other local-composer entry points or fallback paths to ensure they use the same detection helper before calling `buildReadingWithReasoning()` or emitting reflection-specific English wrappers.

### Tests

- Add a regression test for empty `userQuestion` plus Spanish or French `reflectionsText` that expects `LOCAL_COMPOSER_UNSUPPORTED_LANGUAGE_CODE`.
- Add a negative-control test to show English questions with accented names or isolated foreign nouns do not fail closed.
- Add one route/backend test that confirms supported English input still reaches the local composer normally after the helper change.

## Workstream C: Make `sourceUsage.userContext` truthful

### Problem

Both the LLM prompt path and the local-composer path currently derive `sourceUsage.userContext.used` from raw availability checks like `hasUserQuestion || hasReflections || hasFocusAreas`. That misses several real behaviors:

- `displayName`, `readingTone`, `spiritualFrame`, and `preferredSpreadDepth` are ignored entirely.
- reflections can be sanitized away or deduped against per-card reflections.
- prompt budget logic can omit tone/frame sections or truncate optional user-context sections.
- the UI summary can claim "used" even when the effective prompt/backend did not include the supplied input.

### Target contract

`sourceUsage.userContext` should answer three separate questions:

1. What user-context inputs were supplied?
2. Which of those inputs actually influenced the backend output?
3. Which supplied inputs were skipped, and why?

### Proposed code changes

1. Introduce a shared user-context summary helper that tracks at least:
   - `question`
   - `reflections`
   - `focusAreas`
   - `displayName`
   - `readingTone`
   - `spiritualFrame`
   - `preferredSpreadDepth`
2. Capture usage at the point of actual inclusion, not just availability:
   - `functions/lib/narrative/prompts/userPrompt.js` should return metadata for question/reflections/focus areas/display name after sanitization and dedupe.
   - `functions/lib/narrative/prompts/systemPrompt.js` should report whether tone/frame/depth sections were requested and actually included after budget checks.
   - `functions/lib/narrative/prompts/truncation.js` should expose which user-context sections survived truncation so `used` can reflect the final prompt, not the pre-truncation draft.
3. Update the LLM path in `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` to build `sourceUsage.userContext` from prompt metadata instead of raw booleans.
4. Update the local-composer path in `functions/lib/narrativeBackends.js` to use the same summary model, but based on actual composer usage instead of prompt-builder metadata.
5. Keep backward compatibility for current consumers:
   - preserve existing booleans where practical,
   - add richer fields such as `questionUsed`, `reflectionsUsed`, `focusAreasUsed`, `displayNameUsed`, `toneUsed`, `frameUsed`, `depthUsed`, and `skippedInputs`.
6. Update `src/components/reading/complete/sourceUsageSummary.js` so the detail string reflects the richer data set and can show partial use instead of a binary "used" label.

### Tests

- Add a test for `sourceUsage.userContext` when only personalization inputs are present, especially display name / tone / frame / depth.
- Add a test where global reflections are deduped against card-level reflections and therefore should not count as used.
- Add a test where system-prompt budget removes tone/frame guidance and `sourceUsage.userContext` reports that accurately.
- Extend `tests/sourceUsageSummary.test.mjs` to cover the new detail string and partial-use/skipped-input behavior.
- Add or extend prompt-builder tests to assert the new metadata survives prompt truncation and remains consistent with `sourceUsage`.

## Cross-cutting validation

Run the smallest targeted suites first, then the broader checks:

```bash
node --test \
  tests/streamingWrapper.test.mjs \
  tests/narrativeBackends.test.mjs \
  tests/sourceUsageSummary.test.mjs
```

Then run:

```bash
npm test
npm run build
```

For narrative-specific confidence, run:

```bash
npm run ci:narrative-check
```

Manual probes after the code lands:

1. Stream a follow-up that triggers hallucination repair and confirm:
   - the user still receives the streamed text,
   - stored history replays the canonical repaired text,
   - journal/chat/PDF surfaces follow the intended display contract.
2. Submit a local-composer request with empty `userQuestion` and non-English `reflectionsText` and confirm the request fails closed instead of generating English output.
3. Generate readings with:
   - only focus areas,
   - duplicated reflections,
   - tone/frame/depth under a tight token budget,
   and confirm `sourceUsage.userContext` matches the actual prompt/backend behavior.

## Risks and decisions to settle during implementation

- The biggest product decision is whether displayed follow-up history should prioritize fidelity to the streamed text or alignment with the repaired canonical text.
- `sourceUsage.userContext` should remain backward compatible for existing UI consumers; prefer additive schema changes over renaming/removing current fields.
- Non-English detection remains heuristic. Bias toward fail-closed only when the signal is clear enough to avoid breaking English or mixed-language inputs.
- If runtime validation continues to fail because of local dependency drift, fix that environment issue before signing off on the final regression sweep.

## Acceptance criteria

- Stored follow-up history never reuses a known-repaired streamed answer when a safe canonical replacement exists.
- Reflections-only non-English inputs no longer reach English local-composer output.
- `sourceUsage.userContext` reports provided versus used inputs accurately, including display name, tone, frame, depth, dedupe, and budget trimming.
- New regression tests fail on the pre-fix behavior and pass after the implementation.
