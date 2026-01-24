# Narrative Builder Improvements - Action Plan

**Created:** 2026-01-21  
**Status:** In Progress  
**Priority:** High

---

## Quick Wins (3 hours total, in progress)

These are low-risk, high-impact changes that can be implemented immediately. Status reflects current code.

### 1. Move Crisis Detection Earlier ⚡ CRITICAL

**File:** `functions/api/tarot-reading.js`  
**Location:** After payload validation and subscription context, before spread analysis  
**Effort:** 1 hour  
**Risk:** Low  
**Status:** Implemented (safety-gate response path)  

**Why:** Currently wastes expensive spread analysis on inputs that will be rejected anyway.

**Implementation (as shipped):**
```javascript
const user = await getUserFromRequest(request, env);
const subscription = getSubscriptionContext(user);
const crisisCheck = detectCrisisSignals([userQuestion, reflectionsText].filter(Boolean).join(' '));

if (crisisCheck.matched) {
  const crisisSpreadKey = getSpreadKey(spreadInfo.name, spreadInfo?.key || 'custom');
  const crisisMetrics = {
    requestId,
    timestamp: new Date().toISOString(),
    provider: 'safety-gate',
    deckStyle,
    spreadKey: crisisSpreadKey,
    gateBlocked: true,
    gateReason: 'crisis_gate',
    crisisCategories: crisisCheck.categories
  };
  const persistPromise = persistReadingMetrics(env, crisisMetrics);
  if (typeof waitUntil === 'function') {
    waitUntil(persistPromise);
  } else {
    await persistPromise;
  }

  return jsonResponse({
    reading: '...safety response copy...',
    provider: 'safety-gate',
    requestId,
    gateBlocked: true,
    gateReason: 'crisis_gate',
    crisisCategories: crisisCheck.categories
  });
}

// Continue with entitlements/analysis only if no crisis
```

**Testing:**
```bash
# Existing tests should pass
npm test

# Manually verify crisis inputs return early
curl -X POST http://localhost:8787/api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{"question": "should I harm myself", "spread": "single", "cards": [...]}'
```

---

### 2. Add Fail-Fast for Critical Section Truncation 🛡️ CRITICAL

**File:** `functions/lib/narrative/prompts/truncation.js`  
**Lines:** ~239-248  
**Effort:** 30 minutes  
**Risk:** Low  
**Status:** Implemented  

**Why:** Silent degradation of safety guidance is unacceptable.

**Current behavior (as shipped):**
```javascript
if (criticalTokens >= maxTokens || criticalFraction >= 0.8) {
  throw makePromptSafetyBudgetError({
    criticalTokens,
    maxTokens,
    budgetPercent: Number((criticalFraction * 100).toFixed(1))
  });
}
```

**Error Handling in tarot-reading.js (active):**
```javascript
if (error?.message === 'PROMPT_SAFETY_BUDGET_EXCEEDED') {
  return jsonResponse({
    error: 'prompt_budget_exceeded',
    message: 'Unable to generate reading with current configuration.',
    details: error.details || null
  }, { status: 500 });
}
```

**Testing (active):**
```javascript
// Added in tests/narrativePromptSafety.test.mjs
it('fails fast when critical sections exceed 80% budget', () => {
  const largeEthicsSection = '# ETHICS\n' + 'X'.repeat(10000);
  assert.throws(
    () => truncateSystemPromptSafely(largeEthicsSection, 100),
    /PROMPT_SAFETY_BUDGET_EXCEEDED/
  );
});
```

---

### 3. Add Template Syntax Stripping 🔒 HIGH PRIORITY

**File:** `functions/lib/narrative/helpers.js`  
**Lines:** 94-104  
**Effort:** 30 minutes  
**Risk:** Low  
**Status:** Implemented  

**Why:** Prevents potential prompt injection via template engines.

**Implementation:**
```javascript
export function sanitizePromptValue(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return '';
  let trimmed = text.slice(0, maxLength);
  trimmed = filterInstructionPatterns(trimmed);
  return trimmed
    .replace(/[`#*_>]/g, '')                            // Markdown
    .replace(/\{\{|\}\}|\$\{|\}|<%|%>|\{#|#\}|\{%|%\}/g, '')    // Template syntax (Handlebars, EJS, Jinja)
    .replace(/\[%|%\]|\[\[|\]\]/g, '')                  // Additional template patterns
    .replace(/\r?\n+/g, ' ')                            // Flatten newlines
    .replace(/\s{2,}/g, ' ')                            // Collapse whitespace
    .trim();
}
```

**Testing:**
```javascript
// Added in tests/narrativePromptSafety.test.mjs
describe('sanitizePromptValue', () => {
  it('strips template syntax', () => {
    const input = 'Hello {{ name }} and ${user}';
    const output = sanitizePromptValue(input);
    assert(!output.includes('{{'));
    assert(!output.includes('${'));
    assert(output.includes('Hello'));
  });
  
  it('strips EJS syntax', () => {
    const input = '<% code %> and <%- unsafe %>';
    const output = sanitizePromptValue(input);
    assert(!output.includes('<%'));
    assert(!output.includes('%>'));
  });
  
  it('strips Jinja syntax', () => {
    const input = '{% if true %} {# comment #}';
    const output = sanitizePromptValue(input);
    assert(!output.includes('{%'));
    assert(!output.includes('{#'));
  });
});
```

---

### 4. Add Input Guards to Spread Builders 🛡️ HIGH PRIORITY

**Files:** All files in `functions/lib/narrative/spreads/`  
**Effort:** 1 hour  
**Risk:** Low  
**Status:** Implemented (graceful fallback instead of throwing)  

**Why:** Prevents crashes on empty or malformed input.

**Implementation Pattern (as shipped):**
```javascript
// Add to EVERY spread builder at the start

export async function build[SpreadName]Reading({ cardsInfo, ...rest }, options = {}) {
  
  // Input validation + fallback
  const expectedCount = 10; // Adjust per spread
  const receivedCount = Array.isArray(cardsInfo) ? cardsInfo.length : 0;
  const fallback = buildSpreadFallback({ spreadName: '...', expectedCount, receivedCount });

  if (!Array.isArray(cardsInfo) || receivedCount === 0) {
    return fallback;
  }
  if (receivedCount !== expectedCount) {
    return buildSpreadFallback({ spreadName: '...', expectedCount, receivedCount });
  }

  // Validate each card has required properties, otherwise fallback
  for (let i = 0; i < cardsInfo.length; i++) {
    const card = cardsInfo[i];
    if (!card || !card.card || !card.position) {
      return buildSpreadFallback({
        spreadName: '...',
        expectedCount,
        receivedCount,
        reason: `Missing details for card ${i + 1}.`
      });
    }
  }
  
  // Continue with narrative building...
}
```

**Files Updated:**
- `spreads/singleCard.js` (1 card expected)
- `spreads/threeCard.js` (3 cards)
- `spreads/fiveCard.js` (5 cards)
- `spreads/decision.js` (5 cards)
- `spreads/relationship.js` (3 cards)
- `spreads/celticCross.js` (10 cards)

**Testing (update expected behavior if fallback is intended):**
```javascript
// Added in tests/narrativeInputGuards.test.mjs
describe('spread builder input guards', () => {
  it('returns fallback on empty cardsInfo', async () => {
    const result = await buildThreeCardReading({ cardsInfo: [] });
    assert.match(result, /Quick Reset/);
  });
});
```

---

## Testing Checklist

After implementing quick wins:

- [ ] Run targeted guard + prompt safety tests: `node --test tests/narrativePromptSafety.test.mjs tests/narrativeInputGuards.test.mjs` (currently failing)
- [ ] Run full test suite: `npm test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Test crisis detection manually
- [ ] Test with malformed inputs
- [ ] Test with edge case card counts
- [ ] Verify error responses are user-friendly
- [ ] Check logs for appropriate warnings

---

## Deployment Checklist

- [ ] All quick wins implemented
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Error handling tested manually
- [ ] Monitoring alerts configured for new errors
- [ ] Rollback plan documented
- [ ] Deploy to preview environment
- [ ] Smoke test on preview
- [ ] Deploy to production
- [ ] Monitor for 24h

---

## Medium-Term Improvements (Next Quarter)

### 5. Refactor prompts.js into Sub-Modules

**Effort:** 2-3 days  
**Risk:** Medium  
**Priority:** High  

See detailed plan in NARRATIVE_BUILDER_REVIEW.md, section 2.1.

**Structure:**
```
functions/lib/narrative/
├── prompts/
│   ├── index.js              # Re-exports for backward compatibility
│   ├── builder.js            # Main buildEnhancedClaudePrompt
│   ├── tokenBudget.js        # estimateTokenCount, truncation
│   ├── deckStyleTips.js      # DECK_STYLE_TIPS
│   ├── graphRAGInjection.js  # GraphRAG passage integration
│   ├── systemPrompt.js       # System prompt construction
│   ├── userPrompt.js         # User prompt construction
│   └── sections.js           # Section builders
```

**Migration Path:**
1. Create new files with extracted functions
2. Update prompts.js to import and re-export
3. Test thoroughly
4. Update direct importers to use new paths
5. Remove old prompts.js

---

### 6. Remove PROSE_MODE Global State

**Effort:** 2-3 hours  
**Risk:** Medium  
**Priority:** High  

**Files to Update:**
- `functions/lib/narrative/helpers.js` (remove PROSE_MODE, setProseMode)
- All spread builders (ensure proseMode passed in options)
- All tests (pass proseMode explicitly)

**Pattern:**
```javascript
// OLD
setProseMode(true);
const narrative = buildNarrative(payload);

// NEW
const narrative = buildNarrative({ ...payload, proseMode: true });
```

---

### 7. Extract Spread Builder Base Class

**Effort:** 2-3 days  
**Risk:** Medium  
**Priority:** Medium  
**Status:** Implemented (`functions/lib/narrative/spreads/base.js`)  

**Goal:** Reduce code duplication by 30-40% in spread builders.

**Base Class:**
```javascript
// spreads/base.js
export class BaseSpreadBuilder {
  constructor(options = {}) {
    this.options = options;
  }
  
  buildOpening(cardsInfo, themes, userQuestion) {
    // Shared opening logic
  }
  
  buildReflections(reflections) {
    // Shared reflection section
  }
  
  buildClosing(themes) {
    // Shared closing personalization
  }
  
  buildNarrative(payload) {
    throw new Error('buildNarrative must be implemented by subclass');
  }
}
```

**Usage:**
```javascript
// spreads/celticCross.js
import { BaseSpreadBuilder } from './base.js';

export class CelticCrossBuilder extends BaseSpreadBuilder {
  buildNarrative(payload) {
    return [
      this.buildOpening(payload.cardsInfo, payload.themes, payload.userQuestion),
      this.buildNucleus(payload),
      this.buildTimeline(payload),
      // ...spread-specific sections
      this.buildClosing(payload.themes)
    ].join('\n\n');
  }
  
  buildNucleus(payload) {
    // Celtic Cross specific logic
  }
}
```

---

### 8. Add Comprehensive Token Budgeting Tests

**Effort:** 1 day  
**Risk:** Low  
**Priority:** High  
**Status:** Partially implemented (test suite added; fails until fail-fast budget enforcement is added)  

**Test File:** `tests/tokenBudgeting.test.mjs`

**Test Cases:**
- Emoji-heavy text estimation
- Markdown-heavy text estimation
- Unicode text estimation
- Critical section preservation
- Multi-pass truncation
- Budget overflow scenarios
- Edge cases (empty text, very long text, etc.)

---

## Long-Term Vision (Next Year)

### 9. Plugin-Based Narrative System

**Goal:** Make optional features truly optional with clear boundaries.

**Benefits:**
- Easier testing
- Clear feature boundaries
- Gradual migration path
- Reduced coupling

**Architecture:**
```
functions/lib/narrative/
├── core/
│   ├── builder.js           # Core narrative builder
│   ├── pipeline.js          # Pipeline orchestration
│   └── registry.js          # Plugin registry
├── plugins/
│   ├── reasoning/           # Optional reasoning analysis
│   ├── graphRAG/            # Optional GraphRAG integration
│   ├── astrology/           # Optional ephemeris
│   └── vision/              # Optional vision enrichment
└── spreads/
    └── [spread builders use plugins via registry]
```

**Migration Phases:**
1. Q1: Extract token budgeting
2. Q2: Extract GraphRAG injection
3. Q3: Introduce plugin registry
4. Q4: Migrate spread builders

---

## Monitoring & Metrics

### New Metrics to Track

After implementing improvements, monitor:

1. **Crisis Detection Timing:**
   - Time saved by early detection
   - Number of readings saved from analysis

2. **Token Budget Issues:**
   - Number of PROMPT_SAFETY_BUDGET_EXCEEDED errors (only after fail-fast is enabled)
   - Warning frequency when safety sections exceed 80% budget
   - Truncation frequency and sections affected

3. **Input Validation:**
   - Fallback response frequency (Quick Reset) by spread
   - If switching to throw-based guards, track NARRATIVE_* error frequency

4. **Template Injection Attempts:**
   - Log when template syntax is stripped
   - Track patterns to identify malicious actors

### Alerting Thresholds

- **Critical:** PROMPT_SAFETY_BUDGET_EXCEEDED > 5/hour (only after fail-fast is enabled)
- **Warning:** Crisis detection rate > 1%
- **Info:** Token truncation rate > 10%

---

## Success Criteria

### Quick Wins (Week 1)

- [ ] All 4 quick wins implemented
- [ ] Tests passing
- [ ] No regressions in existing functionality
- [x] Documentation updated

### Medium-Term (Quarter 1)

- [ ] prompts.js < 1000 LOC
- [ ] helpers.js < 1000 LOC
- [ ] No global state in narrative system
- [ ] 80%+ test coverage for token budgeting
- [ ] Token budgeting tests passing (suite present; pending fail-fast enforcement)
- [x] Spread builder base class extracted
- [x] All spread builders have input guards

### Long-Term (Year 1)

- [ ] Plugin architecture implemented
- [ ] All optional features pluggable
- [ ] < 500 LOC per file
- [ ] 90%+ test coverage
- [ ] Clear documentation for all modules

---

## Risk Mitigation

### Rollback Plan

If any change causes issues:

1. **Immediate:** Revert PR via GitHub UI
2. **Short-term:** Feature flag to disable new validation
3. **Long-term:** Fix root cause and redeploy

### Feature Flags

Add to `wrangler.jsonc`:

```json
{
  "vars": {
    "ENABLE_EARLY_CRISIS_DETECTION": "true",
    "ENABLE_STRICT_INPUT_VALIDATION": "true",
    "ENABLE_TEMPLATE_SYNTAX_FILTERING": "true",
    "PROMPT_SAFETY_BUDGET_ENFORCEMENT": "true"
  }
}
```

### Gradual Rollout

1. **Week 1:** Deploy to preview environment
2. **Week 2:** Enable for 10% of users (A/B test)
3. **Week 3:** Enable for 50% of users
4. **Week 4:** Enable for 100% of users

---

## Questions & Answers

**Q: Will moving crisis detection break existing tests?**  
A: Unlikely. Tests should pass question validation before hitting spread analysis. If tests do break, they're probably testing the wrong behavior.

**Q: What if a legitimate use case needs template syntax in prompts?**  
A: Very unlikely. If discovered, add an explicit allowlist pattern instead of disabling filtering entirely.

**Q: Will input guards add significant latency?**  
A: No. Validation is < 1ms. The performance gain from early crisis detection (50-100ms saved) far outweighs any validation overhead.

**Q: How do we know if the token budget fix is working?**  
A: Until fail-fast is enabled, monitor warnings and truncation rates. Once enabled, monitor PROMPT_SAFETY_BUDGET_EXCEEDED error rate and investigate if it's > 0.1%.

---

**End of Action Plan**
