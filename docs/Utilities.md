# Anime.js (v4) Utilities

Fast, modular animation reference for Anime.js v4.

## Install

### NPM
```bash
npm install animejs
```

### ESM CDN
```javascript
import { animate } from 'https://esm.sh/animejs';
// or
import { animate } from 'https://cdn.jsdelivr.net/npm/animejs/+esm';
```

### UMD CDN
```html
<script src="https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js"></script>
<script>
  const { animate } = anime;
</script>
```

## Core Imports (v4)

```javascript
import { animate, createTimeline, stagger, splitText, waapi } from 'animejs';

// Granular imports (tree-shaking)
import { animate } from 'animejs/animation';
import { createTimeline } from 'animejs/timeline';
import { splitText } from 'animejs/text';
import { waapi } from 'animejs/waapi';
import * as utils from 'animejs/utils';
```

## Basic Animation

```javascript
import { animate } from 'animejs';

const animation = animate('.box', {
  x: 240,
  rotate: '1turn',
  duration: 900,
  ease: 'inOutQuad',
  loop: 1,
  alternate: true
});

animation.pause();
animation.resume();
animation.play();
animation.reverse();
animation.seek(400);

animation.then(() => {
  console.log('complete');
});
```

## Key Parameters (v4 naming)

- `delay`
- `duration`
- `loop`
- `loopDelay`
- `alternate`
- `reversed`
- `autoplay`
- `frameRate`
- `playbackRate`
- `ease`
- callbacks: `onBegin`, `onUpdate`, `onRender`, `onLoop`, `onPause`, `onComplete`

## Timeline

```javascript
import { createTimeline } from 'animejs';

const tl = createTimeline({
  defaults: { duration: 500, ease: 'outQuad' }
});

tl.add('.a', { x: 140 })
  .add('.b', { x: 140 }, 200)
  .call(() => console.log('timeline step'));
```

## Stagger

```javascript
import { animate, stagger } from 'animejs';

animate('.item', {
  y: -16,
  delay: stagger(80, { from: 'center', reversed: false, ease: 'inOutQuad' })
});
```

## Text Splitting

```javascript
import { splitText, animate, stagger } from 'animejs';

const split = splitText('h2', { words: true, chars: true });

animate(split.chars, {
  y: -10,
  delay: stagger(25),
  ease: 'out(3)'
});
```

## WAAPI

```javascript
import { waapi } from 'animejs';

waapi.animate('.tile', {
  x: '17rem',
  loop: 3,
  alternate: true,
  ease: 'out(2)',
  duration: 700
}).then(() => {
  console.log('waapi done');
});
```

`waapi.convertEase()` converts JS easing to WAAPI-compatible `linear(...)`.

## React Pattern

```jsx
import { useEffect, useRef } from 'react';
import { animate, createScope } from 'animejs';

export function Demo() {
  const root = useRef(null);
  const scope = useRef(null);

  useEffect(() => {
    scope.current = createScope({ root }).add(() => {
      animate('.card', {
        y: -12,
        alternate: true,
        loop: true,
        ease: 'inOut(2)'
      });
    });

    return () => scope.current?.revert();
  }, []);

  return <div ref={root}><div className="card" /></div>;
}
```

## v3 -> v4 Cheatsheet

- `anime({ targets })` -> `animate(targets, params)`
- `easing` -> `ease`
- `endDelay` -> `loopDelay`
- `direction: 'reverse'` -> `reversed: true`
- `direction: 'alternate'` -> `alternate: true`
- `timeline()` -> `createTimeline()`
- `finished` / `promise` usage -> `then()` / `await animation`
- `begin/update/complete` -> `onBegin/onUpdate/onComplete`
- `change` -> `onRender`
- `loopBegin + loopComplete` -> `onLoop`
