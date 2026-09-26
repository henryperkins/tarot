# Cinematic Enhancements - Visual Examples

Type: reference
Status: active background document
Last reviewed: 2026-09-25

This document provides visual examples of the current reading flow, with prototype visuals and future concepts labeled explicitly.

## Scene Flow Diagram

```
┌─────────────┐
│    IDLE     │ ← Reading surface is ready
└──────┬──────┘
       │ user begins a reading
       ▼
┌─────────────┐
│   RITUAL    │ ← Shuffle, optional knock/cut, and card dealing
└──────┬──────┘
       │ cards are dealt
       ▼
┌─────────────┐
│   REVEAL    │ ← User reveals cards; CSS reveal bloom/burst can run
└──────┬──────┘
       │ all cards revealed and narrative requested
       ▼
┌─────────────┐
│  INTERLUDE  │ ← Live NarrativeSkeleton while generation is pending
└──────┬──────┘
       │ first narrative content arrives
       ▼
┌─────────────┐
│  NARRATIVE  │ ← Streaming narrative, color script, and scene particles
└──────┬──────┘
       │ narrative complete
       ▼
┌─────────────┐
│  COMPLETE   │ ← Follow-up, save, share, media, and new-reading actions
└─────────────┘
```

## Color Script Transitions

### Phase 1: The Struggle
```
When narrative contains: "conflict", "challenge", "shadow", "difficulty"

Visual Palette:
┌─────────────────────────────────────┐
│  CSS Variables Applied:             │
│  --phase-color: #4a6fa5 (cool blue) │
│  --phase-warmth: 0.3 (cool)         │
│  --phase-contrast: 1.2 (high)       │
│  --phase-saturation: 0.7 (muted)    │
└─────────────────────────────────────┘

Atmosphere: Isolation, depth, introspection
Visual Effect: Cool blues, steel greys, high contrast
Mood: Contemplative, challenging
```

### Phase 2: The Revelation
```
When narrative contains: "breakthrough", "clarity", "hope", "light"

Visual Palette:
┌─────────────────────────────────────┐
│  CSS Variables Applied:             │
│  --phase-color: #f6b756 (warm gold) │
│  --phase-warmth: 0.9 (very warm)    │
│  --phase-contrast: 0.9 (soft)       │
│  --phase-saturation: 1.1 (enhanced) │
└─────────────────────────────────────┘

Atmosphere: Golden hour, clarity, awakening
Visual Effect: Sunny yellows, warm ambers, enhanced saturation
Mood: Optimistic, illuminated
```

### Phase 3: The Resolution
```
When narrative contains: "balance", "integration", "peace", "grounded"

Visual Palette:
┌─────────────────────────────────────┐
│  CSS Variables Applied:             │
│  --phase-color: #7a9b76 (soft sage) │
│  --phase-warmth: 0.6 (balanced)     │
│  --phase-contrast: 1.0 (neutral)    │
│  --phase-saturation: 0.85 (natural) │
└─────────────────────────────────────┘

Atmosphere: Grounded, harmonious, stable
Visual Effect: Earthy browns, soft greens, balanced contrast
Mood: Peaceful, integrated
```

## Interlude Scene States

The live `interlude` scene uses `InterludeScene` and `NarrativeSkeleton`. The following orb/star treatments are visual references for the unused `AtmosphericInterlude` prototype, not the shipped loading surface.

### Prototype: Initial Phase (0-3 seconds)
```
┌───────────────────────────────────────────┐
│                                           │
│           ⊙ Breathing Orb                 │
│     (scale 1.0 → 1.15 → 1.0)             │
│                                           │
│   ✦  Channeling the cards...  ✦          │
│                                           │
│   Take a breath. The reading will         │
│   unfold in a moment.                     │
│                                           │
└───────────────────────────────────────────┘
```

### Prototype: Progression Phase (3-6 seconds)
```
┌───────────────────────────────────────────┐
│                                           │
│           ⊙ Breathing Orb                 │
│                                           │
│   ✦  Drawing connections...  ✦           │
│                                           │
│   ✧     Constellation      ✧             │
│  ✧  of 12 particle stars  ✧             │
│   ✧    orbiting slowly   ✧               │
│                                           │
└───────────────────────────────────────────┘
```

### Prototype: Extended Phase (6+ seconds)
```
┌───────────────────────────────────────────┐
│                                           │
│           ⊙ Breathing Orb                 │
│                                           │
│   ✦  Weaving the narrative...  ✦         │
│                                           │
│   Complex spreads take a moment           │
│   to interpret thoughtfully.              │
│                                           │
└───────────────────────────────────────────┘
```

## Prototype Element Detection Examples

`useEnhancedTextStreaming` is a prototype and is not used by the live `StreamingNarrative` path. The examples below illustrate its intended fire/water/air/earth mapping only.

### Fire Element Trigger
```
Streaming text: "Your passion burns bright as you take action..."
                     ^^^^^^^^ ^^^^^ trigger word detected

Response:
┌─────────────────────────────────────┐
│  Element: FIRE                      │
│  Palette: red-amber                 │
│  Warmth: high                       │
│  Intensity: bright                  │
│                                     │
│  Visual Response:                   │
│  - Warm red-orange glow             │
│  - Increased brightness             │
│  - Crackling particle effects       │
│                                     │
│  Audio Layer:                       │
│  - crackling-warmth.mp3 (subtle)    │
└─────────────────────────────────────┘
```

### Water Element Trigger
```
Streaming text: "Let your emotions flow like a gentle tide..."
                      ^^^^^^^^ ^^^^ trigger word detected

Response:
┌─────────────────────────────────────┐
│  Element: WATER                     │
│  Palette: blue                      │
│  Warmth: cool                       │
│  Intensity: soft                    │
│                                     │
│  Visual Response:                   │
│  - Cool blue undertones             │
│  - Flowing ripple effects           │
│  - Soft, diffused glow              │
│                                     │
│  Audio Layer:                       │
│  - gentle-waves.mp3 (subtle)        │
└─────────────────────────────────────┘
```

## Haptic Feedback Patterns

The pattern values below correspond to `HAPTIC_PATTERNS` in the centralized `useHaptic` hook and apply to callers that use that hook. The hook suppresses vibration when `prefers-reduced-motion` is active and on unsupported devices. These examples do not imply that every haptics call site in the repository is centralized.

### Minor Arcana Card Reveal
```
User taps card → Card flips → Landing complete

Haptic Pattern:
━━ (20ms single pulse)

Timeline:
0ms                    350ms
▼                      ▼
Card flip animation → ━━ (landing pulse)
```

### Major Arcana Card Reveal
```
User taps Death card → Card flips → Landing complete

Haptic Pattern:
━━━  ━━  ━━━
50ms 30ms 50ms

Timeline:
0ms                    350ms              430ms    510ms
▼                      ▼                  ▼        ▼
Card flip animation → ━━━ (emphasis) → ━━ → ━━━
```

### Reading Complete
```
Narrative finishes streaming → Completion pulse

Haptic Pattern:
━━━━━  ━━━  ━━━━━
100ms  50ms  100ms

Meaning: "Your reading is complete and ready"
```

## Prototype Text Segmentation Comparison

The shipped narrative renderer has its own progressive text path. The `Intl.Segmenter` comparison below documents the unused `useEnhancedTextStreaming` prototype.

### Without Intl.Segmenter (Prototype Fallback)
```
Input: "The Fool's journey begins. Will you take the leap?"

Segments: ['The', ' ', 'Fool's', ' ', 'journey', ' ', 'begins.', ' ', 'Will', ' ', 'you', ' ', 'take', ' ', 'the', ' ', 'leap?']

Issues:
- Punctuation attached to words
- Spaces as separate segments
- No sentence boundaries
```

### With Intl.Segmenter (Locale-Aware)
```
Input: "The Fool's journey begins. Will you take the leap?"

Word Granularity:
Segments: ['The', 'Fool's', 'journey', 'begins', '.', 'Will', 'you', 'take', 'the', 'leap', '?']

Sentence Granularity:
Segments: ["The Fool's journey begins.", "Will you take the leap?"]

Benefits:
- Proper word boundaries
- Punctuation handling
- Respects locale rules
- Cleaner visual reveal
```

## Practical Integration Example

### Current Reading Flow
```javascript
function CinematicReading({ sceneModels, colorScript }) {
  const orchestrator = useSceneOrchestrator({
    isShuffling,
    hasConfirmedSpread: Boolean(reading),
    revealedCards,
    totalCards: reading?.length || 0,
    isGenerating,
    isReadingStreamActive,
    personalReading,
    reading
  });

  const { activeScene, scenes } = orchestrator;
  const { vibrate } = useHaptic();

  useEffect(() => {
    if (activeScene === scenes.NARRATIVE) {
      setNarrativeFocus(true);
    }
  }, [activeScene, scenes.NARRATIVE]);

  useEffect(() => {
    if (personalReading && emotionalTone) {
      const script = determineColorScript(narrativePhase, emotionalTone, reasoning);
      applyColorScript(script);
    }
    return () => resetColorScript();
  }, [personalReading, emotionalTone, narrativePhase, reasoning]);

  const handleCardReveal = (card) => {
    const isMajor = card.arcana === 'major';
    vibrate(isMajor ? [50, 30, 50] : 20);
  };

  return (
    <ReadingSceneRouter
      orchestrator={orchestrator}
      sceneModels={sceneModels}
      colorScript={colorScript}
    />
  );
}
```

The live router selects `InterludeScene`, `NarrativeScene`, and `CompleteScene` by canonical scene key. `AtmosphericInterlude` and `useEnhancedTextStreaming` are not part of this integration.

## Performance and Status

```
Feature                         Status                         Notes
────────────────────────────────────────────────────────────────────────────
Scene Orchestrator              Implemented                    Canonical IDLE → COMPLETE states
Motion                          Implemented                    motion adapter plus CSS keyframes
Scene particles                 Implemented                    Shared @tsparticles layer; mobile stable mode gates some scenes
Slot reveal burst               Implemented                    CSS spark burst; no per-slot canvas
Sora card video                 Implemented, feature-gated     Plus/Pro media path with polling and cache
AtmosphericInterlude             Prototype, unused              Component exists but is not mounted by the live route
Enhanced text streaming          Prototype, unused              Hook exists but is not used by StreamingNarrative
```

## Accessibility Matrix

```
Feature                  Reduced Motion    Screen Reader    Keyboard Nav
────────────────────────────────────────────────────────────────────────────
Scene Orchestrator       ✓ Always works    ✓ State hints   ✓ Nav focus
Interlude Scene          ✓ Static skeleton ✓ Status       ✓ Focusable
Color Script             ✓ No motion       ✓ Transparent  ✓ No impact
Haptic Feedback          ✓ Disabled via useHaptic ✓ Independent  ✓ No impact
Element Detection        Prototype only    Prototype only ✓ No impact
Text Segmentation        Prototype only; live CSS path remains natural ✓ Seamless ✓ Natural
────────────────────────────────────────────────────────────────────────────
```
