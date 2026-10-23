import { Fragment, useCallback, useEffect, useRef, useState, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { ArrowLeft, ArrowRight, Check, BookmarkSimple, Sparkle, MagicWand, X, ArrowsClockwise } from '@phosphor-icons/react';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useSmallScreen } from '../../hooks/useSmallScreen';
import { useLandscape } from '../../hooks/useLandscape';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSwipeDismiss } from '../../hooks/useSwipeDismiss';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { useAutoGrow } from '../../hooks/useAutoGrow';
import { useSettledValue } from '../../hooks/useSettledValue';
import { INTENTION_TOPIC_OPTIONS, INTENTION_TIMEFRAME_OPTIONS, INTENTION_DEPTH_OPTIONS, buildGuidedQuestion } from '../../lib/intentionCoach';
import { MAX_TEMPLATES } from '../../lib/coachStorage';
import { MOBILE_COACH_DIALOG_ID } from '../mobileActionBarConstants';
import { CUSTOM_FOCUS_MAX_LENGTH, STEPS } from '../../lib/coachConstants';
import { useGuidedIntentionCoach } from '../../contexts/GuidedIntentionCoachContext';
import { USER_QUESTION_MAX_LENGTH } from '../../../shared/contracts/readingRequestLimits.js';
import { CoachSuggestionsPanel } from './CoachSuggestionsPanel';
import { CoachTemplatePanel } from './CoachTemplatePanel';
import '../../styles/coach.css';

const REVIEW_STEP = 3;
const optionClass = 'relative text-left rounded-xl border bg-surface-muted/50 px-4 py-4 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
const quietButton = 'inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-lg px-2 text-sm text-secondary hover:text-main hover:bg-secondary/10 transition';
const footerButton = 'inline-flex min-w-0 min-h-cta items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation';
const getTopicLabel = value => INTENTION_TOPIC_OPTIONS.find(option => option.value === value)?.label || null;
const getTimeframeLabel = value => INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === value)?.label || null;
const getDepthLabel = value => INTENTION_DEPTH_OPTIONS.find(option => option.value === value)?.label || null;

export function GuidedIntentionCoachView({ returnFocusRef }) {
  const {
    isOpen, selectedSpread, spreadQuestionContext, onClose, canUseAIQuestions,
    step, setStep, reviewFocusRequest, topic, timeframe, depth, customFocus,
    useCreative, currentQuestion, isManualQuestion, questionLoading, questionError, announcement,
    prefillSource, prefillSourceDescription, templates, newTemplateLabel,
    setNewTemplateLabel, templateStatus, templateUndo, handleUndoTemplateSave,
    questionHistory, personalizedSuggestions, suggestionsPage, isSuggestionsExpanded,
    isTemplatePanelOpen, templatePanelIntent, astroHighlights, astroWindowDays,
    coachSnapshotLabel, coachSnapshotDetail, focusAreaSuggestedTopic,
    originalQuestion, previousQuestion, framingSuggestions = [], startFresh,
    restoreOriginalQuestion, restorePreviousQuestion, suggestionPageCount,
    visibleSuggestions, setTimeframe, setTopic, setDepth, setCustomFocus,
    setSuggestionsPage, setSuggestionsExpanded, editQuestion, remixQuestion,
    setCreativeMode, openTemplatePanel, closeTemplatePanel, releasePrefill,
    handleSaveTemplate, handleApplyTemplate, handleDeleteTemplate,
    handleSuggestionPick, handleApplyHistoryQuestion, canGoNext, goNext, goBack,
    handleApply
  } = useGuidedIntentionCoach();

  const isSmallScreen = useSmallScreen();
  const isLandscape = useLandscape();
  const prefersReducedMotion = useReducedMotion();
  const keyboardOffset = Math.max(0, useKeyboardOffset());
  const questionInputRef = useAutoGrow(currentQuestion, isLandscape ? 2 : 3, Infinity, isOpen && step === REVIEW_STEP);
  const modalRef = useRef(null);
  const scrollRef = useRef(null);
  const footerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const reviewHeadingRef = useRef(null);
  const customFocusRef = useRef(null);
  const stepButtonRefs = useRef([]);
  const previousReviewRef = useRef({ step: null, request: -1 });
  const [footerInFlow, setFooterInFlow] = useState(false);
  const titleId = useId();
  const reviewHeadingId = useId();
  const questionId = useId();
  const questionHelpId = useId();
  const topicPromptId = useId();
  const timeframePromptId = useId();
  const depthPromptId = useId();
  const customFocusId = useId();
  const settledFraming = useSettledValue(framingSuggestions.slice(0, 2).join(' '));
  const framingAnnouncement = framingSuggestions.length ? settledFraming : '';

  const getFallbackFocus = useCallback(() => {
    const candidates = [
      ...document.querySelectorAll('[aria-label="Open guided coach (Shift+G)"], [aria-label="Open guided intention coach"]'),
      ...document.querySelectorAll('[data-coach-fallback-focus], [data-reading-focus-target]')
    ];
    return candidates.find(element => element instanceof HTMLElement && element.isConnected
      && !element.matches(':disabled') && !element.closest('[inert], [hidden], [aria-hidden="true"]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden') || null;
  }, []);

  useModalA11y(isOpen, {
    onClose, containerRef: modalRef, trapFocus: false,
    initialFocusRef: step === REVIEW_STEP ? questionInputRef : closeButtonRef,
    returnFocusRef, getFallbackFocus,
    onBack: () => (isTemplatePanelOpen ? closeTemplatePanel() : onClose()),
    backGuardId: 'intentionCoach'
  });

  useEffect(() => {
    if (!isOpen || isTemplatePanelOpen) return undefined;
    const last = previousReviewRef.current;
    const requestChanged = last.request !== reviewFocusRequest;
    const enteredReview = step === REVIEW_STEP && (last.step !== REVIEW_STEP || requestChanged);
    const fromStepTab = document.activeElement?.getAttribute('role') === 'tab';
    previousReviewRef.current = { step, request: reviewFocusRequest };
    if (!enteredReview) return undefined;
    // Let a closing template layer restore its opener before moving to the
    // chosen question. Only step entry/picks move focus, never editor updates.
    const timer = setTimeout(() => {
      // Arrow navigation keeps the active tab focused. Footer entry, initial
      // entry and explicit suggestion/template picks land in the editor.
      if (!fromStepTab || requestChanged) questionInputRef.current?.focus({ preventScroll: true });
      reviewHeadingRef.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, step, reviewFocusRequest, isTemplatePanelOpen, questionInputRef, prefersReducedMotion]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const measure = () => {
      const available = modalRef.current?.clientHeight || 0;
      const footer = footerRef.current?.getBoundingClientRect().height || 0;
      if (available && footer) setFooterInFlow(footer > available * 0.25);
    };
    const observer = new ResizeObserver(measure);
    if (modalRef.current) observer.observe(modalRef.current);
    if (footerRef.current) observer.observe(footerRef.current);
    measure();
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [isOpen, step, keyboardOffset]);

  const { handlers: swipeDismissHandlers, style: swipeDismissStyle } = useSwipeDismiss({
    onDismiss: onClose, threshold: 120, resistance: 0.5
  });

  useEffect(() => {
    if (isOpen) setSuggestionsExpanded(!isSmallScreen);
  }, [isOpen, isSmallScreen, setSuggestionsExpanded]);

  const buildSuggestionPreview = useCallback(suggestion => {
    if (!suggestion) return '';
    if (suggestion.question) return suggestion.question;
    const nextTopic = suggestion.topic || topic;
    const nextTimeframe = suggestion.timeframe || timeframe;
    const nextDepth = suggestion.depth || depth;
    const nextFocus = typeof suggestion.customFocus === 'string' ? suggestion.customFocus.trim() : '';
    return buildGuidedQuestion({
      topic: nextTopic, timeframe: nextTimeframe, depth: nextDepth,
      customFocus: nextFocus || undefined, spreadKey: selectedSpread,
      seed: ['suggestion', suggestion.id || suggestion.label || 'preview', nextTopic, nextTimeframe, nextDepth, nextFocus].join('|')
    });
  }, [topic, timeframe, depth, selectedSpread]);

  const selectStep = index => {
    setStep(index);
    if (index !== REVIEW_STEP) scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleStepKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % STEPS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + STEPS.length) % STEPS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = STEPS.length - 1;
    else return;
    event.preventDefault();
    selectStep(nextIndex);
    stepButtonRefs.current[nextIndex]?.focus();
  };

  const selectSetting = (setter, current, value) => {
    if (value !== current) releasePrefill();
    setter(value);
  };

  const renderOptions = (options, selected, setter, promptId, columns = 'sm:grid-cols-2') => (
    <div role="radiogroup" aria-labelledby={promptId} className={`grid gap-3 ${columns}`}>
      {options.map((option, index) => (
        <button
          key={option.value} type="button" role="radio" aria-checked={selected === option.value}
          tabIndex={selected === option.value || (!options.some(item => item.value === selected) && index === 0) ? 0 : -1}
          className={`${optionClass} ${selected === option.value ? 'border-accent bg-accent/10' : 'border-secondary/30 hover:border-accent/50'}`}
          onClick={() => selectSetting(setter, selected, option.value)}
          onKeyDown={event => {
            let next;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = options.length - 1;
            else return;
            event.preventDefault();
            selectSetting(setter, selected, options[next].value);
            event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll('[role="radio"]')[next]?.focus();
          }}
        >
          {selected === option.value && <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-surface" aria-hidden="true"><Check className="h-3.5 w-3.5" weight="bold" /></span>}
          <span className="block pr-8 font-medium text-main">{option.label}</span>
          <span className="block text-sm text-muted">{option.description}</span>
          {option.value === focusAreaSuggestedTopic && <span className="mt-2 block text-xs text-secondary">Based on your interests</span>}
        </button>
      ))}
    </div>
  );

  const renderDetail = suffix => (
    <div className="space-y-2">
      <label htmlFor={`${customFocusId}-${suffix}`} className="block text-sm font-medium text-main">Add a detail (optional)</label>
      <input
        ref={suffix === 'review' ? customFocusRef : undefined}
        id={`${customFocusId}-${suffix}`} type="text" value={customFocus}
        maxLength={CUSTOM_FOCUS_MAX_LENGTH} autoComplete="off" enterKeyHint="done"
        onChange={event => { releasePrefill(); setCustomFocus(event.target.value); }}
        placeholder="e.g. a conversation, a creative launch, a potential move"
        className="coach-detail w-full min-h-touch rounded-xl border border-secondary/40 bg-surface-muted/40 px-3 py-3 text-base text-main caret-accent placeholder:text-muted focus:border-secondary focus:outline-hidden focus:ring-2 focus:ring-secondary/60"
      />
    </div>
  );

  const renderReview = () => (
    <section className="coach-review" aria-labelledby={reviewHeadingId}>
      <h3 ref={reviewHeadingRef} id={reviewHeadingId} className="font-serif text-xl sm:text-2xl text-main">Review your question</h3>
      <div className="space-y-2" aria-busy={questionLoading}>
        <label htmlFor={questionId} className="block text-sm font-medium text-main">Your Question</label>
        <textarea
          ref={questionInputRef} id={questionId} value={currentQuestion}
          onChange={event => editQuestion(event.target.value)}
          rows={isLandscape ? 2 : 3} maxLength={USER_QUESTION_MAX_LENGTH} dir="auto"
          aria-describedby={questionHelpId} placeholder="Write your question in your own words…"
          className="coach-question block w-full min-h-touch resize-none overflow-hidden rounded-xl border border-secondary/40 bg-surface-muted/40 font-serif text-main leading-relaxed caret-accent placeholder:text-muted focus:border-secondary focus:outline-hidden focus:ring-2 focus:ring-secondary/60"
        />
        <p id={questionHelpId} className="text-xs text-secondary">Edit the wording before using your question. Framing suggestions are optional.</p>
      </div>
      {framingSuggestions.length > 0 && (
        <div className="coach-framing space-y-2">
          <p className="text-sm font-medium text-main">Question framing</p>
          <ul className="space-y-2 text-sm text-secondary">
            {framingSuggestions.slice(0, 2).map(suggestion => <li key={suggestion}>{suggestion}</li>)}
          </ul>
        </div>
      )}
      {questionLoading && <p className="text-sm text-secondary">Refining your wording…</p>}
      {questionError && <p className="text-sm text-secondary">{questionError}</p>}
      {previousQuestion && <button type="button" className={`${quietButton} justify-start underline underline-offset-4`} onClick={restorePreviousQuestion}>Restore my wording</button>}
      {prefillSource && prefillSourceDescription && <p className="text-xs text-secondary">Starting from {prefillSourceDescription}.</p>}
      <div className="coach-adjustments space-y-4">
        <h4 className="text-base font-medium text-main">Adjust your question</h4>
        <p className="text-sm text-secondary">Your wording stays as written when you change a setting. Choose Generate new wording when you want a new version.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Question settings">
          {[['Topic', getTopicLabel(topic), 0], ['Timeframe', getTimeframeLabel(timeframe), 1], ['Depth', getDepthLabel(depth), 2]].map(([name, label, index]) => (
            <button key={name} type="button" className={`${quietButton} border border-secondary/30`} onClick={() => {
              selectStep(index);
              requestAnimationFrame(() => {
                const selected = modalRef.current?.querySelector(`#step-panel-${STEPS[index].id} [role="radio"][aria-checked="true"]`);
                (selected || stepButtonRefs.current[index])?.focus();
              });
            }}>{isManualQuestion ? name : `${name}: ${label}`}</button>
          ))}
        </div>
        {renderDetail('review')}
        {canUseAIQuestions ? (
          <label className="inline-flex min-h-touch items-center gap-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={useCreative} onChange={event => setCreativeMode(event.target.checked)} className="h-4 w-4 rounded border-secondary/60 text-secondary focus:ring-secondary" />
            <MagicWand className="h-4 w-4" aria-hidden="true" /> Personalize with AI
          </label>
        ) : <p className="text-xs text-secondary">AI refinement is available on Plus and Pro.</p>}
        {canUseAIQuestions && <p className="text-xs text-secondary">AI refinement can use journal themes and recent questions when available.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={remixQuestion} disabled={questionLoading} className={`${quietButton} border border-secondary/40 disabled:opacity-50`}><ArrowsClockwise className="h-4 w-4 shrink-0" aria-hidden="true" />Generate new wording</button>
          <button type="button" onClick={() => openTemplatePanel('save')} aria-haspopup="dialog" className={`${quietButton} underline underline-offset-4`}>Save as template</button>
        </div>
        {astroHighlights?.length > 0 && (
          <div className="space-y-2 text-sm text-secondary">
            <p>Symbolic astrology context{astroWindowDays ? ` · ${astroWindowDays} days` : ''}</p>
            <ul className="space-y-1">{astroHighlights.map((item, index) => <li key={index}>{item}</li>)}</ul>
            <p className="text-xs">Astrology here is symbolic context, not a prediction.</p>
          </div>
        )}
      </div>
    </section>
  );

  const renderStep = id => {
    if (id === 'topic') return (
      <div className="space-y-4">
        <p id={topicPromptId} className="text-base text-main">What area do you want to explore?</p>
        {spreadQuestionContext && <p className="text-sm text-secondary"><span className="font-medium text-main">Shaped for your spread: {spreadQuestionContext.shortName}.</span> {spreadQuestionContext.hint} Your existing wording stays as written until you ask for a new version.</p>}
        {renderOptions(INTENTION_TOPIC_OPTIONS, topic, setTopic, topicPromptId, 'md:grid-cols-2')}
      </div>
    );
    if (id === 'timeframe') return (
      <div className="space-y-4">
        <p id={timeframePromptId} className="text-base text-main">When do you want to explore?</p>
        <p className="text-sm text-secondary">Choose a timeframe if it helps. You can remove it from your question at review.</p>
        {renderOptions(INTENTION_TIMEFRAME_OPTIONS, timeframe, setTimeframe, timeframePromptId)}
      </div>
    );
    if (id === 'depth') return (
      <div className="space-y-5">
        <p id={depthPromptId} className="text-base text-main">How deep do you want to go?</p>
        {renderOptions(INTENTION_DEPTH_OPTIONS, depth, setDepth, depthPromptId, 'md:grid-cols-2')}
        {renderDetail('depth')}
      </div>
    );
    if (id === 'review') return renderReview();
    return null;
  };

  if (!isOpen) return null;
  const closesFromFooter = isSmallScreen && step === 0;
  const suggestions = (
    <CoachSuggestionsPanel
      personalizedSuggestions={personalizedSuggestions} isSuggestionsExpanded={isSuggestionsExpanded}
      setSuggestionsExpanded={setSuggestionsExpanded} suggestionPageCount={suggestionPageCount}
      suggestionsPage={suggestionsPage} setSuggestionsPage={setSuggestionsPage}
      visibleSuggestions={visibleSuggestions} buildSuggestionPreview={buildSuggestionPreview}
      handleSuggestionPick={handleSuggestionPick} getTopicLabel={getTopicLabel}
      getTimeframeLabel={getTimeframeLabel} getDepthLabel={getDepthLabel}
      coachSnapshotLabel={coachSnapshotLabel} coachSnapshotDetail={coachSnapshotDetail}
    />
  );

  return (
    <div className={`fixed inset-0 z-70 flex justify-center ${isSmallScreen ? 'items-end pt-[max(16px,var(--safe-pad-top))]' : 'items-center'}`} style={keyboardOffset ? { paddingBottom: `${keyboardOffset}px` } : undefined}>
      <div className={`absolute inset-0 ${isSmallScreen ? 'mobile-drawer-overlay' : 'bg-main/90 backdrop-blur'} ${prefersReducedMotion ? '' : 'animate-fade-in'}`} onClick={onClose} aria-hidden="true" />
      <FocusTrap active={isOpen} focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: false, allowOutsideClick: true }}>
        <div
          ref={modalRef} id={MOBILE_COACH_DIALOG_ID} role="dialog" aria-modal="true" aria-labelledby={titleId}
          className={`coach-dialog relative w-full flex flex-col min-h-0 wrap-anywhere focus:outline-hidden selection:bg-accent selection:text-surface ${isSmallScreen ? `mobile-drawer ${prefersReducedMotion ? '' : 'animate-slide-up'}` : `max-w-3xl mx-4 rounded-3xl border border-secondary/30 bg-surface shadow-(--ui-elevated-shadow) ${prefersReducedMotion ? '' : 'animate-pop-in'}`}`}
          style={{ maxHeight: isSmallScreen ? 'calc(100% - 8px)' : isLandscape ? '98%' : '90%', ...(isSmallScreen ? { transform: swipeDismissStyle.transform, transition: prefersReducedMotion ? 'none' : swipeDismissStyle.transition } : {}) }}
          {...(isSmallScreen && !isTemplatePanelOpen ? swipeDismissHandlers : {})}
        >
          {isSmallScreen && <div className="mobile-drawer__handle" aria-hidden="true" />}
          <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
          <p className="sr-only" aria-live="polite">{framingAnnouncement}</p>
          <div ref={scrollRef} className="coach-dialog__scroll scrollbar-themed">
            <div className="coach-dialog__header">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 id={titleId} className="font-serif text-xl sm:text-2xl text-main">Shape a question with clarity</h2>
                  {!isLandscape && <p className="text-sm text-secondary">Keep what matters. Shape the wording before you use it.</p>}
                </div>
                <button ref={closeButtonRef} type="button" onClick={onClose} className={`${quietButton} shrink-0`} aria-label="Close intention coach"><X className="h-5 w-5" aria-hidden="true" /></button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                <button type="button" className={`${quietButton} underline underline-offset-4`} onClick={startFresh}>Start fresh</button>
                {originalQuestion && <button type="button" className={`${quietButton} underline underline-offset-4`} onClick={restoreOriginalQuestion}>Restore original question</button>}
              </div>
            </div>
            <div className="coach-dialog__body">
              <div className="coach-step-nav">
                <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Coach wizard steps">
                  {STEPS.map((entry, index) => (
                    <Fragment key={entry.id}>
                      <button
                        ref={element => { stepButtonRefs.current[index] = element; }} type="button"
                        id={`step-tab-${entry.id}`} role="tab" aria-selected={index === step}
                        aria-controls={`step-panel-${entry.id}`} tabIndex={index === step ? 0 : -1}
                        className={`coach-step min-h-touch rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent ${index === step ? 'bg-accent text-surface forced-colors:underline' : 'text-secondary hover:bg-secondary/10'}`}
                        onClick={() => selectStep(index)} onKeyDown={event => handleStepKeyDown(event, index)}
                      >{entry.label}</button>
                    </Fragment>
                  ))}
                </div>
                <p className="text-xs text-secondary">Step {step + 1} of {STEPS.length}</p>
              </div>
              {STEPS.map((entry, index) => (
                <div key={entry.id} id={`step-panel-${entry.id}`} role="tabpanel" aria-labelledby={`step-tab-${entry.id}`} hidden={step !== index} tabIndex={step === index ? 0 : -1} className="coach-step-panel">
                  {renderStep(entry.id)}
                </div>
              ))}
              <div className="coach-library-tools">
                <button type="button" onClick={() => openTemplatePanel('browse')} aria-haspopup="dialog" className={quietButton}><BookmarkSimple className="h-4 w-4" aria-hidden="true" />Templates</button>
              </div>
              {suggestions}
              <p className="mt-4 text-xs text-secondary">Unfinished wording stays available while this page is open. Reloading starts a new coach session.</p>
            </div>
            <footer ref={footerRef} className={`coach-dialog__footer ${footerInFlow ? 'coach-dialog__footer--flow' : ''}`}>
              <div className="coach-footer-actions">
                <button type="button" onClick={closesFromFooter ? onClose : goBack} aria-disabled={(step === 0 && !closesFromFooter) || undefined} className={`${footerButton} border border-secondary/40 bg-surface-muted text-secondary aria-disabled:opacity-40`}>
                  {closesFromFooter ? <X className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />}{closesFromFooter ? 'Close' : 'Back'}
                </button>
                {step < REVIEW_STEP ? <button type="button" onClick={goNext} disabled={!canGoNext()} className={`${footerButton} bg-accent text-surface hover:bg-primary disabled:opacity-50`}><span>{step === 2 ? 'Review question' : 'Next'}</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></button>
                  : <button type="button" onClick={handleApply} disabled={!currentQuestion.trim() || questionLoading} className={`${footerButton} bg-accent text-surface hover:bg-primary disabled:opacity-50`}><span>{questionLoading ? 'Refining…' : 'Use this question'}</span><Sparkle className="h-4 w-4 shrink-0" aria-hidden="true" /></button>}
              </div>
            </footer>
          </div>
          <CoachTemplatePanel
            isOpen={isTemplatePanelOpen} intent={templatePanelIntent} onClose={closeTemplatePanel}
            prefersReducedMotion={prefersReducedMotion} templates={templates} newTemplateLabel={newTemplateLabel}
            setNewTemplateLabel={setNewTemplateLabel} templateStatus={templateStatus} templateUndo={templateUndo}
            handleUndoTemplateSave={handleUndoTemplateSave} handleSaveTemplate={handleSaveTemplate}
            handleApplyTemplate={handleApplyTemplate} handleDeleteTemplate={handleDeleteTemplate}
            questionHistory={questionHistory} handleApplyHistoryQuestion={handleApplyHistoryQuestion}
            maxTemplates={MAX_TEMPLATES} getTopicLabel={getTopicLabel} getTimeframeLabel={getTimeframeLabel} getDepthLabel={getDepthLabel}
          />
        </div>
      </FocusTrap>
    </div>
  );
}
