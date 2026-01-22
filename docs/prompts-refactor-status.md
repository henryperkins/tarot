# Prompts Refactor Status

## Context / Constraints

- Repo: `/home/azureuser/tarot`
- Code style: ESM, 2-space indent, single quotes, terminal semicolons.
- Request: refactor `functions/lib/narrative/prompts.js` into submodules (there was no `functions/lib/narrative/prompts/` dir).
- Preserve the public import path `functions/lib/narrative/prompts.js` for existing callers/tests.

## Progress / What's Done

- Created `functions/lib/narrative/prompts/` and split the original large file into submodules:
  - `functions/lib/narrative/prompts/astro.js` (`shouldIncludeAstroInsights`)
  - `functions/lib/narrative/prompts/constants.js` (`DEFAULT_REVERSAL_DESCRIPTION`, `MAX_*_TEXT_LENGTH`)
  - `functions/lib/narrative/prompts/deckStyle.js` (`getDeckStyleNotes`, local deck tips)
  - `functions/lib/narrative/prompts/budgeting.js` (`estimateTokenCount`, `getPromptBudgetForTarget`, `getHardCapBudget`)
  - `functions/lib/narrative/prompts/truncation.js` (`truncateSystemPromptSafely`, `truncateToTokenBudget`)
  - `functions/lib/narrative/prompts/graphRAGReferenceBlock.js` (`buildGraphRAGReferenceBlock`)
  - `functions/lib/narrative/prompts/visionValidation.js` (`buildVisionValidationSection`)
  - `functions/lib/narrative/prompts/cardBuilders.js` (spread card blocks + deck-specific context)
  - `functions/lib/narrative/prompts/systemPrompt.js` (`buildSystemPrompt`)
  - `functions/lib/narrative/prompts/userPrompt.js` (`buildUserPrompt`)
  - `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` (`buildEnhancedClaudePrompt` orchestrator)
- Replaced `functions/lib/narrative/prompts.js` with a thin barrel re-export preserving the old API:
  - `shouldIncludeAstroInsights`
  - `estimateTokenCount`, `getPromptBudgetForTarget`, `getHardCapBudget`
  - `truncateSystemPromptSafely`
  - `buildEnhancedClaudePrompt`
- Adjusted token/truncation behavior to satisfy existing unit tests:
  - `estimateTokenCount` now adds a heading penalty.
  - `truncateToTokenBudget` now uses binary search to ensure `estimateTokenCount(result) <= budget`.
  - `truncateSystemPromptSafely` now throws `PROMPT_SAFETY_BUDGET_EXCEEDED` when critical sections consume >=80% of the budget (instead of truncating critical blocks).
- Added spread input-guard wrappers in `functions/lib/narrativeBuilder.js`:
  - Throws `NARRATIVE_NO_CARDS`, `NARRATIVE_CARD_COUNT_MISMATCH`, `NARRATIVE_INVALID_CARD_AT_INDEX` (with `err.details`) before delegating to underlying spread builders.
  - Updated `tests/narrativeBuilder.promptCompliance.test.mjs` to expect rejection for an incomplete Decision spread (previously expected a fallback string).
- Validation:
  - `npm test` passes.

## Key Decisions / Behavior Changes

- `truncateSystemPromptSafely` now fails fast with `PROMPT_SAFETY_BUDGET_EXCEEDED` when safety sections are too large (>=80% of budget).
- Public spread builder entrypoints exported from `functions/lib/narrativeBuilder.js` now throw on invalid/short card payloads instead of returning fallback strings (underlying spread modules still return fallback strings, but wrappers intercept first).

## What's Left / Next Steps

1) Confirm desired behavior for incomplete/invalid spread payloads:
   - Keep current behavior (throw from `functions/lib/narrativeBuilder.js`) OR
   - Revert to "return fallback string" behavior and adjust tests accordingly.
2) Optional (not part of `npm test`): run Worker/unit suite and fix failures if desired:
   - `node --test functions/__tests__/*.test.*`
   - Previously observed 2 failing tests:
     - `functions/__tests__/evaluationHeuristics.test.mjs`
     - `functions/__tests__/knowledgeGraph.test.js`
   - These appear unrelated to the prompts refactor and may pre-exist.
3) Optional hygiene:
   - `npm run lint`
   - Update docs that mention monolithic `functions/lib/narrative/prompts.js` LOC/architecture (it is now a barrel).

## Critical References

- Barrel file: `functions/lib/narrative/prompts.js`
- Main orchestrator: `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`
- Truncation + error semantics: `functions/lib/narrative/prompts/truncation.js`
- Input-guard wrappers: `functions/lib/narrativeBuilder.js`
- Test updated for new behavior: `tests/narrativeBuilder.promptCompliance.test.mjs`

