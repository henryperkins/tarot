import { useState, useRef, useId, useMemo, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';
import { X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../../hooks/useModalA11y';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
// Control variant components (7 steps)
import { WelcomeHero } from './WelcomeHero';
import { SpreadEducation } from './SpreadEducation';
import { QuestionCrafting } from './QuestionCrafting';
import { RitualIntro } from './RitualIntro';
import { AccountSetup } from './AccountSetup';
import { JournalIntro } from './JournalIntro';
import { JourneyBegin } from './JourneyBegin';
// Trimmed variant components (4 steps)
import { WelcomeStep, SpreadStep, IntentionStep, BeginStep } from './trimmed';
import { OnboardingProgress } from './OnboardingProgress';
// A/B test utilities
import { getOnboardingVariant, getStepLabels, getTotalSteps } from '../../lib/onboardingVariant';
import { startOnboardingTimer } from '../../lib/onboardingMetrics';

/**
 * OnboardingWizard - Multi-step onboarding flow for new users
 *
 * Guides users through:
 * 1. Welcome & introduction to tarot (+ name, experience level)
 * 2. Account setup (optional registration)
 * 3. Learning about spreads (+ depth/focus preferences)
 * 4. Crafting their first question (+ tone/frame preferences)
 * 5. Understanding the ritual (+ ritual preference)
 * 6. Journal introduction
 * 7. Beginning their journey (summary + launch)
 *
 * @param {boolean} isOpen - Whether wizard is visible
 * @param {function} onComplete - Called with { selectedSpread, question } when finished
 * @param {function} onSelectSpread - Called when user selects a spread in step 3
 * @param {string} initialSpread - Pre-selected spread key for replay (default: 'single')
 * @param {string} initialQuestion - Pre-filled question for replay (default: '')
 */
export function OnboardingWizard({ isOpen, onComplete, onSelectSpread, initialSpread = 'single', initialQuestion = '' }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSpread, setSelectedSpread] = useState(initialSpread || 'single');
  const [question, setQuestion] = useState(initialQuestion || '');

  // Track previous isOpen to detect open transitions
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // A/B test variant - determined once and cached
  const variant = useMemo(() => getOnboardingVariant(), []);
  const totalSteps = getTotalSteps(variant);
  const stepLabels = useMemo(() => getStepLabels(variant), [variant]);

  // Metrics timer for A/B test validation
  const metricsTimerRef = useRef(null);

  // Initialize metrics timer when wizard opens
  useEffect(() => {
    if (isOpen && !metricsTimerRef.current) {
      metricsTimerRef.current = startOnboardingTimer({ variant });
      metricsTimerRef.current.recordStep(1);
    }
    // Cleanup when wizard closes without completing
    return () => {
      if (!isOpen && metricsTimerRef.current && !metricsTimerRef.current.isCompleted()) {
        metricsTimerRef.current.complete({ skipped: true });
        metricsTimerRef.current = null;
      }
    };
  }, [isOpen, variant]);

  // Reset state when wizard opens (replay scenario) to pick up current values.
  // This pattern (adjusting state during render) is React-recommended over useEffect
  // for syncing state with prop changes. See: https://react.dev/learn/you-might-not-need-an-effect
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setCurrentStep(1);
    setSelectedSpread(initialSpread || 'single');
    setQuestion(initialQuestion || '');
    // Reset metrics timer for new session
    metricsTimerRef.current = null;
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();

  // Modal accessibility: useModalA11y handles scroll lock, escape key, and focus restoration.
  // Focus trapping is delegated to the FocusTrap library (trapFocus: false) because it provides
  // more robust handling for complex modals with dynamic step content, where focusable elements
  // change between steps. This matches the pattern used in GuidedIntentionCoach and ConfirmModal.
  useModalA11y(isOpen, {
    onClose: () => handleSkip(),
    containerRef: modalRef,
    trapFocus: false, // Disabled - FocusTrap library handles focus trapping
    initialFocusRef: closeButtonRef,
  });

  const handleNext = () => {
    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      metricsTimerRef.current?.recordStep(nextStep);
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Record metrics as skipped
    metricsTimerRef.current?.complete({ skipped: true });
    metricsTimerRef.current = null;
    // Mark onboarding as complete and close, passing any selections made so far
    onComplete?.({ selectedSpread, question });
  };

  const handleSpreadSelect = (spreadKey) => {
    setSelectedSpread(spreadKey);
    onSelectSpread?.(spreadKey);
  };

  const handleQuestionChange = (newQuestion) => {
    setQuestion(newQuestion);
  };

  const handleSkipRitual = () => {
    // Record metrics as skipped (user skipped from ritual step)
    metricsTimerRef.current?.complete({ skipped: true });
    metricsTimerRef.current = null;
    // Complete onboarding immediately - user wants to start reading now
    onComplete?.({ selectedSpread, question });
  };

  const handleBegin = () => {
    // Record successful completion metrics
    const metrics = metricsTimerRef.current?.complete({ skipped: false });
    metricsTimerRef.current = null;
    if (metrics) {
      console.debug('Onboarding completed:', {
        variant,
        totalTime: `${(metrics.totalTime / 1000).toFixed(1)}s`,
        steps: metrics.stepCount
      });
    }
    // Complete onboarding and pass selections to parent
    onComplete?.({ selectedSpread, question });
  };

  const handleStepSelect = (step) => {
    // Allow navigation to previously visited steps only
    // User selections (spread, question) are preserved in state during navigation
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  // Swipe navigation between steps (mobile gesture support)
  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: () => {
      // Swipe left = advance to next step
      if (currentStep < totalSteps) {
        const nextStep = currentStep + 1;
        metricsTimerRef.current?.recordStep(nextStep);
        setCurrentStep(nextStep);
      }
    },
    onSwipeRight: () => {
      // Swipe right = go back to previous step
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
      }
    },
    threshold: 80 // Slightly higher threshold to avoid accidental triggers
  });

  if (!isOpen) {
    return null;
  }

  // Render control variant (7 steps)
  const renderControlStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WelcomeHero
            onNext={handleNext}
            onSkip={handleSkip}
          />
        );
      case 2:
        return (
          <AccountSetup
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <SpreadEducation
            selectedSpread={selectedSpread}
            onSelectSpread={handleSpreadSelect}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <QuestionCrafting
            question={question}
            onQuestionChange={handleQuestionChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <RitualIntro
            onNext={handleNext}
            onBack={handleBack}
            onSkipRitual={handleSkipRitual}
          />
        );
      case 6:
        return (
          <JournalIntro
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 7:
        return (
          <JourneyBegin
            selectedSpread={selectedSpread}
            question={question}
            onBegin={handleBegin}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  // Render trimmed variant (4 steps)
  const renderTrimmedStep = () => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep onNext={handleNext} />;
      case 2:
        return (
          <SpreadStep
            selectedSpread={selectedSpread}
            onSelectSpread={handleSpreadSelect}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <IntentionStep
            question={question}
            onQuestionChange={handleQuestionChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <BeginStep
            selectedSpread={selectedSpread}
            question={question}
            onBegin={handleBegin}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  // Select render function based on variant
  const renderStep = variant === 'trimmed' ? renderTrimmedStep : renderControlStep;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-main/95 backdrop-blur-sm px-safe-left px-safe-right py-safe-top pb-safe-bottom ${
        prefersReducedMotion ? '' : 'animate-fade-in'
      }`}
      onClick={createBackdropHandler(handleSkip)}
    >
      <FocusTrap
        active={isOpen}
        focusTrapOptions={{
          initialFocus: () => closeButtonRef.current,
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          returnFocusOnDeactivate: false,
          allowOutsideClick: true,
        }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative w-full h-full onboarding-modal overflow-hidden bg-main flex flex-col ${
            prefersReducedMotion ? '' : 'animate-pop-in'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mystical background gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse at 20% 0%, rgba(244, 207, 150, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 100%, rgba(169, 146, 255, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(240, 143, 177, 0.04) 0%, transparent 60%)
              `,
            }}
            aria-hidden="true"
          />

          {/* Header with close button and progress */}
          <header
            className={`sticky top-0 z-30 pt-safe-top bg-main/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg border-b border-white/5 shadow-lg shadow-main/40 ${
              isLandscape ? 'py-1.5' : 'py-3 xs:py-4'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 xs:gap-3 px-2 xxs:px-3 sm:px-6 pl-safe-left pr-safe-right">
              <h1 id={titleId} className="sr-only">
                Welcome to Mystic Tarot
              </h1>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleSkip}
                className="order-1 sm:order-2 self-start sm:self-center ml-auto sm:ml-0 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-muted hover:text-main hover:bg-surface/50 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
                aria-label="Skip onboarding"
              >
                <X className="w-5 h-5" weight="bold" />
              </button>
              <div className="order-2 sm:order-1 flex-1 min-w-0 w-full sm:w-auto">
                <OnboardingProgress
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                  stepLabels={stepLabels}
                  onStepSelect={handleStepSelect}
                  allowNavigation={true}
                />
              </div>
            </div>
          </header>

          {/* Main content area - scrollable with swipe navigation */}
          <main
            className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right onboarding-modal__scroll"
            style={{
              scrollPaddingTop: 'calc(4.5rem + env(safe-area-inset-top, 0.75rem))',
              scrollPaddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 1rem))',
              scrollbarGutter: 'stable both-edges',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
            }}
            {...swipeHandlers}
          >
            <div className={`w-full max-w-3xl mx-auto min-h-full ${isLandscape ? 'px-2 xxs:px-3 py-2 sm:px-4' : 'px-3 xxs:px-4 md:px-6 py-4 xs:py-5 md:py-8'}`}>
              {renderStep()}
            </div>
          </main>
        </div>
      </FocusTrap>
    </div>
  );
}
