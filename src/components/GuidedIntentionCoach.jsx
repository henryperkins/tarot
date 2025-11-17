import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import {
  INTENTION_TOPIC_OPTIONS,
  INTENTION_TIMEFRAME_OPTIONS,
  INTENTION_DEPTH_OPTIONS,
  buildGuidedQuestion,
  getCoachSummary
} from '../lib/intentionCoach';
import { scoreQuestion, getQualityLevel } from '../lib/questionQuality';

const STEPS = [
  { id: 'topic', label: 'Topic' },
  { id: 'timeframe', label: 'Timeframe' },
  { id: 'depth', label: 'Depth' }
];

const COACH_PREFS_KEY = 'tarot-coach-preferences';

const baseOptionClass =
  'text-left rounded-2xl border bg-slate-900/70 px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

// Map spreads to suggested topics
const SPREAD_TO_TOPIC_MAP = {
  relationship: 'relationships',
  decision: 'decision',
  celtic: 'growth',      // Deep 10-card work → spiritual growth
  fiveCard: 'wellbeing', // Clarity spread → balance
  threeCard: null,       // Flexible story spread
  single: null           // Quick pulse, no suggestion
};

// Friendly spread names for hints
const SPREAD_NAMES = {
  relationship: 'Relationship Snapshot',
  decision: 'Decision',
  celtic: 'Celtic Cross',
  fiveCard: 'Five-Card Clarity',
  threeCard: 'Three-Card Story',
  single: 'One-Card Insight'
};

export function GuidedIntentionCoach({ isOpen, selectedSpread, onClose, onApply }) {
  const [step, setStep] = useState(0);

  // Determine suggested topic based on spread
  const suggestedTopic = useMemo(() => {
    return SPREAD_TO_TOPIC_MAP[selectedSpread] || INTENTION_TOPIC_OPTIONS[0].value;
  }, [selectedSpread]);

  const [topic, setTopic] = useState(suggestedTopic);
  const [timeframe, setTimeframe] = useState(INTENTION_TIMEFRAME_OPTIONS[1].value);
  const [depth, setDepth] = useState(INTENTION_DEPTH_OPTIONS[1].value);
  const [customFocus, setCustomFocus] = useState('');
  const modalRef = React.useRef(null);
  const titleId = React.useId();

  useEffect(() => {
    if (isOpen) {
      // Try to load saved preferences
      try {
        const saved = JSON.parse(localStorage.getItem(COACH_PREFS_KEY) || '{}');
        const now = Date.now();
        const weekAgo = 7 * 24 * 60 * 60 * 1000;

        // Use saved preferences if recent (within a week)
        const isRecent = saved.timestamp && (now - saved.timestamp) < weekAgo;

        setStep(0);
        setTopic(isRecent && saved.lastTopic ? saved.lastTopic : suggestedTopic);
        setTimeframe(isRecent && saved.lastTimeframe ? saved.lastTimeframe : INTENTION_TIMEFRAME_OPTIONS[1].value);
        setDepth(isRecent && saved.lastDepth ? saved.lastDepth : INTENTION_DEPTH_OPTIONS[1].value);
        setCustomFocus('');
      } catch (error) {
        // If localStorage fails, use defaults
        setStep(0);
        setTopic(suggestedTopic);
        setTimeframe(INTENTION_TIMEFRAME_OPTIONS[1].value);
        setDepth(INTENTION_DEPTH_OPTIONS[1].value);
        setCustomFocus('');
      }
    }
  }, [isOpen, suggestedTopic]);

  // Escape key handler and focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    // Focus the modal when it opens
    if (modalRef.current) {
      modalRef.current.focus();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const generatedQuestion = useMemo(
    () => buildGuidedQuestion({ topic, timeframe, depth, customFocus }),
    [topic, timeframe, depth, customFocus]
  );

  const questionQuality = useMemo(
    () => scoreQuestion(generatedQuestion),
    [generatedQuestion]
  );

  const qualityLevel = useMemo(
    () => getQualityLevel(questionQuality.score),
    [questionQuality.score]
  );

  const summary = getCoachSummary({ topic, timeframe, depth });

  const canGoNext = () => {
    if (step === 0) return Boolean(topic);
    if (step === 1) return Boolean(timeframe);
    if (step === 2) return Boolean(depth);
    return false;
  };

  const goNext = () => {
    if (step < STEPS.length - 1 && canGoNext()) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleApply = () => {
    if (!generatedQuestion) return;

    // Save preferences for next time
    try {
      const prefs = {
        lastTopic: topic,
        lastTimeframe: timeframe,
        lastDepth: depth,
        timestamp: Date.now()
      };
      localStorage.setItem(COACH_PREFS_KEY, JSON.stringify(prefs));
    } catch (error) {
      // Silently fail if localStorage is not available
      console.warn('Could not save coach preferences:', error);
    }

    onApply?.(generatedQuestion);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur"
      onClick={(e) => {
        // Close on backdrop click (not on modal content click)
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full h-full sm:h-auto sm:max-w-3xl sm:mx-4 sm:rounded-3xl border-0 sm:border border-emerald-400/40 bg-slate-950 shadow-2xl focus:outline-none overflow-y-auto sm:overflow-visible"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-amber-200/80 hover:text-amber-50"
          aria-label="Close intention coach"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col gap-6 px-4 pb-safe pt-16 sm:pt-8 sm:px-10 sm:pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-200">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Guided Intention Coach</span>
            </div>
            <h2 id={titleId} className="mt-2 font-serif text-2xl text-amber-100">Shape a question with clarity</h2>
            <p className="mt-1 text-sm text-amber-100/70">
              Answer three quick prompts and we&apos;ll craft an open-ended question you can drop
              directly into your reading.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Step Progress Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/70 flex-wrap">
                {STEPS.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 min-h-[32px] touch-manipulation ${
                        index === step
                          ? 'bg-emerald-500/80 text-slate-950'
                          : 'bg-slate-800/80 text-amber-100/70 hover:bg-slate-700/80'
                      }`}
                      onClick={() => setStep(index)}
                    >
                      <span className="hidden sm:inline">{entry.label}</span>
                      <span className="sm:hidden">{index + 1}</span>
                    </button>
                    {index < STEPS.length - 1 && <span className="text-amber-100/30">·</span>}
                  </React.Fragment>
                ))}
              </div>
              <div className="text-xs text-emerald-200 font-medium">
                Step {step + 1} of {STEPS.length}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5">
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-amber-100/80">What area do you want to explore?</p>
                  {SPREAD_TO_TOPIC_MAP[selectedSpread] && (
                    <div className="rounded-lg bg-emerald-900/20 border border-emerald-400/30 px-3 py-2">
                      <p className="text-xs text-emerald-200">
                        💡 Based on your <span className="font-medium">{SPREAD_NAMES[selectedSpread]}</span> spread, we suggest exploring{' '}
                        <span className="font-medium text-emerald-100">
                          {INTENTION_TOPIC_OPTIONS.find(opt => opt.value === SPREAD_TO_TOPIC_MAP[selectedSpread])?.label}
                        </span>
                        . Feel free to choose any topic.
                      </p>
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {INTENTION_TOPIC_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${baseOptionClass} ${option.value === topic ? 'border-emerald-400/60 shadow-lg shadow-emerald-900/20' : 'border-slate-700/60 hover:border-emerald-300/40'}`}
                        onClick={() => setTopic(option.value)}
                      >
                        <p className="font-medium text-amber-100">{option.label}</p>
                        <p className="text-sm text-amber-100/70">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-amber-100/80">When do you need guidance for?</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {INTENTION_TIMEFRAME_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${baseOptionClass} ${option.value === timeframe ? 'border-emerald-400/60 shadow-lg shadow-emerald-900/20' : 'border-slate-700/60 hover:border-emerald-300/40'}`}
                        onClick={() => setTimeframe(option.value)}
                      >
                        <p className="font-medium text-amber-100">{option.label}</p>
                        <p className="text-sm text-amber-100/70">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-amber-100/80">How deep do you want to go?</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {INTENTION_DEPTH_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={`${baseOptionClass} ${option.value === depth ? 'border-emerald-400/60 shadow-lg shadow-emerald-900/20' : 'border-slate-700/60 hover:border-emerald-300/40'}`}
                          onClick={() => setDepth(option.value)}
                        >
                          <p className="font-medium text-amber-100">{option.label}</p>
                          <p className="text-sm text-amber-100/70">{option.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="custom-focus" className="text-sm font-medium text-amber-200">
                      Add a detail (optional)
                    </label>
                    <input
                      id="custom-focus"
                      type="text"
                      value={customFocus}
                      onChange={event => setCustomFocus(event.target.value)}
                      placeholder="e.g. a potential move, a creative launch, a new relationship"
                      className="w-full rounded-xl border border-emerald-400/40 bg-slate-950/80 px-4 py-3 text-amber-100 placeholder:text-emerald-200/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
                    />
                  </div>

                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-4 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Suggested question</p>
                      <p className="mt-2 font-serif text-lg text-amber-50">
                        {generatedQuestion}
                      </p>
                    </div>

                    {/* Question Quality Indicator */}
                    <div className="flex items-center gap-3 pt-2 border-t border-emerald-400/20">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-emerald-200">Question quality</span>
                          <span className="text-xs font-medium text-emerald-100">
                            {qualityLevel.emoji} {qualityLevel.label}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              questionQuality.score >= 85
                                ? 'bg-emerald-500'
                                : questionQuality.score >= 65
                                ? 'bg-green-500'
                                : questionQuality.score >= 40
                                ? 'bg-amber-500'
                                : 'bg-orange-500'
                            }`}
                            style={{ width: `${questionQuality.score}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quality Feedback */}
                    {questionQuality.feedback.length > 0 && questionQuality.score < 85 && (
                      <div className="text-xs text-amber-100/70 space-y-1">
                        {questionQuality.feedback.slice(0, 2).map((tip, i) => (
                          <p key={i} className="flex items-start gap-1">
                            <span className="text-emerald-300 mt-0.5">•</span>
                            <span>{tip}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sticky bottom-0 sm:static bg-slate-950 sm:bg-transparent pt-4 sm:pt-0 -mx-4 sm:mx-0 px-4 sm:px-0 pb-4 sm:pb-0 border-t sm:border-t-0 border-slate-800/50">
            <div className="text-xs text-amber-100/70 hidden sm:block">
              <p>
                {summary.topicLabel} · {summary.timeframeLabel} · {summary.depthLabel}
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex items-center justify-center gap-1 rounded-full border border-slate-700/70 px-4 py-2.5 sm:py-2 text-sm text-amber-100 transition disabled:opacity-40 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none touch-manipulation"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-2.5 sm:py-2 text-sm font-medium text-emerald-100 transition disabled:opacity-50 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none touch-manipulation"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!generatedQuestion}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/80 px-5 py-2.5 sm:py-2 text-sm font-semibold text-slate-950 transition disabled:opacity-50 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none touch-manipulation"
                >
                  <span>Use question</span>
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
