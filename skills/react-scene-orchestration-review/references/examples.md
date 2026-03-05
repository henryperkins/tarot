# Examples

## Example 1: Render-Time State Update (Bad -> Good)

Bad pattern:

```js
if (sceneState.currentScene !== candidateScene) {
  setSceneState({ currentScene: candidateScene });
}
```

Good pattern:

```js
useEffect(() => {
  if (sceneState.currentScene !== candidateScene) {
    setSceneState({
      currentScene: candidateScene,
      transitionMeta: defaultTransitionMeta(sceneState.currentScene, candidateScene, 'derived')
    });
  }
}, [candidateScene, sceneState.currentScene]);
```

## Example 2: Collection Type Guard for Scene Progress

Bad pattern:

```js
const revealedCount = Array.isArray(revealedCards) ? revealedCards.length : 0;
```

Good pattern:

```js
let revealedCount = 0;
if (revealedCards instanceof Set) revealedCount = revealedCards.size;
else if (Array.isArray(revealedCards)) revealedCount = revealedCards.length;
else if (typeof revealedCards?.size === 'number') revealedCount = revealedCards.size;
```

## Example 3: Finding Writeup

- `P1` - `src/hooks/useSceneOrchestrator.js:240`
- Render-time scene sync can trigger loop behavior under StrictMode when `candidateScene` oscillates.
- Move state sync into effect and add dependency-safe metadata derivation.
- Validate with `node --test tests/sceneOrchestrator.test.mjs`.