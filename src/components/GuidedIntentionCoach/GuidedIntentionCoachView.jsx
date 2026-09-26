import { Fragment, useCallback, useEffect, useRef, useState, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  ChartLine,
  ArrowLeft,
  ArrowRight,
  Check,
  BookmarkSimple,
  Info,
  Sparkle,
  MagicWand,
  X,
  ArrowsClockwise
} from '@phosphor-icons/react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useSmallScreen } from '../../hooks/useSmallScreen';
import { useAndroidBackGuard } from '../../hooks/useAndroidBackGuard';
import { useLandscape } from '../../hooks/useLandscape';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSwipeDismiss } from '../../hooks/useSwipeDismiss';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { Tooltip } from '../Tooltip';
import {
  INTENTION_TOPIC_OPTIONS,
  INTENTION_TIMEFRAME_OPTIONS,
  INTENTION_DEPTH_OPTIONS,
  buildGuidedQuestion
} from '../../lib/intentionCoach';
import { MAX_TEMPLATES } from '../../lib/coachStorage';
import { MOBILE_COACH_DIALOG_ID } from '../mobileActionBarConstants';
import { CUSTOM_FOCUS_MAX_LENGTH, STEPS, SPREAD_NAMES, SPREAD_TO_TOPIC_MAP } from '../../lib/coachConstants';
import { useGuidedIntentionCoach } from '../../contexts/GuidedIntentionCoachContext';
import { QualityLevelIcon } from '../QualityLevelIcon';
import { CoachSuggestionsPanel } from './CoachSuggestionsPanel';
import { CoachTemplatePanel } from './CoachTemplatePanel';

const baseOptionClass =
  'text-left rounded-2xl border bg-surface-muted/50 px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
const infoButtonClass =
  'inline-flex min-w-touch min-h-touch items-center justify-center rounded-full text-secondary/70 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
// Footer actions follow the mobile action bar's docked pair: a candlelight
// primary and a quiet bordered secondary. Focus is left to the global outline,
// which carries the offset the design system asks for.
const footerButtonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition touch-manipulation';
const footerPrimaryClass =
  `${footerButtonBase} bg-accent text-surface hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`;
const footerSecondaryClass =
  `${footerButtonBase} border border-accent/30 bg-surface-muted text-accent hover:bg-surface aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-surface-muted`;

function getTopicLabel(value) {
  return INTENTION_TOPIC_OPTIONS.find(option => option.value === value)?.label || null;
}

function getTimeframeLabel(value) {
  return INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === value)?.label || null;
}

function getDepthLabel(value) {
  return INTENTION_DEPTH_OPTIONS.find(option => option.value === value)?.label || null;
}

export function GuidedIntentionCoachView() {
  const {
    isOpen,
    selectedSpread,
    onClose,
    canUseAIQuestions,
    step,
    setStep,
    topic,
    timeframe,
    depth,
    customFocus,
    useCreative,
    questionText,
    questionLoading,
    questionError,
    announcement,
    prefillSource,
    templates,
    newTemplateLabel,
    setNewTemplateLabel,
    templateStatus,
    questionHistory,
    personalizedSuggestions,
    suggestionsPage,
    isSuggestionsExpanded,
    isTemplatePanelOpen,
    templatePanelIntent,
    astroHighlights,
    astroWindowDays,
    astroSource,
    coachSnapshotLabel,
    coachSnapshotDetail,
    focusAreaSuggestedTopic,
    prefillSourceDescription,
    guidedQuestion,
    questionQuality,
    qualityLevel,
    footerSummary,
    footerSummaryCompact,
    questionContextChips,
    qualityHelperText,
    qualityHighlights,
    normalizedQualityScore,
    suggestionPageCount,
    visibleSuggestions,
    setTimeframe,
    setTopic,
    setDepth,
    setCustomFocus,
    setSuggestionsPage,
    setSuggestionsExpanded,
    remixQuestion,
    setCreativeMode,
    openTemplatePanel,
    closeTemplatePanel,
    releasePrefill,
    handleSaveTemplate,
    handleApplyTemplate,
    handleDeleteTemplate,
    handleSuggestionPick,
    handleApplyHistoryQuestion,
    canGoNext,
    goNext,
    goBack,
    handleApply
  } = useGuidedIntentionCoach();

  const isLandscape = useLandscape();
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen();
  const viewportOffset = useKeyboardOffset();
  const effectiveOffset = Math.max(0, viewportOffset);

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const depthSectionRef = useRef(null);
  const customFocusRef = useRef(null);
  const stepButtonRefs = useRef([]);
  const titleId = useId();
  const topicPromptId = useId();
  const timeframePromptId = useId();
  const depthPromptId = useId();

  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    trapFocus: false,
    initialFocusRef: closeButtonRef,
  });

  const { handlers: swipeDismissHandlers, style: swipeDismissStyle } = useSwipeDismiss({
    onDismiss: onClose,
    threshold: 120,
    resistance: 0.5
  });

  useEffect(() => {
    if (!isOpen) return;
    setSuggestionsExpanded(!isSmallScreen);
  }, [isOpen, isSmallScreen, setSuggestionsExpanded]);

  // Back closes the innermost layer first, like Escape.
  useAndroidBackGuard(isOpen, {
    onBack: () => (isTemplatePanelOpen ? closeTemplatePanel() : onClose()),
    enabled: isSmallScreen,
    guardId: 'intentionCoach'
  });

  const [showExcellentBurst, setShowExcellentBurst] = useState(false);
  const prevQualityScoreRef = useRef(questionQuality.score);

  useEffect(() => {
    const prev = prevQualityScoreRef.current;
    prevQualityScoreRef.current = questionQuality.score;

    if (prefersReducedMotion) return;
    if (prev < 85 && questionQuality.score >= 85) {
      let rafId = null;
      let timeoutId = null;
      rafId = requestAnimationFrame(() => setShowExcellentBurst(true));
      timeoutId = setTimeout(() => setShowExcellentBurst(false), 650);
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [questionQuality.score, prefersReducedMotion]);

  const buildSuggestionPreview = useCallback((suggestion) => {
    if (!suggestion) return '';
    if (suggestion.question) return suggestion.question;

    const suggestionTopic = suggestion.topic || topic;
    const suggestionTimeframe = suggestion.timeframe || timeframe;
    const suggestionDepth = suggestion.depth || depth;
    const suggestionFocus = typeof suggestion.customFocus === 'string' ? suggestion.customFocus.trim() : '';
    const suggestionSeed = [
      'suggestion',
      suggestion.id || suggestion.label || 'preview',
      suggestionTopic,
      suggestionTimeframe,
      suggestionDepth,
      suggestionFocus
    ].join('|');

    return buildGuidedQuestion({
      topic: suggestionTopic,
      timeframe: suggestionTimeframe,
      depth: suggestionDepth,
      customFocus: suggestionFocus || undefined,
      seed: suggestionSeed
    });
  }, [topic, timeframe, depth]);

  const handleStepKeyDown = (event, currentIndex) => {
    let nextIndex = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % STEPS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + STEPS.length) % STEPS.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = STEPS.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setStep(currentIndex);
      return;
    }

    if (nextIndex !== null) {
      setStep(nextIndex);
      // Focus in the same keystroke: deferring it let a quick second press
      // act on the tab the first press had just left.
      stepButtonRefs.current[nextIndex]?.focus();
    }
  };

  // A chip or step change can hide the control that had focus along with its
  // panel; hand focus to the choice the user is about to change instead.
  const focusCheckedOption = (stepIndex, focusOptions) => {
    requestAnimationFrame(() => {
      const panel = modalRef.current?.querySelector(`#step-panel-${STEPS[stepIndex]?.id}`);
      const target = panel?.querySelector('[role="radio"][aria-checked="true"]') || stepButtonRefs.current[stepIndex];
      target?.focus(focusOptions);
    });
  };

  const handleChipClick = (chip) => {
    if (typeof chip.step === 'number') {
      const isSameStep = chip.step === step;
      setStep(chip.step);
      if (isSameStep && chip.type === 'Depth') {
        depthSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
      }
      focusCheckedOption(chip.step, isSameStep ? { preventScroll: true } : undefined);
    }
    if (chip.action === 'focus') {
      customFocusRef.current?.focus();
    }
  };

  // Single-choice cards behave like the spread selector: arrows move focus and
  // Space or Enter selects. Selecting on arrow would discard a prefilled
  // question while the user was only passing over the other options.
  const handleOptionKeyDown = (event, index, count, select) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % count;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + count) % count;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = count - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
      return;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll('[role="radio"]');
    radios?.[nextIndex]?.focus();
  };

  const renderOptionGroup = ({ options, selectedValue, onSelect, labelledBy, gridClassName, renderExtra }) => {
    const hasSelection = options.some(option => option.value === selectedValue);
    return (
      <div role="radiogroup" aria-labelledby={labelledBy} className={`grid gap-3 ${gridClassName}`}>
        {options.map((option, index) => {
          const isSelected = option.value === selectedValue;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (!hasSelection && index === 0) ? 0 : -1}
              className={`${baseOptionClass} relative ${isSelected ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20' : 'border-secondary/30 hover:border-accent/50 hover:bg-accent/5'}`}
              onClick={() => onSelect(option.value)}
              onKeyDown={event => handleOptionKeyDown(event, index, options.length, () => onSelect(option.value))}
            >
              {/* Selection must survive forced colors and not rest on border colour alone. */}
              {isSelected && (
                <span
                  className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-surface"
                  aria-hidden="true"
                >
                  <Check className="h-3.5 w-3.5" weight="bold" />
                </span>
              )}
              <span className="block pr-8 font-medium text-main">{option.label}</span>
              <span className="block text-sm text-muted">{option.description}</span>
              {renderExtra?.(option)}
            </button>
          );
        })}
      </div>
    );
  };

  const selectTopic = (value) => {
    if (value !== topic) releasePrefill();
    setTopic(value);
  };

  const selectTimeframe = (value) => {
    if (value !== timeframe) releasePrefill();
    setTimeframe(value);
  };

  const selectDepth = (value) => {
    if (value !== depth) releasePrefill();
    setDepth(value);
  };

  const renderStepPanelContent = (panelId) => {
    if (panelId === 'topic') {
      return (
        <div className="space-y-4">
          <p id={topicPromptId} className="text-sm text-muted">What area do you want to explore?</p>
          {SPREAD_TO_TOPIC_MAP[selectedSpread] && (
            <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkle className="h-3 w-3 text-accent" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-accent">Suggested Focus</span>
              </div>
              <p className="text-xs text-secondary">
                Based on your <span className="font-medium">{SPREAD_NAMES[selectedSpread]}</span> spread, we suggest exploring{' '}
                <span className="font-medium text-main">
                  {INTENTION_TOPIC_OPTIONS.find(opt => opt.value === SPREAD_TO_TOPIC_MAP[selectedSpread])?.label}
                </span>
                . Feel free to choose any topic.
              </p>
            </div>
          )}
          {renderOptionGroup({
            options: INTENTION_TOPIC_OPTIONS,
            selectedValue: topic,
            onSelect: selectTopic,
            labelledBy: topicPromptId,
            gridClassName: 'md:grid-cols-2',
            renderExtra: option => (focusAreaSuggestedTopic && option.value === focusAreaSuggestedTopic ? (
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-2xs font-semibold uppercase tracking-[0.2em] text-accent">
                Based on your interests
              </span>
            ) : null)
          })}
        </div>
      );
    }

    if (panelId === 'timeframe') {
      return (
        <div className="space-y-4">
          <p id={timeframePromptId} className="text-sm text-muted">When do you need guidance for?</p>
          {renderOptionGroup({
            options: INTENTION_TIMEFRAME_OPTIONS,
            selectedValue: timeframe,
            onSelect: selectTimeframe,
            labelledBy: timeframePromptId,
            gridClassName: 'sm:grid-cols-2'
          })}
        </div>
      );
    }

    if (panelId === 'depth') {
      return (
        <div className="space-y-6">
          <div ref={depthSectionRef} className="space-y-4">
            <p id={depthPromptId} className="text-sm text-muted">How deep do you want to go?</p>
            {renderOptionGroup({
              options: INTENTION_DEPTH_OPTIONS,
              selectedValue: depth,
              onSelect: selectDepth,
              labelledBy: depthPromptId,
              gridClassName: 'md:grid-cols-2'
            })}
          </div>

          <div className="space-y-2">
            <label htmlFor="custom-focus" className="text-sm font-medium text-accent">
              Add a detail (optional)
            </label>
            <input
              ref={customFocusRef}
              id="custom-focus"
              type="text"
              value={customFocus}
              maxLength={CUSTOM_FOCUS_MAX_LENGTH}
              autoComplete="off"
              enterKeyHint="done"
              onChange={event => {
                releasePrefill();
                setCustomFocus(event.target.value);
              }}
              placeholder="e.g. a potential move, a creative launch, a new relationship"
              className="w-full rounded-xl border border-secondary/40 bg-surface/80 px-4 py-3 text-main caret-accent placeholder:text-secondary/40 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/60"
            />
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-4">
            <div className="flex flex-col gap-2">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-secondary">
                  <Sparkle className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                  Review & Refine
                </p>
                <p className="text-xs text-secondary/80 mt-1">
                  Tap a tag to adjust that setting or toggle AI for a creative spin.
                </p>
              </div>

              {questionContextChips.length > 0 && (
                <div className="flex flex-wrap gap-2 py-2">
                  {questionContextChips.map((chip, idx) => {
                    const chipClassName = 'inline-flex max-w-full items-center rounded-full border border-secondary/40 bg-surface/50 px-3 py-1 text-2xs uppercase tracking-[0.2em] text-secondary/80';
                    const chipContent = (
                      <>
                        <span className="font-bold opacity-50 mr-1 shrink-0">{chip.type}:</span>
                        <span className="truncate">{chip.label}</span>
                      </>
                    );
                    // A chip with nowhere to go (the custom-question mode) is a
                    // label, not a button that silently does nothing.
                    if (typeof chip.step !== 'number' && chip.action !== 'focus') {
                      return (
                        <span key={`${chip.label}-${idx}`} className={chipClassName}>
                          {chipContent}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={`${chip.label}-${idx}`}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        className={`${chipClassName} hover:bg-secondary/10 hover:border-secondary transition`}
                      >
                        {chipContent}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {canUseAIQuestions ? (
                  <label className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-surface/50 px-3 py-1.5 text-2xs text-secondary cursor-pointer select-none hover:bg-secondary/5 transition">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-secondary/60 bg-transparent text-secondary focus:ring-secondary"
                      checked={useCreative}
                      onChange={event => setCreativeMode(event.target.checked)}
                    />
                    <span className="inline-flex items-center gap-1 font-medium">
                      <MagicWand className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                      Personalize with AI
                    </span>
                  </label>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-surface/30 px-3 py-1.5 text-2xs text-secondary/60 select-none" title="Upgrade to Plus or Pro for AI-powered personalization">
                    <MagicWand className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                    <span className="font-medium">AI Personalization</span>
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-accent">Plus</span>
                    {/* The title tooltip never reaches touch or screen reader users. */}
                    <span className="sr-only">: available on the Plus and Pro plans</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={remixQuestion}
                  className="inline-flex items-center gap-1 rounded-full border border-secondary/60 bg-transparent px-3 py-1.5 text-2xs font-semibold text-secondary hover:bg-secondary/10 transition"
                >
                  <ArrowsClockwise className="h-3.5 w-3.5" aria-hidden="true" />
                  Remix
                </button>
              </div>
              <p className="text-2xs text-secondary/70">
                Creative mode uses journal themes and recent questions when available.
              </p>
            </div>

            {prefillSource && prefillSourceDescription && (
              <p className="text-xs text-secondary/80 break-words">
                <span className="font-semibold text-secondary">Auto-filled</span> from {prefillSourceDescription}.
              </p>
            )}
            {questionLoading && (
              <p className={`text-xs text-accent/80 ${prefersReducedMotion ? '' : 'animate-pulse'}`}>Weaving a personalized prompt…</p>
            )}
            {questionError && (
              <p className="text-xs text-accent/80">{questionError}</p>
            )}

            <div className="rounded-2xl border border-secondary/30 bg-surface/60 p-5 space-y-3 text-center" aria-busy={questionLoading}>
              <div className="flex items-center justify-center gap-2 text-2xs uppercase tracking-[0.3em] text-secondary/80">
                <Sparkle className="h-4 w-4 text-secondary" aria-hidden="true" />
                Your Question
              </div>
              <p className="font-serif text-xl sm:text-2xl text-main leading-relaxed break-words">
                {questionText || guidedQuestion}
              </p>
            </div>
            {/* Using the question lives in the footer, which is always on screen. */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => openTemplatePanel('save')}
                aria-haspopup="dialog"
                className="text-2xs text-secondary/80 underline decoration-secondary/40 underline-offset-4 transition hover:text-secondary"
              >
                Save as template
              </button>
            </div>

            {astroHighlights.length > 0 && (
              <div className="rounded-2xl border border-secondary/30 bg-surface/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-secondary/80">
                  <span className="inline-flex items-center gap-2 uppercase tracking-[0.2em]">
                    <MagicWand className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                    Astro window{astroWindowDays ? ` · ${astroWindowDays} days` : ''}
                  </span>
                  {astroSource && <span className="text-2xs text-secondary/60">{astroSource}</span>}
                </div>
                <ul className="grid gap-1 text-sm text-main text-left">
                  {astroHighlights.map((item, idx) => (
                    <li key={`astro-${idx}`} className="flex items-start gap-2">
                      <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-secondary/70" aria-hidden="true" />
                      <span className="leading-snug text-secondary/90">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-2xs text-secondary/70">
                  Astrology here is symbolic context, not a prediction.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-secondary/30 bg-surface/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-secondary">
                <span className="inline-flex items-center gap-1">
                  <ChartLine className="h-4 w-4 text-secondary" aria-hidden="true" />
                  Question quality
                  <Tooltip
                    content="Checks for open-ended wording, specificity, and timeframe."
                    position="top"
                    triggerClassName={infoButtonClass}
                    ariaLabel="About question quality"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </Tooltip>
                </span>
                <span className="text-xs font-semibold text-secondary">
                  <span className="relative inline-flex items-center">
                    <QualityLevelIcon level={qualityLevel} />
                    {showExcellentBurst && (
                      <Sparkle
                        className="absolute -top-2 -right-2 h-3.5 w-3.5 text-accent motion-safe:animate-ping"
                        weight="fill"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="ml-1">{qualityLevel.label}</span>
                </span>
              </div>
              {/* The level label above already carries the score for assistive tech. */}
              <div className="h-2 w-full rounded-full bg-surface-muted/80 overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full ${prefersReducedMotion ? '' : 'transition-all duration-500'} ${
                    normalizedQualityScore >= 85
                      ? 'bg-accent'
                      : normalizedQualityScore >= 65
                        ? 'bg-secondary'
                        : 'bg-secondary/50'
                  }`}
                  style={{ width: `${normalizedQualityScore}%` }}
                />
              </div>
              <p className="text-2xs text-secondary/80">{qualityHelperText}</p>
              {qualityHighlights.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-2xs uppercase tracking-[0.3em] text-secondary/60">
                  {qualityHighlights.map(label => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full border border-secondary/30 px-2 py-1"
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!isOpen) {
    return null;
  }

  const safeAreaXClass = !isSmallScreen && isLandscape
    ? 'pl-[max(1rem,var(--safe-pad-left))] pr-[max(1rem,var(--safe-pad-right))]'
    : '';
  const footerPaddingStyle = !isSmallScreen && effectiveOffset
    ? { paddingBottom: `calc(var(--safe-pad-bottom) + ${effectiveOffset + 16}px)` }
    : undefined;

  return (
    <div
      className={`fixed inset-0 z-[70] flex ${isSmallScreen ? 'items-end pt-[max(16px,var(--safe-pad-top))]' : 'items-center'} justify-center`}
      style={isSmallScreen && effectiveOffset ? { paddingBottom: `${effectiveOffset}px` } : undefined}
    >
      <div
        className={`${isSmallScreen ? 'mobile-drawer-overlay' : 'bg-main/90 backdrop-blur'} absolute inset-0 ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* useModalA11y owns initial focus. Without an initialFocus of its own,
          the trap's deferred activation focus keeps whatever is already
          focused inside the dialog instead of pulling it back to Close when
          the timer runs late. */}
      <FocusTrap
        active={isOpen}
        focusTrapOptions={{
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          returnFocusOnDeactivate: false,
          allowOutsideClick: true,
        }}
      >
        <div
          ref={modalRef}
          id={MOBILE_COACH_DIALOG_ID}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative w-full flex flex-col focus:outline-none selection:bg-accent selection:text-surface ${
            isSmallScreen
              ? `mobile-drawer ${prefersReducedMotion ? '' : 'animate-slide-up'}`
              : `h-auto ${isLandscape ? 'max-h-[98vh]' : 'max-h-[90vh]'} max-w-3xl mx-4 rounded-3xl border border-secondary/30 bg-surface shadow-[var(--ui-elevated-shadow)] ${prefersReducedMotion ? '' : 'animate-pop-in'}`
          }`}
          style={{
            ...(isSmallScreen ? {
              maxHeight: 'calc(100% - 8px)',
              // Present only while dragging or sliding out, so the entrance
              // animation keeps control of transform at rest.
              transform: swipeDismissStyle.transform,
              transition: prefersReducedMotion ? 'none' : swipeDismissStyle.transition
            } : undefined)
          }}
          // The template library is its own layer; dragging in it must not
          // dismiss the coach underneath.
          {...(isSmallScreen && !isTemplatePanelOpen ? swipeDismissHandlers : {})}
        >
          {isSmallScreen && (
            <div className="mobile-drawer__handle" aria-hidden="true" />
          )}

          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>

          {/* Hairlines above and below the scroll body, as on the phone sheet,
              so content scrolling past the header and footer has an edge. */}
          <div className={isSmallScreen ? 'mobile-drawer__header px-4 pt-3 pb-3' : 'relative border-b border-accent/15'}>
            <div className={`flex items-start justify-between gap-3 ${isSmallScreen ? '' : `px-4 pt-8 sm:px-10 sm:pt-6 ${isLandscape ? 'pb-3' : 'pb-4 sm:pb-5'}`}`}>
              <div className="space-y-1">
                <h2 id={titleId} className={`font-serif ${isSmallScreen ? 'text-lg text-accent' : `text-main ${isLandscape ? 'text-xl' : 'text-2xl'}`}`}>
                  Shape a question with clarity
                </h2>
                {!isLandscape && (
                  <p className={`${isSmallScreen ? 'text-[0.78rem] text-muted/90' : 'text-sm text-muted'} leading-snug max-w-[22rem]`}>
                    Answer three quick prompts and we&apos;ll craft an open-ended question you can drop
                    directly into your reading.
                  </p>
                )}
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className={isSmallScreen ? 'mobile-drawer__close' : 'absolute top-4 right-4 sm:top-6 sm:right-6 min-h-touch min-w-touch flex items-center justify-center rounded-full text-muted hover:text-main hover:bg-surface-muted/50 z-10 touch-manipulation transition-colors'}
                aria-label="Close intention coach"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto overscroll-contain min-h-0 scrollbar-themed ${isSmallScreen ? 'mobile-drawer__body' : ''}`}>
            <div
              className={`flex flex-col gap-6 px-4 pb-6 sm:px-10 sm:pb-6 ${isLandscape ? 'pt-4 gap-4' : 'pt-4 sm:pt-6'} ${safeAreaXClass}`}
            >
              <CoachSuggestionsPanel
                personalizedSuggestions={personalizedSuggestions}
                isSuggestionsExpanded={isSuggestionsExpanded}
                setSuggestionsExpanded={setSuggestionsExpanded}
                suggestionPageCount={suggestionPageCount}
                suggestionsPage={suggestionsPage}
                setSuggestionsPage={setSuggestionsPage}
                visibleSuggestions={visibleSuggestions}
                buildSuggestionPreview={buildSuggestionPreview}
                handleSuggestionPick={handleSuggestionPick}
                getTopicLabel={getTopicLabel}
                getTimeframeLabel={getTimeframeLabel}
                getDepthLabel={getDepthLabel}
                coachSnapshotLabel={coachSnapshotLabel}
                coachSnapshotDetail={coachSnapshotDetail}
              />

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent flex-wrap"
                    role="tablist"
                    aria-label="Coach wizard steps"
                  >
                    {STEPS.map((entry, index) => (
                      <Fragment key={entry.id}>
                        <button
                          ref={el => {
                            stepButtonRefs.current[index] = el;
                          }}
                          type="button"
                          id={`step-tab-${entry.id}`}
                          role="tab"
                          aria-selected={index === step}
                          aria-controls={`step-panel-${entry.id}`}
                          tabIndex={index === step ? 0 : -1}
                          className={`rounded-full px-3 py-1 min-h-touch min-w-touch touch-manipulation transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                            index === step
                              ? 'bg-accent text-surface shadow-lg shadow-accent/20 forced-colors:underline forced-colors:underline-offset-4'
                              : 'bg-surface-muted text-muted hover:bg-surface-muted/80 hover:text-accent'
                          }`}
                          onClick={() => setStep(index)}
                          onKeyDown={(e) => handleStepKeyDown(e, index)}
                        >
                          {/* Phones show the number; the name stays in the
                              accessible label ("1 Topic") so voice control
                              and screen readers both get it. */}
                          <span className="sm:hidden">{index + 1}</span>
                          {' '}
                          <span className="sr-only sm:not-sr-only">{entry.label}</span>
                        </button>
                        {index < STEPS.length - 1 && <span className="text-accent/30" aria-hidden="true">·</span>}
                      </Fragment>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <p className="text-xs text-secondary font-medium">
                      Step {step + 1} of {STEPS.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => openTemplatePanel('browse')}
                      aria-haspopup="dialog"
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-secondary/40 px-3 py-1.5 text-2xs uppercase tracking-[0.2em] text-secondary hover:bg-secondary/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
                    >
                      <BookmarkSimple className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                      Templates
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl border border-accent/30 bg-surface-muted/40 ${isLandscape ? 'p-3' : 'p-4 sm:p-5'}`}>
                  {STEPS.map((entry, index) => (
                    <div
                      key={entry.id}
                      id={`step-panel-${entry.id}`}
                      role="tabpanel"
                      aria-labelledby={`step-tab-${entry.id}`}
                      hidden={step !== index}
                      aria-hidden={step !== index}
                      tabIndex={step === index ? 0 : -1}
                    >
                      {renderStepPanelContent(entry.id)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`flex-shrink-0 ${isSmallScreen ? 'mobile-drawer__footer' : 'bg-surface border-t border-accent/20 px-4 sm:px-10 pb-safe sm:pb-6'} ${isLandscape ? 'pt-2' : isSmallScreen ? '' : 'pt-4'} ${safeAreaXClass}`}
            style={!isSmallScreen ? footerPaddingStyle : undefined}
          >
            <div className={`flex sm:flex-row sm:items-center sm:justify-between ${isLandscape ? 'flex-row items-center gap-2' : 'flex-col gap-3'}`}>
              <div className={`text-xs text-muted ${isLandscape ? 'block' : 'hidden sm:block'}`}>
                <p>
                  {isLandscape ? footerSummaryCompact : footerSummary}
                </p>
              </div>
              <div className={`flex items-center w-full sm:w-auto ${isLandscape ? 'gap-2 flex-1 justify-end' : 'gap-3'}`}>
                {/* aria-disabled, not disabled: disabling the focused button on
                    the first step would drop keyboard focus to the page. */}
                <button
                  type="button"
                  onClick={goBack}
                  aria-disabled={step === 0 || undefined}
                  aria-label={isLandscape ? 'Back' : undefined}
                  className={`${footerSecondaryClass} ${isLandscape ? 'min-h-touch px-3 flex-none' : 'min-h-cta px-5 flex-1 sm:flex-none'}`}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {!isLandscape && <span>Back</span>}
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canGoNext()}
                    className={`${footerPrimaryClass} ${isLandscape ? 'min-h-touch px-4 flex-none' : 'min-h-cta px-6 flex-1 sm:flex-none'}`}
                  >
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={(!questionText && !guidedQuestion) || questionLoading}
                    aria-label={isLandscape && !questionLoading ? 'Use question' : undefined}
                    className={`${footerPrimaryClass} ${isLandscape ? 'min-h-touch px-4 flex-none' : 'min-h-cta px-6 flex-1 sm:flex-none'}`}
                  >
                    {/* Say why the button is unavailable while a personalized
                        question is still being written. */}
                    <span>{questionLoading ? 'Weaving…' : isLandscape ? 'Use' : 'Use question'}</span>
                    <Sparkle className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <CoachTemplatePanel
            isOpen={isTemplatePanelOpen}
            intent={templatePanelIntent}
            onClose={closeTemplatePanel}
            prefersReducedMotion={prefersReducedMotion}
            templates={templates}
            newTemplateLabel={newTemplateLabel}
            setNewTemplateLabel={setNewTemplateLabel}
            templateStatus={templateStatus}
            handleSaveTemplate={handleSaveTemplate}
            handleApplyTemplate={handleApplyTemplate}
            handleDeleteTemplate={handleDeleteTemplate}
            questionHistory={questionHistory}
            handleApplyHistoryQuestion={handleApplyHistoryQuestion}
            maxTemplates={MAX_TEMPLATES}
            getTopicLabel={getTopicLabel}
            getTimeframeLabel={getTimeframeLabel}
            getDepthLabel={getDepthLabel}
          />
        </div>
      </FocusTrap>
    </div>
  );
}
