import { useEffect, useMemo } from 'react';
import { cinematicSoundManager } from '../lib/SoundManager';
import { useReducedMotion } from './useReducedMotion';

export function useSounds() {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    cinematicSoundManager.setReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion]);

  useEffect(() => {
    void cinematicSoundManager.preload();
  }, []);

  return useMemo(() => ({
    preload: () => cinematicSoundManager.preload(),
    play: (name, opts) => cinematicSoundManager.play(name, opts),
    stop: (name) => cinematicSoundManager.stop(name),
    setVolume: (value) => cinematicSoundManager.setVolume(value),
    mute: (value = true) => cinematicSoundManager.mute(value)
  }), []);
}

