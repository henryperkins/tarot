import { useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * Scene Orchestrator Hook
 * 
 * Provides a unified state machine interface for the tarot reading flow.
 * Maps existing boolean flags to explicit scene states for better orchestration.
 * 
 * Scene Flow:
 * IDLE → SHUFFLING → DRAWING → REVEALING → INTERLUDE → DELIVERY → COMPLETE
 */

const SCENES = {
  IDLE: 'idle',
  SHUFFLING: 'shuffling',
  DRAWING: 'drawing',
  REVEALING: 'revealing',
  INTERLUDE: 'interlude',
  DELIVERY: 'delivery',
  COMPLETE: 'complete'
};

export function useSceneOrchestrator({
  isShuffling,
  hasConfirmedSpread,
  revealedCards,
  totalCards,
  isGenerating,
  isReadingStreamActive,
  personalReading,
  reading
}) {
  const prevSceneRef = useRef(SCENES.IDLE);
  const sceneTransitionCallbacksRef = useRef([]);

  // Derive current scene from existing state
  const currentScene = useMemo(() => {
    // If shuffling/dealing animation is active
    if (isShuffling) {
      return SCENES.SHUFFLING;
    }

    // If spread confirmed but not all cards revealed yet
    if (hasConfirmedSpread && reading?.length > 0) {
      let revealedCount = 0;
      if (revealedCards instanceof Set) {
        revealedCount = revealedCards.size;
      } else if (Array.isArray(revealedCards)) {
        revealedCount = revealedCards.length;
      } else if (typeof revealedCards?.size === 'number') {
        revealedCount = revealedCards.size;
      }
      const total = totalCards || reading.length;

      if (revealedCount < total) {
        return SCENES.DRAWING;
      }

      // All cards revealed, check if we're generating narrative
      if (revealedCount >= total) {
        if (isReadingStreamActive || personalReading?.isStreaming) {
          return SCENES.DELIVERY;
        }

        if (isGenerating) {
          return SCENES.INTERLUDE;
        }

        if (personalReading) {
          return SCENES.COMPLETE;
        }

        // Cards revealed, awaiting narrative request
        return SCENES.REVEALING;
      }
    }

    // Reading complete
    if (personalReading && !isGenerating && reading?.length > 0) {
      return SCENES.COMPLETE;
    }

    // Default idle state
    return SCENES.IDLE;
  }, [isShuffling, hasConfirmedSpread, revealedCards, totalCards, isGenerating, isReadingStreamActive, personalReading, reading]);

  // Track scene transitions and trigger callbacks
  useEffect(() => {
    const prevScene = prevSceneRef.current;
    if (prevScene !== currentScene) {
      prevSceneRef.current = currentScene;

      // Execute transition callbacks
      sceneTransitionCallbacksRef.current.forEach(callback => {
        try {
          callback(prevScene, currentScene);
        } catch (err) {
          console.error('Scene transition callback error:', err);
        }
      });
    }
  }, [currentScene]);

  // Register callback for scene transitions
  const onSceneTransition = useCallback((callback) => {
    if (typeof callback !== 'function') return;

    sceneTransitionCallbacksRef.current.push(callback);

    // Return cleanup function
    return () => {
      sceneTransitionCallbacksRef.current = sceneTransitionCallbacksRef.current.filter(
        cb => cb !== callback
      );
    };
  }, []);

  // Helper to check if we're in a specific scene
  const isScene = useCallback((scene) => currentScene === scene, [currentScene]);

  // Helper to check if we're past a specific scene
  const isPastScene = useCallback((scene) => {
    const sceneOrder = Object.values(SCENES);
    const currentIndex = sceneOrder.indexOf(currentScene);
    const targetIndex = sceneOrder.indexOf(scene);
    return currentIndex > targetIndex;
  }, [currentScene]);

  // Prefetch trigger point - when entering REVEALING scene
  const shouldPrefetchAssets = useMemo(() => {
    return currentScene === SCENES.REVEALING;
  }, [currentScene]);

  // Interlude active - show atmospheric content instead of loading spinner
  const shouldShowInterlude = useMemo(() => {
    return currentScene === SCENES.INTERLUDE;
  }, [currentScene]);

  return {
    currentScene,
    scenes: SCENES,
    isScene,
    isPastScene,
    onSceneTransition,
    shouldPrefetchAssets,
    shouldShowInterlude
  };
}
