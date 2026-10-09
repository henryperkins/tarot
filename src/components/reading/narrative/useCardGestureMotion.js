import { useEffect, useRef } from 'react';

const recipesFor = gesture => gesture?.motionRecipes || (gesture?.details || []).map(detail => detail.motionRecipe).filter(Boolean);

/** Owns only this presentation's handles. Source scheduling remains in the provider. */
export function createCardGestureMotionController({ startFinite = () => [], getWaterAnimations = () => [], requestFrame = cb => globalThis.requestAnimationFrame?.(cb), cancelFrame = id => globalThis.cancelAnimationFrame?.(id), now = () => performance.now(), setWaterOpacity = () => {} } = {}) {
  let disposed = false, frame, finite = [], identity, finiteStarted = false, finiteAt, settlingAt, settled = false, current;
  const water = new Set();
  const stopFinite = () => { finite.forEach(handle => { handle.cancel?.(); handle.stop?.(); }); finite = []; finiteAt = undefined; };
  const collect = () => { (getWaterAnimations() || []).forEach(handle => water.add(handle)); return [...water]; };
  const cancelTick = () => { if (frame !== undefined) cancelFrame(frame); frame = undefined; };
  const stop = () => { cancelTick(); stopFinite(); collect().forEach(handle => handle.pause?.()); water.clear(); settlingAt = undefined; setWaterOpacity(0); };
  const tick = () => {
    frame = undefined;
    if (disposed || !current) return;
    const time = now();
    if (finiteAt !== undefined && time - finiteAt >= 1800) stopFinite();
    if (settlingAt !== undefined) {
      const progress = Math.min(1, Math.max(0, (time - settlingAt) / 1500));
      const rate = (1 - progress) ** 2;
      collect().forEach(handle => { handle.playbackRate = rate; if (progress === 1) handle.pause?.(); });
      setWaterOpacity(rate);
      if (progress === 1) { settlingAt = undefined; settled = true; }
    }
    if (finiteAt !== undefined || settlingAt !== undefined) frame = requestFrame(tick);
  };
  return {
    sync(next) {
      if (disposed) return;
      const nextIdentity = next.gesture?.associationId ?? next.gesture?.id ?? JSON.stringify(recipesFor(next.gesture));
      if (nextIdentity !== identity) { if (identity !== undefined) stop(); identity = nextIdentity; finiteStarted = false; settled = false; }
      current = next;
      const recipes = recipesFor(next.gesture);
      if (!next.canMove || next.reducedMotion || !['active', 'held', 'settling'].includes(next.phase) || !recipes.length) { stop(); return; }
      if (next.phase === 'settling') {
        if (settled) collect().forEach(handle => { handle.playbackRate = 0; handle.pause?.(); });
        if (!settled && settlingAt === undefined && water.size) settlingAt = now();
      } else {
        settlingAt = undefined; settled = false;
        if (recipes.some(recipe => recipe.kind === 'water')) { collect().forEach(handle => { handle.playbackRate = 1; handle.play?.(); }); setWaterOpacity(1); }
        if (!finiteStarted && recipes.some(recipe => recipe.kind === 'finite')) { finiteStarted = true; finite = startFinite(recipes) || []; finiteAt = finite.length ? now() : undefined; }
      }
      cancelTick();
      if (finiteAt !== undefined || settlingAt !== undefined) frame = requestFrame(tick);
    },
    dispose() { if (disposed) return; stop(); disposed = true; current = undefined; }
  };
}

export function useCardGestureMotion({ elementRef, runId, sourceRevision, associationId, gesture, phase, reducedMotion, canMove }) {
  const controllerRef = useRef();
  useEffect(() => {
    const root = elementRef.current;
    const controller = createCardGestureMotionController({
      getWaterAnimations: () => [...(root?.querySelectorAll('[data-gesture-water]') || [])].flatMap(element => element.getAnimations?.() || []),
      setWaterOpacity: value => root?.style.setProperty('--gesture-water-opacity', String(value)),
      startFinite: () => [...(root?.querySelectorAll('[data-gesture-finite]') || [])].flatMap(element => element.animate ? [element.animate([{ opacity: 0, strokeDashoffset: 70 }, { opacity: .85, offset: .35 }, { opacity: 0, strokeDashoffset: 0 }], { duration: 1800, easing: 'ease-out', iterations: 1 })] : [])
    });
    controllerRef.current = controller;
    return () => { controller.dispose(); controllerRef.current = undefined; };
  }, [elementRef, runId]);
  useEffect(() => { controllerRef.current?.sync({ gesture: { ...gesture, associationId }, phase, canMove, reducedMotion }); }, [gesture, associationId, phase, canMove, reducedMotion, sourceRevision, runId]);
}
