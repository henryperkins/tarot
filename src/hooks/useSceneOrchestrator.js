import { useMemo, useCallback, useEffect, useRef, useState } from 'react';

const LEGACY_SCENES = {
  IDLE: 'idle',
  SHUFFLING: 'shuffling',
  DRAWING: 'drawing',
  REVEALING: 'revealing',
  INTERLUDE: 'interlude',
  DELIVERY: 'delivery',
  COMPLETE: 'complete'
};

const CANONICAL_SCENES = {
  IDLE: 'idle',
  RITUAL: 'ritual',
  REVEAL: 'reveal',
  INTERLUDE: 'interlude',
  NARRATIVE: 'narrative',
  COMPLETE: 'complete'
};

const CANONICAL_ORDER = [
  CANONICAL_SCENES.IDLE,
  CANONICAL_SCENES.RITUAL,
  CANONICAL_SCENES.REVEAL,
  CANONICAL_SCENES.INTERLUDE,
  CANONICAL_SCENES.NARRATIVE,
  CANONICAL_SCENES.COMPLETE
];

const LEGACY_BY_CANONICAL = {
  [CANONICAL_SCENES.IDLE]: LEGACY_SCENES.IDLE,
  [CANONICAL_SCENES.RITUAL]: LEGACY_SCENES.SHUFFLING,
  [CANONICAL_SCENES.REVEAL]: LEGACY_SCENES.REVEALING,
  [CANONICAL_SCENES.INTERLUDE]: LEGACY_SCENES.INTERLUDE,
  [CANONICAL_SCENES.NARRATIVE]: LEGACY_SCENES.DELIVERY,
  [CANONICAL_SCENES.COMPLETE]: LEGACY_SCENES.COMPLETE
};

const CANONICAL_BY_LEGACY = {
  [LEGACY_SCENES.IDLE]: CANONICAL_SCENES.IDLE,
  [LEGACY_SCENES.SHUFFLING]: CANONICAL_SCENES.RITUAL,
  [LEGACY_SCENES.DRAWING]: CANONICAL_SCENES.REVEAL,
  [LEGACY_SCENES.REVEALING]: CANONICAL_SCENES.REVEAL,
  [LEGACY_SCENES.INTERLUDE]: CANONICAL_SCENES.INTERLUDE,
  [LEGACY_SCENES.DELIVERY]: CANONICAL_SCENES.NARRATIVE,
  [LEGACY_SCENES.COMPLETE]: CANONICAL_SCENES.COMPLETE
};

function normalizeLegacyScene(scene) {
  if (!scene) return LEGACY_SCENES.IDLE;
  const normalized = String(scene).toLowerCase();
  if (LEGACY_SCENES[normalized?.toUpperCase?.()]) {
    return LEGACY_SCENES[normalized.toUpperCase()];
  }
  if (Object.values(LEGACY_SCENES).includes(normalized)) {
    return normalized;
  }
  if (Object.values(CANONICAL_SCENES).includes(normalized)) {
    return LEGACY_BY_CANONICAL[normalized] || LEGACY_SCENES.IDLE;
  }
  return LEGACY_SCENES.IDLE;
}

function toCanonical(scene) {
  const legacy = normalizeLegacyScene(scene);
  return CANONICAL_BY_LEGACY[legacy] || CANONICAL_SCENES.IDLE;
}

function extractReadingText(personalReading) {
  if (!personalReading) return '';
  if (typeof personalReading === 'string') return personalReading;
<<<<<<< Updated upstream
  if (typeof personalReading?.raw === 'string' && personalReading.raw.trim()) return personalReading.raw;
  if (typeof personalReading?.normalized === 'string' && personalReading.normalized.trim()) return personalReading.normalized;
=======

  const directTextFields = [
    personalReading?.raw,
    personalReading?.normalized,
    personalReading?.tts,
    personalReading?.text,
    personalReading?.content
  ];

  for (const field of directTextFields) {
    if (typeof field === 'string' && field.trim()) {
      return field;
    }
  }

  if (Array.isArray(personalReading?.paragraphs)) {
    const paragraphText = personalReading.paragraphs
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join('\n\n');

    if (paragraphText) {
      return paragraphText;
    }
  }

>>>>>>> Stashed changes
  return '';
}

function defaultTransitionMeta(fromLegacy, toLegacy, reason = 'derived') {
  const from = toCanonical(fromLegacy);
  const to = toCanonical(toLegacy);
  const fromIndex = CANONICAL_ORDER.indexOf(from);
  const toIndex = CANONICAL_ORDER.indexOf(to);
  const direction = toIndex >= fromIndex ? 'forward' : 'backward';

  let particlePreset = 'idle';
  if (to === CANONICAL_SCENES.RITUAL) particlePreset = 'shuffle';
  if (to === CANONICAL_SCENES.REVEAL) particlePreset = 'deal-trail';
  if (to === CANONICAL_SCENES.INTERLUDE) particlePreset = 'element-ambient';
  if (to === CANONICAL_SCENES.NARRATIVE) particlePreset = 'narrative-glow';
  if (to === CANONICAL_SCENES.COMPLETE) particlePreset = 'idle';

  return {
    from,
    to,
    direction,
    duration: 400,
    particlePreset,
    reason,
    at: Date.now()
  };
}

export function deriveLegacyScene({
  isShuffling,
  hasConfirmedSpread,
  revealedCards,
  totalCards,
  isGenerating,
  isReadingStreamActive,
  personalReading,
  reading
}) {
  const readingText = extractReadingText(personalReading).trim();
  const hasReadingText = readingText.length > 0;
  const hasStreamingReading = Boolean(isReadingStreamActive || personalReading?.isStreaming);

  if (isShuffling) {
    return LEGACY_SCENES.SHUFFLING;
  }

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
    if (revealedCount === 0) {
      return LEGACY_SCENES.SHUFFLING;
    }

    if (revealedCount < total) {
      return LEGACY_SCENES.DRAWING;
    }

    if (revealedCount >= total) {
      // Keep interlude skeleton visible until at least one chunk has rendered.
      if (hasStreamingReading && !hasReadingText) {
        return LEGACY_SCENES.INTERLUDE;
      }

      if (hasStreamingReading) {
        return LEGACY_SCENES.DELIVERY;
      }

      if (isGenerating) {
        return LEGACY_SCENES.INTERLUDE;
      }

      if (personalReading) {
        return LEGACY_SCENES.COMPLETE;
      }

      return LEGACY_SCENES.REVEALING;
    }
  }

  if (personalReading && !isGenerating && reading?.length > 0) {
    return LEGACY_SCENES.COMPLETE;
  }

  return LEGACY_SCENES.IDLE;
}

/**
 * Scene orchestrator with both:
 * - legacy derived scene values (`currentScene`) for backward compatibility
 * - canonical scene key (`activeScene`) for new scene-shell composition
 */
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
  const transitionCallbacksRef = useRef([]);
  const prevSceneRef = useRef(LEGACY_SCENES.IDLE);
  const [manualScene, setManualScene] = useState(null);

  const derivedScene = useMemo(() => deriveLegacyScene({
    isShuffling,
    hasConfirmedSpread,
    revealedCards,
    totalCards,
    isGenerating,
    isReadingStreamActive,
    personalReading,
    reading
  }), [
    isShuffling,
    hasConfirmedSpread,
    revealedCards,
    totalCards,
    isGenerating,
    isReadingStreamActive,
    personalReading,
    reading
  ]);

  const candidateScene = manualScene && manualScene !== derivedScene ? manualScene : derivedScene;
  const [sceneState, setSceneState] = useState(() => ({
    currentScene: candidateScene,
    transitionMeta: defaultTransitionMeta(LEGACY_SCENES.IDLE, candidateScene, 'init')
  }));

  // Sync external scene changes - moved to effect to prevent render-time state updates
  useEffect(() => {
    if (sceneState.currentScene !== candidateScene) {
      setSceneState({
        currentScene: candidateScene,
        transitionMeta: defaultTransitionMeta(sceneState.currentScene, candidateScene, 'derived')
      });
    }
  }, [candidateScene, sceneState.currentScene]);

  const currentScene = sceneState.currentScene;
  const transitionMeta = sceneState.transitionMeta;
  const activeScene = toCanonical(currentScene);

  useEffect(() => {
    const prevScene = prevSceneRef.current;
    if (prevScene === currentScene) return;

    prevSceneRef.current = currentScene;

    transitionCallbacksRef.current.forEach((callback) => {
      try {
        callback(prevScene, currentScene, transitionMeta);
      } catch (err) {
        console.error('Scene transition callback error:', err);
      }
    });
  }, [currentScene, transitionMeta]);

  const transitionTo = useCallback((scene, options = {}) => {
    const resolvedLegacy = normalizeLegacyScene(scene);
    const baseMeta = defaultTransitionMeta(currentScene, resolvedLegacy, options.reason || 'manual');
    const meta = {
      ...baseMeta,
      direction: options.direction || baseMeta.direction,
      duration: Number.isFinite(options.duration) ? options.duration : 400,
      particlePreset: options.particlePreset || baseMeta.particlePreset,
      from: toCanonical(currentScene),
      to: toCanonical(resolvedLegacy),
      at: Date.now()
    };

    setManualScene(resolvedLegacy);
    setSceneState({
      currentScene: resolvedLegacy,
      transitionMeta: meta
    });
  }, [currentScene]);

  const dispatch = useCallback((action = {}) => {
    const type = action?.type;
    if (type === 'RESET') {
      setManualScene(null);
      if (currentScene !== derivedScene) {
        setSceneState({
          currentScene: derivedScene,
          transitionMeta: defaultTransitionMeta(currentScene, derivedScene, 'reset')
        });
      }
      return;
    }

    if (type === 'TRANSITION' && action?.scene) {
      transitionTo(action.scene, {
        reason: action.reason || 'dispatch',
        duration: action.duration,
        direction: action.direction,
        particlePreset: action.particlePreset
      });
      return;
    }

    if (type === 'ADVANCE') {
      const currentCanonical = toCanonical(currentScene);
      const targetCanonical = action?.scene && Object.values(CANONICAL_SCENES).includes(action.scene)
        ? action.scene
        : null;
      const currentIndex = CANONICAL_ORDER.indexOf(currentCanonical);
      const fallbackIndex = currentIndex >= 0 ? Math.min(CANONICAL_ORDER.length - 1, currentIndex + 1) : 1;
      const nextCanonical = targetCanonical || CANONICAL_ORDER[fallbackIndex];
      transitionTo(LEGACY_BY_CANONICAL[nextCanonical] || LEGACY_SCENES.IDLE, {
        reason: action.reason || 'advance',
        duration: action.duration,
        direction: action.direction,
        particlePreset: action.particlePreset
      });
    }
  }, [currentScene, derivedScene, transitionTo]);

  const onSceneTransition = useCallback((callback) => {
    if (typeof callback !== 'function') return undefined;
    transitionCallbacksRef.current.push(callback);
    return () => {
      transitionCallbacksRef.current = transitionCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  const isScene = useCallback((scene) => {
    const normalized = normalizeLegacyScene(scene);
    return currentScene === normalized || activeScene === String(scene).toLowerCase();
  }, [activeScene, currentScene]);

  const isPastScene = useCallback((scene) => {
    const targetCanonical = toCanonical(scene);
    const currentIndex = CANONICAL_ORDER.indexOf(activeScene);
    const targetIndex = CANONICAL_ORDER.indexOf(targetCanonical);
    return currentIndex > targetIndex;
  }, [activeScene]);

  const shouldPrefetchAssets = useMemo(() => {
    return activeScene === CANONICAL_SCENES.REVEAL || activeScene === CANONICAL_SCENES.NARRATIVE;
  }, [activeScene]);

  const shouldShowInterlude = useMemo(() => {
    return activeScene === CANONICAL_SCENES.INTERLUDE;
  }, [activeScene]);

  return {
    currentScene,
    derivedScene,
    activeScene,
    scenes: {
      ...LEGACY_SCENES,
      ...CANONICAL_SCENES
    },
    transitionMeta,
    transitionTo,
    dispatch,
    isScene,
    isPastScene,
    onSceneTransition,
    shouldPrefetchAssets,
    shouldShowInterlude
  };
}
