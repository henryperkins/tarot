import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { useReducedMotion } from '../hooks/useReducedMotion';

const SUIT_COLORS = {
  wands: '#d79a2b',
  cups: '#22b7d8',
  swords: '#c0c7d3',
  pentacles: '#2eb875',
  major: '#f2c14e'
};

const ELEMENT_COLORS = {
  fire: SUIT_COLORS.wands,
  water: SUIT_COLORS.cups,
  air: SUIT_COLORS.swords,
  earth: SUIT_COLORS.pentacles,
  spirit: SUIT_COLORS.major
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

function resolveColor({ suit, element, fallback = SUIT_COLORS.major }) {
  const normalizedSuit = typeof suit === 'string' ? suit.toLowerCase() : '';
  const normalizedElement = typeof element === 'string' ? element.toLowerCase() : '';
  return SUIT_COLORS[normalizedSuit] || ELEMENT_COLORS[normalizedElement] || fallback;
}

function getPresetConfig({ preset, color, reducedMotion, intensity = 1 }) {
  const safeIntensity = Number.isFinite(intensity) ? Math.max(0.2, Math.min(2.2, intensity)) : 1;
  const baseCount = PRESET_COUNTS[preset] || PRESET_COUNTS.idle;
  const reducedFactor = reducedMotion ? 0.2 : 1;
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

