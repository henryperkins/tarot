# Tarot Reading Module Extraction - Integration Plan

## Overview

Phase 1 of the `tarot-reading.js` refactoring extracted three modules containing ~835 lines of code. This plan documents the integration changes needed to complete the extraction by updating imports and removing duplicate code.

**Target Result**: Reduce `tarot-reading.js` from 3,084 lines to ~2,250 lines

---

## Extracted Modules Summary

| Module | Lines | Functions Exported |
|--------|-------|-------------------|
| `readingLimits.js` | 232 | `releaseReadingReservation`, `enforceReadingLimit` |
| `readingStream.js` | 250 | `formatSSEEvent`, `chunkTextForStreaming`, `createReadingStream`, `wrapReadingStreamWithMetadata` |
| `readingTelemetry.js` | 353 | `normalizeBooleanFlag`, `isEvalGateEnabled`, `isAzureTokenStreamingEnabled`, `allowStreamingWithEvalGate`, `getSemanticScoringConfig`, `shouldLogLLMPrompts`, `shouldLogNarrativeEnhancements`, `shouldLogEnhancementTelemetry`, `summarizeNarrativeEnhancements`, `maybeLogNarrativeEnhancements`, `maybeLogPromptPayload`, `maybeLogEnhancementTelemetry`, `trimForTelemetry` |

---

## Step 1: Add New Imports

Add the following imports **after line 106** (after the existing `azureResponsesStream.js` import):

```javascript
import {
  releaseReadingReservation,
  enforceReadingLimit
} from '../lib/readingLimits.js';

import {
  formatSSEEvent,
  chunkTextForStreaming,
  createReadingStream,
  wrapReadingStreamWithMetadata
} from '../lib/readingStream.js';

import {
  normalizeBooleanFlag,
  isEvalGateEnabled,
  isAzureTokenStreamingEnabled,
  allowStreamingWithEvalGate,
  getSemanticScoringConfig,
  shouldLogLLMPrompts,
  shouldLogNarrativeEnhancements,
  shouldLogEnhancementTelemetry,
  summarizeNarrativeEnhancements,
  maybeLogNarrativeEnhancements,
  maybeLogPromptPayload,
  maybeLogEnhancementTelemetry,
  trimForTelemetry
} from '../lib/readingTelemetry.js';
```

**IMPORTANT**: The extracted modules are currently in `functions/api/` but should be moved to `functions/lib/` for consistency with other utility modules. Update the import paths accordingly.

---

## Step 2: Move Extracted Modules to `functions/lib/`

Move the three extracted files from `functions/api/` to `functions/lib/`:

```bash
mv functions/api/readingLimits.js functions/lib/readingLimits.js
mv functions/api/readingStream.js functions/lib/readingStream.js
mv functions/api/readingTelemetry.js functions/lib/readingTelemetry.js
```

Update internal imports in these files:
- `readingLimits.js`: Change `'./usageTracking.js'` to `'./usageTracking.js'` (no change needed - already relative)
- `readingLimits.js`: Change `'./clientId.js'` to `'./clientId.js'` (no change needed)
- `readingTelemetry.js`: Change `'./promptEngineering.js'` to `'./promptEngineering.js'` (no change needed)
- `readingTelemetry.js`: Change `'./environment.js'` to `'./environment.js'` (no change needed)

---

## Step 3: Delete Duplicate Code from `tarot-reading.js`

Delete the following sections **in reverse order** (from bottom to top) to preserve line numbers:

### 3.1 Delete Streaming Utilities (lines 680-853)

Delete from line 680 to 853, which includes:
- `formatSSEEvent` function
- `chunkTextForStreaming` function
- `createReadingStream` function
- `wrapReadingStreamWithMetadata` function

### 3.2 Delete Export Statement (line 628)

Delete line 628:
```javascript
export { summarizeNarrativeEnhancements };
```

### 3.3 Delete Logging Functions and summarizeNarrativeEnhancements (lines 554-678)

Delete from line 554 to 678, which includes:
- `summarizeNarrativeEnhancements` function
- `maybeLogNarrativeEnhancements` function
- `maybeLogPromptPayload` function
- `maybeLogEnhancementTelemetry` function

### 3.4 Delete Boolean Flags and Config Functions (lines 446-552)

Delete from line 446 to 552, which includes:
- `normalizeBooleanFlag` function
- `isEvalGateEnabled` function
- `isAzureTokenStreamingEnabled` function
- `allowStreamingWithEvalGate` function
- `shouldLogLLMPrompts` function
- `shouldLogNarrativeEnhancements` function
- `shouldLogEnhancementTelemetry` function
- `getSemanticScoringConfig` function (with JSDoc comment)

### 3.5 Delete trimForTelemetry (lines 371-376)

Delete from line 371 to 376:
```javascript
function trimForTelemetry(text = '', limit = 500) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}
```

### 3.6 Delete Reading Limit Section (lines 108-289)

Delete from line 108 to 289, which includes:
- Comment header `// Reading Limit Enforcement`
- `READINGS_MONTHLY_KEY_PREFIX` constant
- `READINGS_MONTHLY_TTL_SECONDS` constant
- `releaseReadingReservation` function
- `enforceReadingLimit` function

---

## Step 4: Remove Unused Imports

After deleting the duplicate code, remove these now-unused imports from the top of `tarot-reading.js`:

```javascript
// These are no longer needed (used only by extracted functions):
import {
  decrementUsageCounter,
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow,
  incrementUsageCounter
} from '../lib/usageTracking.js';
import { getClientIdentifier } from '../lib/clientId.js';
```

**Note**: Check if `getClientIdentifier` is used elsewhere in the file before removing.

---

## Verification Checklist

After completing the integration:

- [ ] File compiles without syntax errors
- [ ] All imported functions are used somewhere in the file
- [ ] No `undefined` function errors at runtime
- [ ] `npm test` passes
- [ ] `npm run dev` starts without errors
- [ ] A test reading request completes successfully

---

## Code Diff Summary

The following diagram shows the before/after structure:

```
BEFORE (3,084 lines):
┌─────────────────────────────────────────┐
│ Imports (lines 1-106)                   │
├─────────────────────────────────────────┤
│ Reading Limits (lines 108-289) ──────►  │ EXTRACT to readingLimits.js
├─────────────────────────────────────────┤
│ Helper functions (lines 291-370)        │
├─────────────────────────────────────────┤
│ trimForTelemetry (lines 371-376) ────►  │ EXTRACT to readingTelemetry.js
├─────────────────────────────────────────┤
│ Spread definitions (lines 377-445)      │
├─────────────────────────────────────────┤
│ Boolean flags & config (446-552) ────►  │ EXTRACT to readingTelemetry.js
├─────────────────────────────────────────┤
│ Logging functions (554-678) ─────────►  │ EXTRACT to readingTelemetry.js
├─────────────────────────────────────────┤
│ Streaming utilities (680-853) ───────►  │ EXTRACT to readingStream.js
├─────────────────────────────────────────┤
│ Main business logic (855-3084)          │
└─────────────────────────────────────────┘

AFTER (~2,250 lines):
┌─────────────────────────────────────────┐
│ Imports (expanded with new modules)     │
├─────────────────────────────────────────┤
│ Helper functions                        │
├─────────────────────────────────────────┤
│ Spread definitions                      │
├─────────────────────────────────────────┤
│ Main business logic                     │
└─────────────────────────────────────────┘
```

---

## Notes

1. **Import path consistency**: The extracted modules use relative paths like `'./usageTracking.js'` which work from `functions/lib/`. Verify these paths resolve correctly.

2. **Re-export consideration**: The original file exported `summarizeNarrativeEnhancements`. External consumers (if any) will need to update their imports to use `readingTelemetry.js` instead.

3. **Environment module**: `readingTelemetry.js` imports `isProductionEnvironment` from `'./environment.js'`. Ensure this module exists in `functions/lib/`.

4. **Test coverage**: The extracted modules should have their own test files created in `tests/` to maintain coverage.
