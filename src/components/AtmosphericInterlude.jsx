import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, set } from 'animejs';
import { Sparkle } from '@phosphor-icons/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ParticleLayer } from './ParticleLayer';

const BREATH_PERIOD_MS = 4000;

function BreathingOrb({ prefersReducedMotion }) {
  const orbRef = useRef(null);

  useLayoutEffect(() => {
    const node = orbRef.current;
    if (!node) return undefined;

    if (prefersReducedMotion) {
      set(node, { scale: 1, opacity: 1 });
      return undefined;
    }

    const anim = animate(node, {
      scale: [1, 1.12, 1, 0.94, 1],
      opacity: [0.62, 0.82, 0.62, 0.56, 0.62],
      duration: BREATH_PERIOD_MS,
      loop: true,
      ease: 'inOutQuad'
    });

    return () => anim?.pause?.();
  }, [prefersReducedMotion]);

  return (
    <div ref={orbRef} className="relative w-32 h-32 mx-auto">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--brand-primary) 0%, transparent 70%)',
          filter: 'blur(20px)',
          opacity: 0.3
        }}
      />
      <div
        className="absolute inset-4 rounded-full border-2"
        style={{
          borderColor: 'var(--brand-primary)',
          background: 'radial-gradient(circle at 40% 40%, rgba(229, 196, 142, 0.3), transparent 60%)',
          boxShadow: '0 0 30px rgba(229, 196, 142, 0.4)'
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkle
          size={24}
          weight="duotone"
          style={{ color: 'var(--brand-primary)', opacity: 0.8 }}
        />
      </div>
    </div>
  );
}

function ShimmerSymbol({ symbol = '✦', delay = 0, prefersReducedMotion }) {
  const symbolRef = useRef(null);

  useLayoutEffect(() => {
    const node = symbolRef.current;
    if (!node) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: 0.7, scale: 1 });
      return undefined;
    }

    const anim = animate(node, {
      opacity: [0.28, 0.88, 0.28],
      scale: [0.95, 1.05, 0.95],
      duration: 2000,
      delay,
      loop: true,
      ease: 'inOutQuad'
    });
    return () => anim?.pause?.();
  }, [delay, prefersReducedMotion]);

  return (
    <span
      ref={symbolRef}
      className="inline-block text-2xl"
      style={{ color: 'var(--brand-primary)' }}
    >
      {symbol}
    </span>
  );
}

function OrbitSymbol({ index, prefersReducedMotion }) {
  const nodeRef = useRef(null);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;
    if (prefersReducedMotion) {
      set(node, { opacity: 0.25, scale: 1 });
      return undefined;
    }
    const anim = animate(node, {
      opacity: [0, 0.42, 0],
      scale: [0.5, 1, 0.5],
      duration: 3000,
      delay: index * 200,
      loop: true,
      ease: 'inOutQuad'
    });
    return () => anim?.pause?.();
  }, [index, prefersReducedMotion]);

  const angle = (index * Math.PI * 2) / 12;
  const radius = 200;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  return (
    <div
      ref={nodeRef}
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        transform: `translate(${x}px, ${y}px)`
      }}
    >
      <span style={{ color: 'var(--brand-primary)', fontSize: '12px' }}>✧</span>
    </div>
  );
}

export function AtmosphericInterlude({
  message = 'Channeling the cards...',
  _theme = 'default',
  onComplete
}) {
  const prefersReducedMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const rootRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const messages = [
    message,
    'Drawing connections...',
    'Weaving the narrative...',
    'Nearly ready...'
  ];
  const phaseMessage = messages[phaseIndex % messages.length];

  useEffect(() => {
    phaseTimerRef.current = window.setInterval(() => {
      setPhaseIndex((current) => (current + 1) % messages.length);
    }, BREATH_PERIOD_MS);

    return () => {
      if (phaseTimerRef.current) {
        window.clearInterval(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
    };
  }, [messages.length]);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    if (prefersReducedMotion) {
      set(node, { opacity: 1 });
      return undefined;
    }
    set(node, { opacity: 0, translateY: 12 });
    const anim = animate(node, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 420,
      ease: 'outQuad'
    });
    return () => anim?.pause?.();
  }, [prefersReducedMotion]);

  useEffect(() => () => {
    onComplete?.();
  }, [onComplete]);

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col items-center justify-center min-h-[400px] px-4 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Generating your personalized reading"
    >
      <ParticleLayer preset="element-ambient" intensity={0.7} zIndex={1} id="interlude-particles" />

      <div className="relative z-10">
        <BreathingOrb prefersReducedMotion={prefersReducedMotion} />

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {!prefersReducedMotion && <ShimmerSymbol delay={0} symbol="✦" prefersReducedMotion={prefersReducedMotion} />}
            <p className="text-lg font-medium" style={{ color: 'var(--text-main)' }}>
              {phaseMessage}
            </p>
            {!prefersReducedMotion && <ShimmerSymbol delay={500} symbol="✦" prefersReducedMotion={prefersReducedMotion} />}
          </div>

          <p
            className="text-sm mt-2"
            style={{ color: 'var(--text-muted)', opacity: 0.7 }}
          >
            Take a breath. The reading will unfold in a moment.
          </p>
        </div>
      </div>

      {!prefersReducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
          {Array.from({ length: 12 }).map((_, i) => (
            <OrbitSymbol key={i} index={i} prefersReducedMotion={prefersReducedMotion} />
          ))}
        </div>
      )}
    </div>
  );
}
