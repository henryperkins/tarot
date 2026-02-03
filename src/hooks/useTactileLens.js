import { useState, useCallback, useRef, useEffect } from 'react';
import { useHaptic } from './useHaptic';

const LENS_TUTORIAL_KEY = 'tableu_lens_tutorial_shown';
const TUTORIAL_AUTO_TRIGGER_DELAY = 2500;
const TUTORIAL_AUTO_DISMISS_DELAY = 1800;

/**
 * useTactileLens
 * Manages the press-and-hold "Tactile Lens" interaction for viewing
 * position meanings without modal interruption.
 *
 * Features:
 * - Press-and-hold to activate lens overlay
 * - Continuous haptic buzz while active
 * - First-time micro-tutorial with auto-trigger
 *
 * @param {Object} options
 * @param {boolean} options.disabled - Force-disable lens
 * @returns {{
 *   isActive: boolean,
 *   showTutorial: boolean,
 *   handlePointerDown: () => void,
 *   handlePointerUp: () => void,
 *   handlePointerLeave: () => void,
 *   dismissTutorial: () => void
 * }}
 */
export function useTactileLens({ disabled = false } = {}) {
  const [isActive, setIsActive] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { startContinuous, stopContinuous, vibrateType } = useHaptic();
  const tutorialShownRef = useRef(false);
  const tutorialTimerRef = useRef(null);
  const autoTriggerTimerRef = useRef(null);

  // Check if tutorial has been shown before
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasShown = localStorage.getItem(LENS_TUTORIAL_KEY) === 'true';
    tutorialShownRef.current = hasShown;

    // Auto-trigger tutorial for first-time users
    if (!hasShown && !disabled) {
      autoTriggerTimerRef.current = setTimeout(() => {
        setShowTutorial(true);
        vibrateType('hold');

        // Auto-dismiss after showing
        tutorialTimerRef.current = setTimeout(() => {
          setShowTutorial(false);
          localStorage.setItem(LENS_TUTORIAL_KEY, 'true');
          tutorialShownRef.current = true;
        }, TUTORIAL_AUTO_DISMISS_DELAY);
      }, TUTORIAL_AUTO_TRIGGER_DELAY);
    }

    return () => {
      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
      if (autoTriggerTimerRef.current) clearTimeout(autoTriggerTimerRef.current);
    };
  }, [disabled, vibrateType]);

  const activate = useCallback(() => {
    if (disabled) return;
    setIsActive(true);
    startContinuous(350, 12);

    // Mark tutorial as shown on first activation
    if (!tutorialShownRef.current) {
      localStorage.setItem(LENS_TUTORIAL_KEY, 'true');
      tutorialShownRef.current = true;
      setShowTutorial(false);
      if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
      if (autoTriggerTimerRef.current) clearTimeout(autoTriggerTimerRef.current);
    }
  }, [disabled, startContinuous]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    stopContinuous();
  }, [stopContinuous]);

  const handlePointerDown = useCallback(() => {
    activate();
  }, [activate]);

  const handlePointerUp = useCallback(() => {
    deactivate();
  }, [deactivate]);

  const handlePointerLeave = useCallback(() => {
    if (isActive) {
      deactivate();
    }
  }, [isActive, deactivate]);

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(LENS_TUTORIAL_KEY, 'true');
    tutorialShownRef.current = true;
    if (tutorialTimerRef.current) clearTimeout(tutorialTimerRef.current);
    if (autoTriggerTimerRef.current) clearTimeout(autoTriggerTimerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuous();
    };
  }, [stopContinuous]);

  return {
    isActive,
    showTutorial,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
    dismissTutorial
  };
}
