import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Sparkle } from '@phosphor-icons/react';

/**
 * Atmospheric Interlude Component
 * 
 * Replaces skeleton loading screens with an immersive "breathing" scene
 * that signals the system is "channeling" rather than "processing".
 * 
 * Features:
 * - Breathing animation (4s cycle matching meditative breath)
 * - Shimmer effects on mystical symbols
 * - Subtle progress indication through visual evolution
 * - Reduced motion support
 */

const BREATH_PERIOD_MS = 4000; // 4 seconds per breath cycle
const SHIMMER_DURATION_MS = 2000;

function BreathingOrb({ prefersReducedMotion }) {
  const baseScale = 1;
  const amplitude = 0.15;

  // Breathing animation config
  const breathAnimation = prefersReducedMotion
    ? {}
    : {
        scale: [
          baseScale,
          baseScale + amplitude,
          baseScale,
          baseScale - amplitude * 0.5,
          baseScale
        ],
        opacity: [0.6, 0.8, 0.6, 0.5, 0.6]
      };

  const breathTransition = {
    duration: BREATH_PERIOD_MS / 1000,
    repeat: Infinity,
    ease: 'easeInOut'
  };

  return (
    <motion.div
      className="relative w-32 h-32 mx-auto"
      animate={breathAnimation}
      transition={breathTransition}
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--brand-primary) 0%, transparent 70%)',
          filter: 'blur(20px)',
          opacity: 0.3
        }}
      />

      {/* Inner orb */}
      <div
        className="absolute inset-4 rounded-full border-2"
        style={{
          borderColor: 'var(--brand-primary)',
          background: 'radial-gradient(circle at 40% 40%, rgba(229, 196, 142, 0.3), transparent 60%)',
          boxShadow: '0 0 30px rgba(229, 196, 142, 0.4)'
        }}
      />

      {/* Center sparkle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkle
          size={24}
          weight="duotone"
          style={{ color: 'var(--brand-primary)', opacity: 0.8 }}
        />
      </div>
    </motion.div>
  );
}

function ShimmerSymbol({ delay = 0, symbol = '✦' }) {
  const shimmerVariants = {
    initial: { opacity: 0.3, scale: 0.95 },
    shimmer: {
      opacity: [0.3, 0.9, 0.3],
      scale: [0.95, 1.05, 0.95],
      transition: {
        duration: SHIMMER_DURATION_MS / 1000,
        delay,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  return (
    <motion.span
      className="inline-block text-2xl"
      style={{ color: 'var(--brand-primary)' }}
      initial="initial"
      animate="shimmer"
      variants={shimmerVariants}
    >
      {symbol}
    </motion.span>
  );
}

export function AtmosphericInterlude({
  message = 'Channeling the cards...',
  theme = 'default',
  onComplete
}) {
  const prefersReducedMotion = useReducedMotion();
  const [phaseMessage, setPhaseMessage] = useState(message);
  const phaseTimerRef = useRef(null);

  // Subtle message evolution to show progress without explicit loading bar
  useEffect(() => {
    const messages = [
      message,
      'Drawing connections...',
      'Weaving the narrative...',
      'Nearly ready...'
    ];

    let phase = 0;

    if (!prefersReducedMotion) {
      phaseTimerRef.current = setInterval(() => {
        phase = (phase + 1) % messages.length;
        setPhaseMessage(messages[phase]);
      }, 6000); // Change every 6 seconds
    }

    return () => {
      if (phaseTimerRef.current) {
        clearInterval(phaseTimerRef.current);
      }
    };
  }, [message, prefersReducedMotion]);

  // Container animation
  const containerVariants = {
    initial: { opacity: 0 },
    enter: {
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.4,
        ease: 'easeIn'
      }
    }
  };

  return (
    <AnimatePresence onExitComplete={onComplete}>
      <motion.div
        className="flex flex-col items-center justify-center min-h-[400px] px-4"
        variants={containerVariants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {/* Breathing orb */}
        <BreathingOrb prefersReducedMotion={prefersReducedMotion} />

        {/* Message with shimmer symbols */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            {!prefersReducedMotion && <ShimmerSymbol delay={0} symbol="✦" />}
            <p className="text-lg font-medium" style={{ color: 'var(--text-main)' }}>
              {phaseMessage}
            </p>
            {!prefersReducedMotion && <ShimmerSymbol delay={0.5} symbol="✦" />}
          </div>

          {/* Subtle hint text */}
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--text-muted)', opacity: 0.7 }}
          >
            Take a breath. The reading will unfold in a moment.
          </p>
        </motion.div>

        {/* Decorative constellation of symbols */}
        {!prefersReducedMotion && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => {
              const angle = (i * Math.PI * 2) / 12;
              const radius = 200;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(${x}px, ${y}px)`
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: [0, 0.4, 0],
                    scale: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 3,
                    delay: i * 0.2,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                >
                  <span style={{ color: 'var(--brand-primary)', fontSize: '12px' }}>✧</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
