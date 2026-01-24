# Narrative Builder & Prompt Engineering Review

**Date:** 2026-01-21
**Reviewer:** GitHub Copilot Code Review Agent
**Files Analyzed:** 7,562 LOC across narrative system

---

## Executive Summary

The narrative builder and prompt engineering system is **functionally solid** with sophisticated features (GraphRAG, token budgeting, A/B testing), but suffers from **technical debt** around file size, code organization, and input validation. The core architecture is sound but needs refactoring for long-term maintainability.

**Overall Grade:** B+ (Functional Excellence, Maintainability Concerns)

---

## 1. Architecture Overview

### Pipeline Flow

```
User Request
    ↓
Validation & Auth
    ↓
Spread Analysis (themes, reversals, GraphRAG)
    ↓
Context Inference & Crisis Detection
    ↓
Backend Selection (Azure GPT-5 → Claude → Local)
    ↓
Prompt Construction (buildEnhancedClaudePrompt)
    ↓
Narrative Generation
    ↓
Quality Gates (hallucinations, coverage, spine)
    ↓
Response Finalization
```

### Key Components

| Component | Location | Responsibility | LOC |
|-----------|----------|---------------|-----|
| **Orchestrator** | `functions/api/tarot-reading.js` | Request handling, backend routing | 1200+ |
| **Prompt Builder** | `functions/lib/narrative/prompts/` | Prompt construction modules + budgeting | 2429 |
| **Prompt Barrel** | `functions/lib/narrative/prompts.js` | Barrel re-export for prompts API | 4 |
| **Helpers** | `functions/lib/narrative/helpers.js` | Card text generation, reversal handling | 1682 |
| **Spread Builders** | `functions/lib/narrative/spreads/*.js` | Spread-specific narrative logic | 1800+ |
| **Reasoning** | `functions/lib/narrative/reasoning*.js` | Tension detection, arc analysis | 1728 |
| **Style** | `functions/lib/narrative/styleHelpers.js` | Tone profiles, personalization | 238 |

---

## 2. Detailed Findings

### 2.1 Critical Issues (Must Fix)

#### 🔴 Issue #1: File Size Explosion

**Problem:**
- `prompts/` modules: 2,429 lines total (largest: `buildEnhancedClaudePrompt.js` 692, `cardBuilders.js` 508)
- `prompts.js`: 4 lines (barrel re-export)
- `helpers.js`: 1,682 lines (70KB)
- Modularized, but overall prompt LOC still high

**Impact:**
- Hard to test specific functionality
- High cognitive load for developers
- Difficult to trace bugs
- Reduced reusability

**Recommendation (implemented 2026-01-22):**
```
functions/lib/narrative/
├── prompts/
│   ├── astro.js
│   ├── budgeting.js
│   ├── buildEnhancedClaudePrompt.js
│   ├── cardBuilders.js
│   ├── constants.js
│   ├── deckStyle.js
│   ├── graphRAGReferenceBlock.js
│   ├── systemPrompt.js
│   ├── truncation.js
│   ├── userPrompt.js
│   └── visionValidation.js
└── prompts.js               # Barrel re-export
```

**Priority:** High
**Effort:** 2-3 days
**Risk:** Medium (requires careful testing)

---

#### 🔴 Issue #2: Crisis Detection Timing

**Status:**
Resolved. Crisis detection now runs immediately after payload validation and subscription context in `functions/api/tarot-reading.js`, before spread analysis or GraphRAG work.

**Priority:** High
**Effort:** 1 hour
**Risk:** Low (straightforward refactor)

---

#### 🔴 Issue #3: Global State in helpers.js

**Problem:**
Legacy global state vulnerable to cross-request bleed (lines 22-41):

```javascript
let PROSE_MODE = false;

export function setProseMode(enabled) {
  PROSE_MODE = !!enabled;
}

export function isProseMode(options = {}) {
  // Mitigation: only honor in tests
  if (env?.NODE_ENV === 'test') {
    return PROSE_MODE;
  }
  return false;
}
```

**Impact:**
- Fragile test helper pattern
- Confusing for new developers
- Risk of production bugs if NODE_ENV check bypassed

**Fix:**
Remove global state; pass `proseMode` explicitly everywhere:

```javascript
// Remove PROSE_MODE and setProseMode entirely

export function isProseMode(options = {}) {
  return options.proseMode === true;
}

// Update all callers to pass proseMode in options
```

**Priority:** Medium
**Effort:** 2-3 hours (update all spread builders)
**Risk:** Medium (requires thorough testing)

---

#### 🔴 Issue #4: Token Truncation Safety Gap

**Status:**
Resolved. `truncateSystemPromptSafely` now throws `PROMPT_SAFETY_BUDGET_EXCEEDED` when critical sections exceed the budget (`functions/lib/narrative/prompts/truncation.js`), and the orchestrator handles it with a 500 response (`functions/api/tarot-reading.js`).

**Priority:** High
**Effort:** 30 minutes
**Risk:** Low (better than silent failure)

---

### 2.2 Security Concerns

#### ⚠️ Security #1: Prompt Injection in sanitizePromptValue

**Status:**
Resolved. `sanitizePromptValue` now strips template syntax (Handlebars/EJS/Jinja style) and normalizes whitespace in `functions/lib/narrative/helpers.js`.

**Priority:** High
**Severity:** Medium (depends on downstream usage)

---

#### ⚠️ Security #2: Vision Proof Mismatch Handling

**Status:**
By design in research mode. Vision proof is optional; mismatches are logged for telemetry but readings proceed.

**Risk:**
- Biased readings from incorrect card data
- User confusion if vision interpretation is wrong
- Data integrity issues

**Mitigation:**
Require explicit user confirmation on mismatch:

```javascript
if (mismatchCount > 0) {
  return jsonResponse({
    error: 'vision_card_mismatch',
    message: 'Physical cards do not match drawn cards. Please confirm to proceed.',
    mismatchDetails: { ... },
    confirmationRequired: true
  }, 409); // Conflict
}
```

**Priority:** Medium
**Severity:** Medium (affects reading quality)

---

#### ⚠️ Security #3: User Reflection Length

**Issue:**
Reflections are sanitized but length cap is applied late in the process (line 129):

```javascript
const MAX_REFLECTION_TEXT_LENGTH = 600;
```

Cap is not enforced at validation stage; only during prompt building.

**Mitigation:**
Add length validation in `safeParseReadingRequest` (schema validation):

```javascript
export const readingSchema = z.object({
  reflections: z.array(z.string().max(600)).optional()
});
```

**Priority:** Low
**Severity:** Low (DoS risk minimal)

---

### 2.3 Performance Issues

#### ⏱️ Performance #1: Synchronous GraphRAG Retrieval

**Issue:**
Blocks prompt building on keyword search (in prompts/buildEnhancedClaudePrompt.js):

```javascript
const passages = retrievePassages(patterns, {
  semanticScoring: false, // Sync mode
  maxPassages
});
```

**Impact:**
- 10-50ms additional latency per reading
- Semantic scoring deferred to async phase

**Recommendation:**
Acceptable for current scale, but consider:
1. Pre-compute passage embeddings at deploy time
2. Cache keyword match results (60s TTL)
3. Document semantic scoring as optional enhancement

**Priority:** Low
**Effort:** 1 day (caching infrastructure)

---

#### ⏱️ Performance #2: Early Spread Analysis

**Issue:**
Full analysis happens before backend selection (lines 680-693). If backend fails, wasted work.

**Impact:**
- Unnecessary ephemeris computation (~50ms)
- GraphRAG retrieval even if Azure API is down

**Recommendation:**
Lazy-load non-critical enrichments:

```javascript
// Minimal analysis first
const baseAnalysis = performBaseSpreadAnalysis(spreadInfo, cardsInfo);

// Backend selection
const backend = selectBackend(env);

// Only then enrich
const fullAnalysis = await enrichAnalysis(baseAnalysis, {
  ephemeris: true,
  graphRAG: true
});
```

**Priority:** Low
**Effort:** 1 day
**Risk:** Medium (refactor analysis pipeline)

---

### 2.4 Maintainability Concerns

#### 📝 Maintainability #1: Spread Builder Duplication

**Issue:**
Each spread reimplements:
- Opening generation
- Reflections section
- Closing personalization

Example: `spreads/celticCross.js`, `spreads/fiveCard.js`, `spreads/threeCard.js` all have similar patterns.

**Recommendation:**
Extract to base builder class or shared functions:

```javascript
// spreads/base.js
export class BaseSpreadBuilder {
  buildOpening(cardsInfo, themes, options) { /* shared logic */ }
  buildReflections(reflections, options) { /* shared logic */ }
  buildClosing(themes, options) { /* shared logic */ }
}

// spreads/celticCross.js
export class CelticCrossBuilder extends BaseSpreadBuilder {
  buildNarrative(payload) {
    return [
      this.buildOpening(payload.cardsInfo, payload.themes, payload.options),
      this.buildNucleus(payload), // Spread-specific
      this.buildTimeline(payload),
      this.buildStaff(payload),
      this.buildClosing(payload.themes, payload.options)
    ].join('\n\n');
  }
}
```

**Priority:** Medium
**Effort:** 2-3 days
**Benefit:** 30-40% LOC reduction in spread builders

---

#### 📝 Maintainability #2: Inconsistent Error Responses

**Issue:**
HTTP status codes vary without clear pattern:
- Vision proof: 400/409
- API limit: 429
- Backend failure: 503
- Quality gate: 503 (could be 422)

**Recommendation:**
Document error response matrix:

| Error Category | Status | Response Shape |
|----------------|--------|----------------|
| Input validation | 400 | `{ error: string, details: object }` |
| Auth/rate limit | 401/429 | `{ error: string, retryAfter?: number }` |
| Vision mismatch | 409 | `{ error: string, confirmationRequired: boolean }` |
| Quality gate | 422 | `{ error: string, qualityIssues: string[] }` |
| Backend failure | 503 | `{ error: string, fallbackUsed: boolean }` |

**Priority:** Low
**Effort:** 2 hours (documentation)

---

#### 📝 Maintainability #3: Missing Input Guards

**Issue:**
Spread builders access `cardsInfo[0]` without existence checks:

```javascript
// spreads/singleCard.js (likely around line 37)
const card = cardsInfo[0]; // ⚠️ No guard
const position = card.position;
```

**Recommendation:**
Add guards at entry points:

```javascript
export function buildSingleCardNarrative(payload) {
  const { cardsInfo = [] } = payload;

  if (cardsInfo.length === 0) {
    throw new Error('NARRATIVE_NO_CARDS');
  }

  const card = cardsInfo[0];
  // Continue...
}
```

**Priority:** Medium
**Effort:** 1 hour (add to all spread builders)

---

#### 📝 Maintainability #4: Incomplete Reasoning Integration

**Issue:**
Reasoning-aware builders (`reasoning.js`, `reasoningIntegration.js`) exist but not used consistently:
- Celtic Cross may not integrate reasoning
- Optional feature creates testing burden

**Recommendation:**
Choose one path:
1. **Make reasoning first-class**: Require in all spreads, test thoroughly
2. **Extract as plugin**: Document as optional enhancement, clear integration points
3. **Remove entirely**: If not providing clear value

**Priority:** Low
**Effort:** 1-2 days (depends on choice)

---

## 3. Testing Gaps

### Current Test Coverage

Existing tests found:
- ✅ `tests/narrativeBuilder.reversal.test.mjs`
- ✅ `tests/promptEngineering.test.mjs`
- ✅ `tests/narrativeSpine.test.mjs`
- ✅ `tests/narrativeBuilder.promptCompliance.test.mjs`

### Missing Tests

| Scenario | Priority | File |
|----------|----------|------|
| Token estimation edge cases (emoji, markdown) | High | `prompts/budgeting.js:estimateTokenCount` |
| Critical section preservation under budget pressure | High | `prompts/truncation.js:truncateSystemPromptSafely` |
| Prompt injection attempts in sanitization | High | `helpers.js:sanitizePromptValue` |
| Empty cardsInfo handling in spread builders | Medium | `spreads/*.js` |
| GraphRAG passage relevance filtering | Medium | `prompts/buildEnhancedClaudePrompt.js:buildEnhancedClaudePrompt` |
| Crisis detection false positives | Medium | `safetyChecks.js:detectCrisisSignals` |
| A/B variant prompt overrides | Low | `tarot-reading.js` |

**Recommendation:**
Add test suite for token budgeting:

```javascript
// tests/tokenBudgeting.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { estimateTokenCount, truncateSystemPromptSafely } from '../functions/lib/narrative/prompts.js';

describe('Token Budgeting', () => {
  it('handles emoji-heavy text conservatively', () => {
    const text = '🌟'.repeat(100); // 100 emoji
    const estimate = estimateTokenCount(text);
    assert(estimate > 100, 'Should over-estimate emoji tokenization');
  });

  it('preserves critical sections under pressure', () => {
    const text = '# ETHICS\nCritical guidance\n\n' + 'Filler content\n'.repeat(1000);
    const result = truncateSystemPromptSafely(text, 100);
    assert(result.text.includes('ETHICS'), 'Should preserve ethics section');
    assert(result.preservedSections.includes('ETHICS'));
  });

  it('fails fast if critical sections exceed 80% budget', () => {
    const text = '# ETHICS\n' + 'X'.repeat(10000); // Exceeds budget
    assert.throws(() => truncateSystemPromptSafely(text, 100));
  });
});
```

---

## 4. Code Quality Metrics

### Complexity Analysis

| File | LOC | Cyclomatic Complexity (est.) | Maintainability |
|------|-----|------------------------------|-----------------|
| `prompts/buildEnhancedClaudePrompt.js` | 692 | High (10+ branches in main builder) | Fair |
| `helpers.js` | 1682 | High (nested conditions in reversals) | Poor |
| `tarot-reading.js` | 1200+ | Very High (orchestration + error handling) | Fair |
| `spreads/celticCross.js` | 467 | Medium | Good |
| `reasoning.js` | 1205 | High (pattern detection logic) | Fair |

### Code Smells Detected

1. **Long Method** (prompts/buildEnhancedClaudePrompt.js): 300+ lines
2. **Long Parameter List** (10+ parameters in spread builders)
3. **Feature Envy** (helpers.js accesses card properties deeply)
4. **Shotgun Surgery** (changing reversal handling requires edits in 5+ files)
5. **Speculative Generality** (reasoning integration half-implemented)

---

## 5. Recommendations Prioritized

### Must Do (Next Sprint)

1. ☑ **Move crisis detection before spread analysis** (1 hour, low risk)
2. ☑ **Add fail-fast for critical section budget overflow** (30 min, low risk)
3. ☑ **Add template syntax stripping to sanitizePromptValue** (30 min, low risk)
4. ☑ **Add input guards to all spread builders** (1 hour, low risk)

**Total Effort:** 3 hours
**Impact:** High (security + performance)

---

### Should Do (Next Quarter)

5. ☑ **Refactor prompts.js into sub-modules** (completed 2026-01-22)
6. ☐ **Remove PROSE_MODE global state** (2-3 hours, medium risk)
7. ☐ **Extract spread builder base class** (2-3 days, medium risk)
8. ☐ **Add comprehensive token budgeting tests** (1 day, low risk)

**Total Effort:** 5-7 days
**Impact:** High (maintainability)

---

### Nice to Have (Backlog)

9. ☐ **Lazy-load non-critical analysis enrichments** (1 day, medium risk)
10. ☐ **Cache GraphRAG keyword matches** (1 day, medium risk)
11. ☐ **Document error response matrix** (2 hours, low risk)
12. ☐ **Decide on reasoning integration strategy** (1-2 days, depends on choice)

**Total Effort:** 3-4 days
**Impact:** Medium (performance + documentation)

---

## 6. Architectural Recommendations

### Long-Term Vision

```
Current: Monolithic spread builders
Future: Plugin-based narrative system

functions/lib/narrative/
├── core/
│   ├── builder.js           # Core narrative builder
│   ├── pipeline.js          # Pipeline orchestration
│   └── registry.js          # Plugin registry
├── plugins/
│   ├── reasoning/           # Reasoning analysis (optional)
│   ├── graphRAG/            # GraphRAG integration (optional)
│   ├── astrology/           # Ephemeris integration (optional)
│   └── vision/              # Vision enrichment (optional)
└── spreads/
    └── [spread builders use plugins via registry]
```

**Benefits:**
- Clear plugin boundaries
- Optional features are truly optional
- Easier testing (mock plugins)
- Gradual migration path

**Migration Path:**
1. Extract token budgeting (quarter 1)
2. Extract GraphRAG injection (quarter 2)
3. Introduce plugin registry (quarter 3)
4. Migrate spread builders (quarter 4)

---

## 7. Security Best Practices Checklist

- [x] Input sanitization before storage
- [x] Authentication & authorization checks
- [x] Rate limiting on API endpoints
- [x] Crisis detection for safety gating
- [x] Vision proof signature verification
- [ ] **Template syntax filtering in sanitization** ⚠️
- [ ] **Explicit user confirmation on vision mismatch** ⚠️
- [ ] **Length validation in schema (not just prompt builder)** ⚠️
- [x] No logging of sensitive data (API keys, PII)
- [x] Fail-fast on safety section truncation

**Score:** 7/10 (Good, with gaps to address)

---

## 8. Performance Best Practices Checklist

- [x] Token estimation with conservative multiplier
- [x] Section-aware truncation
- [x] Metrics collection and logging
- [x] A/B testing infrastructure
- [ ] **Early crisis detection (before expensive analysis)** ⚠️
- [ ] **Lazy-load non-critical enrichments** ⚠️
- [ ] **Cache GraphRAG keyword matches** ⚠️
- [x] Request ID tracing
- [x] Async evaluation via waitUntil()
- [x] Streaming response support

**Score:** 7/10 (Good, with optimization opportunities)

---

## 9. Maintainability Best Practices Checklist

- [ ] **File size under 500 LOC** ⚠️ (prompts/buildEnhancedClaudePrompt.js: 692, prompts/cardBuilders.js: 508, helpers.js: 1682)
- [ ] **No global state** ⚠️ (PROSE_MODE)
- [x] Clear separation of concerns (mostly)
- [ ] **Consistent error responses** ⚠️
- [ ] **Input guards at entry points** ⚠️
- [x] Comprehensive logging
- [x] Prompt versioning
- [x] Type safety (JSDoc comments)
- [ ] **DRY principle in spread builders** ⚠️
- [x] Unit test coverage (partial)

**Score:** 6/10 (Fair, needs refactoring)

---

## 10. Conclusion

### Summary

The narrative builder and prompt engineering system demonstrates **strong functional design** with sophisticated features like GraphRAG integration, token budgeting, and A/B testing. However, **technical debt** around file organization, code duplication, and input validation needs attention.

### Key Strengths

1. **Layered architecture** with clear pipeline stages
2. **Token budgeting** prevents context overflow
3. **Safety-first approach** with crisis detection
4. **Comprehensive metrics** and observability
5. **Flexible backend selection** with fallbacks

### Key Weaknesses

1. **Large modules remain** (prompts/ total 2,429 LOC; helpers.js 1,682; largest prompt modules > 500 LOC)
2. **Code duplication** across spread builders
3. **Input validation scattered** across layers
4. **Performance waste** (late crisis detection, early full analysis)
5. **Global state** (PROSE_MODE)

### Actionable Next Steps

**Week 1:**
- [ ] Move crisis detection before spread analysis
- [ ] Add fail-fast for critical section truncation
- [ ] Add template syntax stripping
- [ ] Add input guards to spread builders

**Month 1:**
- [x] Refactor prompts.js into sub-modules
- [ ] Remove PROSE_MODE global state
- [ ] Add comprehensive token budgeting tests

**Quarter 1:**
- [ ] Extract spread builder base class
- [ ] Document error response matrix
- [ ] Implement GraphRAG caching

### Final Grade

**B+ (83/100)**
- Architecture: A (90)
- Security: B+ (85)
- Performance: B (80)
- Maintainability: C+ (75)
- Testing: B (80)

**Verdict:** System is production-ready but needs refactoring for long-term sustainability. Prioritize the "Must Do" items to address security and performance gaps, then tackle maintainability in subsequent sprints.

---

## Appendix: Code Examples

### Example 1: Improved Crisis Detection

**Before:**
```javascript
// Line 680: Expensive analysis first
const analysis = await performSpreadAnalysis(...);

// Line 712: Crisis check (too late)
const crisisCheck = detectCrisisSignals(...);
if (crisisCheck.matched) {
  return safeFallback();
}
```

**After:**
```javascript
// Line 480: Crisis check first (right after validation)
const crisisCheck = detectCrisisSignals([userQuestion, reflectionsText].filter(Boolean).join(' '));
if (crisisCheck.matched) {
  return jsonResponse({
    reading: generateSafeFallbackReading({ ... }),
    provider: 'safe-fallback',
    gateBlocked: true,
    gateReason: `crisis_${crisisCheck.categories.join('_')}`
  });
}

// Line 680: Only then proceed to analysis
const analysis = await performSpreadAnalysis(...);
```

### Example 2: Template Syntax Filtering

**Before:**
```javascript
export function sanitizePromptValue(text, maxLength = 500) {
  return text
    .replace(/[`#*_>]/g, '')   // Markdown only
    .replace(/\r?\n+/g, ' ');
}
```

**After:**
```javascript
export function sanitizePromptValue(text, maxLength = 500) {
  return text
    .replace(/[`#*_>]/g, '')                           // Markdown
    .replace(/\{\{|\}\}|\$\{|\}|<%|%>|\{#|#\}/g, '')   // Template syntax
    .replace(/\r?\n+/g, ' ');
}
```

### Example 3: Fail-Fast Token Truncation

**Before:**
```javascript
if (criticalTokens > maxTokens * 0.8) {
  console.error('[prompts] CRITICAL: Safety sections exceed 80% of token budget');
  return truncateToTokenBudget(text, maxTokens); // ⚠️ Proceeds anyway
}
```

**After:**
```javascript
if (criticalTokens > maxTokens * 0.8) {
  console.error('[prompts] CRITICAL: Safety sections exceed 80% of token budget');
  throw new Error('PROMPT_SAFETY_BUDGET_EXCEEDED');
}
```

---

**End of Review**
