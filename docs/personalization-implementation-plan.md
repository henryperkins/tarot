# Personalization Features Implementation Plan

## Overview

Implement the personalization preferences collected during onboarding throughout the application. This includes both **narrative personalization** (backend: reading tone, spiritual frame, display name) and **UI personalization** (frontend: ritual visibility, spread recommendations, experience-based helpers).

## User Decisions
- **Priority**: Both narrative and UI equally
- **displayName**: Weave naturally throughout narrative
- **showRitualSteps=false**: Hide ritual step completely

---

## Important Implementation Notes

### Backward Compatibility
All personalization features must be backward compatible. Always use defensive patterns:

```javascript
// Always destructure with defaults
const {
  displayName,
  readingTone = 'balanced',
  spiritualFrame = 'mixed',
  tarotExperience = 'intermediate',
  showRitualSteps = true,
  preferredSpreadDepth = 'standard'
} = personalization || {};
```

### Null Safety for displayName
Never produce awkward empty-name text. Always use conditional inclusion:

```javascript
// ❌ BAD - produces "For you, , this suggests..."
`For you, ${displayName}, this suggests...`

// ✅ GOOD - gracefully handles missing name
const nameClause = displayName ? `, ${displayName},` : '';
`For you${nameClause} this suggests...`

// ✅ ALSO GOOD - skip entire personalized section
displayName ? `${displayName}, you asked: ${question}` : `You asked: ${question}`
```

### Error Handling
Handle these edge cases:
- **Schema validation fails**: Log warning, proceed with defaults
- **localStorage unavailable**: Use in-memory defaults, don't crash
- **Preferences load after mount**: Use `useEffect` for re-initialization, not `useState` initializer

### Schema Threading (Critical)

> **⚠️ Important**: The current `safeParseReadingRequest` in `shared/contracts/readingSchema.js` **strips unknown keys**. Any personalization sent from the client will be dropped unless the schema is updated first.

This means Phase 1.1 (schema update) is a **hard prerequisite** for all other phases. Without it, personalization data never reaches the backend.

### PII Logging Redaction

The `shouldLogLLMPrompts` flag currently prints full prompts to logs. When `displayName` is included in prompts, this leaks PII.

```javascript
// ❌ BAD - logs PII
if (shouldLogLLMPrompts) {
  console.log('Prompt:', systemPrompt);
}

// ✅ GOOD - redact displayName before logging
if (shouldLogLLMPrompts) {
  const redactedPrompt = systemPrompt.replace(
    new RegExp(displayName, 'gi'),
    '[REDACTED_NAME]'
  );
  console.log('Prompt:', redactedPrompt);
}
```

### Token Budget Safeguards

Adding tone/frame guidance paragraphs increases system prompt size (~200-400 tokens). Implement budget-aware insertion:

```javascript
function buildSystemPrompt(options = {}) {
  const { personalization, maxTokenBudget = 2000 } = options;

  let prompt = BASE_SYSTEM_PROMPT;

  // Calculate remaining budget
  const baseTokens = estimateTokens(prompt);
  const remainingBudget = maxTokenBudget - baseTokens;

  // Only add tone/frame if budget allows
  if (remainingBudget > 400 && personalization) {
    const { readingTone, spiritualFrame } = personalization;
    if (readingTone && TONE_GUIDANCE[readingTone]) {
      prompt += `\n\n## Reading Tone\n${TONE_GUIDANCE[readingTone]}`;
    }
    if (spiritualFrame && FRAME_GUIDANCE[spiritualFrame]) {
      prompt += `\n\n## Interpretive Frame\n${FRAME_GUIDANCE[spiritualFrame]}`;
    }
  }

  return prompt;
}
```

---

## Architecture Notes

### State Management
- **Ritual state** lives in `useTarotState` hook (`src/hooks/useTarotState.js`)
  - Flags: `hasKnocked`, `knockCount`, `hasCut`, `cutIndex`, `sessionSeed`
  - Spread selection: `selectedSpreadState`, `selectSpread()`
- **Step progression** is derived from flags (no mutable `currentStep`)
  - `activeStep` is computed in `TarotReading.jsx:433` from `hasReading`, `hasConfirmedSpread`, etc.
- **Personalization state** is in `PreferencesContext` (`src/contexts/PreferencesContext.jsx`)
  - All setters already exist (lines 194-232)
  - Persistence to localStorage already implemented

### Narrative Generation
- **Claude API path**: `functions/lib/narrative/prompts.js` → `buildEnhancedClaudePrompt()`
- **Local fallback path**: `functions/api/tarot-reading.js`
  - `composeReadingEnhanced()` (line 1204)
  - `generateReadingFromAnalysis()` (line 1264)
  - `buildGenericReading()` (line 1302)
  - Spread-specific builders via `SPREAD_READING_BUILDERS` map (line 1159)
- **Spread builders**: `functions/lib/narrative/spreads/*.js`
  - `celticCross.js`, `threeCard.js`, `fiveCard.js`, `relationship.js`, `decision.js`, `singleCard.js`

> **Note**: `functions/lib/narrativeBuilder.js` is only a re-export module (12 lines). Actual implementation is in the files above.

---

## Phase 1: Schema & Data Flow (Foundation)

### 1.1 Update Reading Request Schema
**File**: `shared/contracts/readingSchema.js`

Add personalization object to the schema:
```javascript
personalization: z.object({
  displayName: z.string().trim().max(50).optional(),
  readingTone: z.enum(['gentle', 'balanced', 'blunt']).optional(),
  spiritualFrame: z.enum(['psychological', 'spiritual', 'mixed', 'playful']).optional(),
  tarotExperience: z.enum(['newbie', 'intermediate', 'experienced']).optional()
}).optional()
```

### 1.2 Update ReadingContext to Pass Personalization
**File**: `src/contexts/ReadingContext.jsx`

- Extract `personalization` from `usePreferences()`
- Add to payload in `generatePersonalReading()`:
```javascript
const payload = {
  // ...existing fields
  personalization: {
    displayName: personalization.displayName || undefined,
    readingTone: personalization.readingTone,
    spiritualFrame: personalization.spiritualFrame,
    tarotExperience: personalization.tarotExperience
  }
};
```

---

## Phase 2: Backend Narrative Personalization

### 2.1 Extract Personalization in API Handler
**File**: `functions/api/tarot-reading.js`

In `onRequestPost` (around line 360), extract personalization from normalized payload:
```javascript
const { personalization } = normalizedPayload;
```

Pass to both Claude and local composer paths.

### 2.2 Modify Claude System Prompt Builder
**File**: `functions/lib/narrative/prompts.js`

Update `buildSystemPrompt()` to accept `options.personalization` and inject tone/frame guidance:

**Reading Tone Section** (after core principles):

```javascript
const TONE_GUIDANCE = {
  gentle: `Use warm, nurturing language throughout. Lead with validation before
           addressing challenges. Frame difficulties as growth opportunities
           rather than obstacles. Avoid harsh absolutes or alarming language.
           Emphasize possibilities, hope, and the querent's inner wisdom.`,

  balanced: `Be honest but kind. Acknowledge both challenges and opportunities
             with equal weight. Balance difficult truths with encouragement.
             Use measured language that neither sugarcoats nor dramatizes.
             Trust the querent to handle nuanced information.`,

  blunt: `Be direct and clear. Skip softening phrases like "perhaps" or
          "you might consider." State observations plainly without hedging.
          Focus on clarity over comfort. Assume the querent prefers
          straightforward guidance over diplomatic cushioning.`
};
```

**Spiritual Frame Section**:

```javascript
const FRAME_GUIDANCE = {
  psychological: `Interpret through Jungian archetypes, shadow work, and
                  behavioral patterns. Use language of the psyche: projection,
                  integration, individuation. Ground insights in observable
                  patterns and personal development frameworks.`,

  spiritual: `Embrace intuitive, mystical language. Reference cosmic cycles,
              soul contracts, and energetic resonance. Honor the sacred
              dimension of the reading. Use terms like "spirit guides,"
              "higher self," and "universal wisdom" where appropriate.`,

  mixed: `Blend psychological insight with spiritual symbolism naturally.
          Move fluidly between archetypal psychology and mystical language
          based on what serves each card's message. This is the default
          approach when no preference is specified.`,

  playful: `Keep it light, fun, and exploratory. Use humor where appropriate.
            Frame the reading as a curious adventure rather than a solemn
            ritual. Avoid heavy language even for challenging cards.
            Maintain wonder and levity throughout.`
};
```

### 2.3 Modify Claude User Prompt Builder
**File**: `functions/lib/narrative/prompts.js`

Update `buildUserPrompt()` to weave displayName naturally:
- In question preamble: "Sarah, you asked: ..."
- In synthesis sections: "For you, Sarah, this suggests..."
- At closing: "Remember, Sarah, ..."

### 2.4 Update Local Composer Functions
**File**: `functions/api/tarot-reading.js`

> **Key Principle**: Local composer must use the **same style primitives** as Claude prompts. Extract shared constants to ensure consistency between both paths.

**Create shared style helpers** (`functions/lib/narrative/styleHelpers.js`):
```javascript
// Shared between Claude prompts and local composer
export const TONE_STYLES = {
  gentle: {
    openingAdjectives: ['nurturing', 'supportive', 'encouraging'],
    challengeFraming: 'growth opportunity',
    closingTone: 'warm reassurance'
  },
  balanced: {
    openingAdjectives: ['thoughtful', 'measured', 'clear'],
    challengeFraming: 'honest acknowledgment',
    closingTone: 'grounded encouragement'
  },
  blunt: {
    openingAdjectives: ['direct', 'straightforward', 'clear-eyed'],
    challengeFraming: 'plain truth',
    closingTone: 'actionable clarity'
  }
};

export const FRAME_VOCABULARY = {
  psychological: ['archetype', 'shadow', 'integration', 'projection', 'individuation'],
  spiritual: ['soul', 'divine', 'sacred', 'cosmic', 'higher self'],
  mixed: ['energy', 'wisdom', 'insight', 'journey', 'growth'],
  playful: ['adventure', 'curious', 'explore', 'discover', 'wonder']
};

export function buildNameClause(displayName, position = 'inline') {
  if (!displayName?.trim()) return '';
  const name = displayName.trim();
  switch (position) {
    case 'opening': return `${name}, `;
    case 'inline': return `, ${name},`;
    case 'closing': return `, ${name}`;
    default: return `, ${name},`;
  }
}
```

Modify these functions to accept and use personalization:

1. **`composeReadingEnhanced()`** (search for function name)
   - Extract personalization from payload
   - Pass to `generateReadingFromAnalysis()`

```javascript
async function composeReadingEnhanced(payload, env) {
  const { personalization } = payload;

  // ... existing analysis logic ...

  return generateReadingFromAnalysis(analysis, {
    spreadKey: payload.spreadInfo.key,
    question: payload.userQuestion,
    personalization // Thread through
  });
}
```

2. **`generateReadingFromAnalysis()`** (search for function name)
   - Add `personalization` to the options object
   - Pass through to spread builders and `buildGenericReading()`

```javascript
function generateReadingFromAnalysis(analysis, options = {}) {
  const { spreadKey, question, personalization } = options;

  // Look up spread-specific builder
  const builder = SPREAD_READING_BUILDERS[spreadKey];
  if (builder) {
    return builder(analysis, { question, personalization });
  }

  // Fallback to generic
  return buildGenericReading(analysis, { question, personalization });
}
```

3. **`buildGenericReading()`** (search for function name)
   - Inject displayName into opening/closing text
   - Adjust language style based on `readingTone`
   - Frame interpretations based on `spiritualFrame`

```javascript
import { TONE_STYLES, FRAME_VOCABULARY, buildNameClause } from './narrative/styleHelpers';

function buildGenericReading(analysis, options = {}) {
  const { question, personalization } = options;
  const {
    displayName,
    readingTone = 'balanced',
    spiritualFrame = 'mixed'
  } = personalization || {};

  const tone = TONE_STYLES[readingTone];
  const vocab = FRAME_VOCABULARY[spiritualFrame];
  const nameClause = buildNameClause(displayName);

  // Opening with personalization
  const opening = displayName
    ? `${displayName}, the cards reveal a ${tone.openingAdjectives[0]} message...`
    : `The cards reveal a ${tone.openingAdjectives[0]} message...`;

  // Use vocab for framing interpretations
  // ... existing card interpretation logic, using vocab words ...

  // Closing with name
  const closing = `Remember${nameClause} the ${vocab[0]} you bring to this moment shapes what unfolds.`;

  return { opening, body, closing };
}
```

4. **Spread-specific builders** (`SPREAD_READING_BUILDERS` map)
   - Update each builder call signature to include personalization

### 2.5 Update Individual Spread Builders
**Files**: `functions/lib/narrative/spreads/*.js`

Each spread builder needs personalization support. Use the **same style helpers** as `buildGenericReading()`:

```javascript
// Example: functions/lib/narrative/spreads/threeCard.js
import { TONE_STYLES, FRAME_VOCABULARY, buildNameClause } from '../styleHelpers';

export function buildThreeCardReading(analysis, options = {}) {
  const { question, personalization } = options;
  const {
    displayName,
    readingTone = 'balanced',
    spiritualFrame = 'mixed'
  } = personalization || {};

  const tone = TONE_STYLES[readingTone];
  const nameClause = buildNameClause(displayName);

  // Apply tone to position interpretations
  const pastIntro = readingTone === 'gentle'
    ? 'Looking back with compassion, the Past position shows...'
    : readingTone === 'blunt'
    ? 'The Past position clearly indicates...'
    : 'The Past position reveals...';

  // ... spread-specific logic with personalization ...
}
```

**Files to update**:
- `celticCross.js` - Add personalization parameter, apply tone/frame/name
- `threeCard.js` - Add personalization parameter, apply tone/frame/name
- `fiveCard.js` - Add personalization parameter, apply tone/frame/name
- `relationship.js` - Add personalization parameter, apply tone/frame/name
- `decision.js` - Add personalization parameter, apply tone/frame/name
- `singleCard.js` - Add personalization parameter, apply tone/frame/name

---

## Phase 3: Frontend UI Personalization

### 3.1 Ritual Skip via useTarotState
**File**: `src/hooks/useTarotState.js`

> **⚠️ Critical Race Condition**: The current `shuffle()` function computes the seed immediately and then sets state. The `hasConfirmedSpread` flag is set internally by shuffle, which is **too late** for seed derivation. Auto-completion must happen **inside shuffle before `computeSeed`** to maintain determinism.

Add ritual skip capability that respects seed determinism:

```javascript
export function useTarotState(speak) {
  // Extract personalization at top level (required by Rules of Hooks)
  const { personalization } = usePreferences();

  // Derive skip flag from preferences
  const shouldSkipRitual = personalization?.showRitualSteps === false;

  // Fixed deterministic defaults for skipped ritual
  const SKIP_RITUAL_DEFAULTS = {
    knockTimes: [100, 200, 300], // Fixed intervals
    knockCount: 3,
    cutIndex: null // Will be computed as deckSize / 2
  };

  // CRITICAL: Modify shuffle() to auto-complete ritual BEFORE seed calculation
  const shuffle = useCallback((spreadKey) => {
    // If skipping ritual and not already completed, apply defaults FIRST
    let effectiveKnockTimes = knockTimesRef.current;
    let effectiveCutIndex = cutIndexRef.current;

    if (shouldSkipRitual && !hasKnocked) {
      // Apply deterministic defaults before seed calculation
      effectiveKnockTimes = SKIP_RITUAL_DEFAULTS.knockTimes;
      effectiveCutIndex = Math.floor(deckSize / 2);

      // Update refs so computeSeed uses these values
      knockTimesRef.current = effectiveKnockTimes;
      cutIndexRef.current = effectiveCutIndex;
    }

    // NOW compute seed (will use auto-completed values if ritual was skipped)
    const seed = computeSeed({
      cutIndex: effectiveCutIndex,
      knockTimes: effectiveKnockTimes,
      userQuestion
    });

    // ... rest of shuffle logic

    // Update state AFTER seed calculation
    if (shouldSkipRitual && !hasKnocked) {
      setKnockCount(SKIP_RITUAL_DEFAULTS.knockCount);
      setHasKnocked(true);
      setCutIndex(effectiveCutIndex);
      setHasCut(true);
    }
  }, [shouldSkipRitual, hasKnocked, deckSize, userQuestion]);

  return {
    // ...existing returns
    shouldSkipRitual
  };
}
```

**File**: `src/TarotReading.jsx`

The TarotReading effect can remain as a **guard** but is no longer the primary auto-completion mechanism:

```javascript
const { shouldSkipRitual } = useTarotState(speak);

// Track if we've already auto-completed to prevent re-runs
const hasAutoCompletedRef = useRef(false);

// Guard effect: ensures ritual state is consistent if shuffle wasn't called yet
useEffect(() => {
  if (
    hasConfirmedSpread &&
    shouldSkipRitual &&
    !hasKnocked &&
    !hasAutoCompletedRef.current
  ) {
    // This should rarely trigger since shuffle handles it, but acts as a safety net
    hasAutoCompletedRef.current = true;
    console.warn('Ritual auto-complete fallback triggered - shuffle should handle this');
  }
}, [hasConfirmedSpread, shouldSkipRitual, hasKnocked]);

// Reset ref when starting a new reading
useEffect(() => {
  if (!hasConfirmedSpread) {
    hasAutoCompletedRef.current = false;
  }
}, [hasConfirmedSpread]);
```

**Critical Implementation Notes**:

1. **Timing**: Auto-completion MUST happen inside `shuffle()` BEFORE `computeSeed()` is called. The effect in TarotReading.jsx is only a safety net.

2. **Determinism**: Use fixed values (not random) so the same question produces the same seed:
   - `knockTimes: [100, 200, 300]` - Fixed intervals
   - `cutIndex: deckSize / 2` - Center cut

3. **State vs Refs**: Update refs first (for immediate seed calculation), then update state (for UI consistency).

4. **StrictMode Safety**: The `useRef` guard prevents double-execution in React StrictMode.

### 3.2 Spread Selector Default Selection
**File**: `src/hooks/useTarotState.js`

> **⚠️ Important**: React hooks cannot be called inside `useState` initializers. Use `useEffect` for preference-based initialization instead.

**Shared helper**: `src/utils/personalization.js`
```javascript
import { DEFAULT_SPREAD_KEY } from '../data/spreads';

export function getSpreadFromDepth(depth) {
  switch (depth) {
    case 'short':
      return 'single';
    case 'standard':
      return 'threeCard';
    case 'deep':
      return 'celtic';
    default:
      return DEFAULT_SPREAD_KEY;
  }
}
```

```javascript
import { getSpreadFromDepth } from '../utils/personalization';

export function useTarotState(speak) {
  const { personalization } = usePreferences();

  // Initialize with default, then update from preferences
  const [selectedSpreadState, setSelectedSpreadState] = useState(DEFAULT_SPREAD_KEY);

  // Track whether user has manually selected a spread
  const [hasUserSelectedSpread, setHasUserSelectedSpread] = useState(false);

  // Apply preference-based default whenever preferences change,
  // but never override a manual user choice.
  useEffect(() => {
    if (!hasUserSelectedSpread && personalization?.preferredSpreadDepth) {
      const preferredSpread = getSpreadFromDepth(personalization.preferredSpreadDepth);
      setSelectedSpreadState(preferredSpread);
    }
  }, [hasUserSelectedSpread, personalization?.preferredSpreadDepth]);

  // Wrap setter to track manual selection
  const selectSpread = useCallback((spreadKey) => {
    setHasUserSelectedSpread(true);
    setSelectedSpreadState(spreadKey);
  }, []);

  return {
    selectedSpread: selectedSpreadState,
    selectSpread,
    // ...existing returns
  };
}
```

> ⚠️ React will re-run the effect when onboarding data hydrates later in the session, so guard on `hasUserSelectedSpread` to avoid overwriting an explicit choice.

**File**: `src/components/SpreadSelector.jsx`

Add visual indicator for "recommended" spread:
```javascript
import { getSpreadFromDepth } from '../utils/personalization';

const { personalization } = usePreferences();
const recommendedSpread = getSpreadFromDepth(personalization?.preferredSpreadDepth);

// In render:
<div className={`spread-option ${spread.key === selectedSpread ? 'selected' : ''}`}>
  {spread.name}
  {spread.key === recommendedSpread && (
    <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
      Recommended
    </span>
  )}
</div>
```

### 3.3 Experience-Based Helper Visibility

Update these components to respect `tarotExperience`:

| File | Changes |
|------|---------|
| `src/components/RitualControls.jsx` | Collapse helpers for experienced users |
| `src/components/QuestionInput.jsx` | Hide verbose tooltips for experienced |
| `src/components/SpreadSelector.jsx` | Streamline descriptions for experienced |
| `src/components/ReadingPreparation.jsx` | Auto-collapse all panels for experienced |
| `src/components/GuidedIntentionCoach.jsx` | Skip intro nudges for experienced |
| `src/components/HelperToggle.jsx` | Default-expand for newbies only |
| `src/components/StreamingNarrative.jsx` | Can show personalized name during streaming |
| `src/components/MobileSettingsDrawer.jsx` | May need personalization section link |
| `src/components/StepProgress.jsx` | Hide/show step descriptions based on experience |

**Pattern for each component**:
```javascript
const { personalization } = usePreferences();
const isExperienced = personalization?.tarotExperience === 'experienced';
const isNewbie = personalization?.tarotExperience === 'newbie';

// Conditional rendering:
{!isExperienced && <DetailedHelpText />}
{isNewbie && <LearnMoreLink />}
```

**Design Consideration**: Experienced users might still want help occasionally. Consider:
- A per-session "Show tips" toggle in the header or settings drawer
- Making "Learn more" links accessible but visually de-emphasized (not hidden)
- A keyboard shortcut (e.g., `?`) to temporarily show all helpers

### 3.4 Display Name in UI
**Files**:
- `src/components/Header.jsx` - Optional greeting: "Welcome back, Sarah"
- `src/components/ReadingDisplay.jsx` - "Your reading, Sarah"

```javascript
const { personalization } = usePreferences();
const displayName = personalization?.displayName;

// In render:
{displayName && <span className="greeting">Welcome back, {displayName}</span>}
```

---

## Phase 4: Settings Page Integration

### 4.1 Add Personalization Section to ExperienceSettings
**File**: `src/components/ExperienceSettings.jsx`

Add new collapsible section "Reading Style" with controls for:
- Reading tone selector (gentle/balanced/blunt)
- Spiritual frame selector (4 options)
- Display name input
- Show ritual steps toggle
- Preferred spread depth selector

**Available setters from PreferencesContext** (already implemented):
- `setDisplayName(value)`
- `setTarotExperience(value)`
- `setReadingTone(value)`
- `setPreferredSpreadDepth(value)`
- `setSpiritualFrame(value)`
- `setShowRitualSteps(value)`
- `setFocusAreas(value)` / `toggleFocusArea(area)`

No changes needed to PreferencesContext - all setters exist.

---

## Phase 5: Journal Personalization Storage

### 5.1 Store Preferences with Journal Entries
**File**: `src/hooks/useSaveReading.js`

Include personalization context with each saved reading for longitudinal analysis:

```javascript
import { usePreferences } from '../contexts/PreferencesContext';

export function useSaveReading() {
    const { personalization } = usePreferences();
    // ...existing code

    async function saveReading() {
        // ...existing validation

        const entry = {
            // ...existing fields
            spread: spreadInfo?.name || 'Tarot Spread',
            spreadKey: selectedSpread,
            question: userQuestion || '',
            cards: reading.map((card, index) => ({ /* existing */ })),
            personalReading: personalReading?.raw || personalReading?.normalized || '',
            // NEW: Store preferences snapshot with entry
            userPreferences: {
                readingTone: personalization?.readingTone || 'balanced',
                spiritualFrame: personalization?.spiritualFrame || 'mixed',
                tarotExperience: personalization?.tarotExperience || 'intermediate',
                displayName: personalization?.displayName || null
            }
        };
        // ...rest of function
    }
}
```

### 5.2 Update Journal Entry Schema
**File**: `functions/api/journal.js`

Accept and store `userPreferences` field:
```javascript
// In POST handler, extract from body:
const { userPreferences } = body;

// Store in D1 (add column or store as JSON in existing field)
// Option A: Add userPreferences TEXT column
// Option B: Include in existing JSON blob
```

### 5.3 Add Preference Drift Analysis to Journal Insights
**File**: `src/lib/journalInsights.js` or `shared/journal/stats.js`

Track how user's actual reading contexts compare to their stated focus areas:

```javascript
export function computePreferenceDrift(entries, currentFocusAreas = []) {
    if (!entries?.length || !currentFocusAreas?.length) return null;

    // Map focus areas to context categories
    const focusToContext = {
        love: 'love',
        career: 'career',
        self_worth: 'self',
        healing: 'wellbeing',
        creativity: 'career', // approximate mapping
        spirituality: 'spiritual'
    };

    const expectedContexts = new Set(
        currentFocusAreas.map(f => focusToContext[f]).filter(Boolean)
    );

    // Count actual contexts
    const actualContextCounts = {};
    entries.forEach(entry => {
        const ctx = entry.context;
        if (ctx) {
            actualContextCounts[ctx] = (actualContextCounts[ctx] || 0) + 1;
        }
    });

    // Find drift: contexts user reads about but didn't select as focus
    const driftContexts = Object.entries(actualContextCounts)
        .filter(([ctx]) => !expectedContexts.has(ctx))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    return {
        expectedContexts: Array.from(expectedContexts),
        actualTopContexts: Object.entries(actualContextCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([ctx, count]) => ({ context: ctx, count })),
        driftContexts: driftContexts.map(([ctx, count]) => ({ context: ctx, count })),
        hasDrift: driftContexts.length > 0
    };
}
```

### 5.4 Display Drift Insight in Journal
**File**: `src/components/JournalInsightsPanel.jsx`

Add optional insight card when drift is detected:

```javascript
const { personalization } = usePreferences();
const drift = useMemo(
    () => computePreferenceDrift(entries, personalization?.focusAreas),
    [entries, personalization?.focusAreas]
);

// In render:
{drift?.hasDrift && (
    <div className="insight-card">
        <h4>Emerging Interests</h4>
        <p>
            You selected {drift.expectedContexts.join(', ')} as focus areas,
            but you've been exploring {drift.driftContexts[0]?.context} themes too.
            Consider updating your focus areas in Settings.
        </p>
    </div>
)}
```

---

## Phase 6: Intention Coach Integration

### 6.1 Pre-select Topic from Focus Areas
**File**: `src/components/GuidedIntentionCoach.jsx`

Use onboarding focus areas to suggest a default topic:

```javascript
import { usePreferences } from '../contexts/PreferencesContext';
import { INTENTION_TOPIC_OPTIONS } from '../lib/intentionCoach';

// Map onboarding focus areas to coach topics
const FOCUS_TO_TOPIC = {
    love: 'relationships',
    career: 'career',
    self_worth: 'growth',
    healing: 'wellbeing',
    creativity: 'career',
    spirituality: 'growth'
};

export function GuidedIntentionCoach({ /* props */ }) {
    const { personalization } = usePreferences();

    // Derive suggested topic from first focus area
    const suggestedTopic = useMemo(() => {
        const firstFocus = personalization?.focusAreas?.[0];
        if (!firstFocus) return null;
        const mappedTopic = FOCUS_TO_TOPIC[firstFocus];
        return INTENTION_TOPIC_OPTIONS.find(opt => opt.value === mappedTopic) || null;
    }, [personalization?.focusAreas]);

    // Initialize topic state with suggestion
    const [selectedTopic, setSelectedTopic] = useState(
        suggestedTopic?.value || 'relationships'
    );

    // Show "suggested for you" indicator
    // ...
}
```

### 6.2 Show "Suggested for You" Badge
```javascript
// In topic selector render:
{INTENTION_TOPIC_OPTIONS.map(option => (
    <button
        key={option.value}
        onClick={() => setSelectedTopic(option.value)}
        className={selectedTopic === option.value ? 'selected' : ''}
    >
        {option.label}
        {option.value === suggestedTopic?.value && (
            <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                Based on your interests
            </span>
        )}
    </button>
))}
```

### 6.3 Include Focus Areas in Creative Question Generation
**File**: `src/lib/intentionCoach.js`

Pass focus areas to the API for more personalized question generation:

```javascript
export async function buildCreativeQuestion({ topic, timeframe, depth, customFocus, seed, focusAreas }, options = {}) {
    // ...existing code

    // Add focus areas to personalization fragments
    if (Array.isArray(focusAreas) && focusAreas.length > 0) {
        personalizationFragments.push(`User focus areas: ${focusAreas.join(', ')}`);
    }

    // ...rest of function
}
```

---

## Phase 7: Migration Strategy

### 7.1 Existing Users Without Onboarding
Users who have readings but never completed onboarding:

```javascript
// In PreferencesContext or App.jsx initialization
useEffect(() => {
    const hasReadings = localStorage.getItem('tarot_journal');
    const hasCompletedOnboarding = localStorage.getItem('tarot-onboarding-complete');

    if (hasReadings && !hasCompletedOnboarding) {
        // User has readings but no onboarding - offer "Personalize" prompt
        // Don't force onboarding, but show a subtle banner
        setShowPersonalizationBanner(true);
    }
}, []);
```

### 7.2 Personalization Banner Component
**File**: `src/components/PersonalizationBanner.jsx`

```javascript
export function PersonalizationBanner({ onDismiss, onPersonalize }) {
    return (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-main">
                <strong>New:</strong> Personalize your readings with tone, style, and focus preferences.
            </p>
            <div className="flex gap-2 mt-2">
                <button onClick={onPersonalize} className="btn-primary text-sm">
                    Set Preferences
                </button>
                <button onClick={onDismiss} className="btn-secondary text-sm">
                    Maybe Later
                </button>
            </div>
        </div>
    );
}
```

### 7.3 Old localStorage Format Migration
Handle legacy preference formats:

```javascript
// In PreferencesContext initialization
function migratePersonalization(stored) {
    if (!stored) return DEFAULT_PERSONALIZATION;

    // Handle v1 format (if any)
    if (stored.version === undefined) {
        return {
            ...DEFAULT_PERSONALIZATION,
            ...stored,
            // Map any old field names to new ones
            readingTone: stored.tone || stored.readingTone || 'balanced',
            version: 2
        };
    }

    return { ...DEFAULT_PERSONALIZATION, ...stored };
}
```

### 7.4 Cloud Sync Migration
For authenticated users, ensure personalization syncs:

```javascript
// In useJournal or dedicated usePersonalizationSync hook
async function syncPersonalizationToCloud(personalization) {
    if (!isAuthenticated) return;

    try {
        await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ personalization })
        });
    } catch (error) {
        console.warn('Failed to sync personalization to cloud:', error);
        // Non-blocking - local storage is primary
    }
}
```

---

## Critical Files to Modify

| Phase | File | Changes |
|-------|------|---------|
| 1.1 | `shared/contracts/readingSchema.js` | Add personalization schema |
| 1.2 | `src/contexts/ReadingContext.jsx` | Extract and pass personalization |
| 2.1 | `functions/api/tarot-reading.js` | Extract personalization in handler |
| 2.2-2.3 | `functions/lib/narrative/prompts.js` | Inject tone/frame/name into Claude prompts |
| 2.4 | `functions/api/tarot-reading.js` | Update local composer functions |
| 2.5 | `functions/lib/narrative/spreads/*.js` | Add personalization to all 6 spread builders |
| 3.1 | `src/hooks/useTarotState.js` | Add ritual skip with deterministic defaults |
| 3.1 | `src/TarotReading.jsx` | Use auto-complete ritual when skip enabled |
| 3.2 | `src/hooks/useTarotState.js` | Initialize spread from preferredSpreadDepth |
| 3.2 | `src/utils/personalization.js` | Shared mapping from preferred depth → spread key |
| 3.2 | `src/components/SpreadSelector.jsx` | Show recommended badge |
| 3.3 | Multiple components (see 3.3 table) | Experience-based helper visibility |
| 3.4 | `src/components/Header.jsx` | Display name greeting |
| 3.4 | `src/components/ReadingDisplay.jsx` | Display name in reading |
| 4.1 | `src/components/ExperienceSettings.jsx` | Add personalization controls |
| 5.1 | `src/hooks/useSaveReading.js` | Store preferences with journal entries |
| 5.2 | `functions/api/journal.js` | Accept userPreferences field |
| 5.3 | `src/lib/journalInsights.js` | Add preference drift analysis |
| 5.4 | `src/components/JournalInsightsPanel.jsx` | Display drift insights |
| 6.1-6.2 | `src/components/GuidedIntentionCoach.jsx` | Pre-select topic from focus areas |
| 6.3 | `src/lib/intentionCoach.js` | Pass focus areas to question generation |
| 7.1 | `src/contexts/PreferencesContext.jsx` | Detect existing users without onboarding |
| 7.2 | `src/components/PersonalizationBanner.jsx` | New component for migration prompt |
| 7.3 | `src/contexts/PreferencesContext.jsx` | Handle legacy localStorage format |
| 7.4 | `src/hooks/usePersonalizationSync.js` | New hook for cloud sync (optional) |

---

## Implementation Order

> **Note**: Spread defaults (3.2) is moved before Ritual Skip (3.1) because ritual skip occurs *after* spread confirmation. Setting the default spread first ensures the flow is coherent.

### Core Implementation (Required)
1. **Schema + Data Flow** (Phase 1) - Foundation for everything
2. **Spread Defaults** (Phase 3.2) - Set up preference-based defaults early
3. **Backend Prompts - Claude** (Phase 2.1-2.3) - Narrative personalization for API path
4. **Backend Prompts - Local** (Phase 2.4-2.5) - Narrative personalization for fallback path
5. **Ritual Skip** (Phase 3.1) - Skip ritual after spread is confirmed
6. **Display Name in UI** (Phase 3.4) - Quick frontend wins
7. **Helper Visibility** (Phase 3.3) - Experience-based polish
8. **Settings Page** (Phase 4) - Allow post-onboarding changes

### Extended Integration (Recommended)
9. **Journal Storage** (Phase 5.1-5.2) - Store preferences with entries
10. **Journal Insights** (Phase 5.3-5.4) - Preference drift analysis
11. **Intention Coach** (Phase 6) - Focus area integration
12. **Migration** (Phase 7) - Handle existing users

### Dependency Graph
```
Phase 1 (Schema)
    ├── Phase 3.2 (Spread Defaults) ─── no backend dependency
    │
    ├── Phase 2.1-2.3 (Claude Prompts)
    │       └── Phase 2.4-2.5 (Local Prompts) ─── can parallel with 3.x
    │
    └── Phase 3.1 (Ritual Skip) ─── depends on 3.2 flow
            └── Phase 3.3 (Helpers)
                    └── Phase 3.4 (Display Name)
                            └── Phase 4 (Settings)
                                    │
                                    ├── Phase 5 (Journal) ─── can start after Phase 1
                                    │       └── Phase 5.3-5.4 (Insights)
                                    │
                                    ├── Phase 6 (Intention Coach) ─── independent
                                    │
                                    └── Phase 7 (Migration) ─── after Phase 4
```

### Parallelization Opportunities
- **Phase 5** (Journal) can start immediately after Phase 1
- **Phase 6** (Intention Coach) is fully independent, can run in parallel with Phases 2-4
- **Phase 7** (Migration) should wait until Settings Page (Phase 4) is complete

---

## Testing Checklist

### Backward Compatibility (Critical)
- [ ] API works without personalization field (backward compatible)
- [ ] Local composer works without personalization (backward compatible)
- [ ] Existing readings without personalization still display correctly
- [ ] Schema validation accepts missing/partial personalization object
- [ ] Journal entries without userPreferences display correctly
- [ ] Users without onboarding data get sensible defaults

### Narrative Personalization
- [ ] New user with defaults gets balanced/mixed tone
- [ ] User with "blunt" tone gets direct language in Claude response
- [ ] User with "blunt" tone gets direct language in local fallback response
- [ ] User with "gentle" tone gets warm, supportive language
- [ ] displayName appears naturally in narrative (not forced)
- [ ] displayName appears in Claude-generated narrative
- [ ] displayName appears in locally-composed narrative
- [ ] Missing displayName produces no awkward empty text (null safety)
- [ ] All four spiritual frames produce distinct language styles

### Ritual Skip
- [ ] showRitualSteps=false skips ritual completely
- [ ] Skipped ritual uses deterministic defaults (not random)
- [ ] Same question with skipped ritual produces reproducible seed
- [ ] Ritual skip doesn't execute twice in React StrictMode
- [ ] New reading resets auto-complete state properly

### Spread Defaults
- [ ] preferredSpreadDepth highlights correct default spread
- [ ] Spread state initializes correctly from preference on mount
- [ ] Manual spread selection overrides preference
- [ ] "Recommended" badge appears on correct spread

### Experience-Based UI
- [ ] Experienced users see streamlined UI across all helper surfaces
- [ ] Newbie users see expanded helpers and learn-more links
- [ ] Intermediate users get balanced helper visibility
- [ ] Per-session "show tips" toggle works (if implemented)

### Settings Page
- [ ] Settings page allows changing all preferences
- [ ] Changes to preferences take effect immediately
- [ ] Preferences persist across page reloads (localStorage)
- [ ] localStorage failure doesn't crash the app

### Journal Integration (Phase 5)
- [ ] New journal entries include userPreferences snapshot
- [ ] Journal entries display correctly with and without userPreferences
- [ ] Preference drift calculation handles empty entries array
- [ ] Preference drift calculation handles empty focusAreas
- [ ] Drift insight card appears only when drift is detected
- [ ] "Emerging Interests" insight text is grammatically correct
- [ ] Journal API accepts and stores userPreferences field
- [ ] D1 migration adds userPreferences column (if using Option A)

### Intention Coach Integration (Phase 6)
- [ ] Topic pre-selects based on first focus area
- [ ] "Based on your interests" badge appears on suggested topic
- [ ] Manual topic selection overrides suggestion
- [ ] Focus areas with no mapping default gracefully
- [ ] Focus areas are included in creative question API call
- [ ] Generated questions reflect user's focus areas

### Migration (Phase 7)
- [ ] Existing users with readings but no onboarding see personalization banner
- [ ] Banner dismiss persists (doesn't re-appear)
- [ ] "Set Preferences" button opens settings or mini-onboarding
- [ ] Old localStorage format migrates correctly to new format
- [ ] Version field is added during migration
- [ ] Cloud sync doesn't block local operations
- [ ] Cloud sync failure is logged but doesn't crash
- [ ] SSR/hydration doesn't flash wrong defaults before preferences load

---

## Appendix: Code Reference Locations

> **⚠️ Note on Line Numbers**: Line numbers in this document may drift as the codebase evolves. When implementing, search for the **function names** listed below rather than relying on exact line numbers. Consider adding `// PERSONALIZATION_HOOK` comment markers at key integration points for future reference.

### useTarotState.js Key Functions
- `useTarotState()` - Main hook export
- Ritual flags: `hasKnocked`, `knockCount`, `hasCut`, `cutIndex`
- Seed computation: `computeSeed()` call
- `knockTimesRef` - Stores knock timing intervals

### tarot-reading.js Key Functions
- `onRequestPost()` - Main API handler
- `SPREAD_READING_BUILDERS` - Map of spread-specific builders
- `composeReadingEnhanced()` - Enhanced local composer
- `generateReadingFromAnalysis()` - Analysis-to-narrative converter
- `buildGenericReading()` - Fallback generic builder

### PreferencesContext.jsx Key Exports
- `DEFAULT_PERSONALIZATION` - Default preference values
- Individual setters: `setDisplayName`, `setReadingTone`, `setSpiritualFrame`, etc.
- `usePreferences()` - Context consumer hook

### New Files to Create
- `src/utils/personalization.js` - Shared helper functions
- `src/components/PersonalizationBanner.jsx` - Migration prompt component
- `src/hooks/usePersonalizationSync.js` - Cloud sync hook (optional)
- `functions/lib/narrative/styleHelpers.js` - Shared tone/frame/name utilities

---

## Targeted Validation Plan

> This section provides focused test scenarios to verify personalization works end-to-end.

### Backward Compatibility (Critical - Test First)

| Test | Expected Result |
|------|-----------------|
| API request **without** `personalization` field | Reading generated with defaults, no errors |
| Local composer path **without** personalization | Fallback to balanced/mixed tone, no name insertion |
| Journal entry **without** `userPreferences` | Entry loads and displays correctly |
| Old client (pre-personalization) → new API | Works identically to current behavior |

### Schema Threading Verification

```bash
# Test that personalization survives schema validation
curl -X POST /api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadInfo": {...},
    "cardsInfo": [...],
    "personalization": {
      "displayName": "TestUser",
      "readingTone": "blunt"
    }
  }'

# Verify in API handler logs that personalization was received
```

### Prompt Compliance Matrix

| Tone | Frame | Test Query | Verify |
|------|-------|------------|--------|
| gentle | psychological | "What blocks my growth?" | Warm language, archetype terms |
| gentle | spiritual | "What blocks my growth?" | Warm language, soul/divine terms |
| blunt | psychological | "What blocks my growth?" | Direct language, archetype terms |
| blunt | spiritual | "What blocks my growth?" | Direct language, soul/divine terms |
| balanced | mixed | "What blocks my growth?" | Measured language, mixed vocabulary |
| balanced | playful | "What blocks my growth?" | Light tone, adventure/wonder terms |

**displayName tests**:
- With name: Verify natural weaving (not forced insertion every sentence)
- Without name: Verify no "For you, , ..." artifacts
- With empty string `""`: Same as without name

### Determinism Verification

```javascript
// Test: Same question with skipped ritual yields stable seed
const seed1 = computeSeedWithSkippedRitual("What should I focus on?");
const seed2 = computeSeedWithSkippedRitual("What should I focus on?");
assert(seed1 === seed2, "Seeds must match for reproducibility");

// Test: StrictMode doesn't cause double auto-completion
// Run in React.StrictMode, verify shuffle() only applies defaults once
```

### UI Verification Checklist

- [ ] **Spread "Recommended" badge**: Matches `preferredSpreadDepth` setting
  - `short` → badge on Single Card
  - `standard` → badge on Three Card
  - `deep` → badge on Celtic Cross
- [ ] **Helper visibility**: Varies by `tarotExperience`
  - `newbie` → expanded helpers, "Learn more" links visible
  - `experienced` → streamlined UI, helpers collapsed by default
- [ ] **Display name greeting**: Shows in Header when `displayName` is set
- [ ] **Ritual skip**: When `showRitualSteps=false`, ritual panel hidden, shuffle works

### Journal Integration Verification

- [ ] New entry includes `userPreferences` snapshot
- [ ] Entry with preferences loads correctly in Journal view
- [ ] Entry without preferences (legacy) loads correctly
- [ ] Drift insight appears only when actual contexts differ from `focusAreas`

### Performance & Security

| Check | Pass Criteria |
|-------|---------------|
| Token budget | System prompt < 2500 tokens with full personalization |
| PII logging | `displayName` redacted in `shouldLogLLMPrompts` output |
| Payload size | Personalization adds < 500 bytes to request |
| SSR hydration | No flash of wrong defaults on page load |

---

## Revision History

### 2025-11-27 (v3) - Executive Review Corrections

**Critical Fixes Based on Technical Review:**

1. **Schema Threading Warning**: Added critical note that `safeParseReadingRequest` strips unknown keys—Phase 1.1 is a hard prerequisite for all other phases.

2. **Ritual Skip Race Condition**: Rewrote Phase 3.1 to move auto-completion **inside `shuffle()` before `computeSeed()`**. The TarotReading.jsx effect is now only a safety net, not the primary mechanism.

3. **PII Logging Redaction**: Added new section requiring `displayName` to be redacted from prompt logs when `shouldLogLLMPrompts` is enabled.

4. **Token Budget Safeguards**: Added new section with budget-aware insertion pattern for tone/frame blocks (~200-400 tokens). Include `maxTokenBudget` option and slimming fallback.

5. **Local Composer Plumbing**: Expanded Phase 2.4 with:
   - New `styleHelpers.js` file for shared tone/frame/name utilities
   - Concrete code examples for `composeReadingEnhanced`, `generateReadingFromAnalysis`, `buildGenericReading`
   - Principle: local composer must use same style primitives as Claude prompts

6. **Targeted Validation Plan**: Added new comprehensive section with:
   - Backward compatibility test matrix
   - Schema threading verification curl example
   - Prompt compliance matrix (tone × frame combinations)
   - Determinism verification tests
   - UI verification checklist
   - Performance & security checks

**New Files Added to Create List:**
- `functions/lib/narrative/styleHelpers.js` - Shared tone/frame/name utilities

**Status**: Plan approved with changes. Ready for implementation following phased approach.

---

### 2025-11-27 (v2) - Extended Integration & Migration

**New Phases Added:**

11. **Phase 5: Journal Personalization Storage** - Store preferences with journal entries for longitudinal analysis
    - 5.1: Store userPreferences snapshot with each saved reading
    - 5.2: Update journal API to accept preferences
    - 5.3: Add preference drift analysis to journal insights
    - 5.4: Display "Emerging Interests" insight when drift detected

12. **Phase 6: Intention Coach Integration** - Connect focus areas to question generation
    - 6.1: Pre-select topic from onboarding focus areas
    - 6.2: Show "Based on your interests" badge on suggested topics
    - 6.3: Include focus areas in creative question API calls

13. **Phase 7: Migration Strategy** - Handle existing users gracefully
    - 7.1: Detect users with readings but no onboarding
    - 7.2: Personalization banner component for migration prompt
    - 7.3: Legacy localStorage format migration
    - 7.4: Cloud sync for authenticated users

**Documentation Improvements:**

14. **Code Reference Updates**: Replaced line numbers with function names to prevent drift; added note about using `// PERSONALIZATION_HOOK` comment markers
15. **Expanded Testing Checklist**: Added 24 new test cases for Journal, Intention Coach, and Migration phases
16. **Updated Dependency Graph**: Added Phases 5-7 with parallelization opportunities
17. **New Files to Create**: Listed `personalization.js`, `PersonalizationBanner.jsx`, `usePersonalizationSync.js`

---

### 2025-11-27 (v1) - Plan Review & Updates

**Critical Issues Fixed:**
1. **Invalid Hook Usage (Phase 3.1 & 3.2)**: Fixed examples that called `usePreferences()` inside `useState` initializers, which violates React's Rules of Hooks. Now uses `useEffect` for preference-based initialization.
2. **displayName Null Safety**: Added explicit guidance and code patterns to prevent empty-name text like "For you, , this suggests..."

**Moderate Issues Addressed:**
3. **Dependency Array Stability**: Updated `autoCompleteRitual` to use stable dependencies and added `useRef` guard against double-execution in React StrictMode.
4. **Backward Compatibility Patterns**: Added new section with defensive coding patterns and default values.
5. **Error Handling**: Added guidance for schema validation failures, localStorage unavailability, and async preference loading.

**Enhancements:**
6. **Expanded Tone/Frame Guidance**: Detailed prompt text for each tone and spiritual frame option.
7. **Additional Components in 3.3**: Added `StreamingNarrative.jsx`, `MobileSettingsDrawer.jsx`, `StepProgress.jsx` to the helper visibility list.
8. **Implementation Order Adjusted**: Moved Spread Defaults (3.2) before Ritual Skip (3.1) for logical flow, added dependency graph.
9. **Testing Checklist Expanded**: Organized into categories with additional edge case tests.
10. **Experience Level Toggle**: Added design consideration for per-session "Show tips" option.
