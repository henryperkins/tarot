# Cinematic Enhancements Documentation

## Overview

This document describes the cinematic enhancements added to the Tableu tarot reading application, focusing on atmospheric transitions, immersive loading states, and dynamic visual feedback.

## Core Features

### 1. Scene Orchestration (`useSceneOrchestrator`)

A unified state machine that replaces fragmented boolean flags with explicit scene states.

**Scene Flow:**
```
IDLE → SHUFFLING → DRAWING → REVEALING → INTERLUDE → DELIVERY → COMPLETE
```

**Usage:**
```javascript
import { useSceneOrchestrator } from '../hooks/useSceneOrchestrator';

const { 
  currentScene, 
  scenes, 
  shouldShowInterlude,
  onSceneTransition 
} = useSceneOrchestrator({
  isShuffling,
  hasConfirmedSpread,
  revealedCards,
  totalCards,
  isGenerating,
  personalReading,
  reading
});

// React to scene transitions
useEffect(() => {
  const cleanup = onSceneTransition((prevScene, nextScene) => {
    if (nextScene === scenes.REVEALING) {
      // Prefetch assets
    }
  });
  return cleanup;
}, []);
```

### 2. Atmospheric Interlude (`AtmosphericInterlude`)

Replaces skeleton loading screens with an immersive "breathing" animation during narrative generation.

**Features:**
- Breathing orb animation (4-second cycle)
- Shimmer effects on mystical symbols
- Progressive message evolution
- Constellation of animated particles
- Full reduced-motion support

**Usage:**
```javascript
import { AtmosphericInterlude } from '../components/AtmosphericInterlude';

{shouldShowInterlude && (
  <AtmosphericInterlude 
    message="Channeling your reading..."
    theme="narrative-atmosphere--warm"
  />
)}
```

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

### 4. Enhanced Text Streaming (`useEnhancedTextStreaming`)

Locale-sensitive text segmentation with element-based atmosphere triggers.

**Features:**
- Uses `Intl.Segmenter` API for proper word/sentence boundaries
- Regex-based keyword detection for atmospheric elements
- Cooldown system prevents trigger spam

**Element Mapping:**
- **Fire**: passion, burn, desire → Red-amber palette
- **Water**: emotion, flow, intuition → Blue palette
- **Air**: thought, clarity, truth → Violet-sky palette
- **Earth**: root, body, stability → Brown-green palette

**Usage:**
```javascript
import { useEnhancedTextStreaming } from '../hooks/useEnhancedTextStreaming';

const {
  segmentText,
  detectElementTriggers,
  calculateSegmentDelay,
  hasSegmenter
} = useEnhancedTextStreaming({
  onElementDetected: (element, config) => {
    // Apply visual/audio changes based on element
    console.log(`Detected ${element}:`, config.palette);
  },
  locale: 'en',
  granularity: 'word'
});

// Segment streaming text
const segments = segmentText(narrativeChunk);

// Detect atmospheric triggers
detectElementTriggers(narrativeChunk);
```

### 5. Enhanced Haptic Feedback

Extended haptic patterns for cinematic tactile feedback.

**New Patterns:**
- `cardLanding`: 20ms - Brief pulse when card lands in spread
- `majorArcana`: [50, 30, 50] - Complex pattern for Major Arcana emphasis
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
- Haptic feedback may still function (user device control)

### Screen Readers
All visual enhancements include proper ARIA labels and live regions:
```javascript
<div
  role="status"
  aria-label="Generating your personalized narrative"
  aria-live="polite"
  aria-busy="true"
>
  <AtmosphericInterlude />
</div>
```

## Performance Considerations

### CSS-First Approach
All animations use CSS transforms and opacity for GPU acceleration:
```css
.breathing-element {
  /* GPU-accelerated properties only */
  transform: scale(1.15);
  opacity: 0.8;
  will-change: transform, opacity;
}
```

### Ref-Based Updates
High-frequency updates bypass React rendering:
```javascript
// Direct DOM manipulation for 60fps animations
const node = elementRef.current;
if (node) {
  node.style.transform = `translateY(${y}px)`;
}
```

### Predictive Loading
Scene transitions trigger asset prefetching:
```javascript
onSceneTransition((prev, next) => {
  if (next === scenes.REVEALING) {
    // Prefetch heavy assets before they're needed
    prefetchVideoAssets();
    prefetchAudioLayers();
  }
});
```

## Testing

### Unit Tests
```bash
npm test tests/cinematicEnhancements.test.mjs
```

Tests cover:
- Scene state derivation
- Color script selection logic
- Element trigger detection
- Haptic pattern validation

### Integration Testing
The cinematic enhancements integrate seamlessly with existing E2E tests:
```bash
npm run test:e2e
```

## Browser Support

| Feature | Support | Fallback |
|---------|---------|----------|
| Intl.Segmenter | Modern browsers | Simple word split |
| CSS filter | All modern | Graceful degradation |
| Vibration API | Mobile browsers | Silent no-op |
| Framer Motion | All modern | CSS animations |
| CSS custom properties | All modern | Static defaults |

## Future Enhancements

The current implementation provides a foundation for:

1. **Video Integration**: Async Sora-2 generation with blob pre-loading
2. **Audio Layers**: Ambient soundscapes responding to narrative arc
3. **Particle Systems**: WebGL-based particle trails for card movements
4. **Advanced Haptics**: Pattern composition based on card combinations

## Troubleshooting

### Color Script Not Applying
Check that the emotional tone is being provided:
```javascript
console.log({ narrativePhase, emotionalTone, reasoning });
```

### Atmospheric Interlude Not Showing
Verify the scene orchestrator state:
```javascript
console.log({ currentScene, shouldShowInterlude });
```

### Haptic Feedback Not Working
- Check device support: `navigator.vibrate` must exist
- Ensure user hasn't disabled reduced motion
- Test on actual mobile device (desktop browsers may not support)

## Best Practices

1. **Always check reduced motion preferences** before enabling animations
2. **Use scene orchestrator** for complex state transitions
3. **Cleanup effects** when components unmount (especially color script)
4. **Test on mobile devices** for haptic feedback
5. **Provide fallbacks** for unsupported features
6. **Monitor performance** with complex animations

## References

- [Scene Orchestrator Hook](../src/hooks/useSceneOrchestrator.js)
- [Atmospheric Interlude Component](../src/components/AtmosphericInterlude.jsx)
- [Color Script Library](../src/lib/colorScript.js)
- [Enhanced Text Streaming](../src/hooks/useEnhancedTextStreaming.js)
- [Haptic Patterns](../src/hooks/useHaptic.js)
