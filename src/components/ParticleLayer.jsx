import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { useReducedMotion } from '../hooks/useReducedMotion';

const SUIT_COLOR_META = {
  wands: { cssVar: '--color-wands', fallback: 'rgb(201 168 118)' },
  cups: { cssVar: '--color-cups', fallback: 'rgb(139 149 165)' },
  swords: { cssVar: '--color-swords', fallback: 'rgb(107 114 128)' },
  pentacles: { cssVar: '--color-pentacles', fallback: 'rgb(138 153 133)' },
  major: { cssVar: '--brand-primary', fallback: 'rgb(212 184 150)' }
};

const ELEMENT_TO_SUIT = {
  fire: 'wands',
  water: 'cups',
  air: 'swords',
  earth: 'pentacles',
  spirit: 'major'
};

const PRESET_COUNTS = {
  idle: 24,
  shuffle: 46,
  'deal-trail': 52,
  'reveal-burst': 70,
  'element-ambient': 30,
  'narrative-glow': 28
};

let particlesInitialized = false;

function resolveSuitColor(suitKey) {
  const meta = SUIT_COLOR_META[suitKey] || SUIT_COLOR_META.major;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return meta.fallback;
  }
  const tokenValue = getComputedStyle(document.documentElement).getPropertyValue(meta.cssVar).trim();
  return tokenValue || meta.fallback;
}

function resolveColor({ suit, element, fallback = 'major' }) {
  const normalizedSuit = typeof suit === 'string' ? suit.toLowerCase() : '';
  const normalizedElement = typeof element === 'string' ? element.toLowerCase() : '';
  const resolvedSuitKey = SUIT_COLOR_META[normalizedSuit]
    ? normalizedSuit
    : ELEMENT_TO_SUIT[normalizedElement] || fallback;
  return resolveSuitColor(resolvedSuitKey);
}

function getPresetConfig({ preset, color, reducedMotion, intensity = 1 }) {
  const safeIntensity = Number.isFinite(intensity) ? Math.max(0.2, Math.min(2.2, intensity)) : 1;
  const baseCount = PRESET_COUNTS[preset] || PRESET_COUNTS.idle;
  const reducedFactor = reducedMotion ? 0 : 1;
  const count = Math.max(0, Math.round(baseCount * safeIntensity * reducedFactor));

  if (count === 0) return null;

  const shared = {
    fullScreen: { enable: false, zIndex: 0 },
    fpsLimit: reducedMotion ? 30 : 60,
    detectRetina: true,
    background: { color: 'transparent' },
    interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
    particles: {
      number: { value: count, density: { enable: true, area: 1000 } },
      color: { value: color },
      links: { enable: false },
      opacity: { value: { min: 0.12, max: 0.55 } },
      move: {
        enable: true,
        speed: 0.4,
        random: true,
        direction: 'none',
        outModes: { default: 'out' }
      },
      size: { value: { min: 1, max: 3 } },
      shape: { type: 'circle' },
      life: { duration: { sync: false, value: reducedMotion ? 2 : 4 }, count: 0 }
    }
  };

  if (preset === 'shuffle') {
    shared.particles.move.speed = reducedMotion ? 0.6 : 1.8;
    shared.particles.opacity.value = { min: 0.2, max: 0.75 };
    shared.particles.size.value = { min: 1, max: 4 };
  }

  if (preset === 'deal-trail') {
    shared.particles.move.speed = reducedMotion ? 0.45 : 1.4;
    shared.particles.shape.type = ['circle', 'star'];
    shared.particles.size.value = { min: 1, max: 2.5 };
    shared.particles.opacity.value = { min: 0.14, max: 0.65 };
  }

  if (preset === 'reveal-burst') {
    shared.particles.move.speed = reducedMotion ? 0.7 : 2.4;
    shared.particles.shape.type = ['circle', 'triangle', 'star'];
    shared.particles.size.value = { min: 1, max: 4.2 };
    shared.particles.opacity.value = { min: 0.22, max: 0.85 };
  }

  if (preset === 'element-ambient') {
    shared.particles.move.speed = reducedMotion ? 0.2 : 0.55;
    shared.particles.links = {
      enable: !reducedMotion,
      distance: 130,
      color,
      opacity: 0.18,
      width: 1
    };
    shared.particles.size.value = { min: 1, max: 2 };
    shared.particles.opacity.value = { min: 0.1, max: 0.4 };
  }

  if (preset === 'narrative-glow') {
    shared.particles.move.speed = reducedMotion ? 0.16 : 0.4;
    shared.particles.shape.type = ['circle'];
    shared.particles.size.value = { min: 2, max: 5 };
    shared.particles.opacity.value = { min: 0.08, max: 0.26 };
  }

  return shared;
}

export function ParticleLayer({
  preset = 'idle',
  suit = null,
  element = null,
  intensity = 1,
  className = '',
  zIndex = 1,
  id = 'scene-particles'
}) {
  const prefersReducedMotion = useReducedMotion();
  const [ready, setReady] = useState(particlesInitialized);

  useEffect(() => {
    if (particlesInitialized) return;
    let mounted = true;
    void initParticlesEngine(async (engine) => {
      await loadSlim(engine);
      particlesInitialized = true;
      if (mounted) {
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const color = useMemo(() => resolveColor({ suit, element }), [suit, element]);
  const options = useMemo(
    () => getPresetConfig({ preset, color, reducedMotion: prefersReducedMotion, intensity }),
    [preset, color, prefersReducedMotion, intensity]
  );

  if (!ready || !options) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ zIndex }}
      aria-hidden="true"
    >
      <Particles id={id} options={options} />
    </div>
  );
}

export default ParticleLayer;
