# Cinematic Enhancements Documentation

Type: reference
Status: active reference
Last reviewed: 2026-09-25

## Overview

This document records the cinematic surfaces that are live in the reading flow and separates them from prototype components and future proposals.

## Core Features

### 1. Scene Orchestration (`useSceneOrchestrator`)

A unified state machine that exposes explicit scene states. The current canonical flow is:

```
IDLE → RITUAL → REVEAL → INTERLUDE → NARRATIVE → COMPLETE
```

`currentScene` retains legacy values for compatibility; new scene-shell consumers should use `activeScene` and the canonical names above. The old `shuffling`, `drawing`, `revealing`, and `delivery` names are aliases, not the current scene-shell states.

**Usage:**
```javascript
import { useSceneOrchestrator } from '../hooks/useSceneOrchestrator';

const {
  activeScene,
  scenes,
  transitionMeta,
  shouldPrefetchAssets,
  shouldShowInterlude
} = useSceneOrchestrator({
  isShuffling,
  hasConfirmedSpread,
  revealedCards,
  totalCards,
  isGenerating,
  isReadingStreamActive,
  personalReading,
  reading
});
```

`shouldPrefetchAssets` is true for `REVEAL` and `NARRATIVE`; `transitionMeta.to` uses the canonical scene names.

### 2. Interlude Scene and `AtmosphericInterlude` (prototype; unused in the live flow)

The live `interlude` state renders `InterludeScene` with `NarrativeSkeleton`. The separate `AtmosphericInterlude` component exists as a prototype, but no live reading route imports it; its breathing orb, shimmer, and constellation effects should not be described as shipped behavior.

The shipped interlude surface:
- Shows a narrative-generation status and skeleton
- Reports progress through the live scene state
- Uses the scene shell's reduced-motion and particle behavior
- Preserves an accessible status announcement

The prototype component includes:
- A 4-second breathing-orb cycle
- Shimmer symbols and a 12-symbol constellation
- Progressive status messages
- Reduced-motion branches

### 3. Hero's Journey Color Script (`colorScript`)

Dynamic visual palette system that shifts based on narrative arc and emotional tone.

**Color Phases:**
- **Struggle**: Cool blues, high contrast (challenge/turmoil)
- **Revelation**: Warm golds, enhanced saturation (breakthrough/hope)
- **Resolution**: Earthy greens, balanced (stability/integration)

**Usage:**
```javascript
import { applyColorScript, determineColorScript, resetColorScript } from '../lib/colorScript';

useEffect(() => {
  if (personalReading && emotionalTone) {
    const colorScript = determineColorScript(narrativePhase, emotionalTone, reasoning);
    applyColorScript(colorScript);
  }
  
  return () => resetColorScript();
}, [narrativePhase, emotionalTone, reasoning, personalReading]);
```

**CSS Integration:**
The color script system works through CSS custom properties:
```css
:root {
  --phase-color: var(--brand-primary);
  --phase-warmth: 0.7;
  --phase-contrast: 1.0;
  --phase-saturation: 1.0;
}

/* Apply phase colors to elements */
.narrative-phase-glow {
  box-shadow: 0 0 20px color-mix(in srgb, var(--phase-color) 30%, transparent);
}
```

### 4. Enhanced Text Streaming (`useEnhancedTextStreaming`; prototype; unused)

The live narrative path uses `StreamingNarrative`, which handles progressive rendering, TTS word-boundary highlighting, and CSS word-reveal effects. `useEnhancedTextStreaming` is a separate prototype hook: it is not imported by the live reading flow, and its `Intl.Segmenter` and element-trigger effects are not shipped behavior.

Prototype capabilities:
- `Intl.Segmenter`-based word or sentence segmentation with a simple fallback
- Regex-based fire/water/air/earth trigger detection
- Configurable cooldown between element triggers

Prototype-only usage:
```javascript
import { useEnhancedTextStreaming } from '../hooks/useEnhancedTextStreaming';

const {
  segmentText,
  detectElementTriggers,
  calculateSegmentDelay,
  hasSegmenter
} = useEnhancedTextStreaming({
  onElementDetected: (element, config) => {
    handlePrototypeAtmosphere(element, config);
  },
  locale: 'en',
  granularity: 'word'
});

const segments = segmentText(narrativeChunk);
detectElementTriggers(narrativeChunk);
```

**Prototype element mapping:**
- **Fire**: passion, burn, desire → Red-amber palette
- **Water**: emotion, flow, intuition → Blue palette
- **Air**: thought, clarity, truth → Violet-sky palette
- **Earth**: root, body, stability → Brown-green palette

### 5. Enhanced Haptic Feedback

The centralized `useHaptic` hook provides typed patterns for semantic feedback. It is disabled when `prefers-reduced-motion` is active, as well as when the device has no Vibration API or the caller passes `disabled`. This guarantee applies to the hook; direct `navigator.vibrate` call sites are separate code paths.

**Current patterns:**
- `cardLanding`: 20ms - Brief pulse when a card lands
- `majorArcana`: [50, 30, 50] - Major Arcana emphasis
- `readingComplete`: [100, 50, 100] - Success confirmation

**Usage:**
```javascript
import { useHaptic } from '../hooks/useHaptic';

const { vibrate, vibrateType } = useHaptic();

// Simple pulse
vibrate(20);

// Named pattern
vibrateType('majorArcana');

// Card-specific feedback
const isMajorArcana = card.arcana === 'major';
vibrate(isMajorArcana ? [50, 30, 50] : 20);
```

## Accessibility

All cinematic enhancements respect user preferences:

### Reduced Motion
```javascript
const prefersReducedMotion = useReducedMotion();

if (prefersReducedMotion) {
  // Disable animations
  // Show static content immediately
}
```

Features that adapt to reduced motion:
- Atmospheric orb breathing disabled
- Color script filters removed
- Particle animations hidden
- Centralized haptic feedback is disabled when reduced motion is active
- Device support is a silent no-op when the Vibration API is unavailable

### Screen Readers
Live status surfaces include appropriate labels and live regions:
```javascript
<div
  role="status"
  aria-label="Generating your personalized narrative"
  aria-live="polite"
  aria-busy="true"
>
  <InterludeScene sceneModels={sceneModels} />
</div>
```

## Performance Considerations

### Mixed Motion Stack

Motion is implemented as a mixed stack:
- JS-driven card, deck, overlay, modal, gesture, and toast transitions go through `src/lib/motionAdapter.js`, which wraps the `motion` library.
- CSS keyframes handle narrative word reveals and the card-slot reveal burst.
- `@tsparticles/react` and `@tsparticles/slim` provide the shared scene-level `ParticleLayer`; the per-slot reveal burst is CSS-based.
- Sora card video is a separate feature-flagged media path, not an animation primitive.

### Reduced-Motion and Lifecycle Safeguards

Scene transitions are skipped when reduced motion is active, particles receive a zero count, and the slot reveal burst collapses through the global reduced-motion rules. Particle sessions clean up their canvas when a scene unmounts, and media polling is bounded by the card-video client flow.

## Testing

### Unit Tests
```bash
node --test tests/cinematicEnhancements.test.mjs
```

Tests cover:
- Scene state derivation
- Color-script selection behavior
- Prototype element-trigger fixtures (not a live integration test)
- Haptic pattern validation

### Integration Testing
The cinematic enhancements integrate seamlessly with existing E2E tests:
```bash
npm run test:e2e
```

## Browser Support

| Feature | Support | Fallback |
|---------|---------|----------|
| `Intl.Segmenter` (prototype hook) | Modern browsers | Simple word split |
| CSS filters and custom properties | All modern | Static defaults |
| `motion` library via `motionAdapter` | Modern browsers | Reduced/static state |
| Vibration API (centralized haptics) | Mobile browsers | Silent no-op; reduced motion disables it |
| `@tsparticles` scene layer | Modern browsers | No particles |
| Sora card video | Feature/config dependent | Static media fallback |

## Implementation Status and Proposals

### Implemented

- Canonical scene orchestration with `IDLE`, `RITUAL`, `REVEAL`, `INTERLUDE`, `NARRATIVE`, and `COMPLETE` states.
- JS motion through the `motion` adapter, CSS narrative/slot-reveal effects, and shared `@tsparticles` scene particles.
- Sora-backed card video generation through the feature-flagged `/api/generate-card-video` path for Plus/Pro media access.
- Centralized haptics with reduced-motion disabling.

### Prototype or unused

- `AtmosphericInterlude` is a prototype component and is not used by the live reading route.
- `useEnhancedTextStreaming` is a prototype hook and is not used by `StreamingNarrative`.

### Proposals

1. **Video expansion:** richer Sora usage across additional reading surfaces, if product scope and quotas are defined.
2. **Audio layers:** narrative-driven ambient layers beyond the existing scene sounds.
3. **Particle work:** WebGL-based trails or richer interaction presets.
4. **Advanced haptics:** pattern composition based on card combinations.

## Troubleshooting

### Color Script Not Applying
Check that the emotional tone is being provided:
```javascript
console.log({ narrativePhase, emotionalTone, reasoning });
```

### Interlude Scene Not Showing
Verify the canonical active scene and its model:
```javascript
console.log({ activeScene, shouldShowInterlude, sceneModels });
```

The live component is `InterludeScene`; `AtmosphericInterlude` is only the unused prototype.

### Haptic Feedback Not Working
- Check device support: `navigator.vibrate` must exist
- The centralized hook is disabled when reduced motion is active
- Test on an actual mobile device (desktop browsers may not support haptics)

## Best Practices

1. **Always check reduced motion preferences** before enabling animations
2. **Use scene orchestrator** for complex state transitions
3. **Cleanup effects** when components unmount (especially color script)
4. **Test on mobile devices** for haptic feedback
5. **Provide fallbacks** for unsupported features
6. **Monitor performance** with complex animations

## References

- [Scene Orchestrator Hook](../src/hooks/useSceneOrchestrator.js)
- [Scene Shell](../src/components/scenes/SceneShell.jsx)
- [Interlude Scene](../src/components/scenes/InterludeScene.jsx)
- [Atmospheric Interlude Prototype](../src/components/AtmosphericInterlude.jsx)
- [Color Script Library](../src/lib/colorScript.js)
- [Live Narrative Streaming](../src/components/StreamingNarrative.jsx)
- [Enhanced Text Streaming Prototype](../src/hooks/useEnhancedTextStreaming.js)
- [Particle Layer](../src/components/ParticleLayer.jsx)
- [Motion Adapter](../src/lib/motionAdapter.js)
- [Haptic Hook](../src/hooks/useHaptic.js)
- [Sora Card Video UI](../src/components/AnimatedReveal.jsx)
