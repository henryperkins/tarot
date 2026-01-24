import { useState, useRef, useId, useCallback } from 'react';
import FocusTrap from 'focus-trap-react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HandTap, Scissors, ArrowsClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { CarouselDots } from './CarouselDots';

const GESTURE_STEPS = [
  {
    id: 'knock',
    icon: HandTap,
    title: 'Tap to Knock',
    description: 'Tap the deck 3 quick times within 2s to clear it. This ritual gesture helps focus your intention before the reading.',
    hint: 'Many readers find the rhythm of knocking helps them center their thoughts.',
    gesture: 'tap'
  },
  {
    id: 'cut',
    icon: Scissors,
    title: 'Hold to Cut',
    description: 'Long-press the deck to reveal the cut slider. Choose where to cut the deck - your intuition guides this choice.',
    hint: 'The cut position influences the shuffle seed, making your reading unique.',
    gesture: 'hold'
  },
  {
    id: 'shuffle',
    icon: ArrowsClockwise,
    title: 'Double-Tap to Shuffle',
    description: 'After the deck is cleared, double-tap to shuffle. Then tap once to draw each card.',
    hint: 'You can also use the explicit buttons below the deck if you prefer.',
    gesture: 'double-tap'
  }
];

/**
 * GestureCoachOverlay - First-time gesture education overlay
 *
 * Shows once per device to teach users the deck interaction gestures:
 * - Tap to knock (3 times to clear)
 * - Long-press to cut
 * - Double-tap to shuffle
 *
 * @param {boolean} isOpen - Whether overlay is visible
 * @param {function} onDismiss - Called when user closes the overlay
 */
export function GestureCoachOverlay({ isOpen, onDismiss }) {
  const [currentStep, setCurrentStep] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();

  useModalA11y(isOpen, {
    onClose: onDismiss,
    containerRef: modalRef,
    trapFocus: false,
    initialFocusRef: closeButtonRef
  });

  const handleNext = useCallback(() => {
    if (currentStep < GESTURE_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onDismiss?.();
    }
  }, [currentStep, onDismiss]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleStepSelect = useCallback((index) => {
    setCurrentStep(index);
  }, []);

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
    threshold: 60
  });

  if (!isOpen) return null;

  const step = GESTURE_STEPS[currentStep];
  const isLastStep = currentStep === GESTURE_STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-main/95 backdrop-blur-sm px-safe pt-safe pb-safe-bottom ${
        prefersReducedMotion ? '' : 'animate-fade-in'
      }`}
      onClick={createBackdropHandler(onDismiss)}
    >
      <FocusTrap
        active={isOpen}
        focusTrapOptions={{
          initialFocus: () => closeButtonRef.current,
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          returnFocusOnDeactivate: true,
          allowOutsideClick: true
        }}
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative w-full max-w-md mx-4 rounded-2xl border border-secondary/30 bg-surface/95 backdrop-blur shadow-2xl overflow-hidden ${
            prefersReducedMotion ? '' : 'animate-pop-in'
          }`}
          onClick={(e) => e.stopPropagation()}
          {...swipeHandlers}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary/20">
            <h2 id={titleId} className="text-sm font-semibold text-main">
              Deck Gestures
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onDismiss}
              className="flex items-center justify-center min-w-touch min-h-touch -mr-2 rounded-full text-muted hover:text-main hover:bg-surface-muted/50 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close gesture guide"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>
          </div>

          {/* Step Content */}
          <div className="px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                {/* Gesture Icon with Animation */}
                <div className="relative mx-auto w-20 h-20 mb-4">
                  <div className="absolute inset-0 rounded-full bg-accent/10 border border-accent/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="w-10 h-10 text-accent" weight="duotone" />
                  </div>
                  {/* Animated gesture indicator */}
                  {!prefersReducedMotion && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-accent/50"
                      animate={
                        step.gesture === 'tap'
                          ? { scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }
                          : step.gesture === 'hold'
                          ? { scale: [1, 1.1, 1.1, 1], opacity: [0.5, 0.8, 0.8, 0.5] }
                          : { scale: [1, 1.15, 1, 1.15, 1], opacity: [0.5, 0, 0.5, 0, 0.5] }
                      }
                      transition={{
                        duration: step.gesture === 'double-tap' ? 1.5 : 1.2,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                  )}
                </div>

                {/* Step Title */}
                <h3 className="text-lg font-semibold text-main mb-2">
                  {step.title}
                </h3>

                {/* Step Description */}
                <p className="text-sm text-muted leading-relaxed mb-3">
                  {step.description}
                </p>

                {/* Hint */}
                <p className="text-xs text-secondary/70 italic">
                  {step.hint}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer with Navigation */}
          <div className="px-4 py-4 border-t border-secondary/20 bg-surface-muted/30">
            {/* Carousel Dots */}
            <div className="flex justify-center mb-4">
              <CarouselDots
                total={GESTURE_STEPS.length}
                current={currentStep}
                onSelect={handleStepSelect}
                variant="compact"
              />
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex items-center gap-1 min-h-touch px-4 py-2 rounded-full border border-secondary/30 text-muted text-sm font-medium transition hover:border-secondary/50 hover:text-main disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CaretLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 min-h-touch px-5 py-2 rounded-full bg-accent text-surface text-sm font-semibold transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {isLastStep ? 'Got it!' : 'Next'}
                {!isLastStep && <CaretRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Skip link */}
            <button
              type="button"
              onClick={onDismiss}
              className="w-full mt-3 text-xs text-muted/70 hover:text-muted transition touch-manipulation min-h-touch flex items-center justify-center"
            >
              Skip tutorial
            </button>
          </div>
        </motion.div>
      </FocusTrap>
    </div>
  );
}
