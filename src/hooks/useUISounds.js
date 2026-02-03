import { useCallback, useRef, useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * UI sound effect URLs (small, low-latency sounds)
 * Using Web Audio API tone generation for instant, lightweight feedback
 */
const SOUND_CONFIGS = {
  error: { frequency: 200, duration: 0.15, type: 'sine', volume: 0.3 },
  success: { frequency: 880, duration: 0.1, type: 'sine', volume: 0.25 },
  reveal: { frequency: 523.25, duration: 0.08, type: 'triangle', volume: 0.2 },
  completion: { frequencies: [523.25, 659.25, 783.99], duration: 0.12, type: 'sine', volume: 0.25 }
};

/**
 * useUISounds
 * Provides lightweight UI sound effects using Web Audio API.
 * Respects user preferences and reduced motion settings.
 *
 * @param {Object} options
 * @param {boolean} options.disabled - Force-disable sounds
 * @returns {{
 *   playSound: (type: 'error' | 'success' | 'reveal' | 'completion') => void,
 *   enabled: boolean
 * }}
 */
export function useUISounds({ disabled = false } = {}) {
  const prefersReducedMotion = useReducedMotion();
  const audioContextRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  // Initialize audio context on first user interaction
  useEffect(() => {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      return;
    }

    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          setEnabled(true);
        } catch (e) {
          console.debug('UI sounds unavailable:', e);
        }
      }
    };

    // Initialize on any user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, initAudioContext, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudioContext);
      });
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playTone = useCallback((config) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = config.type || 'sine';
      oscillator.frequency.value = config.frequency;

      gainNode.gain.setValueAtTime(config.volume || 0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration);
    } catch (e) {
      console.debug('Sound playback failed:', e);
    }
  }, []);

  const playChord = useCallback((config) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(config.volume || 0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration * config.frequencies.length);
      gainNode.connect(ctx.destination);

      config.frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        oscillator.type = config.type || 'sine';
        oscillator.frequency.value = freq;
        oscillator.connect(gainNode);

        const startTime = ctx.currentTime + i * config.duration * 0.8;
        oscillator.start(startTime);
        oscillator.stop(startTime + config.duration);
      });
    } catch (e) {
      console.debug('Chord playback failed:', e);
    }
  }, []);

  const playSound = useCallback((type) => {
    if (disabled || prefersReducedMotion || !enabled) return;

    const config = SOUND_CONFIGS[type];
    if (!config) return;

    if (config.frequencies) {
      playChord(config);
    } else {
      playTone(config);
    }
  }, [disabled, prefersReducedMotion, enabled, playTone, playChord]);

  return {
    playSound,
    enabled: enabled && !disabled && !prefersReducedMotion
  };
}
