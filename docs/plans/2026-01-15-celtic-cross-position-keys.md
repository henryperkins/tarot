# Celtic Cross Position Key Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the mismatch between Celtic Cross positions in `spreads.js` and `POSITION_LANGUAGE` keys in `helpers.js` so position-specific templates are correctly applied.

**Architecture:** Add a position normalization function that maps incoming positions to their canonical `POSITION_LANGUAGE` keys. This approach preserves backward compatibility (frontend continues sending positions from `spreads.js`) while enabling the rich position-specific templates (intro variations, frame guidance, connectors).

**Tech Stack:** Node.js, Vitest/node:test

---

## Task 1: Add Position Normalization Tests

**Files:**
- Create: `tests/positionNormalization.test.mjs`

**Step 1: Write the failing test for Celtic Cross position normalization**

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePositionKey } from '../functions/lib/narrative/helpers.js';

describe('normalizePositionKey', () => {
  describe('Celtic Cross positions', () => {
    it('normalizes position without Card suffix to canonical form', () => {
      assert.strictEqual(
        normalizePositionKey('Present — core situation'),
        'Present — core situation (Card 1)'
      );
    });

    it('passes through already-canonical position unchanged', () => {
      assert.strictEqual(
        normalizePositionKey('Present — core situation (Card 1)'),
        'Present — core situation (Card 1)'
      );
    });

    it('normalizes all 10 Celtic Cross positions', () => {
      const mappings = [
        ['Present — core situation', 'Present — core situation (Card 1)'],
        ['Challenge — crossing / tension', 'Challenge — crossing / tension (Card 2)'],
        ['Past — what lies behind', 'Past — what lies behind (Card 3)'],
        ['Near Future — what lies before', 'Near Future — what lies before (Card 4)'],
        ['Conscious — goals & focus', 'Conscious — goals & focus (Card 5)'],
        ['Subconscious — roots / hidden forces', 'Subconscious — roots / hidden forces (Card 6)'],
        ['Self / Advice — how to meet this', 'Self / Advice — how to meet this (Card 7)'],
        ['External Influences — people & environment', 'External Influences — people & environment (Card 8)'],
        ['Hopes & Fears — deepest wishes & worries', 'Hopes & Fears — deepest wishes & worries (Card 9)'],
        ['Outcome — likely path if unchanged', 'Outcome — likely path if unchanged (Card 10)']
      ];

      for (const [input, expected] of mappings) {
        assert.strictEqual(normalizePositionKey(input), expected, `Failed for: ${input}`);
      }
    });
  });

  describe('Other spread positions', () => {
    it('passes through Three-Card positions unchanged (already match)', () => {
      assert.strictEqual(
        normalizePositionKey('Past — influences that led here'),
        'Past — influences that led here'
      );
    });

    it('passes through unknown positions unchanged', () => {
      assert.strictEqual(
        normalizePositionKey('Custom Position'),
        'Custom Position'
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/positionNormalization.test.mjs`
Expected: FAIL with "normalizePositionKey is not exported" or similar

---

## Task 2: Implement Position Normalization

**Files:**
- Modify: `functions/lib/narrative/helpers.js` (add normalization map and function)

**Step 1: Add the Celtic Cross position mapping constant**

Add after the existing `const POSITION_LANGUAGE = {` block (around line 807):

```javascript
/**
 * Maps positions from spreads.js (without Card #) to POSITION_LANGUAGE keys (with Card #)
 * Only needed for Celtic Cross where the source-of-truth positions differ from template keys.
 */
const CELTIC_CROSS_POSITION_MAP = {
  'Present — core situation': 'Present — core situation (Card 1)',
  'Challenge — crossing / tension': 'Challenge — crossing / tension (Card 2)',
  'Past — what lies behind': 'Past — what lies behind (Card 3)',
  'Near Future — what lies before': 'Near Future — what lies before (Card 4)',
  'Conscious — goals & focus': 'Conscious — goals & focus (Card 5)',
  'Subconscious — roots / hidden forces': 'Subconscious — roots / hidden forces (Card 6)',
  'Self / Advice — how to meet this': 'Self / Advice — how to meet this (Card 7)',
  'External Influences — people & environment': 'External Influences — people & environment (Card 8)',
  'Hopes & Fears — deepest wishes & worries': 'Hopes & Fears — deepest wishes & worries (Card 9)',
  'Outcome — likely path if unchanged': 'Outcome — likely path if unchanged (Card 10)'
};
```

**Step 2: Add the normalizePositionKey function**

Add after the mapping constant:

```javascript
/**
 * Normalize a position string to its canonical POSITION_LANGUAGE key.
 * Handles Celtic Cross positions that arrive without "(Card N)" suffix.
 *
 * @param {string} position - Position string from cardsInfo
 * @returns {string} Canonical position key for POSITION_LANGUAGE lookup
 */
export function normalizePositionKey(position) {
  if (!position || typeof position !== 'string') {
    return position;
  }
  return CELTIC_CROSS_POSITION_MAP[position] || position;
}
```

**Step 3: Export the function**

Find the existing exports at the end of the file and add `normalizePositionKey`:

```javascript
export {
  // ... existing exports ...
  normalizePositionKey
};
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/positionNormalization.test.mjs`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add tests/positionNormalization.test.mjs functions/lib/narrative/helpers.js
git commit -m "$(cat <<'EOF'
feat(narrative): add position key normalization for Celtic Cross

Adds normalizePositionKey() to map Celtic Cross positions from
spreads.js format (without Card #) to POSITION_LANGUAGE keys (with Card #).
This enables position-specific templates to be applied correctly.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Integrate Normalization into buildPositionCardText

**Files:**
- Modify: `functions/lib/narrative/helpers.js:812-827`

**Step 1: Write the integration test**

Add to `tests/positionNormalization.test.mjs`:

```javascript
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';

describe('buildPositionCardText with Celtic Cross positions', () => {
  it('uses position-specific template for normalized Celtic Cross position', () => {
    const cardInfo = {
      card: 'The Magician',
      number: 1,
      orientation: 'Upright',
      meaning: 'Willpower and manifestation.'
    };

    // Position from spreads.js (without Card #)
    const result = buildPositionCardText(cardInfo, 'Present — core situation', {});

    // Should contain position-specific intro (not generic fallback)
    assert.ok(
      result.includes('At the heart of this moment') ||
      result.includes('Right now, your story') ||
      result.includes('The core tone of this moment'),
      `Expected position-specific intro, got: ${result.substring(0, 200)}`
    );
  });

  it('still handles unknown positions with fallback', () => {
    const cardInfo = {
      card: 'The Fool',
      number: 0,
      orientation: 'Reversed',
      meaning: 'New beginnings with caution.'
    };

    const result = buildPositionCardText(cardInfo, 'Unknown Custom Position', {});

    // Should contain the position name (fallback behavior)
    assert.ok(result.includes('Unknown Custom Position'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/positionNormalization.test.mjs`
Expected: FAIL - "Expected position-specific intro" assertion fails

**Step 3: Update buildPositionCardText to use normalization**

In `functions/lib/narrative/helpers.js`, find `buildPositionCardText` (around line 812) and update the template lookup:

```javascript
function buildPositionCardText(cardInfo, position, options = {}) {
  const normalizedPosition = normalizePositionKey(position);
  const template = POSITION_LANGUAGE[normalizedPosition];
  // ... rest of function unchanged
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/positionNormalization.test.mjs`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add tests/positionNormalization.test.mjs functions/lib/narrative/helpers.js
git commit -m "$(cat <<'EOF'
feat(narrative): integrate position normalization into buildPositionCardText

buildPositionCardText now normalizes incoming position keys before
POSITION_LANGUAGE lookup, enabling Celtic Cross position-specific
templates to work with positions from spreads.js.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate Normalization into getConnector

**Files:**
- Modify: `functions/lib/narrative/helpers.js:1111-1124`

**Step 1: Write the test**

Add to `tests/positionNormalization.test.mjs`:

```javascript
import { getConnector } from '../functions/lib/narrative/helpers.js';

describe('getConnector with Celtic Cross positions', () => {
  it('returns connector for normalized Celtic Cross position', () => {
    // 'Past — what lies behind' has connectorToNext defined
    const connector = getConnector('Past — what lies behind', 'toNext');

    assert.ok(
      connector === 'Because of this,' ||
      connector === 'Because of this history,' ||
      connector === 'Because of this groundwork,',
      `Expected a valid connector, got: "${connector}"`
    );
  });

  it('returns empty string for unknown position', () => {
    const connector = getConnector('Unknown Position', 'toPrev');
    assert.strictEqual(connector, '');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/positionNormalization.test.mjs`
Expected: FAIL - connector is empty string instead of expected value

**Step 3: Update getConnector to use normalization**

In `functions/lib/narrative/helpers.js`, find `getConnector` (around line 1111):

```javascript
function getConnector(position, direction = 'toPrev') {
  const normalizedPosition = normalizePositionKey(position);
  const template = POSITION_LANGUAGE[normalizedPosition];
  if (!template) return '';
  // ... rest unchanged
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/positionNormalization.test.mjs`
Expected: PASS (all 9 tests)

**Step 5: Commit**

```bash
git add tests/positionNormalization.test.mjs functions/lib/narrative/helpers.js
git commit -m "$(cat <<'EOF'
feat(narrative): integrate position normalization into getConnector

getConnector now normalizes position keys, enabling Celtic Cross
connectors (connectorToPrev, connectorToNext) to work correctly.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Run Full Test Suite

**Files:** None (verification only)

**Step 1: Run all narrative-related tests**

Run: `npm test -- --grep narrative`
Expected: All tests pass

**Step 2: Run the full test suite**

Run: `npm test`
Expected: All tests pass, no regressions

**Step 3: Commit (if any test fixes needed)**

If tests revealed issues that required fixes, commit those fixes.

---

## Task 6: Manual Verification

**Files:** None (manual testing)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Perform a Celtic Cross reading**

1. Open http://localhost:5173
2. Select "Celtic Cross (Classic 10-Card)" spread
3. Complete the ritual and draw cards
4. Observe the generated narrative

**Step 3: Verify position-specific language**

Check that the narrative includes position-specific phrasing like:
- "At the heart of this moment stands..." (Card 1)
- "Crossing this, the challenge manifests as..." (Card 2)
- "Looking to what lies behind, the past shows..." (Card 3)

If you see generic phrasing like "Position: Card Name. Meaning..." instead, the fix didn't work.

---

## Summary

This plan fixes the Celtic Cross position key mismatch with minimal changes:
1. Add a position mapping constant
2. Add a normalization function
3. Apply normalization at two lookup points

Total changes: ~30 lines of code + ~80 lines of tests
