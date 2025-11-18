import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  History,
  RefreshCw,
  Sparkles,
  Wand2,
  X
} from 'lucide-react';
import {
  INTENTION_TOPIC_OPTIONS,
  INTENTION_TIMEFRAME_OPTIONS,
  INTENTION_DEPTH_OPTIONS,
  buildGuidedQuestion,
  buildCreativeQuestion,
  getCoachSummary
} from '../lib/intentionCoach';
import { scoreQuestion, getQualityLevel } from '../lib/questionQuality';
import { loadCoachRecommendation, loadStoredJournalInsights } from '../lib/journalInsights';
import {
  loadCoachTemplates,
  saveCoachTemplate,
  deleteCoachTemplate,
  loadCoachHistory,
  recordCoachQuestion
} from '../lib/coachStorage';

const STEPS = [
  { id: 'topic', label: 'Topic' },
  { id: 'timeframe', label: 'Timeframe' },
  { id: 'depth', label: 'Depth' }
];

const COACH_PREFS_KEY = 'tarot-coach-preferences';
const CONTEXT_HINTS = {
  love: {
    label: 'Relationship reciprocity',
    topic: 'relationships',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'my closest relationships and how I can nurture reciprocity'
  },
  career: {
    label: 'Purpose & vocation pulse',
    topic: 'career',
    timeframe: 'month',
    depth: 'guided',
    customFocus: 'my career direction and purpose'
  },
  self: {
    label: 'Inner growth focus',
    topic: 'growth',
    timeframe: 'open',
    depth: 'lesson',
    customFocus: 'my inner growth and healing'
  },
  spiritual: {
    label: 'Spiritual practice check-in',
    topic: 'growth',
    timeframe: 'season',
    depth: 'deep',
    customFocus: 'my spiritual practice and devotion'
  },
  wellbeing: {
    label: 'Energy & wellbeing tune-up',
    topic: 'wellbeing',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'my wellbeing and daily balance'
  },
  decision: {
    label: 'Navigating a decision',
    topic: 'decision',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'the decision currently on my mind'
  }
};

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

function buildPersonalizedSuggestions(stats, history = []) {
  const suggestions = [];
  if (stats?.frequentCards?.length) {
    stats.frequentCards.slice(0, 2).forEach((card, idx) => {
      const label =
        idx === 0 ? `Recurring card: ${card.name}` : `${card.name} keeps showing up`;
      suggestions.push({
        id: `card-${card.name}-${idx}`,
        label,
        helper: `${card.count} pulls logged${card.reversed ? ` (${card.reversed} reversed)` : ''}`,
        question: `What is ${card.name} inviting me to embody next?`,
        topic: 'growth',
        timeframe: 'open',
        depth: 'lesson',
        customFocus: `${card.name} recurring energy`
      });
    });
  }

  if (Array.isArray(stats?.recentThemes)) {
    stats.recentThemes.slice(0, 2).forEach((theme, idx) => {
      suggestions.push({
        id: `theme-${idx}`,
        label: `Lean into: ${theme}`,
        helper: 'Recent journal theme',
        topic: 'growth',
        timeframe: 'month',
        depth: 'guided',
        customFocus: theme
      });
    });
  }

  if (Array.isArray(stats?.contextBreakdown) && stats.contextBreakdown.length > 0) {
    const primary = stats.contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
    const hint = CONTEXT_HINTS[primary.name];
    if (hint) {
      suggestions.push({
        id: `context-${primary.name}`,
        label: hint.label,
        helper: `Most logged context (${primary.count})`,
        topic: hint.topic,
        timeframe: hint.timeframe,
        depth: hint.depth,
        customFocus: hint.customFocus
      });
    }
  }

  if (Array.isArray(history) && history.length > 0) {
    const last = history[0];
    suggestions.push({
      id: `history-${last.id}`,
      label: 'Revisit your last question',
      helper: last.question,
      question: last.question
    });
  }

  return suggestions.slice(0, 6);
}

function getTopicLabel(value) {
  return INTENTION_TOPIC_OPTIONS.find(option => option.value === value)?.label || null;
}

function getTimeframeLabel(value) {
  return INTENTION_TIMEFRAME_OPTIONS.find(option => option.value === value)?.label || null;
}

function getDepthLabel(value) {
  return INTENTION_DEPTH_OPTIONS.find(option => option.value === value)?.label || null;
}

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
  const [useCreative, setUseCreative] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [autoQuestionEnabled, setAutoQuestionEnabled] = useState(true);
  const [prefillSource, setPrefillSource] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [templateStatus, setTemplateStatus] = useState('');
  const [questionHistory, setQuestionHistory] = useState([]);
  const [coachStats, setCoachStats] = useState(null);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState([]);
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);
  const modalRef = React.useRef(null);
  const titleId = React.useId();
  const questionRequestRef = useRef(0);
  const releasePrefill = () => {
    if (prefillSource) {
      setPrefillSource(null);
      setAutoQuestionEnabled(true);
    }
  };

  const refreshSuggestions = () => {
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory));
  };

  const handleSaveTemplate = () => {
    const label = newTemplateLabel.trim();
    if (!label) {
      setTemplateStatus('Add a template name first.');
      return;
    }
    const payload = {
      label,
      topic,
      timeframe,
      depth,
      customFocus,
      useCreative,
      savedQuestion: questionText || guidedQuestion
    };
    const result = saveCoachTemplate(payload);
    if (result.success) {
      setTemplates(result.templates);
      setTemplateStatus('Template saved');
      setNewTemplateLabel('');
      setTimeout(() => setTemplateStatus(''), 2600);
    } else if (result.error) {
      setTemplateStatus(result.error);
      setTimeout(() => setTemplateStatus(''), 2600);
    }
  };

  const handleApplyTemplate = (template) => {
    if (!template) return;
    if (template.topic && template.topic !== topic) {
      releasePrefill();
      setTopic(template.topic);
    }
    if (template.timeframe && template.timeframe !== timeframe) {
      setTimeframe(template.timeframe);
    }
    if (template.depth && template.depth !== depth) {
      setDepth(template.depth);
    }
    setCustomFocus(template.customFocus || '');
    setUseCreative(Boolean(template.useCreative));
    if (template.savedQuestion) {
      setQuestionText(template.savedQuestion);
      setAutoQuestionEnabled(false);
    } else {
      setAutoQuestionEnabled(true);
    }
    setQuestionError('');
    setQuestionLoading(false);
    setPrefillSource({
      source: 'template',
      label: template.label
    });
  };

  const handleDeleteTemplate = (templateId) => {
    const result = deleteCoachTemplate(templateId);
    if (result.success) {
      setTemplates(result.templates);
      setTemplateStatus('Template removed');
      setTimeout(() => setTemplateStatus(''), 1800);
    }
  };

  const handleApplySuggestion = (suggestion) => {
    if (!suggestion) return;
    if (suggestion.topic && suggestion.topic !== topic) {
      releasePrefill();
      setTopic(suggestion.topic);
    }
    if (suggestion.timeframe && suggestion.timeframe !== timeframe) {
      setTimeframe(suggestion.timeframe);
    }
    if (suggestion.depth && suggestion.depth !== depth) {
      setDepth(suggestion.depth);
    }
    if (typeof suggestion.customFocus === 'string') {
      setCustomFocus(suggestion.customFocus);
    }
    if (typeof suggestion.useCreative === 'boolean') {
      setUseCreative(suggestion.useCreative);
    }
    if (suggestion.question) {
      setQuestionText(suggestion.question);
      setAutoQuestionEnabled(false);
    } else {
      setAutoQuestionEnabled(true);
    }
    setQuestionError('');
    setQuestionLoading(false);
    setPrefillSource({
      source: 'suggestion',
      label: suggestion.label
    });
  };

  const handleApplyHistoryQuestion = (historyItem) => {
    if (!historyItem) return;
    handleApplySuggestion({
      label: 'Recent question',
      question: historyItem.question
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    try {
      const saved = JSON.parse(localStorage.getItem(COACH_PREFS_KEY) || '{}');
      const now = Date.now();
      const weekAgo = 7 * 24 * 60 * 60 * 1000;
      const isRecent = saved.timestamp && (now - saved.timestamp) < weekAgo;

      setStep(0);
      setTopic(isRecent && saved.lastTopic ? saved.lastTopic : suggestedTopic);
      setTimeframe(isRecent && saved.lastTimeframe ? saved.lastTimeframe : INTENTION_TIMEFRAME_OPTIONS[1].value);
      setDepth(isRecent && saved.lastDepth ? saved.lastDepth : INTENTION_DEPTH_OPTIONS[1].value);
      setCustomFocus('');
      setUseCreative(false);
      setQuestionText('');
      setQuestionError('');
      setQuestionLoading(false);
      setAutoQuestionEnabled(true);
      setPrefillSource(null);
    } catch (error) {
      setStep(0);
      setTopic(suggestedTopic);
      setTimeframe(INTENTION_TIMEFRAME_OPTIONS[1].value);
      setDepth(INTENTION_DEPTH_OPTIONS[1].value);
      setCustomFocus('');
      setUseCreative(false);
      setQuestionText('');
      setQuestionError('');
      setQuestionLoading(false);
      setAutoQuestionEnabled(true);
      setPrefillSource(null);
    }

    const recommendation = loadCoachRecommendation();
    if (recommendation?.question) {
      if (recommendation.topicValue) {
        setTopic(recommendation.topicValue);
      }
      if (recommendation.timeframeValue) {
        setTimeframe(recommendation.timeframeValue);
      }
      if (recommendation.depthValue) {
        setDepth(recommendation.depthValue);
      }
      setUseCreative(false);
      setQuestionLoading(false);
      setQuestionError('');
      setQuestionText(recommendation.question);
      setPrefillSource(recommendation);
      setAutoQuestionEnabled(false);
    }
  }, [isOpen, suggestedTopic]);

  useEffect(() => {
    if (!isOpen) return;
    setTemplates(loadCoachTemplates());
    const history = loadCoachHistory();
    setQuestionHistory(history);
    const insights = loadStoredJournalInsights();
    setCoachStats(insights?.stats || null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory));
  }, [coachStats, questionHistory, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTemplateStatus('');
      setNewTemplateLabel('');
      setTemplatePanelOpen(false);
    }
  }, [isOpen]);

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

  const guidedQuestion = useMemo(
    () => buildGuidedQuestion({ topic, timeframe, depth, customFocus }),
    [topic, timeframe, depth, customFocus]
  );

  useEffect(() => {
    if (!isOpen) {
      setQuestionText('');
      return;
    }
    if (!autoQuestionEnabled) {
      return;
    }

    const requestId = questionRequestRef.current + 1;
    questionRequestRef.current = requestId;

    if (useCreative) {
      setQuestionLoading(true);
      setQuestionError('');
      (async () => {
        const creative = await buildCreativeQuestion({ topic, timeframe, depth, customFocus });
        if (questionRequestRef.current !== requestId) {
          return;
        }
        if (creative) {
          setQuestionText(creative);
          setQuestionError('');
        } else {
          setQuestionText(guidedQuestion);
          setQuestionError('Personalized mode is temporarily unavailable. Showing guided version.');
        }
        setQuestionLoading(false);
      })();
    } else {
      setQuestionLoading(false);
      setQuestionError('');
      setQuestionText(guidedQuestion);
    }

    return () => {
      questionRequestRef.current += 1;
    };
  }, [guidedQuestion, useCreative, topic, timeframe, depth, customFocus, isOpen, autoQuestionEnabled]);

  const questionQuality = useMemo(
    () => scoreQuestion(questionText || guidedQuestion || ''),
    [questionText, guidedQuestion]
  );

  const qualityLevel = useMemo(
    () => getQualityLevel(questionQuality.score),
    [questionQuality.score]
  );

  const summary = getCoachSummary({ topic, timeframe, depth });

  const questionContextChips = useMemo(() => {
    const chips = [];
    if (summary.topicLabel) {
      chips.push(`Topic: ${summary.topicLabel}`);
    }
    if (summary.timeframeLabel) {
      chips.push(`Timing: ${summary.timeframeLabel}`);
    }
    if (summary.depthLabel) {
      chips.push(`Depth: ${summary.depthLabel}`);
    }
    if (customFocus?.trim()) {
      chips.push(`Detail: ${customFocus.trim()}`);
    }
    return chips;
  }, [summary.topicLabel, summary.timeframeLabel, summary.depthLabel, customFocus]);

  const qualityHelperText = useMemo(() => {
    if (questionQuality.score >= 85) return 'Ready to anchor into your spread.';
    if (questionQuality.score >= 65) return 'Add one more detail for extra clarity.';
    if (questionQuality.score >= 40) return 'Sharpen the focus to strengthen it.';
    return 'Try reframing it from a curious, open-ended angle.';
  }, [questionQuality.score]);

  const normalizedQualityScore = Math.min(Math.max(questionQuality.score, 0), 100);

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
    if (!questionText) return;

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

    onApply?.(questionText);
    const updatedHistory = recordCoachQuestion(questionText);
    setQuestionHistory(updatedHistory);
    refreshSuggestions();
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur animate-fade-in"
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
        className="relative w-full h-full sm:h-auto sm:max-w-3xl sm:mx-4 sm:rounded-3xl border-0 sm:border border-emerald-400/40 bg-slate-950 shadow-2xl focus:outline-none flex flex-col sm:block animate-pop-in"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-amber-200/80 hover:text-amber-50 z-10"
          aria-label="Close intention coach"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto sm:overflow-visible">
          <div className="flex flex-col gap-6 px-4 pb-6 pt-16 sm:pt-8 sm:px-10 sm:pb-6">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/70 flex-wrap">
                  {STEPS.map((entry, index) => (
                    <React.Fragment key={entry.id}>
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 min-h-[32px] touch-manipulation ${index === step
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <p className="text-xs text-emerald-200 font-medium">
                    Step {step + 1} of {STEPS.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTemplatePanelOpen(true)}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-emerald-400/40 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    Templates
                  </button>
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
                          onClick={() => {
                            if (option.value !== topic) {
                              releasePrefill();
                            }
                            setTopic(option.value);
                          }}
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
                          onClick={() => {
                            if (option.value !== timeframe) {
                              releasePrefill();
                            }
                            setTimeframe(option.value);
                          }}
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
                            onClick={() => {
                              if (option.value !== depth) {
                                releasePrefill();
                              }
                              setDepth(option.value);
                            }}
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
                        onChange={event => {
                          releasePrefill();
                          setCustomFocus(event.target.value);
                        }}
                        placeholder="e.g. a potential move, a creative launch, a new relationship"
                        className="w-full rounded-xl border border-emerald-400/40 bg-slate-950/80 px-4 py-3 text-amber-100 placeholder:text-emerald-200/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
                      />
                    </div>

                    <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/5 p-4 space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-200">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                            Question blueprint
                          </p>
                          <p className="text-xs text-emerald-100/80">
                            Adjust the topic, timing, or depth and we’ll re-weave the wording automatically.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-slate-950/50 px-3 py-1.5 text-[0.7rem] text-emerald-100 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-emerald-400/60 bg-transparent text-emerald-400 focus:ring-emerald-400"
                              checked={useCreative}
                              onChange={event => {
                                releasePrefill();
                                setUseCreative(event.target.checked);
                                setAutoQuestionEnabled(true);
                              }}
                            />
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Wand2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                              Personalize with AI
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setPrefillSource(null);
                              setAutoQuestionEnabled(true);
                              setQuestionError('');
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-transparent px-3 py-1.5 text-[0.7rem] font-semibold text-emerald-100 hover:bg-emerald-500/10 transition"
                          >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            Remix
                          </button>
                        </div>
                      </div>
                      {prefillSource && (
                        <p className="text-xs text-emerald-200/80">
                          <span className="font-semibold text-emerald-100">Auto-filled</span> from your journal insights.
                        </p>
                      )}
                      {questionLoading && (
                        <p className="text-xs text-amber-200/80 animate-pulse">Weaving a personalized prompt…</p>
                      )}
                      {questionError && (
                        <p className="text-xs text-amber-300/80">{questionError}</p>
                      )}
                      <div className="rounded-2xl border border-emerald-400/30 bg-slate-950/60 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-emerald-200/80">
                          <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                          Current draft
                        </div>
                        <p className="font-serif text-xl text-amber-50 leading-relaxed">
                          {questionText || guidedQuestion}
                        </p>
                        {questionContextChips.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {questionContextChips.map(chip => (
                              <span
                                key={chip}
                                className="rounded-full border border-emerald-400/40 bg-transparent px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-emerald-100/80"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Question Quality Indicator */}
                      <div className="rounded-2xl border border-emerald-400/30 bg-slate-950/40 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-emerald-200">
                          <span className="inline-flex items-center gap-1">
                            <Activity className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                            Question quality
                          </span>
                          <span className="text-xs font-semibold text-emerald-100">
                            {qualityLevel.emoji} {qualityLevel.label}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${normalizedQualityScore >= 85
                                ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300'
                                : normalizedQualityScore >= 65
                                  ? 'bg-gradient-to-r from-green-400 via-emerald-400 to-emerald-300'
                                  : normalizedQualityScore >= 40
                                    ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-orange-300'
                                    : 'bg-gradient-to-r from-red-400 via-orange-500 to-amber-300'
                              }`}
                            style={{ width: `${normalizedQualityScore}%` }}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between text-[0.7rem] text-emerald-200/80">
                          <span className="uppercase tracking-[0.2em]">Score {questionQuality.score}/100</span>
                          <span className="text-emerald-100/80 sm:text-right">{qualityHelperText}</span>
                        </div>
                      </div>

                      {/* Quality Feedback */}
                      {questionQuality.feedback.length > 0 && questionQuality.score < 85 && (
                        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-3 text-xs text-amber-100/80 space-y-1">
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

              {personalizedSuggestions.length > 0 && (
                <section className="rounded-3xl border border-emerald-400/30 bg-slate-950/60 mx-4 sm:mx-10 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Personalized suggestions</p>
                    <button
                      type="button"
                      onClick={refreshSuggestions}
                      className="text-xs text-emerald-200 hover:text-emerald-100 underline decoration-dotted"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-2">
                    {personalizedSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleApplySuggestion(suggestion)}
                        className="w-full text-left rounded-2xl border border-emerald-400/20 bg-slate-900/70 px-4 py-3 hover:border-emerald-300/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-amber-100">{suggestion.label}</p>
                          <span className="text-xs text-emerald-300/80">Apply</span>
                        </div>
                        {suggestion.helper && (
                          <p className="mt-0.5 text-xs text-amber-100/70">{suggestion.helper}</p>
                        )}
                        {(suggestion.topic || suggestion.timeframe || suggestion.depth) && (
                          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-emerald-200/80">
                            {[
                              getTopicLabel(suggestion.topic),
                              getTimeframeLabel(suggestion.timeframe),
                              getDepthLabel(suggestion.depth)
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Footer - outside scroll area on mobile, inline on desktop */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 sm:static bg-slate-950 sm:bg-transparent pt-4 sm:pt-0 px-4 sm:px-10 pb-safe sm:pb-6 border-t sm:border-t-0 border-slate-800/50">
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
                  disabled={!questionText || questionLoading}
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
      {isTemplatePanelOpen && (
        <div
          className="absolute inset-0 z-40 flex items-stretch bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setTemplatePanelOpen(false)}
        >
          <div
            className="ml-auto h-full w-full sm:w-[26rem] bg-slate-950 border-l border-emerald-400/30 p-5 sm:p-6 overflow-y-auto shadow-[0_0_45px_rgba(0,0,0,0.6)] animate-slide-in-right"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-200">
                  <BookmarkPlus className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  Template library
                </p>
                <p className="text-sm text-amber-100/70">
                  Save this configuration or reapply a favorite blend anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplatePanelOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/40 p-1 text-emerald-200 hover:bg-emerald-500/10"
                aria-label="Close template panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-6">
              <section className="space-y-3">
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80">Save current setup</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={newTemplateLabel}
                      onChange={event => setNewTemplateLabel(event.target.value)}
                      placeholder="Template name"
                      className="flex-1 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-amber-100 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                      Save
                    </button>
                  </div>
                </div>
                {templateStatus && (
                  <p className="text-xs text-emerald-200/80">{templateStatus}</p>
                )}
              </section>

              <section className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80">Saved templates</p>
                {templates.length === 0 ? (
                  <p className="text-xs text-amber-100/70">
                    Nothing saved yet. Create a label above to store this blend for later.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-3 flex flex-col gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(template)}
                          className="text-left"
                        >
                          <p className="text-sm font-semibold text-amber-100">{template.label}</p>
                          <p className="text-xs text-amber-100/70">
                            {[
                              getTopicLabel(template.topic),
                              getTimeframeLabel(template.timeframe),
                              getDepthLabel(template.depth)
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Custom mix'}
                          </p>
                          {template.customFocus && (
                            <p className="mt-1 text-xs text-emerald-200/80">{template.customFocus}</p>
                          )}
                          {template.savedQuestion && (
                            <p className="mt-2 text-xs text-amber-100/60">{template.savedQuestion}</p>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="self-start text-xs text-red-300 hover:text-red-200 underline decoration-dotted"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-200/80">
                  <History className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  Recent questions
                </p>
                {questionHistory.length === 0 ? (
                  <p className="text-xs text-amber-100/70">No recent pulls yet—log a question to see it here.</p>
                ) : (
                  <div className="space-y-2">
                    {questionHistory.slice(0, 6).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleApplyHistoryQuestion(item)}
                        className="w-full text-left rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-amber-100/80 hover:border-emerald-400/50 transition"
                      >
                        {item.question}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
