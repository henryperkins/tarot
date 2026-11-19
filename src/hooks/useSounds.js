import { useEffect, useMemo } from 'react';
import { cinematicSoundManager } from '../lib/SoundManager';
import { canPlayTableSounds, subscribeToAmbience } from '../lib/audio';
import { useReducedMotion } from './useReducedMotion';

// The cue player is loaded with the reading scenes. All cards share one
// subscription so a mute also cancels cues already playing or still loading.
if (typeof window !== 'undefined') {
  let enabled = canPlayTableSounds();
  cinematicSoundManager.mute(!enabled);
  const unsubscribe = subscribeToAmbience(() => {
    const next = canPlayTableSounds();
    if (next !== enabled) {
      enabled = next;
      cinematicSoundManager.mute(!enabled);
    }
  });
  if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribe(); cinematicSoundManager.mute(); });
}

export function useSounds() {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    cinematicSoundManager.setReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion]);

  return useMemo(() => ({
    preload: () => canPlayTableSounds() ? cinematicSoundManager.preload() : Promise.resolve(null),
    play: (name, opts) => cinematicSoundManager.play(name, opts),
    stop: (name) => cinematicSoundManager.stop(name),
    setVolume: (value) => cinematicSoundManager.setVolume(value),
    mute: (value = true) => cinematicSoundManager.mute(value || !canPlayTableSounds())
  }), []);
}

