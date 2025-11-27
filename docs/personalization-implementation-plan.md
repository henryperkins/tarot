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

Modify these functions to accept and use personalization:

1. **`composeReadingEnhanced()`** (line 1204)
   - Extract personalization from payload
   - Pass to `generateReadingFromAnalysis()`

2. **`generateReadingFromAnalysis()`** (line 1264)
   - Add `personalization` to the options object
   - Pass through to spread builders and `buildGenericReading()`

3. **`buildGenericReading()`** (line 1302)
   - Inject displayName into opening/closing text
   - Adjust language style based on `readingTone`
   - Frame interpretations based on `spiritualFrame`

4. **Spread-specific builders** (`SPREAD_READING_BUILDERS`, line 1159)
   - Update each builder call signature to include personalization

### 2.5 Update Individual Spread Builders
**Files**: `functions/lib/narrative/spreads/*.js`

Each spread builder needs personalization support:
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

Add ritual skip capability that respects seed determinism:

```javascript
export function useTarotState(speak) {
  // Extract personalization at top level (required by Rules of Hooks)
  const { personalization } = usePreferences();

  // Derive skip flag from preferences
  const shouldSkipRitual = personalization?.showRitualSteps === false;

  // Auto-complete ritual with DETERMINISTIC defaults (not random!)
  // Using useCallback with stable dependencies to avoid re-render loops
  const autoCompleteRitual = useCallback(() => {
    // Fixed defaults preserve seed determinism for reproducible readings
    knockTimesRef.current = [100, 200, 300]; // Fixed intervals
    setKnockCount(3);
    setHasKnocked(true);
    setCutIndex(Math.floor(deckSize / 2)); // Center cut
    setHasCut(true);
  }, [deckSize]); // Only depends on deckSize, not shouldSkipRitual

  return {
    // ...existing returns
    shouldSkipRitual,
    autoCompleteRitual
  };
}
```

**File**: `src/TarotReading.jsx`

Use the skip capability in the flow:
```javascript
const { shouldSkipRitual, autoCompleteRitual } = useTarotState(speak);

// Track if we've already auto-completed to prevent re-runs
const hasAutoCompletedRef = useRef(false);

// After spread confirmation, auto-complete ritual if skipped
useEffect(() => {
  if (
    hasConfirmedSpread &&
    shouldSkipRitual &&
    !hasKnocked &&
    !hasAutoCompletedRef.current
  ) {
    hasAutoCompletedRef.current = true;
    autoCompleteRitual();
  }
}, [hasConfirmedSpread, shouldSkipRitual, hasKnocked, autoCompleteRitual]);

// Reset ref when starting a new reading
useEffect(() => {
  if (!hasConfirmedSpread) {
    hasAutoCompletedRef.current = false;
  }
}, [hasConfirmedSpread]);
```

**Important**:
- Do NOT use random values for auto-completed rituals. Fixed defaults preserve seed determinism.
- The `useRef` prevents double-execution from React StrictMode or dependency changes.
- `autoCompleteRitual` deliberately excludes `shouldSkipRitual` from its dependency array to maintain a stable reference.

### 3.2 Spread Selector Default Selection
**File**: `src/hooks/useTarotState.js`

> **⚠️ Important**: React hooks cannot be called inside `useState` initializers. Use `useEffect` for preference-based initialization instead.

```javascript
// Helper function (pure, no hooks)
function getSpreadFromDepth(depth) {
  switch (depth) {
    case 'short': return 'single';
    case 'standard': return 'threeCard';
    case 'deep': return 'celtic';
    default: return DEFAULT_SPREAD_KEY;
  }
}

export function useTarotState(speak) {
  const { personalization } = usePreferences();

  // Initialize with default, then update from preferences
  const [selectedSpreadState, setSelectedSpreadState] = useState(DEFAULT_SPREAD_KEY);

  // Track whether user has manually selected a spread
  const [hasUserSelectedSpread, setHasUserSelectedSpread] = useState(false);

  // Apply preference-based default ONCE on mount (if user hasn't chosen)
  useEffect(() => {
    if (!hasUserSelectedSpread && personalization?.preferredSpreadDepth) {
      const preferredSpread = getSpreadFromDepth(personalization.preferredSpreadDepth);
      setSelectedSpreadState(preferredSpread);
    }
  }, []); // Empty deps = run once on mount only

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

**File**: `src/components/SpreadSelector.jsx`

Add visual indicator for "recommended" spread:
```javascript
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

## Critical Files to Modify

| Phase | File | Changes |
|-------|------|---------|
| 1.1 | `shared/contracts/readingSchema.js` | Add personalization schema |
| 1.2 | `src/contexts/ReadingContext.jsx` | Extract and pass personalization |
| 2.1 | `functions/api/tarot-reading.js` | Extract personalization in handler |
| 2.2-2.3 | `functions/lib/narrative/prompts.js` | Inject tone/frame/name into Claude prompts |
| 2.4 | `functions/api/tarot-reading.js` | Update local composer functions (lines 1204-1350) |
| 2.5 | `functions/lib/narrative/spreads/*.js` | Add personalization to all 6 spread builders |
| 3.1 | `src/hooks/useTarotState.js` | Add ritual skip with deterministic defaults |
| 3.1 | `src/TarotReading.jsx` | Use auto-complete ritual when skip enabled |
| 3.2 | `src/hooks/useTarotState.js` | Initialize spread from preferredSpreadDepth |
| 3.2 | `src/components/SpreadSelector.jsx` | Show recommended badge |
| 3.3 | Multiple components (see 3.3 table) | Experience-based helper visibility |
| 3.4 | `src/components/Header.jsx` | Display name greeting |
| 3.4 | `src/components/ReadingDisplay.jsx` | Display name in reading |
| 4.1 | `src/components/ExperienceSettings.jsx` | Add personalization controls |

---

## Implementation Order

> **Note**: Spread defaults (3.2) is moved before Ritual Skip (3.1) because ritual skip occurs *after* spread confirmation. Setting the default spread first ensures the flow is coherent.

1. **Schema + Data Flow** (Phase 1) - Foundation for everything
2. **Spread Defaults** (Phase 3.2) - Set up preference-based defaults early
3. **Backend Prompts - Claude** (Phase 2.1-2.3) - Narrative personalization for API path
4. **Backend Prompts - Local** (Phase 2.4-2.5) - Narrative personalization for fallback path
5. **Ritual Skip** (Phase 3.1) - Skip ritual after spread is confirmed
6. **Display Name in UI** (Phase 3.4) - Quick frontend wins
7. **Helper Visibility** (Phase 3.3) - Experience-based polish
8. **Settings Page** (Phase 4) - Allow post-onboarding changes

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
```

---

## Testing Checklist

### Backward Compatibility (Critical)
- [ ] API works without personalization field (backward compatible)
- [ ] Local composer works without personalization (backward compatible)
- [ ] Existing readings without personalization still display correctly
- [ ] Schema validation accepts missing/partial personalization object

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

---

## Appendix: Code Reference Locations

### useTarotState.js Key Lines
- Ritual flags: lines 20-27
- Seed computation: lines 152-156
- knockTimesRef usage: lines 29, 83-92, 149-150

### tarot-reading.js Key Lines
- onRequestPost: ~line 360
- SPREAD_READING_BUILDERS: line 1159
- composeReadingEnhanced: line 1204
- generateReadingFromAnalysis: line 1264
- buildGenericReading: line 1302

### PreferencesContext.jsx Key Lines
- DEFAULT_PERSONALIZATION: lines 18-26
- Individual setters: lines 194-232
- Context value export: lines 314-328
