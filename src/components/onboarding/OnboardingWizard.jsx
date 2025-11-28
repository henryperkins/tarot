import { useState, useRef, useId, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';
import { X } from '@phosphor-icons/react';
import { useModalA11y, createBackdropHandler } from '../../hooks/useModalA11y';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { WelcomeHero } from './WelcomeHero';
import { SpreadEducation } from './SpreadEducation';
import { QuestionCrafting } from './QuestionCrafting';
import { RitualIntro } from './RitualIntro';
import { AccountSetup } from './AccountSetup';
import { JournalIntro } from './JournalIntro';
import { JourneyBegin } from './JourneyBegin';
import { OnboardingProgress } from './OnboardingProgress';

const TOTAL_STEPS = 7;

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

  // Reset state when wizard opens (replay scenario) to pick up current values
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedSpread(initialSpread || 'single');
      setQuestion(initialQuestion || '');
    }
  }, [isOpen, initialSpread, initialQuestion]);

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
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
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
    // Complete onboarding immediately - user wants to start reading now
    onComplete?.({ selectedSpread, question });
  };

  const handleBegin = () => {
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

  if (!isOpen) {
    return null;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WelcomeHero
            onNext={handleNext}
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

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-main/95 backdrop-blur-sm ${
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
          className={`relative w-full h-full overflow-hidden bg-main flex flex-col ${
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
            className={`relative z-10 pt-safe-top ${
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
                  totalSteps={TOTAL_STEPS}
                  onStepSelect={handleStepSelect}
                  allowNavigation={true}
                />
              </div>
            </div>
          </header>

          {/* Main content area - scrollable */}
          <main
            className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right"
            style={{ scrollPaddingTop: '1rem', scrollPaddingBottom: '1rem' }}
          >
            <div className={`max-w-full sm:max-w-2xl mx-auto h-full ${isLandscape ? 'px-2 xxs:px-3 py-2 sm:px-4' : 'px-3 xxs:px-4 md:px-6 py-4 xs:py-6 md:py-8'}`}>
              {renderStep()}
            </div>
          </main>
        </div>
      </FocusTrap>
    </div>
  );
}
