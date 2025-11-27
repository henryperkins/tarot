# Complete Implementation: Adding New Reversal Frameworks

## Overview

This implementation adds 3 new reversal interpretation frameworks:

1. **Shadow Integration** - Jungian shadow work with micro-practices
2. **Mirror/Reflection** - Cards reflect unconscious projection
3. **Unrealized Potential** - Dormant gifts awaiting activation

---

## Step 1: Add Framework Definitions

**File:** [`functions/lib/spreadAnalysis.js`](functions/lib/spreadAnalysis.js:400)

Add these new frameworks to the `REVERSAL_FRAMEWORKS` object after line 450:

```javascript
export const REVERSAL_FRAMEWORKS = {
  // ... existing frameworks (none, blocked, delayed, internalized, contextual) ...

  shadow: {
    name: "Shadow Integration",
    description:
      "Reversals reveal disowned emotions, avoided needs, or unconscious habits surfacing for healing and wholeness.",
    guidance:
      "Name the hidden feeling, show how it can be witnessed safely, and suggest a micro-practice for reintegration.",
    examples: {
      "The Moon":
        "Anxiety eases when you name the fear aloud and create grounding rituals—try writing it down each morning.",
      "Five of Swords":
        "Step out of zero-sum thinking by repairing the belief that conflict equals abandonment.",
      "The Tower":
        "Resistance to change reveals fear of loss of control—acknowledge the grief of letting go as a first step.",
      "The Devil":
        "An attachment you judge in yourself deserves compassion; what need does it serve?",
    },
  },

  mirror: {
    name: "Mirror / Reflection",
    description:
      "Reversed cards reflect back to the querent what they are projecting outward—a mirror of unconscious behavior or energy.",
    guidance:
      "Ask what aspect of this energy you might be unconsciously expressing, attracting, or projecting onto others.",
    examples: {
      "The Emperor":
        "Where are you being overly controlling or rigid without realizing it?",
      "Queen of Cups":
        "Are you suppressing your emotional needs while focusing on caring for others?",
      "Knight of Swords":
        "Is your mental intensity coming across as aggression to those around you?",
      "The Hermit":
        "Are you isolating yourself in ways that others perceive as withdrawal or judgment?",
    },
  },

  potentialBlocked: {
    name: "Unrealized Potential",
    description:
      "Reversed cards show latent gifts, strengths, or capacities that have not yet been activated, claimed, or developed.",
    guidance:
      "Read each reversal as a dormant strength awaiting conscious cultivation—ask what would help this energy emerge fully.",
    examples: {
      "The Magician":
        "You have the tools and skills—what belief or circumstance is preventing you from wielding them fully?",
      "Eight of Pentacles":
        "A talent exists that you haven't invested time in developing yet. What would daily practice look like?",
      "The Star":
        "Hope and inspiration are available but not yet accessed—what would help you reconnect with your vision?",
      "Ace of Wands":
        "Creative fire is present but hasn't been channeled. What outlet would give it form?",
    },
  },
};
```

---

## Step 2: Enhance Framework Selection Logic

**File:** [`functions/lib/spreadAnalysis.js`](functions/lib/spreadAnalysis.js:389)

Replace the `selectReversalFramework` function with an enhanced version:

```javascript
/**
 * Select appropriate reversal interpretation framework based on patterns
 *
 * @param {number} ratio - Ratio of reversed cards (0-1)
 * @param {Array} cardsInfo - Card array for pattern detection
 * @param {Object} [options] - Additional context
 * @param {string} [options.userQuestion] - User's question for intent detection
 * @returns {string} Framework key
 */
function selectReversalFramework(ratio, cardsInfo, options = {}) {
  if (ratio === 0) return "none";

  const { userQuestion } = options;

  // Detect shadow work intent from question keywords
  if (userQuestion) {
    const q = userQuestion.toLowerCase();
    const shadowKeywords = [
      "afraid",
      "avoid",
      "fear",
      "shadow",
      "hidden",
      "deny",
      "repress",
      "shame",
      "guilt",
      "trigger",
    ];
    const mirrorKeywords = [
      "reflect",
      "mirror",
      "project",
      "attract",
      "pattern",
      "repeat",
      "always",
    ];
    const potentialKeywords = [
      "potential",
      "talent",
      "gift",
      "dormant",
      "untapped",
      "could be",
      "capable",
    ];

    if (shadowKeywords.some((kw) => q.includes(kw))) {
      return "shadow";
    }
    if (mirrorKeywords.some((kw) => q.includes(kw))) {
      return "mirror";
    }
    if (potentialKeywords.some((kw) => q.includes(kw))) {
      return "potentialBlocked";
    }
  }

  // Detect multiple Major Arcana reversed = potential-blocked
  if (Array.isArray(cardsInfo)) {
    const reversedMajors = cardsInfo.filter(
      (c) =>
        c &&
        (c.orientation || "").toLowerCase() === "reversed" &&
        typeof c.number === "number" &&
        c.number >= 0 &&
        c.number <= 21
    );
    if (reversedMajors.length >= 2) {
      return "potentialBlocked";
    }
  }

  // Original ratio-based logic
  if (ratio >= 0.6) return "blocked";
  if (ratio >= 0.4) return "internalized";
  if (ratio >= 0.2) return "delayed";
  return "contextual";
}
```

---

## Step 3: Update Function Call in `analyzeSpreadThemes`

**File:** [`functions/lib/spreadAnalysis.js`](functions/lib/spreadAnalysis.js:293)

Update line ~293 to pass the user question:

```javascript
// Change from:
let reversalFramework = selectReversalFramework(reversalRatio, cardsInfo);

// To:
let reversalFramework = selectReversalFramework(reversalRatio, cardsInfo, {
  userQuestion: options.userQuestion,
});
```

> `analyzeSpreadThemes` already accepts an `options` argument, so no signature change is required—just ensure `options.userQuestion` is plumbed into the selector as shown.

---

## Step 4: Pass User Question Through the Chain

**File:** [`functions/api/tarot-reading.js`](functions/api/tarot-reading.js:689)

In `performSpreadAnalysis`, pass `userQuestion` through to `analyzeSpreadThemes` and also forward `deckStyle` so theme analysis stops defaulting to `'rws-1909'`:

```javascript
// Around line 689, change:
themes = await analyzeSpreadThemes(cardsInfo, {
  reversalFrameworkOverride: options.reversalFrameworkOverride,
});

// To:
themes = await analyzeSpreadThemes(cardsInfo, {
  reversalFrameworkOverride: options.reversalFrameworkOverride,
  deckStyle: options.deckStyle,
  userQuestion: options.userQuestion, // ADD THIS
});
```

---

## Step 5: Add UI Option for Manual Selection (Optional)

**File:** [`src/components/ExperienceSettings.jsx`](src/components/ExperienceSettings.jsx)

The select is currently hard-coded—append the new frameworks directly inside the existing `<select>`:

```jsx
<select ...>
  <option value="auto">Auto (recommended)</option>
  <option value="blocked">Blocked energy</option>
  <option value="delayed">Timing & delays</option>
  <option value="internalized">Internal process</option>
  <option value="contextual">Context-based</option>
  <option value="shadow">Shadow Integration (Jungian)</option>
  <option value="mirror">Mirror / reflection</option>
  <option value="potentialBlocked">Unrealized potential</option>
</select>
```

Also extend the helper text block beneath the select so that each new framework renders explanatory copy when manually selected:

```jsx
{reversalFramework === "shadow" && (
  <>
    <span className="font-semibold text-secondary">Shadow</span> — surface hidden feelings and name a reintegration micro-practice
  </>
)}
{reversalFramework === "mirror" && (
  <>
    <span className="font-semibold text-secondary">Mirror</span> — examine what energy you might be projecting or attracting
  </>
)}
{reversalFramework === "potentialBlocked" && (
  <>
    <span className="font-semibold text-secondary">Potential</span> — treat reversals as dormant strengths awaiting activation
  </>
)}
```

---

## Step 6: Add Tests

**File:** [`functions/lib/__tests__/spreadAnalysis.test.js`](functions/lib/__tests__/) (create if needed)

Use Node’s built-in test runner to stay consistent with the existing suite:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REVERSAL_FRAMEWORKS, selectReversalFramework } from '../spreadAnalysis.js';

describe('Reversal Frameworks', () => {
  it('should have all expected frameworks defined', () => {
    const expectedKeys = [
      'none',
      'blocked',
      'delayed',
      'internalized',
      'contextual',
      'shadow',
      'mirror',
      'potentialBlocked'
    ];

    expectedKeys.forEach((key) => {
      const framework = REVERSAL_FRAMEWORKS[key];
      assert.ok(framework, `Framework ${key} is missing`);
      assert.ok(framework.name);
      assert.ok(framework.description);
      assert.ok(framework.guidance);
    });
  });

  it('shadow framework should have examples for key cards', () => {
    const shadow = REVERSAL_FRAMEWORKS.shadow;
    assert.ok(shadow.examples['The Moon']);
    assert.ok(shadow.examples['The Tower']);
  });
});

describe('selectReversalFramework', () => {
  it('should detect shadow intent from question keywords', () => {
    const result = selectReversalFramework(0.3, [], {
      userQuestion: 'What am I afraid to face?'
    });
    assert.strictEqual(result, 'shadow');
  });

  it('should detect mirror intent from question keywords', () => {
    const result = selectReversalFramework(0.3, [], {
      userQuestion: 'Why do I keep attracting the same patterns?'
    });
    assert.strictEqual(result, 'mirror');
  });

  it('should detect potential-blocked when 2+ Major Arcana reversed', () => {
    const cardsInfo = [
      { number: 1, orientation: 'Reversed' },  // The Magician
      { number: 17, orientation: 'Reversed' }, // The Star
      { number: 5, orientation: 'Upright' }    // The Hierophant
    ];
    const result = selectReversalFramework(0.4, cardsInfo, {});
    assert.strictEqual(result, 'potentialBlocked');
  });
});
```

> **Note:** `npm test` currently runs `node --test tests/*.test.mjs`. Either invoke `node --test functions/lib/__tests__/spreadAnalysis.test.js` directly or update the script to include the `functions/lib/__tests__` glob.

---

## Step 7: Export the Function (if needed for testing)

**File:** [`functions/lib/spreadAnalysis.js`](functions/lib/spreadAnalysis.js)

If `selectReversalFramework` is not already exported, add it to the exports:

```javascript
// At the end of the file, ensure it's exported:
export { selectReversalFramework };
```

---

## Verification Checklist

After implementation:

1. [ ] Run `npm test` (existing suite) **and** `node --test functions/lib/__tests__/spreadAnalysis.test.js`
2. [ ] Run `npm run dev` and create a reading with a question containing "afraid" or "shadow" - should use Shadow Integration framework
3. [ ] Create a reading with 2+ reversed Major Arcana - should use Unrealized Potential framework
4. [ ] Verify the prompt contains the new framework text (enable `LOG_LLM_PROMPTS=true` in `.dev.vars`)
5. [ ] Confirm the generated reading uses language consistent with the selected framework

---

## Expected Prompt Output Example

With Shadow Integration selected, the prompt will include:

```
REVERSAL FRAMEWORK
- Reversal lens: "Shadow Integration". Reversals reveal disowned emotions,
  avoided needs, or unconscious habits surfacing for healing and wholeness.
- Guidance: Name the hidden feeling, show how it can be witnessed safely,
  and suggest a micro-practice for reintegration.
- Example applications:
  - The Moon reversed: Anxiety eases when you name the fear aloud and create
    grounding rituals—try writing it down each morning.
  - The Tower reversed: Resistance to change reveals fear of loss of control—
    acknowledge the grief of letting go as a first step.
- Keep this lens consistent for all reversed cards in this spread.
```

This produces readings with specific micro-practices and shadow work framing rather than the more observational "internal processing" tone.
