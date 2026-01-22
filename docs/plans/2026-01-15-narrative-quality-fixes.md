# Narrative Quality Pipeline Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three related issues in the narrative quality pipeline: spread-key resolution drift, spine ratio false positives, and GraphRAG telemetry skew.

**Architecture:** Surgical fixes at each issue's source. Spread-key uses existing `getSpreadKey()` from readingQuality.js. Spine classification adds `isCardSection()` helper to only apply spine ratio to card sections. GraphRAG telemetry adds explicit `injectedIntoPrompt` flag when falling back to analysis summary.

**Tech Stack:** Cloudflare Workers, ES modules, Node test runner (`node:test`)

---

## Task 1: Spread-Key Resolution Fix

**Files:**
- Modify: `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` (replace call)
- Modify: `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` (delete unused helper, if present)
- Test: `tests/narrativeBuilder.promptCompliance.test.mjs`

**Step 1: Write the failing test**

Add to `tests/narrativeBuilder.promptCompliance.test.mjs`:

```javascript
describe('spread-key resolution', () => {
  it('uses spreadInfo.key when display name is unrecognized', async () => {
    const customSpread = {
      name: 'My Custom Spread',
      key: 'threeCard',
      positions: [
        { name: 'Past', roleKey: 'past' },
        { name: 'Present', roleKey: 'present' },
        { name: 'Future', roleKey: 'future' }
      ]
    };

    const result = await buildEnhancedClaudePrompt({
      spreadInfo: customSpread,
      cardsInfo: [
        { card: 'The Fool', position: 'Past', orientation: 'upright' },
        { card: 'The Magician', position: 'Present', orientation: 'upright' },
        { card: 'The High Priestess', position: 'Future', orientation: 'upright' }
      ],
      userQuestion: 'What does my week look like?',
      themes: {},
      context: {}
    });

    // Should use threeCard structure, not general
    assert.equal(result.promptMeta.spreadKey, 'threeCard');
  });

  it('still resolves standard spreads by display name', async () => {
    const celticCross = {
      name: 'Celtic Cross (Classic 10-Card)',
      key: 'celtic'
    };

    const result = await buildEnhancedClaudePrompt({
      spreadInfo: celticCross,
      cardsInfo: Array(10).fill(null).map((_, i) => ({
        card: 'The Fool',
        position: `Position ${i + 1}`,
        orientation: 'upright'
      })),
      userQuestion: 'General guidance',
      themes: {},
      context: {}
    });

    assert.equal(result.promptMeta.spreadKey, 'celtic');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/narrativeBuilder.promptCompliance.test.mjs --test-name-pattern "spread-key resolution"`

Expected: FAIL - custom spread resolves to `"general"` instead of `"threeCard"`

**Step 3: Update import in buildEnhancedClaudePrompt.js**

At top of `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`, add to existing imports from readingQuality.js:

```javascript
import { getSpreadKey } from '../readingQuality.js';
```

**Step 4: Replace spread-key resolution call**

In `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`, change the spread-key resolution call from:

```javascript
const spreadKey = getSpreadKeyFromName(spreadInfo.name);
```

To:

```javascript
const spreadKey = getSpreadKey(spreadInfo?.name, spreadInfo?.key);
```

**Step 5: Store spreadKey in prompt metadata**

In `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`, add `spreadKey` to `promptMeta`:

```javascript
const promptMeta = {
  // Reading prompt version for quality tracking and A/B testing correlation
  readingPromptVersion: getReadingPromptVersion(),
  spreadKey,
  // Token estimates present when slimming is enabled or hard-cap adjustments occur.
  // Use llmUsage.input_tokens from API response for actual token counts.
  estimatedTokens,
  ...
};
```

**Step 6: Delete unused helper (if present)**

Remove `getSpreadKeyFromName()` helper (if present) from `buildEnhancedClaudePrompt.js`:

```javascript
// DELETE THIS ENTIRE FUNCTION:
function getSpreadKeyFromName(name) {
  const map = {
    'Celtic Cross (Classic 10-Card)': 'celtic',
    'Three-Card Story (Past · Present · Future)': 'threeCard',
    'Five-Card Clarity': 'fiveCard',
    'One-Card Insight': 'single',
    'Relationship Snapshot': 'relationship',
    'Decision / Two-Path': 'decision'
  };
  return map[name] || 'general';
}
```

**Step 7: Run test to verify it passes**

Run: `node --test tests/narrativeBuilder.promptCompliance.test.mjs --test-name-pattern "spread-key resolution"`

Expected: PASS

**Step 8: Run full test suite + narrative gate**

Run: `npm test`

Run: `npm run gate:narrative`

Expected: All tests pass

**Step 9: Commit**

```bash
git add functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js tests/narrativeBuilder.promptCompliance.test.mjs
git commit -m "fix(narrative): align spread-key resolution with readingQuality

Replaces getSpreadKeyFromName() which only matched display names with
getSpreadKey() from readingQuality.js which also accepts fallback key.

Custom/renamed spreads now resolve correctly instead of falling back
to 'general' prompt structure.

Fixes spread-key drift between prompt intent and gate logic."
```

---

## Task 2: Spine Classification Fix

**Files:**
- Modify: `functions/lib/narrativeSpine.js` (add `isCardSection()`, update return)
- Modify: `functions/lib/readingQuality.js` (thread card/structural counts into metrics)
- Modify: `functions/api/tarot-reading.js:969-975` (update gate logic)
- Test: `tests/narrativeSpine.test.mjs`

### Step 1: Write failing tests for section classification

Add to `tests/narrativeSpine.test.mjs`:

```javascript
import { isCardSection } from '../functions/lib/narrativeSpine.js';

describe('isCardSection', () => {
  describe('structural sections', () => {
    it('returns false for Opening', () => {
      assert.equal(isCardSection('Opening', 'Welcome to your reading...'), false);
    });

    it('returns false for Closing', () => {
      assert.equal(isCardSection('Closing', 'Thank you for this session...'), false);
    });

    it('returns false for Next Steps', () => {
      assert.equal(isCardSection('Next Steps', 'Consider journaling about...'), false);
    });

    it('returns false for Gentle Next Steps', () => {
      assert.equal(isCardSection('Gentle Next Steps', 'You might try...'), false);
    });

    it('returns false for Synthesis', () => {
      assert.equal(isCardSection('Synthesis', 'Bringing these threads together...'), false);
    });

    it('returns false for Reflection', () => {
      assert.equal(isCardSection('Reflection', 'As you sit with this reading...'), false);
    });

    it('returns false for Guidance for This Connection', () => {
      assert.equal(isCardSection('Guidance for This Connection', 'Consider journaling about...'), false);
    });

    it('returns false for Synthesis & Guidance', () => {
      assert.equal(isCardSection('Synthesis & Guidance', 'Bringing these threads together...'), false);
    });
  });

  describe('card sections by header', () => {
    it('returns true for Major Arcana in header', () => {
      assert.equal(isCardSection('The Fool', 'New beginnings await...'), true);
    });

    it('returns true for Minor Arcana in header', () => {
      assert.equal(isCardSection('Three of Cups', 'Celebration and joy...'), true);
    });

    it('returns true for card with position context', () => {
      assert.equal(isCardSection('The Tower (Challenge)', 'Sudden change...'), true);
    });
  });

  describe('card sections by content', () => {
    it('returns true when content contains Major Arcana', () => {
      assert.equal(isCardSection('Present Situation', 'The Tower crashes through...'), true);
    });

    it('returns true when content contains Minor Arcana', () => {
      assert.equal(isCardSection('Your Challenge', 'The Five of Swords appears here...'), true);
    });
  });

  describe('edge cases', () => {
    it('returns false for unknown header without card content', () => {
      assert.equal(isCardSection('Final Thoughts', 'Remember to breathe...'), false);
    });

    it('handles case-insensitive matching', () => {
      assert.equal(isCardSection('OPENING', 'Welcome...'), false);
      assert.equal(isCardSection('the fool', 'New beginnings...'), true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/narrativeSpine.test.mjs --test-name-pattern "isCardSection"`

Expected: FAIL - `isCardSection` is not exported

### Step 3: Add structural header constants

In `functions/lib/narrativeSpine.js`, after the existing constants (around line 65), add:

```javascript
/**
 * Headers that indicate structural sections (not card-specific).
 * These sections don't require WHAT/WHY/WHAT'S NEXT spine structure.
 */
const STRUCTURAL_HEADERS = new Set([
  'opening',
  'closing',
  'synthesis',
  'summary',
  'next steps',
  'gentle next steps',
  'reflection',
  'reflections',
  'final thoughts',
  'closing thoughts',
  'invitation',
  'final invitation'
]);

const STRUCTURAL_HEADER_PREFIXES = [
  'opening',
  'closing',
  'synthesis',
  'summary',
  'guidance',
  'next steps',
  'gentle next steps',
  'reflection'
];
```

### Step 4: Add isCardSection function

In `functions/lib/narrativeSpine.js`, after the new constant, add:

```javascript
/**
 * Determine if a section is a card section vs structural section.
 * Card sections should follow spine structure; structural sections don't need it.
 *
 * @param {string} header - Section header text
 * @param {string} content - Section content
 * @returns {boolean} True if this is a card section
 */
export function isCardSection(header, content) {
  if (!header || typeof header !== 'string') return false;

  const normalizedHeader = header.toLowerCase().trim();

  // Known structural sections
  if (STRUCTURAL_HEADERS.has(normalizedHeader)) return false;
  if (STRUCTURAL_HEADER_PREFIXES.some(prefix => normalizedHeader.startsWith(prefix))) {
    return false;
  }

  // Check for card name in header
  if (MAJOR_ARCANA_PATTERN.test(header) || MINOR_ARCANA_PATTERN.test(header)) {
    return true;
  }

  // Check for card name in content
  if (content && typeof content === 'string') {
    if (MAJOR_ARCANA_PATTERN.test(content) || MINOR_ARCANA_PATTERN.test(content)) {
      return true;
    }
  }

  // Default to structural (conservative - avoids false spine failures)
  return false;
}
```

### Step 5: Run section classification tests

Run: `node --test tests/narrativeSpine.test.mjs --test-name-pattern "isCardSection"`

Expected: PASS

### Step 6: Write failing test for updated validateReadingNarrative return

Add to `tests/narrativeSpine.test.mjs`:

```javascript
describe('validateReadingNarrative card section tracking', () => {
  it('should return separate card and structural section counts', () => {
    const reading = `
**Opening**
Welcome to your reading today.

**The Fool**
The Fool appears upright, signaling new beginnings.
This energy stems from your willingness to take risks.
Consider stepping into the unknown with trust.

**The Magician**
The Magician brings focus and skill.
Your resources are aligned because you've done the work.
Channel this energy into your creative projects.

**Synthesis**
Together, these cards weave a story of fresh starts.

**Next Steps**
Journal about what "beginning" means to you.
`;

    const result = validateReadingNarrative(reading);

    assert.equal(result.cardSections, 2); // Fool, Magician
    assert.equal(result.structuralSections, 3); // Opening, Synthesis, Next Steps
    assert.ok(result.cardComplete >= 1);
    assert.equal(result.totalSections, 5);
  });
});
```

**Step 7: Run test to verify it fails**

Run: `node --test tests/narrativeSpine.test.mjs --test-name-pattern "card section tracking"`

Expected: FAIL - `cardSections` is undefined

### Step 8: Update validateReadingNarrative return

In `functions/lib/narrativeSpine.js`, update `validateReadingNarrative()` (around line 442-460).

Replace the analysis and return block with:

```javascript
  // Analyze each section and classify as card vs structural
  const analyses = sections.map(section => {
    const isCard = isCardSection(section.header, section.content);
    return {
      header: section.header,
      isCardSection: isCard,
      analysis: analyzeSpineCompleteness(section.content)
    };
  });

  const cardAnalyses = analyses.filter(a => a.isCardSection);
  const structuralAnalyses = analyses.filter(a => !a.isCardSection);

  const cardComplete = cardAnalyses.filter(a => a.analysis.isComplete).length;
  const cardIncomplete = cardAnalyses.length - cardComplete;
  const completeSections = analyses.filter(a => a.analysis.isComplete).length;
  const incompleteSections = analyses.length - completeSections;

  return {
    isValid: cardIncomplete === 0,
    totalSections: sections.length,
    // New fields for card-aware gating
    cardSections: cardAnalyses.length,
    cardComplete,
    cardIncomplete,
    structuralSections: structuralAnalyses.length,
    // Legacy fields for backward compatibility
    completeSections,
    incompleteSections,
    sectionAnalyses: analyses,
    suggestions: cardIncomplete > 0
      ? ["Review incomplete card sections and ensure they include: what is happening, why/how (connector), and what's next"]
      : []
  };
```

### Step 9: Thread card/structural counts into narrative metrics

In `functions/lib/readingQuality.js`, update `buildNarrativeMetrics()` to include card-aware fields:

```javascript
  return {
    spine: {
      isValid: spine.isValid,
      totalSections: spine.totalSections || 0,
      completeSections: spine.completeSections || 0,
      incompleteSections: spine.incompleteSections || 0,
      cardSections: spine.cardSections || 0,
      cardComplete: spine.cardComplete || 0,
      cardIncomplete: spine.cardIncomplete || 0,
      structuralSections: spine.structuralSections || 0,
      suggestions: spine.suggestions || []
    },
    cardCoverage: coverage.coverage,
    missingCards: coverage.missingCards,
    hallucinatedCards
  };
```

### Step 10: Run tests to verify they pass

Run: `node --test tests/narrativeSpine.test.mjs`

Expected: All tests pass

### Step 11: Update gate logic in tarot-reading.js

In `functions/api/tarot-reading.js`, update the spine gate logic (around line 969-975).

Replace:

```javascript
        const spine = qualityMetrics.spine || null;
        const MIN_SPINE_COMPLETION = 0.5;
        if (spine && spine.totalSections > 0) {
          const spineRatio = (spine.completeSections || 0) / spine.totalSections;
          if (spineRatio < MIN_SPINE_COMPLETION) {
            qualityIssues.push(`incomplete spine (${spine.completeSections || 0}/${spine.totalSections}, need ${Math.ceil(MIN_SPINE_COMPLETION * 100)}%)`);
          }
        }
```

With:

```javascript
        // Enforce spine completeness for card sections only
        // Structural sections (Opening, Closing, Next Steps) don't need WHAT/WHY/WHAT'S NEXT
        const spine = qualityMetrics.spine || null;
        const MIN_SPINE_COMPLETION = 0.5;
        if (spine) {
          const cardSections = typeof spine.cardSections === 'number'
            ? spine.cardSections
            : spine.totalSections;
          const cardComplete = typeof spine.cardComplete === 'number'
            ? spine.cardComplete
            : spine.completeSections;
          if (cardSections > 0) {
            const spineRatio = (cardComplete || 0) / cardSections;
            if (spineRatio < MIN_SPINE_COMPLETION) {
              qualityIssues.push(`incomplete spine (${cardComplete || 0}/${cardSections} card sections, need ${Math.ceil(MIN_SPINE_COMPLETION * 100)}%)`);
            }
          }
        }
```

### Step 12: Run full test suite + narrative gate

Run: `npm test`

Run: `npm run gate:narrative`

Expected: All tests pass

### Step 13: Commit

```bash
git add functions/lib/narrativeSpine.js functions/lib/readingQuality.js functions/api/tarot-reading.js tests/narrativeSpine.test.mjs
git commit -m "fix(narrative): apply spine ratio only to card sections

Adds isCardSection() to classify sections as card-specific vs structural.
Structural sections (Opening, Closing, Synthesis, Next Steps) no longer
count toward spine completion ratio.

This prevents false gate failures when LLMs add verbose structural content
that dilutes the ratio even when card sections are solid.

Returns new fields: cardSections, cardComplete, structuralSections
Maintains backward compat: completeSections, incompleteSections still present"
```

---

## Task 3: GraphRAG Telemetry Fix

**Files:**
- Modify: `functions/lib/readingTelemetry.js` (export `resolveGraphRAGStats`)
- Modify: `functions/api/tarot-reading.js` (import helper, remove local function)
- Test: `tests/tarotReading.telemetry.test.mjs` (new file)

### Step 1: Create test file with failing tests

Create `tests/tarotReading.telemetry.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveGraphRAGStats } from '../functions/lib/readingTelemetry.js';

describe('resolveGraphRAGStats', () => {
  it('returns promptMeta.graphRAG when available', () => {
    const promptMeta = {
      graphRAG: {
        passagesRetrieved: 3,
        includedInPrompt: true
      }
    };
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: { passagesRetrieved: 5 }
      }
    };

    const result = resolveGraphRAGStats(analysis, promptMeta);

    assert.deepEqual(result, promptMeta.graphRAG);
    assert.equal(result.includedInPrompt, true);
  });

  it('adds injectedIntoPrompt: false when falling back to analysis', () => {
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: {
          passagesRetrieved: 3,
          keywords: ['transformation']
        }
      }
    };

    const result = resolveGraphRAGStats(analysis, null);

    assert.equal(result.injectedIntoPrompt, false);
    assert.equal(result.source, 'analysis-fallback');
    assert.equal(result.passagesRetrieved, 3);
  });

  it('returns null when neither promptMeta nor analysis available', () => {
    assert.equal(resolveGraphRAGStats(null, null), null);
    assert.equal(resolveGraphRAGStats({}, null), null);
    assert.equal(resolveGraphRAGStats({ graphRAGPayload: {} }, null), null);
  });

  it('preserves original summary fields when falling back', () => {
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: {
          passagesRetrieved: 2,
          topPatterns: ['death-star'],
          relevanceScores: [0.8, 0.6]
        }
      }
    };

    const result = resolveGraphRAGStats(analysis, null);

    assert.equal(result.passagesRetrieved, 2);
    assert.deepEqual(result.topPatterns, ['death-star']);
    assert.deepEqual(result.relevanceScores, [0.8, 0.6]);
    assert.equal(result.injectedIntoPrompt, false);
  });
});
```

### Step 2: Run test to verify it fails

Run: `node --test tests/tarotReading.telemetry.test.mjs`

Expected: FAIL - `resolveGraphRAGStats` is not exported yet

### Step 3: Extract resolveGraphRAGStats into readingTelemetry

In `functions/lib/readingTelemetry.js`, add:

```javascript
/**
 * Resolve GraphRAG statistics for telemetry.
 * Prefers promptMeta (authoritative about injection) over analysis summary.
 * When falling back to analysis, explicitly marks as not injected.
 *
 * @param {Object} analysis - Spread analysis with graphRAGPayload
 * @param {Object} promptMeta - Prompt metadata from buildEnhancedClaudePrompt
 * @returns {Object|null} GraphRAG stats with injection status
 */
export function resolveGraphRAGStats(analysis, promptMeta = null) {
  // Prefer promptMeta - it's authoritative about what was injected
  if (promptMeta?.graphRAG) {
    return promptMeta.graphRAG;
  }

  // Fallback to analysis summary, but mark as not injected
  const summary = analysis?.graphRAGPayload?.retrievalSummary;
  if (summary) {
    return {
      ...summary,
      injectedIntoPrompt: false,
      source: 'analysis-fallback'
    };
  }

  return null;
}
```

### Step 4: Update tarot-reading.js to use shared helper

In `functions/api/tarot-reading.js`, import `resolveGraphRAGStats` from `functions/lib/readingTelemetry.js`
and remove the local function definition.

### Step 5: Run telemetry test

Run: `node --test tests/tarotReading.telemetry.test.mjs`

Expected: PASS

### Step 6: Run full test suite

Run: `npm test`

Expected: All tests pass

### Step 7: Commit

```bash
git add functions/lib/readingTelemetry.js functions/api/tarot-reading.js tests/tarotReading.telemetry.test.mjs
git commit -m "fix(telemetry): add injectedIntoPrompt flag for GraphRAG fallback

When promptMeta is absent (e.g., local composer), telemetry now explicitly
marks GraphRAG stats with injectedIntoPrompt: false and source: 'analysis-fallback'.

This prevents skewed experiment data from reporting GraphRAG usage
when passages were retrieved but never injected into the prompt."
```

---

## Task 4: Final Integration Test

**Files:**
- Test: Manual verification via `npm run dev`

### Step 1: Run all tests

Run: `npm test`

Expected: All tests pass

### Step 2: Run narrative gate

Run: `npm run gate:narrative`

Expected: Narrative gate passes

### Step 3: Run E2E tests (optional)

Run: `npm run test:e2e`

Expected: All E2E tests pass

### Step 4: Final commit with all changes

```bash
git log --oneline -5
```

Verify the three commits are present.

---

## Summary of Changes

| File | Change |
|------|--------|
| `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` | Use `getSpreadKey`, store `spreadKey` in `promptMeta`, delete `getSpreadKeyFromName()` |
| `functions/lib/narrativeSpine.js` | Add structural header constants, `isCardSection()`, update `validateReadingNarrative()` with card/structural counts |
| `functions/lib/readingQuality.js` | Thread card/structural spine fields into `buildNarrativeMetrics()` |
| `functions/lib/readingTelemetry.js` | Export `resolveGraphRAGStats()` |
| `functions/api/tarot-reading.js` | Update spine gate to use card-aware ratio (with fallback), consume shared `resolveGraphRAGStats()` |
| `tests/narrativeBuilder.promptCompliance.test.mjs` | Add spread-key resolution tests |
| `tests/narrativeSpine.test.mjs` | Add `isCardSection` and card section tracking tests |
| `tests/tarotReading.telemetry.test.mjs` | New telemetry tests for `resolveGraphRAGStats` |
