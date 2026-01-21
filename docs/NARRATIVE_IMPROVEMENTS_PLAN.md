# Narrative Builder Improvements - Action Plan

**Created:** 2026-01-21  
**Status:** Ready for Implementation  
**Priority:** High

---

## Quick Wins (3 hours total)

These are low-risk, high-impact changes that can be implemented immediately:

### 1. Move Crisis Detection Earlier ⚡ CRITICAL

**File:** `functions/api/tarot-reading.js`  
**Lines:** Move from ~712 to ~480  
**Effort:** 1 hour  
**Risk:** Low  

**Why:** Currently wastes expensive spread analysis on inputs that will be rejected anyway.

**Implementation:**
```javascript
// After line 483 (after schema validation)
const crisisCheck = detectCrisisSignals(
  [userQuestion, reflectionsText].filter(Boolean).join(' ')
);

if (crisisCheck.matched) {
  const crisisReason = `crisis_${crisisCheck.categories.join('_') || 'safety'}`;
  console.warn(`[${requestId}] Crisis gate triggered early: ${crisisReason}`);
  
  await releaseReadingReservation(env, readingReservation);
  
  return jsonResponse({
    reading: generateSafeFallbackReading({
      spreadKey: getSpreadKey(spreadKey),
      cardCount: cardsInfo?.length || 0,
      reason: crisisReason
    }),
    provider: 'safe-fallback',
    requestId,
    gateBlocked: true,
    gateReason: crisisReason
  });
}

// Continue with spread analysis only if no crisis
const analysis = await performSpreadAnalysis(...);
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

**File:** `functions/lib/narrative/prompts.js`  
**Lines:** ~326-330  
**Effort:** 30 minutes  
**Risk:** Low  

**Why:** Silent degradation of safety guidance is unacceptable.

**Implementation:**
```javascript
// Replace lines 326-330
if (criticalTokens > maxTokens * 0.8) {
  const error = new Error('PROMPT_SAFETY_BUDGET_EXCEEDED');
  error.details = {
    criticalTokens,
    maxTokens,
    budgetPercent: (criticalTokens / maxTokens * 100).toFixed(1)
  };
  console.error('[prompts] CRITICAL: Safety sections exceed 80% of token budget', error.details);
  throw error;
}
```

**Error Handling in tarot-reading.js:**
```javascript
try {
  const prompts = await buildEnhancedClaudePrompt(...);
} catch (err) {
  if (err.message === 'PROMPT_SAFETY_BUDGET_EXCEEDED') {
    return jsonResponse({
      error: 'prompt_budget_exceeded',
      message: 'Unable to generate reading with current configuration',
      details: err.details
    }, 500);
  }
  throw err;
}
```

**Testing:**
```javascript
// Add to tests/promptEngineering.test.mjs
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
**Lines:** 94-100  
**Effort:** 30 minutes  
**Risk:** Low  

**Why:** Prevents potential prompt injection via template engines.

**Implementation:**
```javascript
export function sanitizePromptValue(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return '';
  let trimmed = text.slice(0, maxLength);
  trimmed = filterInstructionPatterns(trimmed);
  return trimmed
    .replace(/[`#*_>]/g, '')                            // Markdown
    .replace(/\{\{|\}\}|\$\{|\}|<%|%>|\{#|#\}/g, '')    // Template syntax (Handlebars, EJS, Jinja)
    .replace(/\[%|%\]|\[\[|\]\]/g, '')                  // Additional template patterns
    .replace(/\r?\n+/g, ' ')                            // Flatten newlines
    .replace(/\s{2,}/g, ' ')                            // Collapse whitespace
    .trim();
}
```

**Testing:**
```javascript
// Add to tests/promptEngineering.test.mjs
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

**Why:** Prevents crashes on empty or malformed input.

**Implementation Pattern:**
```javascript
// Add to EVERY spread builder at the start

export function build[SpreadName]Narrative(payload) {
  const { cardsInfo = [], themes = {}, userQuestion = '', ...rest } = payload;
  
  // Input validation
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    throw new Error('NARRATIVE_NO_CARDS');
  }
  
  // Spread-specific card count validation
  const expectedCount = 10; // Adjust per spread
  if (cardsInfo.length !== expectedCount) {
    throw new Error(`NARRATIVE_CARD_COUNT_MISMATCH: expected ${expectedCount}, got ${cardsInfo.length}`);
  }
  
  // Validate each card has required properties
  for (let i = 0; i < cardsInfo.length; i++) {
    const card = cardsInfo[i];
    if (!card || !card.card || !card.position) {
      throw new Error(`NARRATIVE_INVALID_CARD_AT_INDEX: ${i}`);
    }
  }
  
  // Continue with narrative building...
}
```

**Files to Update:**
- `spreads/singleCard.js` (1 card expected)
- `spreads/threeCard.js` (3 cards)
- `spreads/fiveCard.js` (5 cards)
- `spreads/decision.js` (5 cards)
- `spreads/relationship.js` (3 cards)
- `spreads/celticCross.js` (10 cards)

**Testing:**
```javascript
// Add to each spread's test file
describe('[SpreadName] Narrative Builder', () => {
  it('throws on empty cardsInfo', () => {
    assert.throws(
      () => build[SpreadName]Narrative({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });
  
  it('throws on wrong card count', () => {
    assert.throws(
      () => build[SpreadName]Narrative({ cardsInfo: [{ card: 'The Fool' }] }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });
  
  it('throws on invalid card data', () => {
    const invalidCards = [{ /* missing 'card' property */ }];
    assert.throws(
      () => build[SpreadName]Narrative({ cardsInfo: invalidCards }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });
});
```

---

## Testing Checklist

After implementing quick wins:

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
   - Number of PROMPT_SAFETY_BUDGET_EXCEEDED errors
   - Truncation frequency and sections affected

3. **Input Validation:**
   - NARRATIVE_NO_CARDS frequency
   - NARRATIVE_CARD_COUNT_MISMATCH frequency
   - NARRATIVE_INVALID_CARD_AT_INDEX frequency

4. **Template Injection Attempts:**
   - Log when template syntax is stripped
   - Track patterns to identify malicious actors

### Alerting Thresholds

- **Critical:** PROMPT_SAFETY_BUDGET_EXCEEDED > 5/hour
- **Warning:** Crisis detection rate > 1%
- **Info:** Token truncation rate > 10%

---

## Success Criteria

### Quick Wins (Week 1)

- [ ] All 4 quick wins implemented
- [ ] Tests passing
- [ ] No regressions in existing functionality
- [ ] Documentation updated

### Medium-Term (Quarter 1)

- [ ] prompts.js < 1000 LOC
- [ ] helpers.js < 1000 LOC
- [ ] No global state in narrative system
- [ ] 80%+ test coverage for token budgeting
- [ ] All spread builders have input guards

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
A: Monitor PROMPT_SAFETY_BUDGET_EXCEEDED error rate. If it's > 0.1%, investigate prompt size limits.

---

**End of Action Plan**
