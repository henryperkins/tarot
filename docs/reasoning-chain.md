# Reasoning Chain for Local Composer

> **Status:** Prototype
> **Location:** `functions/lib/narrative/reasoning.js`, `functions/lib/narrative/reasoningIntegration.js`
> **Purpose:** Add explicit "thinking" to the local composer fallback for more coherent, cross-card-aware readings without requiring an LLM.

## Overview

The reasoning chain adds an analysis phase between card data and narrative generation. Instead of processing each card independently, the system first builds a holistic understanding of the spread, then uses that understanding to inform how each card is described and how the reading is synthesized.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           BEFORE (Template-Only)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Card Data ──► Template Lookup ──► Text Assembly ──► Output             │
│                                                                          │
│   Each card processed independently; no cross-card awareness             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        AFTER (With Reasoning Chain)                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Card Data ──► REASONING CHAIN ──► Informed Template ──► Output         │
│                        │                Selection                        │
│                        │                                                 │
│                        ├── Question Intent Analysis                      │
│                        ├── Narrative Arc Detection                       │
│                        ├── Tension Identification                        │
│                        ├── Throughline Detection                         │
│                        ├── Pivot Card Identification                     │
│                        ├── Emotional Arc Mapping                         │
│                        └── Emphasis Map Building                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Question Intent Analysis

Determines what the user is really asking, enabling more targeted responses.

| Intent Type | Pattern Examples | Reading Adaptation |
|-------------|-----------------|-------------------|
| `decision` | "Should I...", "Which path..." | Frame cards as options to weigh |
| `timing` | "When will...", "How soon..." | Emphasize readiness over dates |
| `blockage` | "Why can't I...", "What's stopping..." | Focus on obstacle cards |
| `confirmation` | "Am I right...", "Is this a good idea..." | Reflect back user's wisdom |
| `outcome` | "What will happen...", "Where is this going..." | Emphasize trajectory cards |
| `understanding` | "What does this mean...", "Help me understand..." | Provide deeper insight |
| `exploration` | "How can I...", "What should I..." | Open, guidance-oriented |

**Code Location:** `reasoning.js:analyzeQuestionIntent()`

### 2. Narrative Arc Detection

Identifies the overall "shape" of the reading from card valences and archetypes.

| Arc Pattern | Description | Template Bias |
|-------------|-------------|---------------|
| `struggle-to-resolution` | Challenging start → positive end | Hopeful, transformative |
| `resolution-to-challenge` | Positive start → challenging end | Preparatory, grounded |
| `disruption-and-renewal` | Tower/Death + Star/Sun pattern | Release and rebirth |
| `steady-growth` | Multiple positive cards | Encouraging, expansive |
| `inner-journey` | Hermit/Priestess dominant | Contemplative, patient |
| `active-momentum` | Action cards dominant | Decisive, forward-moving |
| `tension-and-choice` | Two of Swords, Lovers, etc. | Clarifying, choice-focused |

**Code Location:** `reasoning.js:identifyNarrativeArc()`

### 3. Tension Detection

Identifies key contrasts and conflicts between positions that should be explicitly addressed.

**Tension Types:**
- **Emotional Contrast:** Strong valence difference (e.g., Three of Swords → The Sun)
- **Elemental Opposition:** Fire/Water or Air/Earth conflicts
- **Action/Reflection:** Movement cards vs. introspection cards

**Key Tensions:** Special position pairs in Celtic Cross:
- Present ↔ Outcome (where you are vs. where you're heading)
- Conscious ↔ Subconscious (what you want vs. deeper needs)

**Code Location:** `reasoning.js:identifyTensions()`

### 4. Pivot Card Identification

Finds the card that serves as the "fulcrum" or leverage point of the reading.

| Spread | Default Pivot | Reason |
|--------|---------------|--------|
| Celtic Cross | Card 7 (Advice) | Shows how to engage with everything else |
| Three-Card | Card 2 (Present) | Point of power and choice |
| Five-Card | Card 1 (Core) | Everything revolves around it |
| Decision | Card 4 (Clarifier) | Illuminates what wisdom already knows |
| Relationship | Card 3 (Connection) | What the bond itself is asking for |

**Code Location:** `reasoning.js:identifyPivotCard()`

### 5. Emotional Arc Mapping

Tracks the emotional journey across the spread for narrative shaping.

```
Valence Scale: -1 (difficulty) ◄──────► +1 (joy)

Example Three-Card Reading:
  Past (3 of Swords): -0.7 → difficulty
  Present (Hermit): 0.3 → hope
  Future (Sun): 0.8 → joy

Direction: ascending
Summary: "This reading moves from difficulty toward joy—an upward emotional trajectory."
```

**Code Location:** `reasoning.js:mapEmotionalArc()`

### 6. Emphasis Map

Determines how much narrative weight each position should receive.

**Emphasis Levels:**
- `high`: Pivot position, key tension, or emotional peak/valley
- `moderate`: Major Arcana, secondary tensions
- `normal`: Standard positions

**Code Location:** `reasoning.js:buildEmphasisMap()`

## Integration Points

### With Existing Builders

The reasoning chain integrates with existing spread builders via the integration layer:

```javascript
import { buildReadingWithReasoning } from './reasoningIntegration.js';
import { buildThreeCardReading } from './spreads/threeCard.js';

// Wrap existing builder with reasoning
const enhancedReading = await buildReadingWithReasoning(
  payload,
  buildThreeCardReading,
  { personalization }
);

// Returns:
// {
//   reading: "Enhanced narrative text...",
//   reasoning: {
//     questionIntent: {...},
//     narrativeArc: {...},
//     tensions: [...],
//     throughlines: [...],
//     pivotCard: {...},
//     emotionalArc: {...}
//   },
//   prompts: null,
//   usage: null
// }
```

### Connector Selection

The reasoning chain informs connector phrase selection between cards:

```javascript
import { selectReasoningConnector } from './reasoningIntegration.js';

// Instead of random connector:
const connector = selectReasoningConnector(reasoning, 0, 1);
// Returns tension-aware phrase like "Yet from this weight, something begins to lift—"
```

### Opening Customization

The opening adapts to question intent:

```javascript
import { buildReasoningAwareOpening } from './reasoningIntegration.js';

const opening = buildReasoningAwareOpening(
  'Three-Card Story',
  userQuestion,
  context,
  reasoning,
  { personalization }
);
// For decision intent: "You stand at a crossroads, weighing your options."
// For timing intent: "You're wondering about timing and readiness."
```

### Synthesis Enhancement

The synthesis section uses reasoning hooks:

```javascript
import { buildReasoningSynthesis } from './reasoningIntegration.js';

const synthesis = buildReasoningSynthesis(
  cardsInfo,
  reasoning,
  themes,
  userQuestion,
  context
);
// Includes: arc summary, key tensions, pivot insight, emotional journey
```

## API Reference

### Core Functions

#### `buildReadingReasoning(cardsInfo, userQuestion, context, themes, spreadKey)`

Main entry point. Builds complete reasoning chain.

**Parameters:**
- `cardsInfo` (Array): Card information objects
- `userQuestion` (string): User's question
- `context` (string): Reading context (love, career, etc.)
- `themes` (Object): Theme analysis from spread analysis
- `spreadKey` (string): Spread identifier

**Returns:** Complete reasoning chain object

#### `analyzeQuestionIntent(userQuestion)`

Analyzes question to determine intent, focus, and urgency.

**Returns:**
```javascript
{
  type: 'decision',
  typeDescription: 'seeking guidance on a choice',
  focus: 'relationship',
  urgency: 'high',
  keywords: ['partner', 'commitment'],
  originalQuestion: '...'
}
```

#### `identifyNarrativeArc(cardsInfo)`

Identifies the overall story shape.

**Returns:**
```javascript
{
  key: 'struggle-to-resolution',
  name: 'From Struggle to Resolution',
  description: 'A journey from difficulty toward healing and clarity',
  emphasis: 'transformation',
  narrativeGuidance: "Honor where you've been while trusting the trajectory ahead.",
  templateBias: 'hopeful'
}
```

#### `identifyTensions(cardsInfo)`

Finds key tensions between positions.

**Returns:** Array of tension objects with positions, cards, type, description, and bridge phrases.

#### `identifyPivotCard(cardsInfo, spreadKey)`

Finds the pivot/leverage card.

**Returns:**
```javascript
{
  card: 'The Hermit',
  position: 'Self / Advice',
  index: 6,
  reason: 'The Advice position shows how to engage with everything else in the spread.'
}
```

#### `mapEmotionalArc(cardsInfo)`

Maps emotional journey across spread.

**Returns:**
```javascript
{
  start: 'difficulty',
  end: 'joy',
  direction: 'ascending',
  peak: { card: 'The Sun', valence: 0.8, quality: 'joy' },
  valley: { card: 'Three of Swords', valence: -0.7, quality: 'difficulty' },
  summary: 'This reading moves from difficulty toward joy—an upward emotional trajectory.'
}
```

### Integration Functions

#### `buildReadingWithReasoning(payload, baseBuilder, options)`

Wraps existing builder with reasoning chain.

#### `selectReasoningConnector(reasoning, currentIndex, nextIndex)`

Selects tension/arc-aware connector phrase.

#### `buildReasoningAwareOpening(spreadName, userQuestion, context, reasoning, options)`

Builds intent-responsive opening.

#### `buildReasoningSynthesis(cardsInfo, reasoning, themes, userQuestion, context)`

Builds reasoning-informed synthesis.

#### `formatReasoningChain(reasoning)`

Formats reasoning as human-readable text for debugging.

## Configuration

### Card Valence Categories

Modify these sets in `reasoning.js` to adjust emotional mapping:

```javascript
const POSITIVE_CARDS = new Set([
  'The Sun', 'The Star', 'The World', ...
]);

const CHALLENGING_CARDS = new Set([
  'The Tower', 'Ten of Swords', ...
]);

const TRANSITION_CARDS = new Set([
  'Death', 'Wheel of Fortune', ...
]);
```

### Question Patterns

Add new question intent patterns:

```javascript
const QUESTION_PATTERNS = {
  myNewIntent: {
    patterns: [/my pattern/i, /another pattern/i],
    description: 'description for narrative'
  }
};
```

### Arc Patterns

Add new narrative arc patterns:

```javascript
const ARC_PATTERNS = {
  'my-new-arc': {
    test: (cards) => { /* detection logic */ },
    name: 'My New Arc',
    description: '...',
    emphasis: '...',
    narrativeGuidance: '...',
    templateBias: '...'
  }
};
```

## Example Output

### Before (Template-Only)

```markdown
**Past — influences that led here:** The Three of Swords reversed. This
surfaces the experiences and patterns that set the stage for now. In
relationships, this encourages tending to the wound with compassion.

**Present — where you stand now:** And so, The Hermit upright. This is
the current energy and active dynamic you are navigating.

**Future — trajectory if nothing shifts:** Therefore, The Sun upright.
This shows where things are tending if you maintain your current course.
```

### After (With Reasoning Chain)

```markdown
**Three-Card Story (Past · Present · Future)**

You stand at a crossroads in your relationship. *A journey from
difficulty toward healing and clarity.*

---

**Past — influences that led here:** The Three of Swords reversed
opens this story. Old heartbreak is releasing its grip—you're moving
past what once cut deeply. This is the wound that taught you what
you now value.

**Present — where you stand now:** *This brings us to the pivot—*
The Hermit marks a necessary pause. You're integrating the past
before stepping into what's next. The solitude isn't loneliness—
it's preparation.

*This position carries particular weight in your reading. The Present
is your point of power—where awareness becomes choice.*

**Future — trajectory if nothing shifts:** *Yet from this weight,
something begins to lift—* The Sun awaits. The contrast between where
you've been and where you're heading couldn't be starker. This isn't
bypassing the grief—it's what becomes possible *because* you did
that inner work.

---

**The Overall Shape:** A journey from difficulty toward healing and clarity

**Core Dynamic:** The Three of Swords and The Sun pull in different
directions. This tension between where you are and where things are
heading is central to your reading.

**The Pivot:** The Hermit in Present. The Present is your point of
power—where awareness becomes choice.

**Recurring Themes:**
- Strong Water energy emphasizes emotions, intuition, and relationships.
- High Major Arcana presence suggests significant life themes at play.

**Emotional Journey:** This reading moves from difficulty toward joy—an
upward emotional trajectory.

**Guidance:** Honor where you've been while trusting the trajectory ahead.

*Remember: these cards illuminate, they don't determine. Your choices
shape what unfolds.*
```

## Performance

The reasoning chain adds minimal overhead:

| Operation | Typical Time |
|-----------|-------------|
| Question intent analysis | <1ms |
| Narrative arc detection | <1ms |
| Tension identification | 1-2ms (10 cards) |
| Full reasoning chain | 3-5ms total |

All operations are deterministic (no LLM calls) and synchronous.

## Testing

Unit tests are located in `tests/reasoning.test.mjs`.

```bash
npm test -- --grep "reasoning"
```

Key test cases:
- Question intent detection for each type
- Arc detection for known patterns
- Tension detection between opposing cards
- Pivot identification per spread type
- Emotional arc calculation

## Future Enhancements

1. **Learning from Feedback:** Track which reasoning patterns correlate with positive user feedback
2. **Template Variant Scoring:** Use reasoning to score template variants, not just random selection
3. **Dynamic Arc Detection:** Detect more nuanced arc patterns (hero's journey stages, etc.)
4. **Cross-Session Reasoning:** Consider user's previous readings in reasoning
5. **Visualization:** Generate reasoning chain visualizations for debugging

## Related Files

- `functions/lib/narrative/reasoning.js` - Core reasoning chain
- `functions/lib/narrative/reasoningIntegration.js` - Builder integration
- `functions/lib/narrative/helpers.js` - Existing template system
- `functions/lib/narrative/spreads/*.js` - Spread-specific builders
- `functions/api/tarot-reading.js` - Main endpoint
- `tests/reasoning.test.mjs` - Unit tests
