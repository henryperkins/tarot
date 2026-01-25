# Anime.js v4 Comprehensive Usage Guide

A complete guide to anime.js, the lightweight JavaScript animation library.

---

## Table of Contents

1. [Installation](#installation)
2. [Basic Animation](#basic-animation)
3. [Targets](#targets)
4. [Animatable Properties](#animatable-properties)
5. [Tween Parameters](#tween-parameters)
6. [Tween Value Types](#tween-value-types)
7. [Playback Settings](#playback-settings)
8. [Callbacks](#callbacks)
9. [Animation Methods](#animation-methods)
10. [Timeline](#timeline)
11. [Timer](#timer)
12. [Stagger](#stagger)
13. [Utilities](#utilities)
14. [Animatable](#animatable)
15. [Draggable](#draggable)
16. [Scope](#scope)
17. [SVG Animations](#svg-animations)
18. [Text Animations](#text-animations)
19. [Web Animation API (WAAPI)](#web-animation-api-waapi)

---

## Installation

### NPM

```bash
npm install animejs
```

### ES Modules

```javascript
import { animate } from 'animejs';
```

### CommonJS

```javascript
const { animate } = require('animejs');
```

### CDN (ES Modules)

```javascript
import { animate } from 'https://esm.sh/animejs';
```

### CDN (UMD)

```html
<script src="https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js"></script>
<script>
  const { animate } = anime;
</script>
```

### Available Subpaths (Tree-Shaking)

```javascript
import { animate } from 'animejs/animation';
import { createTimer } from 'animejs/timer';
import { createTimeline } from 'animejs/timeline';
import { createAnimatable } from 'animejs/animatable';
import { createDraggable } from 'animejs/draggable';
import { createScope } from 'animejs/scope';
import { engine } from 'animejs/engine';
import * as easings from 'animejs/easings';
import * as utils from 'animejs/utils';
import * as svg from 'animejs/svg';
import * as text from 'animejs/text';
import * as waapi from 'animejs/waapi';
```

---

## Basic Animation

```javascript
import { animate } from 'animejs';

const animation = animate(targets, parameters);
```

### Simple Example

```javascript
animate('.square', {
  translateX: 100,
  scale: 2,
  opacity: 0.5,
  duration: 400,
  delay: 250,
  ease: 'out(3)',
  loop: 3,
  alternate: true,
});
```

---

## Targets

Targets define which elements to animate. Specified as the first argument of `animate()`.

### CSS Selector

```javascript
animate('.square', { x: '17rem' });
animate('#my-id', { rotate: '1turn' });
animate('.row:nth-child(3) .square', { scale: [1, 0.5, 1] });
```

### DOM Elements

```javascript
const $el = document.querySelector('.square');
const $elements = document.querySelectorAll('.square');

animate($el, { scale: 0.75 });
animate($elements, { x: '23rem' });
```

**Accepted types:**
- `HTMLElement`
- `SVGElement`
- `SVGGeometryElement`
- `NodeList`

### JavaScript Objects

```javascript
const vector2D = { x: 0, y: 0 };

animate(vector2D, {
  x: 100,
  y: 150,
  modifier: utils.round(0),
  onUpdate: () => console.log(vector2D),
});
```

**Accepted types:**
- `Object`
- Instance of `Class`

---

## Animatable Properties

Define which properties to animate in the parameters object.

```javascript
animate('.square', {
  // Transform properties
  translateX: 100,
  translateY: 50,
  scale: 2,
  rotate: '1turn',
  
  // CSS properties
  opacity: 0.5,
  backgroundColor: '#FF0000',
  borderRadius: '50%',
  
  // Other parameters
  duration: 400,
  delay: 250,
  ease: 'out(3)',
});
```

### CSS Properties

Any CSS property can be animated:

```javascript
animate('.box', {
  width: '200px',
  height: '200px',
  backgroundColor: '#3498db',
  borderRadius: '10px',
  boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
});
```

### Transform Shorthand

```javascript
animate('.element', {
  x: 100,        // translateX
  y: 50,         // translateY
  scale: 1.5,
  rotate: 45,    // degrees
});
```

---

## Tween Parameters

Configure values, timings, and behaviors. Can be set globally or locally per property.

### Global Parameters

```javascript
animate('.square', {
  x: 100,
  scale: 1,
  opacity: 0.5,
  // Global tween parameters
  duration: 400,
  delay: 250,
  ease: 'out(3)',
});
```

### Local Parameters (Per Property)

```javascript
animate('.square', {
  x: {
    to: 100,
    delay: 0,
    ease: 'inOut(4)',
  },
  scale: 1,
  opacity: 0.5,
  // Global defaults
  duration: 400,
  delay: 250,
  ease: 'out(3)',
});
```

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `duration` | Animation duration in ms | `1000` |
| `delay` | Delay before animation starts | `0` |
| `ease` | Easing function | `'out(1)'` |
| `modifier` | Function to modify animated value | `null` |

### Modifier Function

```javascript
animate('.square', {
  x: '17rem',
  modifier: utils.round(0), // Round to 0 decimals
  duration: 4000,
});

// Custom modifier
animate('.square', {
  x: '85rem',
  modifier: v => v % 17, // Modulo operation
});

// Per-property modifier
animate('.square', {
  x: '17rem',
  y: {
    to: '70rem',
    modifier: v => Math.cos(v) / 2,
  },
});
```

---

## Tween Value Types

### Unit Values

```javascript
animate('.square', {
  x: '6rem',
  width: '200px',
  rotate: '1turn',
});
```

### From/To Values

```javascript
animate('.square', {
  opacity: {
    from: 0,
    to: 1,
  },
});
```

### Array Values (Keyframes)

```javascript
animate('.square', {
  scale: [1, 0.5, 1],  // Start → Middle → End
});
```

### Relative Values

```javascript
animate('.square', {
  scale: '+=0.25',  // Add to current value
  x: '-=50',        // Subtract from current value
  rotate: '*=2',    // Multiply current value
});
```

### Function-Based Values

```javascript
animate('.square', {
  x: (el, index, total) => index * 50,
  y: el => el.dataset.y,
});
```

---

## Playback Settings

```javascript
animate('.square', {
  translateX: 100,
  // Playback settings
  loop: 3,           // Number of loops (true for infinite)
  alternate: true,   // Alternate direction each loop
  autoplay: false,   // Don't start automatically
  playbackRate: 1.5, // Speed multiplier
});
```

| Setting | Description | Default |
|---------|-------------|---------|
| `loop` | Loop count (`true` = infinite) | `false` |
| `alternate` | Reverse direction on loop | `false` |
| `autoplay` | Start automatically | `true` |
| `playbackRate` | Speed multiplier | `1` |

---

## Callbacks

Execute functions at specific animation points.

```javascript
animate('.square', {
  translateX: 100,
  
  onBegin: (anim) => {
    console.log('Animation started');
  },
  
  onUpdate: (anim) => {
    console.log('Progress:', anim.progress);
  },
  
  onLoop: (anim) => {
    console.log('Loop completed');
  },
  
  onComplete: (anim) => {
    console.log('Animation finished');
  },
});
```

| Callback | Triggered When |
|----------|----------------|
| `onBegin` | Animation starts |
| `onUpdate` | Every frame |
| `onLoop` | Each loop iteration |
| `onComplete` | Animation finishes |

---

## Animation Methods

The `animate()` function returns an `Animation` instance with control methods.

```javascript
const animation = animate('.square', {
  translateX: 100,
  autoplay: false,
});

// Playback control
animation.play();
animation.pause();
animation.restart();

// Seeking
animation.seek(500);          // Seek to 500ms
animation.seek('50%');        // Seek to 50%

// Speed control
animation.playbackRate = 2;   // Double speed
animation.playbackRate = 0.5; // Half speed

// Reverse
animation.reverse();

// Complete/Reset
animation.complete();
animation.reset();
```

---

## Timeline

Synchronize multiple animations, timers, and callbacks.

```javascript
import { createTimeline } from 'animejs';

const timeline = createTimeline({
  defaults: {
    ease: 'out(3)',
    duration: 500,
  },
  loop: 3,
  alternate: true,
});
```

### Adding Animations

```javascript
const tl = createTimeline();

// Add animations with position parameter
tl.add('.box1', { x: 100 });                    // Starts at 0
tl.add('.box2', { x: 100 }, 200);               // Starts at 200ms
tl.add('.box3', { x: 100 }, '-=100');           // Starts 100ms before previous ends
tl.add('.box4', { x: 100 }, '+=100');           // Starts 100ms after previous ends
tl.add('.box5', { x: 100 }, 'label1');          // Starts at label
```

### Labels

```javascript
tl.label('intro');
tl.add('.title', { opacity: [0, 1] });
tl.add('.subtitle', { opacity: [0, 1] }, '-=200');

tl.label('main');
tl.add('.content', { y: [50, 0], opacity: [0, 1] });
```

### Callbacks in Timeline

```javascript
tl.call(() => {
  console.log('Reached this point');
}, 500);  // Execute at 500ms
```

### Timeline Methods

```javascript
tl.play();
tl.pause();
tl.restart();
tl.seek(1000);
tl.reverse();
```

---

## Timer

Alternative to `setTimeout`/`setInterval` that stays synchronized with animations.

```javascript
import { createTimer } from 'animejs';

const timer = createTimer({
  duration: 1000,
  loop: true,
  frameRate: 30,
  
  onUpdate: (self) => {
    console.log('Current time:', self.currentTime);
  },
  
  onLoop: (self) => {
    console.log('Loop count:', self._currentIteration);
  },
});
```

### Timer Settings

| Setting | Description |
|---------|-------------|
| `duration` | Timer duration in ms |
| `loop` | Loop count or `true` for infinite |
| `frameRate` | Callback frequency (fps) |

---

## Stagger

Create sequential effects across multiple targets.

```javascript
import { animate, stagger } from 'animejs';

animate('.square', {
  x: '17rem',
  scale: stagger([1, 0.1]),    // Range from 1 to 0.1
  delay: stagger(100),          // 100ms between each
});
```

### Stagger Parameters

```javascript
// Basic stagger
delay: stagger(100)              // 100ms between each

// Range stagger
scale: stagger([1, 0.5])         // Distribute from 1 to 0.5

// From center
delay: stagger(100, { from: 'center' })

// From specific index
delay: stagger(100, { from: 2 })

// From last
delay: stagger(100, { from: 'last' })

// Random order
delay: stagger(100, { from: 'random' })

// Grid stagger
delay: stagger(100, { grid: [7, 5], from: 'center' })

// Eased stagger
delay: stagger(500, { ease: 'inOut(3)' })
```

---

## Utilities

```javascript
import { utils } from 'animejs';
// Or import specific utilities
import { stagger, $, get, set, random, clamp, round } from 'animejs';
```

### DOM Selection

```javascript
const elements = utils.$('.square');  // Returns array of elements
```

### Get/Set Values

```javascript
// Get current value
const currentX = utils.get('.square', 'translateX');

// Set value instantly
utils.set('.square', { scale: 0.5, opacity: 0.8 });
```

### Math Utilities

```javascript
// Random number
utils.random(0, 100);           // Integer between 0-100
utils.random(0, 1, 2);          // Float with 2 decimals

// Clamp value
utils.clamp(value, 0, 100);     // Keep between 0-100

// Round
utils.round(3.14159, 2);        // 3.14

// Wrap (loop value within range)
utils.wrap(value, 0, 360);

// Map range
utils.mapRange(value, 0, 1, 0, 100);

// Lerp (linear interpolation)
utils.lerp(0, 100, 0.5);        // 50
```

---

## Animatable

Efficiently animate properties that change frequently (cursor events, animation loops).

```javascript
import { createAnimatable } from 'animejs';

const animatable = createAnimatable('.square', {
  x: { unit: 'rem', duration: 400, ease: 'out(4)' },
  y: 200,
  rotate: 1000,
  ease: 'out(2)',  // Global default
});

// Trigger animation
animatable.x(100);
animatable.y(50, 200, 'inOut(3)');  // value, duration, ease

// Get current value
const currentX = animatable.x();
```

**Note:** Only `Number` or `Array<Number>` can be passed to animatable property functions.

---

## Draggable

Add drag capabilities to DOM elements.

```javascript
import { createDraggable } from 'animejs';

const draggable = createDraggable('.square', {
  // Axis constraints
  x: { snap: 100 },           // Snap to 100px grid
  y: { snap: 50 },
  
  // Settings
  modifier: utils.wrap(-200, 0),
  containerPadding: 10,
  releaseStiffness: 40,
  releaseEase: 'out(3)',
  
  // Callbacks
  onGrab: (self) => console.log('Grabbed'),
  onDrag: (self) => console.log('Dragging', self.x, self.y),
  onRelease: (self) => console.log('Released'),
});
```

### Draggable Callbacks

| Callback | Triggered When |
|----------|----------------|
| `onGrab` | Element is grabbed |
| `onDrag` | Element is being dragged |
| `onRelease` | Element is released |

---

## Scope

Manage animations with media queries and scoped defaults.

```javascript
import { createScope, animate } from 'animejs';

createScope({
  root: '.section',
  defaults: {
    duration: 250,
    ease: 'out(4)',
  },
  mediaQueries: {
    mobile: '(max-width: 640px)',
    reducedMotion: '(prefers-reduced-motion)',
  },
})
.add((ctx) => {
  const { mobile, reducedMotion } = ctx.matches;
  
  animate('.square', {
    x: mobile ? 0 : '100vw',
    y: mobile ? '100vh' : 0,
    duration: reducedMotion ? 0 : 750,
  });
});
```

### Scope Parameters

| Parameter | Description |
|-----------|-------------|
| `root` | Root element/selector for scoped queries |
| `defaults` | Default animation parameters |
| `mediaQueries` | Named media query definitions |

---

## SVG Animations

```javascript
import { svg } from 'animejs';
// Or individual functions
import { morphTo, createMotionPath, createDrawable } from 'animejs';
```

### morphTo - Shape Morphing

```javascript
import { animate, svg, utils } from 'animejs';

const [$path1, $path2] = utils.$('polygon');

// Morph path1 into path2
animate($path1, {
  points: svg.morphTo($path2),
  ease: 'inOutCirc',
  duration: 500,
});
```

**Parameters:**
- `shapeTarget`: CSS selector, `SVGPathElement`, `SVGPolylineElement`, or `SVGPolygonElement`
- `precision` (optional): Number between 0-1 (default: 0.33)

### createDrawable - Line Drawing

```javascript
const [drawable] = svg.createDrawable('path');

// Draw property: 'start end' (0-1 range)
animate(drawable, {
  draw: ['0 0', '0 1'],  // Draw from nothing to full
  duration: 1000,
});

// Partial drawing
drawable.draw = '0.25 0.75';  // Draw middle 50%
```

**Draw value examples:**
```
'0 1'      // Full line: |[———————————————————]|
'0 .5'     // First half: |[—————————]          |
'.25 .75'  // Middle: |     [—————————]     |
'.5 1'     // Second half: |          [—————————]|
'1 1'      // Nothing: |                   []|
```

### createMotionPath - Path Animation

```javascript
import { animate, svg } from 'animejs';

const { translateX, translateY, rotate } = svg.createMotionPath('path');

animate('.element', {
  ...svg.createMotionPath('path'),
  ease: 'linear',
  duration: 5000,
  loop: true,
});
```

**Returns object with:**
- `translateX`: X coordinate along path
- `translateY`: Y coordinate along path
- `rotate`: Angle along path

---

## Text Animations

```javascript
import { splitText } from 'animejs';
// Or
import { splitText } from 'animejs/text';
```

### splitText

Split text into animatable lines, words, and characters.

```javascript
import { createTimeline, stagger, splitText } from 'animejs';

const { lines, words, chars } = splitText('p', {
  words: { wrap: 'clip' },
  chars: true,
});

createTimeline({ loop: true })
  .add(words, {
    y: ['100%', '0%'],
  }, stagger(125))
  .add(chars, {
    y: '100%',
  }, stagger(10, { from: 'random' }));
```

### Split Parameters

```javascript
const split = splitText('.text', {
  lines: true,           // Split into lines
  words: true,           // Split into words
  chars: true,           // Split into characters
  words: { wrap: 'clip' }, // Wrap with overflow:hidden
});

// Returns
split.lines  // Array of line elements
split.words  // Array of word elements
split.chars  // Array of character elements
```

### Revert Split

```javascript
split.revert();  // Restore original text
```

---

## Web Animation API (WAAPI)

Lightweight 3KB alternative using native Web Animation API.

```javascript
import { waapi } from 'animejs';

const animation = waapi.animate(targets, parameters);
```

### Example

```javascript
import { waapi, stagger, splitText } from 'animejs';

const { chars } = splitText('h2', { chars: true });

waapi.animate(chars, {
  translate: '0 -2rem',
  delay: stagger(100),
  duration: 600,
  loop: true,
  alternate: true,
  ease: 'inOut(2)',
});
```

### WAAPI vs JS Animation

| Feature | JS (10KB) | WAAPI (3KB) |
|---------|-----------|-------------|
| Size | ~10KB | ~3KB |
| Performance | JavaScript-based | Hardware-accelerated |
| Features | Full feature set | Basic API |
| Browser support | All browsers | Modern browsers |

**Use WAAPI when:**
- Bundle size is critical
- Animating only transforms/opacity
- Targeting modern browsers

**Use JS animation when:**
- Need full feature set
- Complex sequencing
- JavaScript object animation

---

## Easing Functions

### Built-in Easings

```javascript
// Power easings
ease: 'out(1)'    // Equivalent to easeOutQuad
ease: 'out(2)'    // Equivalent to easeOutCubic
ease: 'out(3)'    // Equivalent to easeOutQuart
ease: 'in(3)'     // Ease in
ease: 'inOut(3)'  // Ease in and out

// Named easings
ease: 'linear'
ease: 'inOutCirc'
ease: 'inOutElastic'
ease: 'inOutBounce'
```

### Custom Easing

```javascript
// Cubic bezier
ease: 'cubicBezier(0.25, 0.1, 0.25, 1)'

// Spring
ease: 'spring(mass, stiffness, damping, velocity)'
ease: 'spring(1, 100, 10, 0)'

// Steps
ease: 'steps(10)'
```

---

## Engine Defaults

Modify global defaults for all animations.

```javascript
import { engine } from 'animejs';

engine.defaults.duration = 500;
engine.defaults.ease = 'out(3)';
engine.defaults.autoplay = false;
```

---

## Quick Reference

### Most Common Pattern

```javascript
import { animate, stagger } from 'animejs';

animate('.element', {
  // Properties to animate
  translateX: 100,
  opacity: [0, 1],
  scale: [0.5, 1],
  
  // Timing
  duration: 800,
  delay: stagger(100),
  ease: 'out(3)',
  
  // Playback
  loop: true,
  alternate: true,
  
  // Events
  onComplete: () => console.log('Done!'),
});
```

### Timeline Pattern

```javascript
import { createTimeline } from 'animejs';

createTimeline({ defaults: { ease: 'out(3)' } })
  .add('.title', { opacity: [0, 1], y: [20, 0] })
  .add('.subtitle', { opacity: [0, 1] }, '-=200')
  .add('.content', { opacity: [0, 1], y: [30, 0] }, '-=100');
```

### Interactive Animation Pattern

```javascript
import { createAnimatable } from 'animejs';

const cursor = createAnimatable('.cursor', {
  x: { duration: 200, ease: 'out(3)' },
  y: { duration: 200, ease: 'out(3)' },
});

document.addEventListener('mousemove', (e) => {
  cursor.x(e.clientX);
  cursor.y(e.clientY);
});
```

---

## Resources

- **Documentation**: https://animejs.com/documentation
- **GitHub**: https://github.com/juliangarnier/anime
- **NPM**: https://www.npmjs.com/package/animejs
- **Migration Guide (v3 → v4)**: https://github.com/juliangarnier/anime/wiki/Migrating-from-v3-to-v4
