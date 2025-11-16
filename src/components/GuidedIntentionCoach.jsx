import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import {
  INTENTION_TOPIC_OPTIONS,
  INTENTION_TIMEFRAME_OPTIONS,
  INTENTION_DEPTH_OPTIONS,
  buildGuidedQuestion,
  getCoachSummary
} from '../lib/intentionCoach';

const STEPS = [
  { id: 'topic', label: 'Topic' },
  { id: 'timeframe', label: 'Timeframe' },
  { id: 'depth', label: 'Depth' }
];

const baseOptionClass =
  'text-left rounded-2xl border bg-slate-900/70 px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

export function GuidedIntentionCoach({ isOpen, onClose, onApply }) {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState(INTENTION_TOPIC_OPTIONS[0].value);
  const [timeframe, setTimeframe] = useState(INTENTION_TIMEFRAME_OPTIONS[1].value);
  const [depth, setDepth] = useState(INTENTION_DEPTH_OPTIONS[1].value);
  const [customFocus, setCustomFocus] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setTopic(INTENTION_TOPIC_OPTIONS[0].value);
      setTimeframe(INTENTION_TIMEFRAME_OPTIONS[1].value);
      setDepth(INTENTION_DEPTH_OPTIONS[1].value);
      setCustomFocus('');
    }
  }, [isOpen]);

  const generatedQuestion = useMemo(
    () => buildGuidedQuestion({ topic, timeframe, depth, customFocus }),
    [topic, timeframe, depth, customFocus]
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
    onApply?.(generatedQuestion);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="relative w-full max-w-3xl mx-4 rounded-3xl border border-emerald-400/40 bg-slate-950 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-amber-200/80 hover:text-amber-50"
          aria-label="Close intention coach"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col gap-6 px-6 pb-6 pt-8 sm:px-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-200">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Guided Intention Coach</span>
            </div>
            <h2 className="mt-2 font-serif text-2xl text-amber-100">Shape a question with clarity</h2>
            <p className="mt-1 text-sm text-amber-100/70">
              Answer three quick prompts and we&apos;ll craft an open-ended question you can drop
              directly into your reading.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/70">
              {STEPS.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 ${index === step ? 'bg-emerald-500/80 text-slate-950' : 'bg-slate-800/80 text-amber-100/70'}`}
                    onClick={() => setStep(index)}
                  >
                    {entry.label}
                  </button>
                  {index < STEPS.length - 1 && <span className="text-amber-100/30">·</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5">
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-amber-100/80">What area do you want to explore?</p>
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

                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Suggested question</p>
                    <p className="mt-2 font-serif text-lg text-amber-50">
                      {generatedQuestion}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-amber-100/70">
              <p>
                {summary.topicLabel} · {summary.timeframeLabel} · {summary.depthLabel}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-amber-100 transition disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext()}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-2 text-sm font-medium text-emerald-100 transition disabled:opacity-50"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!generatedQuestion}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/80 px-5 py-2 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
                >
                  Use question
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
