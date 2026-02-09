import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { animate, set } from 'animejs';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSounds } from '../../hooks/useSounds';
import { applyColorScript, resetColorScript } from '../../lib/colorScript';
import { ParticleLayer } from '../ParticleLayer';

const SCENE_PARTICLE_FALLBACK = {
  idle: 'idle',
  ritual: 'shuffle',
  reveal: 'deal-trail',
  interlude: 'element-ambient',
  narrative: 'narrative-glow',
  complete: 'idle'
};

const SCENE_BACKDROP = {
  idle: {
    start: 'rgba(12, 10, 20, 0.94)',
    end: 'rgba(6, 5, 12, 0.97)',
    accentA: 'rgba(255, 214, 132, 0.12)',
    accentB: 'rgba(90, 152, 240, 0.09)'
  },
  ritual: {
    start: 'rgba(8, 8, 14, 0.96)',
    end: 'rgba(2, 2, 7, 0.98)',
    accentA: 'rgba(117, 171, 255, 0.14)',
    accentB: 'rgba(233, 199, 131, 0.1)'
  },
  reveal: {
    start: 'rgba(20, 11, 15, 0.93)',
    end: 'rgba(9, 5, 9, 0.98)',
    accentA: 'rgba(242, 193, 78, 0.14)',
    accentB: 'rgba(67, 165, 255, 0.1)'
  },
  interlude: {
    start: 'rgba(10, 16, 24, 0.95)',
    end: 'rgba(5, 9, 16, 0.99)',
    accentA: 'rgba(139, 205, 255, 0.12)',
    accentB: 'rgba(196, 171, 255, 0.12)'
  },
  narrative: {
    start: 'rgba(11, 13, 29, 0.94)',
    end: 'rgba(6, 7, 16, 0.98)',
    accentA: 'rgba(255, 220, 140, 0.16)',
    accentB: 'rgba(82, 148, 255, 0.12)'
  },
  complete: {
    start: 'rgba(20, 16, 8, 0.92)',
    end: 'rgba(10, 7, 4, 0.97)',
    accentA: 'rgba(255, 229, 146, 0.15)',
    accentB: 'rgba(146, 214, 183, 0.1)'
  }
};

const TRANSITION_PROFILES = {
  'ritual->reveal': {
    duration: 920,
    overlay: 'radial-gradient(circle at 50% 50%, rgba(9, 8, 14, 0.94), rgba(2, 1, 6, 0.98))'
  },
  'reveal->interlude': {
    duration: 980,
    overlay: 'linear-gradient(180deg, rgba(11, 13, 21, 0.92), rgba(6, 8, 13, 0.97))'
  },
  'interlude->narrative': {
    duration: 1060,
    overlay: 'linear-gradient(180deg, rgba(7, 9, 15, 0.95), rgba(8, 8, 16, 0.9))'
  },
  'narrative->complete': {
    duration: 860,
    overlay: 'radial-gradient(circle at 50% 50%, rgba(23, 16, 9, 0.9), rgba(8, 4, 2, 0.95))'
  }
};

const SceneContext = createContext({
  currentScene: 'idle',
  transitionTo: () => {},
  sceneData: {}
});

export function useScene() {
  return useContext(SceneContext);
}

export function SceneShell({
  orchestrator,
  scenes = {},
  sceneData = {},
  className = '',
  colorScript = null,
  colorScriptOwner = 'scene-shell',
  children = null
}) {
  const prefersReducedMotion = useReducedMotion();
  const sounds = useSounds();
  const activeScene = orchestrator?.activeScene || 'idle';
  const transitionMeta = orchestrator?.transitionMeta || null;
  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const transitionPrevSceneRef = useRef(activeScene);
  const soundPrevSceneRef = useRef(activeScene);
  const transitionAnimRef = useRef(null);

  const backdrop = SCENE_BACKDROP[activeScene] || SCENE_BACKDROP.idle;

  useEffect(() => {
    if (!colorScript) {
      resetColorScript({ owner: colorScriptOwner });
      return;
    }

    applyColorScript(colorScript, { owner: colorScriptOwner });
    return () => {
      resetColorScript({ owner: colorScriptOwner });
    };
  }, [colorScript, colorScriptOwner]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;
    const content = contentRef.current;
    const previousScene = transitionPrevSceneRef.current;
    const key = `${previousScene}->${activeScene}`;
    const profile = TRANSITION_PROFILES[key] || null;
    const duration = Number.isFinite(transitionMeta?.duration)
      ? transitionMeta.duration
      : profile?.duration || 560;

    if (transitionAnimRef.current?.pause) {
      transitionAnimRef.current.pause();
      transitionAnimRef.current = null;
    }

    if (previousScene === activeScene) {
      return undefined;
    }

    transitionPrevSceneRef.current = activeScene;

    overlay.style.background = profile?.overlay
      || 'radial-gradient(circle at 50% 50%, rgba(6, 4, 12, 0.75), rgba(2, 1, 6, 0.94))';

    if (prefersReducedMotion) {
      set(overlay, { opacity: 0 });
      if (content) {
        set(content, { opacity: 1, scale: 1 });
      }
      const fade = animate(overlay, {
        opacity: [0, 0.55, 0],
        duration: 200,
        ease: 'inOutQuad'
      });
      if (content) {
        animate(content, {
          opacity: [0.95, 1],
          duration: 200,
          ease: 'outQuad'
        });
      }
      transitionAnimRef.current = fade;
      return () => fade?.pause?.();
    }

    set(overlay, { opacity: 0 });
    if (content) {
      set(content, { opacity: 0.88, scale: 0.988 });
    }
    const fadeInDuration = Math.round(duration * 0.45);
    const fadeOutDuration = Math.max(120, duration - fadeInDuration);
    let chainedOverlay = null;
    let chainedContent = null;
    const enter = animate(overlay, {
      opacity: [0, 1],
      duration: fadeInDuration,
      ease: 'outQuad'
    });
    transitionAnimRef.current = enter;

    enter.then(() => {
      if (content) {
        chainedContent = animate(content, {
          opacity: [0.88, 1],
          scale: [0.988, 1],
          duration: fadeOutDuration,
          ease: 'outQuad'
        });
      }
      chainedOverlay = animate(overlay, {
        opacity: [1, 0],
        duration: fadeOutDuration,
        ease: 'inOutQuad'
      });
    });

    return () => {
      enter?.pause?.();
      chainedOverlay?.pause?.();
      chainedContent?.pause?.();
    };
  }, [activeScene, prefersReducedMotion, transitionMeta?.duration]);

  useEffect(() => {
    const previousScene = soundPrevSceneRef.current;
    if (previousScene === activeScene) return;

    soundPrevSceneRef.current = activeScene;

    void sounds.play('phase-transition', {
      essential: prefersReducedMotion,
      restart: true,
      volume: prefersReducedMotion ? 0.7 : 0.58
    });

    if (previousScene === 'ritual' && activeScene === 'reveal') {
      void sounds.play('reveal-bloom', { essential: true, volume: 0.72 });
    }
    if (activeScene === 'complete') {
      sounds.stop('narrative-ambient');
      void sounds.play('complete-chime', { essential: true, volume: 0.8 });
    }
  }, [activeScene, prefersReducedMotion, sounds]);

  useEffect(() => {
    const shouldPlayAmbient = activeScene === 'interlude' || activeScene === 'narrative';
    if (shouldPlayAmbient) {
      void sounds.play('narrative-ambient', {
        essential: false,
        loop: true,
        restart: false,
        volume: 0.32
      });
      return undefined;
    }

    sounds.stop('narrative-ambient');
    return undefined;
  }, [activeScene, sounds]);

  useEffect(() => {
    return () => {
      sounds.stop('narrative-ambient');
      if (transitionAnimRef.current?.pause) {
        transitionAnimRef.current.pause();
        transitionAnimRef.current = null;
      }
    };
  }, [sounds]);

  const ActiveScene = scenes[activeScene] || scenes.idle || null;
  const particlePreset = transitionMeta?.particlePreset
    || SCENE_PARTICLE_FALLBACK[activeScene]
    || 'idle';

  const sceneContext = useMemo(() => ({
    currentScene: activeScene,
    transitionTo: orchestrator?.transitionTo || (() => {}),
    dispatch: orchestrator?.dispatch || (() => {}),
    transitionMeta,
    sceneData
  }), [activeScene, orchestrator?.dispatch, orchestrator?.transitionTo, sceneData, transitionMeta]);

  return (
    <SceneContext.Provider value={sceneContext}>
      <div className={`relative overflow-hidden ${className}`}>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 18% 8%, ${backdrop.accentA}, transparent 45%),
              radial-gradient(circle at 82% 12%, ${backdrop.accentB}, transparent 45%),
              linear-gradient(155deg, var(--scene-bg-start, ${backdrop.start}), var(--scene-bg-end, ${backdrop.end}))
            `
          }}
          aria-hidden="true"
        />
        <div
          id="hero-bg"
          className="absolute inset-0 z-[0] pointer-events-none"
          aria-hidden="true"
        />
        <ParticleLayer
          id={`scene-shell-particles-${activeScene}`}
          preset={particlePreset}
          suit={sceneData?.dominantSuit}
          element={sceneData?.dominantElement}
          intensity={sceneData?.particleIntensity || 1}
          zIndex={1}
        />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            opacity: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(6, 4, 12, 0.75), rgba(2, 1, 6, 0.94))'
          }}
          aria-hidden="true"
        />
        <div ref={contentRef} className="relative z-[3]">
          {ActiveScene ? <ActiveScene sceneData={sceneData}>{children}</ActiveScene> : children}
        </div>
      </div>
    </SceneContext.Provider>
  );
}
