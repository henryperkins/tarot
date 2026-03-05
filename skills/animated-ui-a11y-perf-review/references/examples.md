# Examples

## Example 1: JS Animation Storm (Bad -> Good)

Bad pattern:

```js
ref={(node) => {
  animate(node, { opacity: [0, 1], translateY: [8, 0], duration: 280 });
}}
```

Good pattern:

```js
const isNewWord = idx >= revealWindowStart && idx < visibleCount && streamingActive && !prefersReducedMotion;
<span className={isNewWord ? 'narrative-word-reveal' : ''}>{word}</span>
```

## Example 2: Loading Strategy for Spread Cards

Bad pattern:

```jsx
<img loading="eager" ... />
```

Good pattern:

```jsx
<img loading={isNext || isRevealed ? 'eager' : 'lazy'} ... />
```

## Example 3: Live Region Semantics

Bad pattern:

```jsx
<div className="interlude">Generating...</div>
```

Good pattern:

```jsx
<div role="status" aria-live="polite" aria-label="Generating your personalized reading">...</div>
```

## Example 4: Finding Writeup

- `P2` - `src/components/StreamingNarrative.jsx:500`
- Per-word JS animation can saturate main thread for long responses.
- Replace with CSS reveal class and bounded chunk progression.
- Validate with cinematic tests and E2E flow.