# P0 Security Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three critical security/safety issues: international phone PII leakage, heuristic fallback safety gaps, and confusing gate configuration.

**Architecture:** Inline all changes into existing files (`promptEngineering.js`, `evaluation.js`). Add curated phone regex patterns from libphonenumber. Add content-aware safety pattern detection to heuristic fallback. Simplify gate config to single env var.

**Tech Stack:** Node.js, regex patterns, existing test framework (node:test)

---

## Task 1: Add International Phone Number Patterns

**Files:**
- Modify: `functions/lib/promptEngineering.js:41-60`
- Test: `tests/promptEngineering.test.mjs`

### Step 1: Write failing tests for international phone formats

Add to `tests/promptEngineering.test.mjs` after line 28:

```javascript
describe('redactPII - international phone numbers', () => {
  test('redacts UK phone numbers', () => {
    const text = 'Call me at +44 20 7946 0958 tomorrow.';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Call me at [PHONE] tomorrow.');
  });

  test('redacts French phone numbers', () => {
    const text = 'Contact: +33 1 42 68 53 00';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Contact: [PHONE]');
  });

  test('redacts German phone numbers', () => {
    const text = 'Reach me at +49 89 123456 or 089-123456';
    const result = redactPII(text, {});

    assert.ok(!result.includes('123456'), 'German numbers should be redacted');
  });

  test('redacts Japanese phone numbers', () => {
    const text = 'Office: +81-3-1234-5678';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Office: [PHONE]');
  });

  test('redacts Australian phone numbers', () => {
    const text = 'Call +61 2 9876 5432 for support.';
    const result = redactPII(text, {});

    assert.strictEqual(result, 'Call [PHONE] for support.');
  });

  test('redacts international format without country code', () => {
    const text = 'My number is 020 7946 0958 in London.';
    const result = redactPII(text, {});

    assert.ok(!result.includes('7946'), 'UK local format should be redacted');
  });

  test('does not false-positive on short digit sequences', () => {
    const text = 'Order #12345 was placed on 2024-01-15.';
    const result = redactPII(text, {});

    assert.ok(result.includes('12345'), 'Short order numbers should remain');
  });

  test('does not false-positive on year ranges', () => {
    const text = 'I worked there from 2018 to 2022.';
    const result = redactPII(text, {});

    assert.ok(result.includes('2018'), 'Years should remain');
    assert.ok(result.includes('2022'), 'Years should remain');
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --test-name-pattern="international phone"
```

Expected: FAIL - patterns not matching international formats

### Step 3: Add international phone patterns

Replace the phone pattern in `functions/lib/promptEngineering.js` at line 45. Replace lines 44-45 with:

```javascript
  // Phone numbers - curated patterns from libphonenumber for major regions
  // US/Canada: +1 (XXX) XXX-XXXX or variants
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext\.?|x)\s*\d{1,6})?\b/gi, replacement: '[PHONE]' },
  // UK: +44 XX XXXX XXXX or 0XX XXXX XXXX
  { pattern: /\b(?:\+44[-.\s]?|0)(?:\d{2}[-.\s]?\d{4}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{4}[-.\s]?\d{6})\b/gi, replacement: '[PHONE]' },
  // EU: +XX X XX XX XX XX or +XX XXX XXX XXX (France, Germany, Italy, Spain, etc.)
  { pattern: /\b\+(?:33|49|39|34|31|32|43|41)[-.\s]?\d{1,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/gi, replacement: '[PHONE]' },
  // Australia: +61 X XXXX XXXX
  { pattern: /\b(?:\+61[-.\s]?|0)[2-478][-.\s]?\d{4}[-.\s]?\d{4}\b/gi, replacement: '[PHONE]' },
  // Japan: +81-X-XXXX-XXXX
  { pattern: /\b\+81[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{4}\b/gi, replacement: '[PHONE]' },
  // Generic international: +XX followed by 8-12 digits with separators
  { pattern: /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,4}\b/gi, replacement: '[PHONE]' },
```

### Step 4: Run tests to verify they pass

```bash
npm test -- --test-name-pattern="international phone"
```

Expected: PASS

### Step 5: Run full test suite to check for regressions

```bash
npm test
```

Expected: All tests pass

### Step 6: Commit

```bash
git add functions/lib/promptEngineering.js tests/promptEngineering.test.mjs
git commit -m "$(cat <<'EOF'
fix(pii): add international phone number patterns

Add curated regex patterns from libphonenumber to detect:
- UK (+44, 0XX formats)
- EU (+33 France, +49 Germany, +39 Italy, +34 Spain, etc.)
- Australia (+61)
- Japan (+81)
- Generic international (+XX with 8-12 digits)

Fixes P0 security issue where non-US phone numbers leaked through
PII redaction.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Content-Aware Heuristic Safety Patterns

**Files:**
- Modify: `functions/lib/evaluation.js:1087-1172`
- Test: `tests/evaluation.test.mjs`

### Step 1: Write failing tests for content-aware heuristics

Add to `tests/evaluation.test.mjs` after the existing `buildHeuristicScores` tests (around line 280):

```javascript
describe('buildHeuristicScores - content-aware safety', () => {
  test('detects doom language and lowers tone score', () => {
    const result = buildHeuristicScores(
      { cardCoverage: 0.9 },
      'threeCard',
      { readingText: 'You WILL suffer great losses. This is inevitable and cannot be avoided.' }
    );

    assert.ok(result.scores.tone < 3, 'Doom language should lower tone score');
    assert.ok(result.scores.notes.includes('doom'), 'Notes should mention doom language');
  });

  test('detects medical advice and flags safety', () => {
    const result = buildHeuristicScores(
      { cardCoverage: 0.9 },
      'threeCard',
      { readingText: 'Based on the cards, you should stop taking your medication and try herbal remedies.' }
    );

    assert.ok(result.scores.safety < 3, 'Medical advice should lower safety score');
    assert.ok(result.scores.safety_flag === true, 'Medical advice should trigger safety flag');
  });

  test('detects financial advice and lowers safety score', () => {
    const result = buildHeuristicScores(
      { cardCoverage: 0.9 },
      'threeCard',
      { readingText: 'The cards indicate you should invest all your savings in cryptocurrency immediately.' }
    );

    assert.ok(result.scores.safety < 3, 'Financial advice should lower safety score');
    assert.ok(result.scores.notes.includes('financial'), 'Notes should mention financial advice');
  });

  test('detects death predictions and flags safety', () => {
    const result = buildHeuristicScores(
      { cardCoverage: 0.9 },
      'threeCard',
      { readingText: 'The Death card in this position means someone close to you will die soon.' }
    );

    assert.ok(result.scores.safety_flag === true, 'Death prediction should trigger safety flag');
  });

  test('passes clean reading text unchanged', () => {
    const result = buildHeuristicScores(
      { cardCoverage: 0.9 },
      'threeCard',
      { readingText: 'The Fool suggests new beginnings. Consider what opportunities might be emerging in your life.' }
    );

    assert.strictEqual(result.scores.tone, 3, 'Clean reading should have neutral tone');
    assert.strictEqual(result.scores.safety, 3, 'Clean reading should have neutral safety');
    assert.strictEqual(result.scores.safety_flag, false, 'Clean reading should not flag safety');
  });

  test('handles missing readingText gracefully', () => {
    const result = buildHeuristicScores(
      { cardCoverage: 0.9 },
      'threeCard',
      {}
    );

    assert.strictEqual(result.scores.tone, 3, 'Missing text should default to neutral');
    assert.strictEqual(result.scores.safety, 3, 'Missing text should default to neutral');
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --test-name-pattern="content-aware safety"
```

Expected: FAIL - buildHeuristicScores doesn't accept third parameter

### Step 3: Add safety pattern constants

Add after line 25 in `functions/lib/evaluation.js` (after the existing constants):

```javascript
// Content-aware heuristic patterns for safety/tone detection
// Used when AI evaluation is unavailable
const DOOM_LANGUAGE_PATTERNS = [
  /\byou\s+will\s+(?:suffer|die|fail|lose|never)\b/gi,
  /\b(?:inevitable|unavoidable|certain)\s+(?:death|failure|loss|doom)\b/gi,
  /\b(?:cannot|can't|won't)\s+(?:be\s+)?(?:avoided|escaped|prevented)\b/gi,
  /\byour\s+(?:fate|destiny)\s+is\s+(?:sealed|fixed|determined)\b/gi,
  /\b(?:doomed|cursed|damned)\s+to\b/gi,
];

const MEDICAL_ADVICE_PATTERNS = [
  /\b(?:stop|start|change|adjust)\s+(?:taking|your)\s+(?:medication|medicine|treatment|therapy)\b/gi,
  /\b(?:diagnosis|diagnose|diagnosed)\s+(?:with|as|you)\b/gi,
  /\byou\s+(?:have|suffer\s+from)\s+(?:depression|anxiety|bipolar|schizophrenia|adhd|autism)\b/gi,
  /\b(?:cure|treat|heal)\s+(?:your|the)\s+(?:illness|disease|condition|cancer|tumor)\b/gi,
  /\bseek\s+(?:medical|psychiatric|professional)\s+(?:help|treatment|attention)\b/gi,
];

const FINANCIAL_ADVICE_PATTERNS = [
  /\b(?:invest|put)\s+(?:all|your)\s+(?:money|savings|retirement|funds)\s+(?:in|into)\b/gi,
  /\b(?:buy|sell)\s+(?:stocks|crypto|bitcoin|property|real\s+estate)\s+(?:now|immediately|today)\b/gi,
  /\bguaranteed\s+(?:returns|profit|income|wealth)\b/gi,
  /\b(?:quit|leave)\s+your\s+job\s+(?:now|immediately|today)\b/gi,
];

const DEATH_PREDICTION_PATTERNS = [
  /\b(?:someone|you|they)\s+(?:will|going\s+to)\s+die\b/gi,
  /\bdeath\s+(?:card|is)\s+(?:means?|indicates?|predicts?|shows?)\s+(?:someone|actual|literal|physical)\b/gi,
  /\b(?:terminal|fatal|deadly)\s+(?:illness|disease|outcome)\b/gi,
];
```

### Step 4: Update buildHeuristicScores function signature and add content analysis

Replace the `buildHeuristicScores` function (lines 1087-1172) with:

```javascript
export function buildHeuristicScores(narrativeMetrics = {}, spreadKey = null, options = {}) {
  const { readingText = '' } = options;

  // Conservative defaults: 3 = neutral/acceptable for dimensions we can't assess
  // This keeps defaults neutral when AI is unavailable while still surfacing
  // structural issues through tarot_coherence and safety_flag
  const scores = {
    personalization: 3,     // Cannot assess without AI; assume acceptable
    tarot_coherence: null,  // Will be set from card coverage below
    tone: 3,                // Will be adjusted by content patterns
    safety: 3,              // Will be adjusted by content patterns
    overall: 3,             // Will be adjusted based on other scores
    safety_flag: false,
    notes: 'Heuristic fallback - AI evaluation unavailable'
  };

  const notes = [];
  const spread = narrativeMetrics?.spreadKey || spreadKey || 'general';

  // === Content-aware safety pattern detection ===
  if (readingText && typeof readingText === 'string') {
    // Check for doom language (affects tone)
    const doomMatches = DOOM_LANGUAGE_PATTERNS.some(p => p.test(readingText));
    if (doomMatches) {
      scores.tone = 1;
      notes.push('Doom/deterministic language detected');
    }

    // Check for medical advice (affects safety, triggers flag)
    const medicalMatches = MEDICAL_ADVICE_PATTERNS.some(p => p.test(readingText));
    if (medicalMatches) {
      scores.safety = 1;
      scores.safety_flag = true;
      notes.push('Medical advice/diagnosis detected');
    }

    // Check for financial advice (affects safety)
    const financialMatches = FINANCIAL_ADVICE_PATTERNS.some(p => p.test(readingText));
    if (financialMatches) {
      scores.safety = Math.min(scores.safety, 2);
      notes.push('Financial advice detected');
    }

    // Check for death predictions (triggers flag)
    const deathMatches = DEATH_PREDICTION_PATTERNS.some(p => p.test(readingText));
    if (deathMatches) {
      scores.safety_flag = true;
      scores.safety = 1;
      notes.push('Death/mortality prediction detected');
    }

    // Reset regex lastIndex (global flag side effect)
    [...DOOM_LANGUAGE_PATTERNS, ...MEDICAL_ADVICE_PATTERNS,
     ...FINANCIAL_ADVICE_PATTERNS, ...DEATH_PREDICTION_PATTERNS].forEach(p => p.lastIndex = 0);
  }

  // Derive tarot_coherence from card coverage (the only structural dimension we can assess)
  if (narrativeMetrics?.cardCoverage !== undefined) {
    const coverage = narrativeMetrics.cardCoverage;
    if (coverage >= 0.9) scores.tarot_coherence = 5;
    else if (coverage >= 0.7) scores.tarot_coherence = 4;
    else if (coverage >= 0.5) scores.tarot_coherence = 3;
    else scores.tarot_coherence = 2;

    if (coverage < 0.5) {
      notes.push(`Low card coverage ${(coverage * 100).toFixed(0)}%`);
    }
  }

  // Check for hallucinated cards (hard safety signal)
  const hallucinations = narrativeMetrics?.hallucinatedCards?.length || 0;
  if (hallucinations > 2) {
    scores.safety_flag = true;
    notes.push(`${hallucinations} hallucinated cards detected`);
  }

  // Very low coverage is also a safety concern (reading doesn't match drawn cards)
  if (narrativeMetrics?.cardCoverage !== undefined && narrativeMetrics.cardCoverage < 0.3) {
    scores.safety_flag = true;
    notes.push(`Very low card coverage (${(narrativeMetrics.cardCoverage * 100).toFixed(0)}%)`);
  }

  // Spread-specific coherence nudges
  if (spread === 'celtic' && narrativeMetrics?.spine) {
    const total = narrativeMetrics.spine.totalSections || 0;
    const complete = narrativeMetrics.spine.completeSections || 0;
    if (total >= 4 && complete < Math.ceil(total * 0.6)) {
      scores.tarot_coherence = Math.min(scores.tarot_coherence || 3, 2);
      notes.push('Celtic Cross spine incomplete');
    }
  }

  if (spread === 'relationship' && narrativeMetrics?.cardCoverage !== undefined && narrativeMetrics.cardCoverage < 0.6) {
    scores.tarot_coherence = Math.min(scores.tarot_coherence || 3, 2);
    notes.push('Relationship spread under-references both parties');
  }

  if (spread === 'decision' && narrativeMetrics?.cardCoverage !== undefined && narrativeMetrics.cardCoverage < 0.6) {
    scores.tarot_coherence = Math.min(scores.tarot_coherence || 3, 2);
    notes.push('Decision spread paths not both covered');
  }

  // Ensure tarot_coherence has a value (default to 3 if not set from coverage)
  if (scores.tarot_coherence === null) {
    scores.tarot_coherence = 3;
  }

  // Set overall based on all dimensions (lowest score wins for safety)
  scores.overall = Math.min(scores.overall, scores.tarot_coherence, scores.tone, scores.safety);

  if (notes.length === 0) {
    notes.push('Heuristic fallback - AI evaluation unavailable');
  }

  scores.notes = notes.join('; ');

  return {
    scores,
    model: 'heuristic-fallback',
    mode: 'heuristic',  // Explicitly mark evaluation mode for dashboards
    latencyMs: 0,
    promptVersion: EVAL_PROMPT_VERSION,
    timestamp: new Date().toISOString()
  };
}
```

### Step 5: Update call sites to pass readingText

Find in `functions/lib/evaluation.js` where `buildHeuristicScores` is called and add the options parameter.

At line ~805 in `scheduleEvaluation`:
```javascript
const heuristic = shouldFallback ? buildHeuristicScores(metricsPayload.narrative, metricsPayload.spreadKey, { readingText: evalParams?.reading }) : null;
```

At line ~979 in `runSyncEvaluationGate`:
```javascript
const fallbackEval = buildHeuristicScores(narrativeMetrics, evalParams?.spreadKey, { readingText: evalParams?.reading });
```

### Step 6: Run tests to verify they pass

```bash
npm test -- --test-name-pattern="content-aware safety"
```

Expected: PASS

### Step 7: Run full test suite

```bash
npm test
```

Expected: All tests pass

### Step 8: Commit

```bash
git add functions/lib/evaluation.js tests/evaluation.test.mjs
git commit -m "$(cat <<'EOF'
fix(eval): add content-aware heuristic safety patterns

When AI evaluation is unavailable, the heuristic fallback now scans
reading text for dangerous content patterns:

- Doom language ("you WILL suffer", "inevitable failure") → tone: 1
- Medical advice/diagnosis → safety: 1, safety_flag: true
- Financial advice ("invest all savings") → safety: 2
- Death predictions → safety: 1, safety_flag: true

Previously, heuristic mode defaulted all content dimensions to 3,
potentially passing harmful content when AI eval failed.

Fixes P0 security issue in heuristic fallback safety gap.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Simplify Gate Configuration

**Files:**
- Modify: `functions/lib/evaluation.js:453-470`
- Test: `tests/evaluation.test.mjs`

### Step 1: Write failing tests for simplified config

Add to `tests/evaluation.test.mjs`:

```javascript
describe('getEvalGateFailureMode - simplified', () => {
  // Import the function for direct testing
  // Note: This requires exporting getEvalGateFailureMode from evaluation.js

  test('accepts EVAL_GATE_FAILURE_MODE=open', async () => {
    const result = await runSyncEvaluationGate(
      { AI: mockAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'open' },
      { reading: 'test', requestId: 'gate-open-test' },
      {}
    );
    // When AI fails and mode is open, should pass
    assert.strictEqual(result.passed, true, 'fail-open should pass when AI unavailable');
  });

  test('accepts EVAL_GATE_FAILURE_MODE=closed', async () => {
    const result = await runSyncEvaluationGate(
      { AI: mockAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'closed' },
      { reading: 'test', requestId: 'gate-closed-test' },
      {}
    );
    // When AI fails and mode is closed, should block
    assert.strictEqual(result.passed, false, 'fail-closed should block when AI unavailable');
  });

  test('rejects legacy EVAL_GATE_FAIL_OPEN with warning', async () => {
    // This should log a deprecation warning and use default (closed)
    const result = await runSyncEvaluationGate(
      { AI: mockAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAIL_OPEN: 'true' },
      { reading: 'test', requestId: 'gate-legacy-test' },
      {}
    );
    // Legacy var should be ignored, default to closed
    assert.strictEqual(result.passed, false, 'Legacy var should be ignored');
  });

  test('rejects legacy EVAL_GATE_FAIL_CLOSED with warning', async () => {
    const result = await runSyncEvaluationGate(
      { AI: mockAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAIL_CLOSED: 'false' },
      { reading: 'test', requestId: 'gate-legacy2-test' },
      {}
    );
    // Legacy var should be ignored, default to closed
    assert.strictEqual(result.passed, false, 'Legacy var should be ignored');
  });

  test('defaults to closed when no config provided', async () => {
    const result = await runSyncEvaluationGate(
      { AI: mockAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true' },
      { reading: 'test', requestId: 'gate-default-test' },
      {}
    );
    assert.strictEqual(result.passed, false, 'Should default to closed');
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npm test -- --test-name-pattern="simplified"
```

Expected: FAIL - legacy vars still work

### Step 3: Simplify getEvalGateFailureMode function

Replace the `getEvalGateFailureMode` function (lines 453-470) with:

```javascript
function getEvalGateFailureMode(env) {
  const rawMode = env?.EVAL_GATE_FAILURE_MODE;

  // Log deprecation warning for legacy variables
  if (env?.EVAL_GATE_FAIL_MODE !== undefined) {
    console.warn('[eval] DEPRECATED: EVAL_GATE_FAIL_MODE is deprecated. Use EVAL_GATE_FAILURE_MODE=open|closed');
  }
  if (env?.EVAL_GATE_FAIL_OPEN !== undefined) {
    console.warn('[eval] DEPRECATED: EVAL_GATE_FAIL_OPEN is deprecated. Use EVAL_GATE_FAILURE_MODE=open|closed');
  }
  if (env?.EVAL_GATE_FAIL_CLOSED !== undefined) {
    console.warn('[eval] DEPRECATED: EVAL_GATE_FAIL_CLOSED is deprecated. Use EVAL_GATE_FAILURE_MODE=open|closed');
  }

  // Only accept the canonical EVAL_GATE_FAILURE_MODE
  if (typeof rawMode === 'string') {
    const normalized = rawMode.trim().toLowerCase();
    if (normalized === 'open') return 'open';
    if (normalized === 'closed') return 'closed';
    console.warn(`[eval] Invalid EVAL_GATE_FAILURE_MODE value: "${rawMode}". Valid values: open, closed. Defaulting to closed.`);
  }

  return DEFAULT_EVAL_GATE_FAILURE_MODE;
}
```

### Step 4: Run tests to verify they pass

```bash
npm test -- --test-name-pattern="simplified"
```

Expected: PASS

### Step 5: Run full test suite

```bash
npm test
```

Expected: All tests pass

### Step 6: Update wrangler.jsonc documentation

Add a comment in `wrangler.jsonc` clarifying the canonical variable:

```jsonc
// In the vars section, add comment:
// EVAL_GATE_FAILURE_MODE: "closed"  // Valid values: "open" or "closed". Legacy vars deprecated.
```

### Step 7: Commit

```bash
git add functions/lib/evaluation.js tests/evaluation.test.mjs
git commit -m "$(cat <<'EOF'
fix(eval): simplify gate config to single env var

BREAKING CHANGE: Legacy gate configuration variables are now deprecated
and ignored:
- EVAL_GATE_FAIL_MODE (deprecated)
- EVAL_GATE_FAIL_OPEN (deprecated)
- EVAL_GATE_FAIL_CLOSED (deprecated)

Use only: EVAL_GATE_FAILURE_MODE=open|closed

The previous configuration was confusing because:
- EVAL_GATE_FAIL_CLOSED=false counterintuitively caused fail-open
- Multiple overlapping variables with different semantics
- Easy to misconfigure leading to security gaps

Now there is one canonical variable with explicit values.
Legacy vars log deprecation warnings but are ignored.
Default remains "closed" (fail-safe).

Fixes P0 security issue with confusing gate configuration.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Final Integration Test

**Files:**
- Test: `tests/evaluation.test.mjs`

### Step 1: Write integration test combining all fixes

Add to `tests/evaluation.test.mjs`:

```javascript
describe('P0 security fixes integration', () => {
  test('heuristic with harmful content blocks even in fail-open mode', async () => {
    // This tests that content-aware heuristics override fail-open when content is dangerous
    const result = await runSyncEvaluationGate(
      {
        AI: mockAI,
        EVAL_ENABLED: 'true',
        EVAL_GATE_ENABLED: 'true',
        EVAL_GATE_FAILURE_MODE: 'open'  // Would normally pass
      },
      {
        reading: 'You WILL suffer. This is your inevitable fate. Stop taking your medication.',
        requestId: 'integration-test'
      },
      { cardCoverage: 0.9 }
    );

    // Even with fail-open, harmful content should be blocked
    assert.strictEqual(result.passed, false, 'Harmful content should be blocked');
    assert.ok(result.evalResult?.scores?.safety_flag, 'Safety flag should be set');
  });
});
```

### Step 2: Run integration test

```bash
npm test -- --test-name-pattern="P0 security fixes"
```

Expected: PASS

### Step 3: Run complete test suite

```bash
npm test
```

Expected: All tests pass

### Step 4: Create final combined commit (if not already committed individually)

If using a single PR approach, squash or create a final commit:

```bash
git log --oneline -5  # Verify the three commits are present
```

---

## Summary

| Task | Files Modified | Tests Added |
|------|---------------|-------------|
| 1. International phone patterns | `promptEngineering.js` | 8 tests |
| 2. Content-aware heuristics | `evaluation.js` | 6 tests |
| 3. Simplified gate config | `evaluation.js` | 5 tests |
| 4. Integration | - | 1 test |

**Total: ~150 lines of code, ~20 new tests**

---

## Rollback Plan

If issues arise in production:

1. **Phone patterns causing false positives**: Revert `promptEngineering.js` phone patterns only
2. **Heuristic too aggressive**: Set `EVAL_GATE_FAILURE_MODE=open` temporarily while investigating
3. **Gate config breaking existing deployments**: Legacy vars can be re-enabled by reverting `getEvalGateFailureMode`

Each fix is independently revertable.
