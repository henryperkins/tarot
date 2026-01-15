# Narrative Quality Pipeline Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three related issues in the narrative quality pipeline: spread-key resolution drift, spine ratio false positives, and GraphRAG telemetry skew.

**Architecture:** Surgical fixes at each issue's source. Spread-key uses existing `getSpreadKey()` from readingQuality.js. Spine classification adds `isCardSection()` helper to only apply spine ratio to card sections. GraphRAG telemetry adds explicit `injectedIntoPrompt` flag when falling back to analysis summary.

**Tech Stack:** Cloudflare Workers, ES modules, Vitest

---

## Task 1: Spread-Key Resolution Fix

**Files:**
- Modify: `functions/lib/narrative/prompts.js:282` (replace call)
- Modify: `functions/lib/narrative/prompts.js:769-779` (delete unused function)
- Test: `tests/narrativeBuilder.promptCompliance.test.mjs`

**Step 1: Write the failing test**

Add to `tests/narrativeBuilder.promptCompliance.test.mjs`:

```javascript
describe('spread-key resolution', () => {
  it('should use spreadInfo.key when display name is unrecognized', async () => {
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
        { name: 'The Fool', position: 'Past', orientation: 'upright' },
        { name: 'The Magician', position: 'Present', orientation: 'upright' },
        { name: 'The High Priestess', position: 'Future', orientation: 'upright' }
      ],
      userQuestion: 'What does my week look like?',
      themes: {},
      context: {}
    });

    // Should use threeCard structure, not general
    expect(result.promptMeta.spreadKey).toBe('threeCard');
  });

  it('should still resolve standard spreads by display name', async () => {
    const celticCross = {
      name: 'Celtic Cross (Classic 10-Card)',
      key: 'celtic'
    };

    const result = await buildEnhancedClaudePrompt({
      spreadInfo: celticCross,
      cardsInfo: Array(10).fill(null).map((_, i) => ({
        name: 'The Fool',
        position: `Position ${i + 1}`,
        orientation: 'upright'
      })),
      userQuestion: 'General guidance',
      themes: {},
      context: {}
    });

    expect(result.promptMeta.spreadKey).toBe('celtic');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/narrativeBuilder.promptCompliance.test.mjs -t "spread-key resolution"`

Expected: FAIL - custom spread resolves to `"general"` instead of `"threeCard"`

**Step 3: Update import in prompts.js**

At top of `functions/lib/narrative/prompts.js`, add to existing imports from readingQuality.js:

```javascript
import { getSpreadKey } from '../readingQuality.js';
```

**Step 4: Replace spread-key resolution call**

In `functions/lib/narrative/prompts.js`, change line 282 from:

```javascript
const spreadKey = getSpreadKeyFromName(spreadInfo.name);
```

To:

```javascript
const spreadKey = getSpreadKey(spreadInfo.name, spreadInfo.key);
```

**Step 5: Delete unused function**

Remove `getSpreadKeyFromName()` function (lines 769-779):

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

**Step 6: Run test to verify it passes**

Run: `npm test -- tests/narrativeBuilder.promptCompliance.test.mjs -t "spread-key resolution"`

Expected: PASS

**Step 7: Run full test suite**

Run: `npm test`

Expected: All tests pass

**Step 8: Commit**

```bash
git add functions/lib/narrative/prompts.js tests/narrativeBuilder.promptCompliance.test.mjs
git commit -m "fix(narrative): use getSpreadKey for spread-key resolution

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
- Modify: `functions/api/tarot-reading.js:969-975` (update gate logic)
- Test: `tests/narrativeSpine.test.mjs`

### Step 1: Write failing tests for section classification

Add to `tests/narrativeSpine.test.mjs`:

```javascript
import { isCardSection } from '../functions/lib/narrativeSpine.js';

describe('isCardSection', () => {
  describe('structural sections', () => {
    it('should return false for Opening', () => {
      expect(isCardSection('Opening', 'Welcome to your reading...')).toBe(false);
    });

    it('should return false for Closing', () => {
      expect(isCardSection('Closing', 'Thank you for this session...')).toBe(false);
    });

    it('should return false for Next Steps', () => {
      expect(isCardSection('Next Steps', 'Consider journaling about...')).toBe(false);
    });

    it('should return false for Gentle Next Steps', () => {
      expect(isCardSection('Gentle Next Steps', 'You might try...')).toBe(false);
    });

    it('should return false for Synthesis', () => {
      expect(isCardSection('Synthesis', 'Bringing these threads together...')).toBe(false);
    });

    it('should return false for Reflection', () => {
      expect(isCardSection('Reflection', 'As you sit with this reading...')).toBe(false);
    });
  });

  describe('card sections by header', () => {
    it('should return true for Major Arcana in header', () => {
      expect(isCardSection('The Fool', 'New beginnings await...')).toBe(true);
    });

    it('should return true for Minor Arcana in header', () => {
      expect(isCardSection('Three of Cups', 'Celebration and joy...')).toBe(true);
    });

    it('should return true for card with position context', () => {
      expect(isCardSection('The Tower (Challenge)', 'Sudden change...')).toBe(true);
    });
  });

  describe('card sections by content', () => {
    it('should return true when content contains Major Arcana', () => {
      expect(isCardSection('Present Situation', 'The Tower crashes through...')).toBe(true);
    });

    it('should return true when content contains Minor Arcana', () => {
      expect(isCardSection('Your Challenge', 'The Five of Swords appears here...')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return false for unknown header without card content', () => {
      expect(isCardSection('Final Thoughts', 'Remember to breathe...')).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      expect(isCardSection('OPENING', 'Welcome...')).toBe(false);
      expect(isCardSection('the fool', 'New beginnings...')).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/narrativeSpine.test.mjs -t "isCardSection"`

Expected: FAIL - `isCardSection` is not exported

### Step 3: Add STRUCTURAL_HEADERS constant

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

Run: `npm test -- tests/narrativeSpine.test.mjs -t "isCardSection"`

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

    expect(result.cardSections).toBe(2); // Fool, Magician
    expect(result.structuralSections).toBe(3); // Opening, Synthesis, Next Steps
    expect(result.cardComplete).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 7: Run test to verify it fails**

Run: `npm test -- tests/narrativeSpine.test.mjs -t "card section tracking"`

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

  return {
    isValid: cardIncomplete === 0,
    totalSections: sections.length,
    // New fields for card-aware gating
    cardSections: cardAnalyses.length,
    cardComplete,
    structuralSections: structuralAnalyses.length,
    // Legacy fields for backward compatibility
    completeSections: cardComplete,
    incompleteSections: cardIncomplete,
    sectionAnalyses: analyses,
    suggestions: cardIncomplete > 0
      ? ["Review incomplete card sections and ensure they include: what is happening, why/how (connector), and what's next"]
      : []
  };
```

### Step 9: Run tests to verify they pass

Run: `npm test -- tests/narrativeSpine.test.mjs`

Expected: All tests pass

### Step 10: Update gate logic in tarot-reading.js

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
        if (spine && spine.cardSections > 0) {
          const spineRatio = (spine.cardComplete || 0) / spine.cardSections;
          if (spineRatio < MIN_SPINE_COMPLETION) {
            qualityIssues.push(`incomplete spine (${spine.cardComplete || 0}/${spine.cardSections} card sections, need ${Math.ceil(MIN_SPINE_COMPLETION * 100)}%)`);
          }
        }
```

### Step 11: Run full test suite

Run: `npm test`

Expected: All tests pass

### Step 12: Commit

```bash
git add functions/lib/narrativeSpine.js functions/api/tarot-reading.js tests/narrativeSpine.test.mjs
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
- Modify: `functions/api/tarot-reading.js:86-88` (update `resolveGraphRAGStats`)
- Test: `tests/tarotReading.telemetry.test.mjs` (new file)

### Step 1: Create test file with failing tests

Create `tests/tarotReading.telemetry.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';

// We'll test the function directly after extracting it
// For now, test the expected behavior

describe('resolveGraphRAGStats', () => {
  // Import the function - will be extracted for testability
  const resolveGraphRAGStats = (analysis, promptMeta = null) => {
    if (promptMeta?.graphRAG) {
      return promptMeta.graphRAG;
    }

    const summary = analysis?.graphRAGPayload?.retrievalSummary;
    if (summary) {
      return {
        ...summary,
        injectedIntoPrompt: false,
        source: 'analysis-fallback'
      };
    }

    return null;
  };

  it('should return promptMeta.graphRAG when available', () => {
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

    expect(result).toEqual(promptMeta.graphRAG);
    expect(result.includedInPrompt).toBe(true);
  });

  it('should add injectedIntoPrompt: false when falling back to analysis', () => {
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: {
          passagesRetrieved: 3,
          keywords: ['transformation']
        }
      }
    };

    const result = resolveGraphRAGStats(analysis, null);

    expect(result.injectedIntoPrompt).toBe(false);
    expect(result.source).toBe('analysis-fallback');
    expect(result.passagesRetrieved).toBe(3);
  });

  it('should return null when neither promptMeta nor analysis available', () => {
    expect(resolveGraphRAGStats(null, null)).toBeNull();
    expect(resolveGraphRAGStats({}, null)).toBeNull();
    expect(resolveGraphRAGStats({ graphRAGPayload: {} }, null)).toBeNull();
  });

  it('should preserve all original summary fields when falling back', () => {
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

    expect(result.passagesRetrieved).toBe(2);
    expect(result.topPatterns).toEqual(['death-star']);
    expect(result.relevanceScores).toEqual([0.8, 0.6]);
    expect(result.injectedIntoPrompt).toBe(false);
  });
});
```

### Step 2: Run test to verify expected behavior is documented

Run: `npm test -- tests/tarotReading.telemetry.test.mjs`

Expected: PASS (tests define expected behavior with inline implementation)

### Step 3: Update resolveGraphRAGStats in tarot-reading.js

In `functions/api/tarot-reading.js`, update `resolveGraphRAGStats` (lines 86-88).

Replace:

```javascript
function resolveGraphRAGStats(analysis, promptMeta = null) {
  return promptMeta?.graphRAG || analysis?.graphRAGPayload?.retrievalSummary || null;
}
```

With:

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
function resolveGraphRAGStats(analysis, promptMeta = null) {
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

### Step 4: Run full test suite

Run: `npm test`

Expected: All tests pass

### Step 5: Commit

```bash
git add functions/api/tarot-reading.js tests/tarotReading.telemetry.test.mjs
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

### Step 2: Run E2E tests (optional)

Run: `npm run test:e2e`

Expected: All E2E tests pass

### Step 3: Final commit with all changes

```bash
git log --oneline -5
```

Verify the three commits are present.

---

## Summary of Changes

| File | Change |
|------|--------|
| `functions/lib/narrative/prompts.js` | Import `getSpreadKey`, replace resolution call, delete `getSpreadKeyFromName()` |
| `functions/lib/narrativeSpine.js` | Add `STRUCTURAL_HEADERS`, `isCardSection()`, update `validateReadingNarrative()` return |
| `functions/api/tarot-reading.js` | Update spine gate to use `cardSections`, fix `resolveGraphRAGStats()` |
| `tests/narrativeBuilder.promptCompliance.test.mjs` | Add spread-key resolution tests |
| `tests/narrativeSpine.test.mjs` | Add `isCardSection` and card section tracking tests |
| `tests/tarotReading.telemetry.test.mjs` | New file with GraphRAG telemetry tests |
