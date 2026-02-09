# Anime.js V4 Migration Guide

**IMPORTANT**: This guide is based on the installed Anime.js v4 API and official v4 docs, which differ significantly from V3 documentation.

## Verified Exports (from `npm list animejs`)

```javascript
import {
  // Core
  animate,           // Main animation function
  createTimeline,    // Timeline factory (NOT 'timeline')
  stagger,           // Stagger utility
  set,               // Instant property setter

  // Easing
  spring,            // Spring easing factory
  eases,             // Easing presets: { outQuad, inOutCubic, ... }
  linear,            // Linear easing
  steps,             // Steps easing
  cubicBezier,       // Custom bezier

  // Text
  splitText,         // Text splitting (top-level export)

  // SVG
  svg,               // { morphTo, createDrawable, createMotionPath }
  morphTo,
  createDrawable,
  createMotionPath,

  // Utilities
  utils,             // Math/DOM utilities
  get,               // Get element property
  clamp,
  round,
  random,
  mapRange,
  lerp,
  snap,
  degToRad,
  radToDeg,

  // Advanced
  createAnimatable,  // High-level DOM animation
  createDraggable,   // Draggable elements
  createScope,       // Animation scopes
  createTimer,       // Low-level timer
  waapi,             // Web Animations API: { animate, convertEase }
  engine,            // Animation engine control
} from 'animejs';
```

## Key Differences from V3 / Provided Docs

| V3 / Docs Said | V4 Actually Uses |
|----------------|------------------|
| `timeline()` | `createTimeline()` |
| `easing: 'easeOutQuad'` | `ease: 'outQuad'` (no 'ease' prefix) |
| `spring(1, 100, 10, 0)` string | `spring({ stiffness, damping, mass })` |
| `animation.promise` | `animation.then()` / `await animation` |
| `utils.splitText()` | `splitText()` (top-level) |
| `anime()` default | `animate()` named export |
| `anime.set()` | `set()` named export |
| `anime.stagger()` | `stagger()` named export |

## Easing Names

V4 easing names in `eases` object (no 'ease' prefix):

```javascript
// Correct V4 easing names:
'linear'
'inQuad', 'outQuad', 'inOutQuad'
'inCubic', 'outCubic', 'inOutCubic'
'inQuart', 'outQuart', 'inOutQuart'
'inQuint', 'outQuint', 'inOutQuint'
'inSine', 'outSine', 'inOutSine'
'inExpo', 'outExpo', 'inOutExpo'
'inCirc', 'outCirc', 'inOutCirc'
'inBack', 'outBack', 'inOutBack'
'inElastic', 'outElastic', 'inOutElastic'
'inBounce', 'outBounce', 'inOutBounce'

// Also available: outIn variants
'outInQuad', 'outInCubic', etc.
```

## Migration Examples

### Before: Framer Motion hover

```jsx
// Framer Motion
<motion.button
  whileHover={{ scale: 1.05, y: -5 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
/>
```

### After: Anime.js V4

```jsx
import { animate, set, spring } from 'animejs';

const buttonRef = useRef(null);

const springEase = spring({ stiffness: 400, damping: 25, mass: 1 });

const handleMouseEnter = () => {
  animate(buttonRef.current, {
    scale: 1.05,
    translateY: -5,
    ease: springEase,
    duration: 400
  });
};

const handleMouseLeave = () => {
  animate(buttonRef.current, {
    scale: 1,
    translateY: 0,
    ease: springEase,
    duration: 300
  });
};

const handleMouseDown = () => {
  animate(buttonRef.current, {
    scale: 0.97,
    duration: 100,
    ease: 'outQuad'
  });
};
```

### Before: Framer Motion useAnimation

```jsx
// Framer Motion
const controls = useAnimation();

await controls.start({
  rotateY: 90,
  opacity: 0.6,
  filter: 'blur(8px)',
  transition: { duration: 0.35 }
});
```

### After: Anime.js V4 Timeline

```jsx
import { createTimeline, set } from 'animejs';

const tl = createTimeline();

tl.add(cardRef.current, {
  rotateY: 90,
  opacity: 0.6,
  filter: 'blur(8px)',
  scale: 0.95,
  duration: 350,
  ease: 'inQuad'
});

tl.add(cardRef.current, {
  rotateY: 0,
  opacity: 1,
  filter: 'blur(0px)',
  scale: 1,
  duration: 400,
  ease: 'outQuart',
  onBegin: () => setIsRevealed(true)
});
```

### Before: Framer Motion staggerChildren

```jsx
// Framer Motion variants
const containerVariants = {
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 }
  }
};
```

### After: Anime.js V4 stagger

```jsx
import { animate, stagger, set } from 'animejs';

// Set initial state
set('.card', { opacity: 0, translateY: -30, scale: 0.95 });

animate('.card', {
  opacity: 1,
  translateY: 0,
  scale: 1,
  delay: stagger(40, { start: 50 }),  // 40ms between, 50ms initial delay
  duration: 350,
  ease: 'outQuart'
});
```

### Function-based values (per-element)

```jsx
import { animate, stagger } from 'animejs';

// Card fan effect
animate('.card', {
  translateX: (el, i, total) => {
    const normalized = (2 * i / (total - 1)) - 1;
    return normalized * 120;
  },
  translateY: (el, i, total) => {
    const normalized = (2 * i / (total - 1)) - 1;
    return -Math.abs(normalized) * 20;
  },
  rotate: (el, i, total) => (2 * i / (total - 1) - 1) * 15,
  scale: (el, i, total) => 1 - Math.abs(2 * i / (total - 1) - 1) * 0.05,
  delay: stagger(50),
  duration: 400,
  ease: 'outQuart'
});
```

### Text Animation

```jsx
import { splitText, animate, stagger, set } from 'animejs';

const words = splitText(containerRef.current, { by: 'word' });

set(words, { opacity: 0, translateY: 20 });

animate(words, {
  opacity: 1,
  translateY: 0,
  delay: stagger(80),
  duration: 400,
  ease: 'outQuad'
});
```

### Completion Handling

```jsx
import { animate } from 'animejs';

// Callback style
animate(target, {
  translateX: 100,
  onComplete: (anim) => console.log('Done!')
});

// Promise style (v4)
const anim = animate(target, { translateX: 100 });
await anim;

// Or explicitly
anim.then(() => console.log('Done!'));
```

### Playback Controls

```jsx
const anim = animate(target, {
  translateX: 300,
  duration: 3000,
  autoplay: false  // Don't auto-start
});

anim.play();       // Start/resume
anim.pause();      // Pause
anim.restart();    // Restart from beginning
anim.reverse();    // Reverse direction
anim.seek(1500);   // Seek to 1500ms
anim.seek('50%');  // Seek to 50%
```

## React Integration Hook

```jsx
// src/hooks/useAnime.js
import { useEffect, useRef, useCallback } from 'react';
import { animate, set } from 'animejs';

export function useAnime() {
  const animationsRef = useRef([]);

  const run = useCallback((targets, params) => {
    const anim = animate(targets, params);
    animationsRef.current.push(anim);
    return anim;
  }, []);

  const setProps = useCallback((targets, props) => {
    set(targets, props);
  }, []);

  const cleanup = useCallback(() => {
    animationsRef.current.forEach(anim => {
      if (anim.pause) anim.pause();
    });
    animationsRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  return { run, set: setProps, cleanup };
}
```

## CSS Properties Confirmed Working

From testing:
- ✅ `translateX`, `translateY`, `translateZ`
- ✅ `rotate`, `rotateX`, `rotateY`, `rotateZ`
- ✅ `scale`, `scaleX`, `scaleY`
- ✅ `opacity`
- ✅ `filter` (blur, brightness, etc.)
- ✅ `backgroundColor`
- ✅ `borderRadius`
- ✅ CSS custom properties (`'--my-var'`)

## Testing

Run the visual tests:

```bash
# Start dev server
npm run dev

# Open in browser:
# http://localhost:5173/tests/anime-v4-api-test.html
```

Run the Node.js API verification:

```bash
node tests/anime-api-verification.mjs
```

## Bundle Size

```
animejs@4.3.4: ~15KB gzipped (full)
framer-motion: ~45KB gzipped

Potential savings: ~30KB
```

Note: V4 is larger than V3 (~6KB) due to additional features, but still smaller than Framer Motion.
