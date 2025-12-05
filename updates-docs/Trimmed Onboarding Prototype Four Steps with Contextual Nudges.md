# Trimmed Onboarding Prototype: 4 Steps + Contextual Nudges

Based on analysis of the current 7-step onboarding flow [^1], I'm proposing a streamlined 4-step architecture that reduces friction while preserving personalization depth. The key insight: ritual and journal education can move to **contextual discovery** after the first reading, rather than blocking the path to that first reading.

---

## Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| WelcomeStep | ✅ Implemented | [`src/components/onboarding/trimmed/WelcomeStep.jsx`](../src/components/onboarding/trimmed/WelcomeStep.jsx) |
| SpreadStep | ✅ Implemented | [`src/components/onboarding/trimmed/SpreadStep.jsx`](../src/components/onboarding/trimmed/SpreadStep.jsx) |
| IntentionStep | ✅ Implemented | [`src/components/onboarding/trimmed/IntentionStep.jsx`](../src/components/onboarding/trimmed/IntentionStep.jsx) |
| BeginStep | ✅ Implemented | [`src/components/onboarding/trimmed/BeginStep.jsx`](../src/components/onboarding/trimmed/BeginStep.jsx) |
| onboardingMetrics.js | ✅ Implemented | [`src/lib/onboardingMetrics.js`](../src/lib/onboardingMetrics.js) - includes `getDeviceInfo()` |
| onboardingVariant.js | ✅ Implemented | [`src/lib/onboardingVariant.js`](../src/lib/onboardingVariant.js) - includes `?onboarding=trimmed` URL override |
| RitualNudge | ✅ Implemented | [`src/components/nudges/RitualNudge.jsx`](../src/components/nudges/RitualNudge.jsx) |
| JournalNudge | ✅ Implemented | [`src/components/nudges/JournalNudge.jsx`](../src/components/nudges/JournalNudge.jsx) |
| AccountNudge | ✅ Implemented | [`src/components/nudges/AccountNudge.jsx`](../src/components/nudges/AccountNudge.jsx) |
| OnboardingProgress 4-step support | ✅ Implemented | [`src/components/onboarding/OnboardingProgress.jsx`](../src/components/onboarding/OnboardingProgress.jsx) |
| OnboardingWizard A/B variants | ✅ Implemented | [`src/components/onboarding/OnboardingWizard.jsx`](../src/components/onboarding/OnboardingWizard.jsx) |
| Nudge State System | ✅ Implemented | [`src/contexts/PreferencesContext.jsx:324-377`](../src/contexts/PreferencesContext.jsx:324-377) |

---

## Current vs. Proposed Flow Comparison

| Current (7 steps) | Proposed (4 steps) | Change |
|---|---|---|
| 1. WelcomeHero (name + experience) | 1. **Welcome** (name + experience + tone) | Merged tone selection |
| 2. AccountSetup (registration) | *Moved to post-reading* | Deferred |
| 3. SpreadEducation (spread + depth + focus) | 2. **Choose Your Spread** (spread + focus) | Simplified |
| 4. QuestionCrafting (question + tone + frame) | 3. **Set Your Intention** (question only) | Moved preferences up |
| 5. RitualIntro (ritual explanation) | *Contextual nudge* | Deferred |
| 6. JournalIntro (journal benefits) | *Contextual nudge* | Deferred |
| 7. JourneyBegin (summary + launch) | 4. **Begin** (confirmation + launch) | Streamlined |

---

## Proposed 4-Step Script

### Step 1: Welcome (Target: 20-30 seconds)

```jsx
// WelcomeStep.jsx - Consolidated welcome with essential personalization
export function WelcomeStep({ onNext }) {
  const { setDisplayName, setTarotExperience, setReadingTone } = usePreferences();
  const [name, setName] = useState('');
  const [experience, setExperience] = useState('intermediate');
  const [tone, setTone] = useState('balanced');
  
  const handleContinue = () => {
    setDisplayName(name || null);
    setTarotExperience(experience);
    setReadingTone(tone);
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Hero - simplified */}
      <div className="text-center mb-6">
        <Moon className="w-16 h-16 mx-auto text-accent mb-4" weight="duotone" />
        <h2 className="font-serif text-3xl text-main mb-2">Welcome to Tableau</h2>
        <p className="text-muted">A space for reflection, clarity, and insight</p>
      </div>

      {/* Consolidated inputs - all visible, no accordions */}
      <div className="flex-1 space-y-5 overflow-y-auto">
        {/* Name (optional) */}
        <div>
          <label className="block text-sm text-accent mb-2">
            What should we call you? <span className="text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name or nickname"
            className="w-full rounded-xl border border-secondary/30 bg-surface px-4 py-3 text-base"
            autoComplete="given-name"
          />
        </div>

        {/* Experience - horizontal pills instead of vertical list */}
        <div>
          <label className="block text-sm text-accent mb-2">Tarot experience</label>
          <div className="flex gap-2">
            {[
              { value: 'newbie', label: 'New to tarot' },
              { value: 'intermediate', label: 'Know basics' },
              { value: 'experienced', label: 'Experienced' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExperience(opt.value)}
                className={`flex-1 py-3 px-2 rounded-xl text-sm font-medium transition ${
                  experience === opt.value
                    ? 'bg-accent text-surface'
                    : 'bg-surface border border-secondary/30 text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tone - horizontal pills */}
        <div>
          <label className="block text-sm text-accent mb-2">Reading tone preference</label>
          <div className="flex gap-2">
            {[
              { value: 'gentle', label: 'Gentle' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'blunt', label: 'Direct' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                className={`flex-1 py-3 px-2 rounded-xl text-sm font-medium transition ${
                  tone === opt.value
                    ? 'bg-accent text-surface'
                    : 'bg-surface border border-secondary/30 text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Single CTA - full width, prominent */}
      <div className="pt-4 pb-safe-bottom">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full min-h-[52px] rounded-xl bg-accent text-surface font-semibold text-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

**Rationale:** The current WelcomeHero already collects name and experience [^2]. Adding tone here (from QuestionCrafting [^3]) eliminates one entire step while keeping the most impactful personalization.

---

### Step 2: Choose Your Spread (Target: 15-25 seconds)

```jsx
// SpreadStep.jsx - Streamlined spread selection with inline education
export function SpreadStep({ selectedSpread, onSelectSpread, onNext, onBack }) {
  const [focusArea, setFocusArea] = useState(null);
  const { setFocusAreas } = usePreferences();

  const BEGINNER_SPREADS = [
    {
      key: 'single',
      name: 'One Card',
      tagline: 'Quick clarity',
      time: '2 min',
      cardCount: 1
    },
    {
      key: 'threeCard',
      name: 'Three Cards',
      tagline: 'Past · Present · Future',
      time: '5 min',
      cardCount: 3
    },
    {
      key: 'decision',
      name: 'Decision',
      tagline: 'Compare two paths',
      time: '8 min',
      cardCount: 5
    }
  ];

  const handleContinue = () => {
    if (focusArea) {
      setFocusAreas([focusArea]);
    } else {
      setFocusAreas([]);
    }
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <h2 className="font-serif text-2xl text-main">Choose Your Spread</h2>
        <p className="text-muted mt-1 text-sm">How deep do you want to go?</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Spread cards - horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {BEGINNER_SPREADS.map(spread => (
            <button
              key={spread.key}
              type="button"
              onClick={() => onSelectSpread(spread.key)}
              className={`flex-shrink-0 w-[140px] snap-center rounded-2xl border p-4 text-left transition ${
                selectedSpread === spread.key
                  ? 'border-accent bg-accent/10 ring-1 ring-accent'
                  : 'border-secondary/30 bg-surface/50'
              }`}
            >
              {/* Card count visualization */}
              <div className="flex gap-1 mb-3">
                {Array.from({ length: spread.cardCount }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-6 rounded-sm ${
                      selectedSpread === spread.key ? 'bg-accent' : 'bg-secondary/40'
                    }`}
                  />
                ))}
              </div>
              <h3 className="font-medium text-main text-sm">{spread.name}</h3>
              <p className="text-xs text-muted mt-0.5">{spread.tagline}</p>
              <p className="text-xs text-accent mt-2">~{spread.time}</p>
            </button>
          ))}
        </div>

        {/* Optional focus area - single select for simplicity */}
        <div className="rounded-xl border border-secondary/20 bg-surface/50 p-4">
          <p className="text-sm text-accent mb-3">What's on your mind? (optional)</p>
          <div className="flex flex-wrap gap-2">
            {['Love', 'Career', 'Growth', 'Decisions'].map(area => (
              <button
                key={area}
                type="button"
                onClick={() => setFocusArea(focusArea === area.toLowerCase() ? null : area.toLowerCase())}
                className={`px-3 py-1.5 rounded-full text-sm transition ${
                  focusArea === area.toLowerCase()
                    ? 'bg-accent text-surface'
                    : 'bg-surface border border-secondary/30 text-muted'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4 pb-safe-bottom">
        <button type="button" onClick={onBack} className="px-4 py-3 text-muted">
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedSpread}
          className="flex-1 min-h-[52px] rounded-xl bg-accent text-surface font-semibold disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

**Rationale:** The current SpreadEducation step has extensive position explanations [^4] that overwhelm new users. This version shows spread options as scannable cards with time estimates, letting users learn positions during the actual reading.

---

### Step 3: Set Your Intention (Target: 10-20 seconds)

```jsx
// IntentionStep.jsx - Focused question entry with quality feedback
export function IntentionStep({ question, onQuestionChange, onNext, onBack }) {
  const quality = useMemo(() => scoreQuestion(question), [question]);
  const qualityLevel = getQualityLevel(quality.score);

  const QUICK_STARTERS = [
    "What should I focus on this week?",
    "What energy do I need right now?",
    "What's blocking my progress?"
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <h2 className="font-serif text-2xl text-main">Set Your Intention</h2>
        <p className="text-muted mt-1 text-sm">What would you like guidance on?</p>
      </div>

      <div className="flex-1 space-y-4">
        {/* Question textarea */}
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="e.g., What should I focus on this week?"
          rows={3}
          className="w-full rounded-xl border border-secondary/30 bg-surface px-4 py-3 text-base resize-none focus:border-accent focus:ring-1 focus:ring-accent/50"
          autoFocus
        />

        {/* Quality indicator - only show when typing */}
        {question.trim().length > 5 && (
          <div className="flex items-center gap-2 text-sm">
            <span>{qualityLevel.emoji}</span>
            <span className="text-muted">{qualityLevel.label}</span>
          </div>
        )}

        {/* Quick starters - only show when empty */}
        {!question.trim() && (
          <div>
            <p className="text-xs text-muted mb-2">Try one of these:</p>
            <div className="space-y-2">
              {QUICK_STARTERS.map(starter => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => onQuestionChange(starter)}
                  className="block w-full text-left px-3 py-2 rounded-lg border border-secondary/20 text-sm text-muted hover:border-accent/50 hover:text-main transition"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 pb-safe-bottom">
        <button type="button" onClick={onBack} className="px-4 py-3 text-muted">
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 min-h-[52px] rounded-xl bg-accent text-surface font-semibold"
        >
          {question.trim() ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}
```

**Rationale:** The current QuestionCrafting includes tone and spiritual frame selectors [^3]. By moving tone to Step 1 and making spiritual frame a post-reading setting, this step becomes laser-focused on the question itself.

---

### Step 4: Begin (Target: 5-10 seconds)

```jsx
// BeginStep.jsx - Quick confirmation and launch
export function BeginStep({ selectedSpread, question, onBegin, onBack }) {
  const { personalization } = usePreferences();
  const spread = SPREADS[selectedSpread];

  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      {/* Celebration icon */}
      <div className="mb-6">
        <Star className="w-20 h-20 text-gold" weight="duotone" />
      </div>

      <h2 className="font-serif text-2xl text-main mb-2">You're Ready</h2>
      <p className="text-muted max-w-xs">
        Stay open to what feels true. The cards will meet you where you are.
      </p>

      {/* Quick summary - minimal */}
      <div className="mt-6 rounded-xl border border-accent/20 bg-surface/50 p-4 w-full max-w-sm text-left">
        <div className="flex items-center gap-2 text-sm mb-2">
          <Check className="w-4 h-4 text-accent" weight="bold" />
          <span className="text-muted">
            {spread?.name || 'Your spread'} • {personalization.readingTone || 'balanced'} tone
          </span>
        </div>
        {question.trim() && (
          <p className="text-xs text-muted italic line-clamp-2">"{question}"</p>
        )}
      </div>

      <div className="w-full max-w-sm mt-8 space-y-3">
        <button
          type="button"
          onClick={onBegin}
          className="w-full min-h-[56px] rounded-xl bg-accent text-surface font-bold text-lg"
        >
          Begin Reading
        </button>
        <button type="button" onClick={onBack} className="w-full py-3 text-muted text-sm">
          Go back
        </button>
      </div>
    </div>
  );
}
```

**Rationale:** The current JourneyBegin shows extensive personalization recap [^5]. Most users don't read it—they want to start. This version confirms selections in one glance.

---

## Contextual Nudges (Post-First-Reading)

### Ritual Nudge

Display after spread selection is confirmed, before first shuffle:

```jsx
// RitualNudge.jsx - Inline education during first reading
export function RitualNudge({ onEnableRitual, onSkip }) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Hand className="w-8 h-8 text-accent shrink-0" weight="duotone" />
        <div>
          <h4 className="font-medium text-main text-sm">Optional: Add a ritual</h4>
          <p className="text-xs text-muted mt-1">
            Knock and cut the deck to add your personal touch to the shuffle.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onEnableRitual}
              className="px-3 py-1.5 rounded-full bg-accent text-surface text-xs font-medium"
            >
              Try it
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-3 py-1.5 rounded-full border border-secondary/30 text-muted text-xs"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Trigger:** First reading only, after spread confirmed but before shuffle.

### Journal Nudge

Display after first reading is complete:

```jsx
// JournalNudge.jsx - Post-reading journal prompt
export function JournalNudge({ onSave, onDismiss }) {
  return (
    <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
      <div className="flex items-start gap-3">
        <Notebook className="w-8 h-8 text-success shrink-0" weight="duotone" />
        <div>
          <h4 className="font-medium text-main text-sm">Save to your journal?</h4>
          <p className="text-xs text-muted mt-1">
            Track patterns and revisit insights over time.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onSave}
              className="px-3 py-1.5 rounded-full bg-success text-surface text-xs font-medium"
            >
              Save reading
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-full border border-secondary/30 text-muted text-xs"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Trigger:** After first narrative generation completes.

### Account Nudge

Display after third saved reading:

```jsx
// AccountNudge.jsx - Deferred registration prompt
export function AccountNudge({ onCreateAccount, onDismiss }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <h4 className="font-medium text-main text-sm">Protect your readings</h4>
      <p className="text-xs text-muted mt-1">
        Create a free account to sync across devices and never lose your journal.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onCreateAccount}
          className="px-3 py-1.5 rounded-full bg-primary text-surface text-xs font-medium"
        >
          Create account
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-full border border-secondary/30 text-muted text-xs"
        >
          Later
        </button>
      </div>
    </div>
  );
}
```

**Trigger:** After 3rd journal save, if not authenticated.

---

## Nudge State System (Undocumented Implementation)

The nudge visibility is controlled by a state management system in [`PreferencesContext.jsx`](../src/contexts/PreferencesContext.jsx). This was implemented but not originally documented:

### State Structure

```javascript
// PreferencesContext.jsx:31-37
const DEFAULT_NUDGE_STATE = {
  hasSeenRitualNudge: false,
  hasSeenJournalNudge: false,
  hasDismissedAccountNudge: false,
  readingCount: 0,
  journalSaveCount: 0
};
```

### Exported Helpers (PreferencesContext.jsx:372-375)

| Helper | Condition | Usage |
|--------|-----------|-------|
| `shouldShowRitualNudge` | `readingCount === 0 && !hasSeenRitualNudge` | Show ritual education on first reading |
| `shouldShowJournalNudge` | `readingCount === 0 && !hasSeenJournalNudge` | Show journal prompt after first reading |
| `shouldShowAccountNudge` | `journalSaveCount >= 3 && !hasDismissedAccountNudge` | Prompt registration after 3+ saves |

### State Mutation Functions

- `markRitualNudgeSeen()` — Called when user interacts with RitualNudge
- `markJournalNudgeSeen()` — Called when user interacts with JournalNudge
- `dismissAccountNudge()` — Called when user dismisses AccountNudge
- `incrementReadingCount()` — Called after each completed reading
- `incrementJournalSaveCount()` — Called via [`useSaveReading.js:89-92`](../src/hooks/useSaveReading.js:89-92) on non-deduplicated saves

### Integration Points

1. **RitualNudge** — Shown in [`ReadingDisplay.jsx:264-276`](../src/components/ReadingDisplay.jsx:264-276) before shuffle
2. **JournalNudge** — Shown in [`ReadingDisplay.jsx`](../src/components/ReadingDisplay.jsx) after narrative generation
3. **AccountNudge** — Shown in [`Journal.jsx:600-608`](../src/components/Journal.jsx:600-608) when threshold met

---

## Validation Protocol: Completion Time Testing

### Test Matrix

| Device | OS | Screen Size | Target Time | Pass Criteria |
|--------|-----|-------------|-------------|---------------|
| iPhone SE | iOS 17 | 375×667 | < 75s | Complete all 4 steps |
| iPhone 14 Pro | iOS 17 | 393×852 | < 60s | Complete all 4 steps |
| Pixel 7 | Android 14 | 412×915 | < 60s | Complete all 4 steps |
| Samsung A53 | Android 13 | 360×800 | < 75s | Complete all 4 steps |
| iPad Mini | iPadOS 17 | 744×1133 | < 50s | Complete all 4 steps |

### Testing Script

```javascript
// onboardingMetrics.js - Instrumentation for validation
const ONBOARDING_METRICS_KEY = 'tarot-onboarding-metrics';

export function startOnboardingTimer() {
  const startTime = Date.now();
  const stepTimes = [];
  
  return {
    recordStep(stepNumber) {
      const elapsed = Date.now() - startTime;
      stepTimes.push({
        step: stepNumber,
        elapsed,
        delta: stepTimes.length > 0 
          ? elapsed - stepTimes[stepTimes.length - 1].elapsed 
          : elapsed
      });
    },
    
    complete() {
      const totalTime = Date.now() - startTime;
      const metrics = {
        totalTime,
        stepTimes,
        averageStepTime: totalTime / stepTimes.length,
        timestamp: new Date().toISOString(),
        device: {
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio,
          userAgent: navigator.userAgent
        }
      };
      
      // Store for analysis
      try {
        const existing = JSON.parse(localStorage.getItem(ONBOARDING_METRICS_KEY) || '[]');
        existing.push(metrics);
        localStorage.setItem(ONBOARDING_METRICS_KEY, JSON.stringify(existing.slice(-50)));
      } catch (e) {
        console.debug('Failed to store onboarding metrics', e);
      }
      
      return metrics;
    }
  };
}

// Usage in OnboardingWizard:
const timerRef = useRef(null);

useEffect(() => {
  if (isOpen && !timerRef.current) {
    timerRef.current = startOnboardingTimer();
  }
}, [isOpen]);

const handleNext = () => {
  timerRef.current?.recordStep(currentStep);
  if (currentStep < totalSteps) {
    setCurrentStep(currentStep + 1);
  }
};

const handleComplete = () => {
  timerRef.current?.recordStep(currentStep);
  const metrics = timerRef.current?.complete();
  console.log('Onboarding completed:', metrics);
  // ... rest of completion logic
};
```

### Expected Results

| Metric | Current (7 steps) | Target (4 steps) | Improvement |
|--------|-------------------|------------------|-------------|
| Total time | ~120-180s | ~50-75s | 50-60% faster |
| Drop-off rate | ~40% (estimated) | <15% (target) | 60%+ reduction |
| Steps to first reading | 7 | 4 | 43% fewer |
| User satisfaction | Baseline | +20% (target) | Measured via post-reading survey |

### A/B Test Configuration

```javascript
// onboardingVariant.js
export function getOnboardingVariant(userId) {
  // Simple hash-based assignment for consistent experience
  const hash = hashString(userId || 'anonymous');
  return hash % 100 < 50 ? 'control' : 'trimmed';
}

// In OnboardingWizard:
const variant = useMemo(() => getOnboardingVariant(userId), [userId]);
const totalSteps = variant === 'trimmed' ? 4 : 7;

// Pass totalSteps to OnboardingProgress and any helpers instead of relying on the previous module-level constant.
```

---

## Implementation Checklist

- [x] Create new step components (WelcomeStep, SpreadStep, IntentionStep, BeginStep)
- [x] Add metrics instrumentation to OnboardingWizard
- [x] Implement contextual nudge components (RitualNudge, JournalNudge, AccountNudge)
- [x] Add nudge trigger logic to ReadingDisplay and Journal
- [x] Update OnboardingProgress to support 4-step variant
- [x] Configure A/B test split (`onboardingVariant.js`)
- [x] Add nudge state management to PreferencesContext
- [ ] Deploy to staging for device testing
- [ ] Run validation tests on target device matrix
- [ ] Analyze metrics and adjust if needed
- [ ] Full rollout based on results

---

#### Sources

[^1]: [`OnboardingWizard.jsx`](../src/components/onboarding/OnboardingWizard.jsx) - Multi-step wizard with A/B variant support
[^2]: [`WelcomeHero.jsx`](../src/components/onboarding/WelcomeHero.jsx) - Original welcome step collecting name and experience
[^3]: [`QuestionCrafting.jsx`](../src/components/onboarding/QuestionCrafting.jsx) - Question composition with tone and frame selection
[^4]: [`SpreadEducation.jsx`](../src/components/onboarding/SpreadEducation.jsx) - Original spread education with position explanations
[^5]: [`JourneyBegin.jsx`](../src/components/onboarding/JourneyBegin.jsx) - Final step with personalization recap
