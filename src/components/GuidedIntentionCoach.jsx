import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  ChartLine,
  ArrowLeft,
  ArrowRight,
  BookmarkSimple,
  ClockCounterClockwise,
  ArrowsClockwise,
  Sparkle,
  MagicWand,
  X
} from '@phosphor-icons/react';
import {
  INTENTION_TOPIC_OPTIONS,
  INTENTION_TIMEFRAME_OPTIONS,
  INTENTION_DEPTH_OPTIONS,
  buildGuidedQuestion,
  buildCreativeQuestion,
  getCoachSummary
} from '../lib/intentionCoach';
import { scoreQuestion, getQualityLevel } from '../lib/questionQuality';
import { loadCoachRecommendation, loadStoredJournalInsights, loadCoachStatsSnapshot } from '../lib/journalInsights';
import {
  loadCoachTemplates,
  saveCoachTemplate,
  deleteCoachTemplate,
  loadCoachHistory,
  recordCoachQuestion,
  MAX_TEMPLATES
} from '../lib/coachStorage';

// ============================================================================
// Constants
// ============================================================================

const STEPS = [
  { id: 'topic', label: 'Topic' },
  { id: 'timeframe', label: 'Timeframe' },
  { id: 'depth', label: 'Depth' }
];

const COACH_PREFS_KEY = 'tarot-coach-preferences';
const SUGGESTIONS_PER_PAGE = 5;

// Timing constants (milliseconds)
const TIMING = {
  CREATIVE_DEBOUNCE: 800,
  STATUS_DISPLAY_SHORT: 1800,
  STATUS_DISPLAY_MEDIUM: 2600,
  STATUS_DISPLAY_LONG: 5000,
  PREFS_EXPIRY: 7 * 24 * 60 * 60 * 1000 // 1 week
};

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

// Map spreads to suggested topics
const SPREAD_TO_TOPIC_MAP = {
  relationship: 'relationships',
  decision: 'decision',
  celtic: 'growth',
  fiveCard: 'wellbeing',
  threeCard: null,
  single: null
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

const baseOptionClass =
  'text-left rounded-2xl border bg-surface-muted/50 px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main';

// ============================================================================
// Helper Functions
// ============================================================================

function describePrefillSource(source) {
  if (!source) return null;
  const label = typeof source.label === 'string' ? source.label.trim() : '';
  const normalizedSource = typeof source.source === 'string' ? source.source.toLowerCase() : '';

  if (normalizedSource === 'template') {
    return label ? `template "${label}"` : 'a saved template';
  }

  if (normalizedSource === 'suggestion') {
    return label ? `suggestion "${label}"` : 'a personalized suggestion';
  }

  if (normalizedSource === 'journal' || normalizedSource === 'insight' || normalizedSource === 'insights') {
    return label ? `journal insight "${label}"` : 'your journal insights';
  }

  if (normalizedSource && label) {
    return `${source.source} "${label}"`;
  }

  if (label) {
    return label;
  }

  if (normalizedSource) {
    return source.source;
  }

  return 'your journal insights';
}

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

  return suggestions;
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

// ============================================================================
// Component
// ============================================================================

export function GuidedIntentionCoach({ isOpen, selectedSpread, onClose, onApply, prefillRecommendation = null }) {
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
  const [historyStatus, setHistoryStatus] = useState('');
  const [autoQuestionEnabled, setAutoQuestionEnabled] = useState(true);
  const [prefillSource, setPrefillSource] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [templateStatus, setTemplateStatus] = useState('');
  const [questionHistory, setQuestionHistory] = useState([]);
  const [coachStats, setCoachStats] = useState(null);
  const [coachStatsMeta, setCoachStatsMeta] = useState(null);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState([]);
  const [suggestionsPage, setSuggestionsPage] = useState(0);
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [remixCount, setRemixCount] = useState(0);

  // Refs
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const depthSectionRef = useRef(null);
  const customFocusRef = useRef(null);
  const previousFocusRef = useRef(null);
  const stepButtonRefs = useRef([]);
  const titleId = useId();
  const timeoutRefs = useRef([]);
  const hasInitializedRef = useRef(false);

  // Clear step button refs on each render to prevent stale references
  useLayoutEffect(() => {
    stepButtonRefs.current = [];
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const releasePrefill = () => {
    if (prefillSource) {
      setPrefillSource(null);
      setAutoQuestionEnabled(true);
    }
  };

  const scheduleTimeout = (callback, delay) => {
    const id = setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter(timeoutId => timeoutId !== id);
      callback();
    }, delay);
    timeoutRefs.current.push(id);
    return id;
  };

  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(id => clearTimeout(id));
    timeoutRefs.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, []);

  const prefillSourceDescription = useMemo(
    () => describePrefillSource(prefillSource),
    [prefillSource]
  );

  const refreshSuggestions = () => {
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory));
    setSuggestionsPage(0);
  };

  // ============================================================================
  // Derived State
  // ============================================================================

  // Generate deterministic seed from user selections
  const questionSeed = useMemo(() => {
    return `${topic}|${timeframe}|${depth}|${customFocus}|${remixCount}`;
  }, [topic, timeframe, depth, customFocus, remixCount]);

  const guidedQuestion = useMemo(
    () => buildGuidedQuestion({ topic, timeframe, depth, customFocus, seed: questionSeed }),
    [topic, timeframe, depth, customFocus, questionSeed]
  );

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
      chips.push({ label: summary.topicLabel, type: 'Topic', step: 0 });
    }
    if (summary.timeframeLabel) {
      chips.push({ label: summary.timeframeLabel, type: 'Timing', step: 1 });
    }
    if (summary.depthLabel) {
      chips.push({ label: summary.depthLabel, type: 'Depth', step: 2 });
    }
    if (customFocus?.trim()) {
      chips.push({ label: customFocus.trim(), type: 'Detail', action: 'focus' });
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

  const suggestionPageCount = useMemo(() => {
    if (personalizedSuggestions.length === 0) return 0;
    return Math.ceil(personalizedSuggestions.length / SUGGESTIONS_PER_PAGE);
  }, [personalizedSuggestions.length]);

  const visibleSuggestions = useMemo(() => {
    if (personalizedSuggestions.length === 0) return [];
    const start = suggestionsPage * SUGGESTIONS_PER_PAGE;
    return personalizedSuggestions.slice(start, start + SUGGESTIONS_PER_PAGE);
  }, [personalizedSuggestions, suggestionsPage]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSaveTemplate = () => {
    const label = newTemplateLabel.trim();
    if (!label) {
      setTemplateStatus('Add a template name first.');
      return;
    }
    const trimmedQuestion = (questionText || guidedQuestion || '').trim();
    if (!trimmedQuestion) {
      setTemplateStatus('Add or generate a question before saving.');
      return;
    }
    const normalizedLabel = label.toLowerCase();
    const previousTemplateCount = templates.length;
    const replacedExisting = templates.some(template => template.label?.toLowerCase() === normalizedLabel);
    const payload = {
      label,
      topic,
      timeframe,
      depth,
      customFocus,
      useCreative,
      savedQuestion: trimmedQuestion
    };
    const result = saveCoachTemplate(payload);
    if (result.success) {
      setTemplates(result.templates);
      const archivedOldest =
        !replacedExisting &&
        previousTemplateCount >= MAX_TEMPLATES &&
        (result.templates?.length || 0) >= MAX_TEMPLATES;
      const status = archivedOldest
        ? 'Template saved (oldest archived to keep 8 max).'
        : replacedExisting
          ? 'Template updated'
          : 'Template saved';
      setTemplateStatus(status);
      setNewTemplateLabel('');
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
    } else if (result.error) {
      setTemplateStatus(result.error);
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
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
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_SHORT);
    } else if (result.error) {
      setTemplateStatus(result.error);
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
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

  // Keyboard navigation for step indicators (roving tabindex pattern)
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
      // Focus the new step button after state update
      requestAnimationFrame(() => {
        stepButtonRefs.current[nextIndex]?.focus();
      });
    }
  };

  const handleApply = async () => {
    const finalQuestion = questionText || guidedQuestion;
    if (!finalQuestion) return;

    // Record question, but don't block apply if storage fails
    const historyResult = recordCoachQuestion(finalQuestion);

    // Update history state with the new list
    if (historyResult?.history) {
      setQuestionHistory(historyResult.history);
      // Refresh suggestions with the NEW history immediately
      setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, historyResult.history));
      setSuggestionsPage(0);
    }

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
      console.warn('Could not save coach preferences:', error);
    }

    // Clear any status messages on success
    if (historyResult?.success) {
      setHistoryStatus('');
    } else {
      const message =
        historyResult?.error ||
        'Your question was used, but we could not save it to recent history. Check storage permissions and try again.';
      setHistoryStatus(message);
    }

    // Apply the question regardless of storage outcome
    onApply?.(finalQuestion);

    if (historyResult?.success) {
      onClose?.();
    }
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Initialize state when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    try {
      const saved = JSON.parse(localStorage.getItem(COACH_PREFS_KEY) || '{}');
      const now = Date.now();
      const isRecent = saved.timestamp && (now - saved.timestamp) < TIMING.PREFS_EXPIRY;

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
      console.warn('Could not load coach preferences:', error);
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

    const recommendation = prefillRecommendation?.question ? prefillRecommendation : loadCoachRecommendation();
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
  }, [isOpen, suggestedTopic, prefillRecommendation]);

  // Load templates and history when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setTemplates(loadCoachTemplates());
    const history = loadCoachHistory();
    setQuestionHistory(history);
    const insights = loadStoredJournalInsights();
    const snapshot = loadCoachStatsSnapshot();
    if (snapshot?.stats) {
      setCoachStats(snapshot.stats);
      setCoachStatsMeta(snapshot.meta || null);
    } else {
      setCoachStats(insights?.stats || null);
      setCoachStatsMeta(null);
    }
  }, [isOpen]);

  // Build personalized suggestions when stats/history change
  useEffect(() => {
    if (!isOpen) return;
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory));
    setSuggestionsPage(0);
  }, [coachStats, questionHistory, isOpen]);

  // Keep pagination in range when suggestion count changes
  useEffect(() => {
    const totalPages = Math.max(0, Math.ceil(personalizedSuggestions.length / SUGGESTIONS_PER_PAGE) - 1);
    setSuggestionsPage(prev => Math.min(prev, totalPages));
  }, [personalizedSuggestions]);

  // Reset transient state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTemplateStatus('');
      setNewTemplateLabel('');
      setTemplatePanelOpen(false);
      setHistoryStatus('');
      setSuggestionsPage(0);
      clearAllTimeouts();
    }
  }, [isOpen]);

  // Clear history status after timeout (using scheduleTimeout for consistency)
  useEffect(() => {
    if (!historyStatus) return;
    const timeoutId = scheduleTimeout(() => setHistoryStatus(''), TIMING.STATUS_DISPLAY_LONG);
    return () => clearTimeout(timeoutId);
  }, [historyStatus]);

  // Focus management for modal
  useEffect(() => {
    if (!isOpen) return;

    // Store previous focus to restore on close
    previousFocusRef.current = document.activeElement;

    return () => {
      // Restore focus when modal closes
      const elementToFocus = previousFocusRef.current;
      if (
        elementToFocus &&
        typeof elementToFocus.focus === 'function' &&
        document.body.contains(elementToFocus)
      ) {
        // Use requestAnimationFrame to ensure modal is fully removed
        requestAnimationFrame(() => {
          if (document.body.contains(elementToFocus)) {
            elementToFocus.focus();
          }
        });
      }
    };
  }, [isOpen]);

  // Creative question generation with proper race condition handling
  useEffect(() => {
    const controller = new AbortController();
    let timerId = null;
    let isCancelled = false;

    const safeSetState = (setter, value) => {
      if (!isCancelled) setter(value);
    };

    if (!isOpen) {
      setQuestionText('');
      return () => { isCancelled = true; };
    }

    if (!autoQuestionEnabled) {
      return () => { isCancelled = true; };
    }

    // If not in creative mode, update immediately
    if (!useCreative) {
      setQuestionLoading(false);
      setQuestionError('');
      setQuestionText(guidedQuestion);
      return () => { isCancelled = true; };
    }

    setQuestionLoading(true);
    setQuestionError('');

    timerId = setTimeout(async () => {
      try {
        const { question: creative, source } = await buildCreativeQuestion({
          topic,
          timeframe,
          depth,
          customFocus,
          seed: questionSeed
        }, { signal: controller.signal });

        if (isCancelled || controller.signal.aborted) {
          return;
        }

        if (creative) {
          safeSetState(setQuestionText, creative);
          const isLocalFallback = source === 'local' || source === 'local-fallback' || source === 'api-fallback';
          safeSetState(setQuestionError, isLocalFallback ? 'Using on-device generator for now.' : '');
        } else {
          safeSetState(setQuestionText, guidedQuestion);
          safeSetState(setQuestionError, 'Personalized mode is temporarily unavailable. Showing guided version.');
        }
      } catch (error) {
        if (error?.name === 'AbortError' || isCancelled) {
          return;
        }
        safeSetState(setQuestionText, guidedQuestion);
        safeSetState(setQuestionError, 'Personalized mode is temporarily unavailable. Showing guided version.');
      } finally {
        if (!isCancelled && !controller.signal.aborted) {
          safeSetState(setQuestionLoading, false);
        }
      }
    }, TIMING.CREATIVE_DEBOUNCE);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      controller.abort();
    };
  }, [guidedQuestion, useCreative, isOpen, autoQuestionEnabled, questionSeed, topic, timeframe, depth, customFocus]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderStepPanelContent = (panelId) => {
    if (panelId === 'topic') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted">What area do you want to explore?</p>
          {SPREAD_TO_TOPIC_MAP[selectedSpread] && (
            <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkle className="h-3 w-3 text-accent" />
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
          <div className="grid gap-3 md:grid-cols-2">
            {INTENTION_TOPIC_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`${baseOptionClass} ${option.value === topic ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20' : 'border-secondary/30 hover:border-accent/50 hover:bg-accent/5'}`}
                onClick={() => {
                  if (option.value !== topic) {
                    releasePrefill();
                  }
                  setTopic(option.value);
                }}
              >
                <p className="font-medium text-main">{option.label}</p>
                <p className="text-sm text-muted">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (panelId === 'timeframe') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted">When do you need guidance for?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {INTENTION_TIMEFRAME_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`${baseOptionClass} ${option.value === timeframe ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20' : 'border-secondary/30 hover:border-accent/50 hover:bg-accent/5'}`}
                onClick={() => {
                  if (option.value !== timeframe) {
                    releasePrefill();
                  }
                  setTimeframe(option.value);
                }}
              >
                <p className="font-medium text-main">{option.label}</p>
                <p className="text-sm text-muted">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (panelId === 'depth') {
      return (
        <div className="space-y-6">
          <div ref={depthSectionRef} className="space-y-4">
            <p className="text-sm text-muted">How deep do you want to go?</p>
            <div className="grid gap-3 md:grid-cols-2">
              {INTENTION_DEPTH_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`${baseOptionClass} ${option.value === depth ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20' : 'border-secondary/30 hover:border-accent/50 hover:bg-accent/5'}`}
                  onClick={() => {
                    if (option.value !== depth) {
                      releasePrefill();
                    }
                    setDepth(option.value);
                  }}
                >
                  <p className="font-medium text-main">{option.label}</p>
                  <p className="text-sm text-muted">{option.description}</p>
                </button>
              ))}
            </div>
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
              onChange={event => {
                releasePrefill();
                setCustomFocus(event.target.value);
              }}
              placeholder="e.g. a potential move, a creative launch, a new relationship"
              className="w-full rounded-xl border border-secondary/40 bg-surface/80 px-4 py-3 text-main placeholder:text-secondary/40 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/60"
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
                  {questionContextChips.map((chip, idx) => (
                    <button
                      key={`${chip.label}-${idx}`}
                      onClick={() => {
                        if (typeof chip.step === 'number') {
                          setStep(chip.step);
                          if (chip.step === step && chip.type === 'Depth') {
                            depthSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }
                        if (chip.action === 'focus') {
                          customFocusRef.current?.focus();
                        }
                      }}
                      className="rounded-full border border-secondary/40 bg-surface/50 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-secondary/80 hover:bg-secondary/10 hover:border-secondary transition"
                    >
                      <span className="font-bold opacity-50 mr-1">{chip.type}:</span>
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-surface/50 px-3 py-1.5 text-[0.7rem] text-secondary cursor-pointer select-none hover:bg-secondary/5 transition">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-secondary/60 bg-transparent text-secondary focus:ring-secondary"
                    checked={useCreative}
                    onChange={event => {
                      releasePrefill();
                      setUseCreative(event.target.checked);
                      setAutoQuestionEnabled(true);
                    }}
                  />
                  <span className="inline-flex items-center gap-1 font-medium">
                    <MagicWand className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                    Personalize with AI
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPrefillSource(null);
                    setAutoQuestionEnabled(true);
                    setQuestionError('');
                    setRemixCount(c => c + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-secondary/60 bg-transparent px-3 py-1.5 text-[0.7rem] font-semibold text-secondary hover:bg-secondary/10 transition"
                >
                  <ArrowsClockwise className="h-3.5 w-3.5" aria-hidden="true" />
                  Remix
                </button>
              </div>
            </div>

            {prefillSource && prefillSourceDescription && (
              <p className="text-xs text-secondary/80">
                <span className="font-semibold text-secondary">Auto-filled</span> from {prefillSourceDescription}.
              </p>
            )}
            {questionLoading && (
              <p className="text-xs text-accent/80 animate-pulse">Weaving a personalized prompt…</p>
            )}
            {questionError && (
              <p className="text-xs text-accent/80">{questionError}</p>
            )}

            <div className="rounded-2xl border border-secondary/30 bg-surface/60 p-5 space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-secondary/80">
                <Sparkle className="h-4 w-4 text-secondary" aria-hidden="true" />
                Your Question
              </div>
              <p className="font-serif text-xl sm:text-2xl text-main leading-relaxed">
                {questionText || guidedQuestion}
              </p>
            </div>

            {/* Question Quality Indicator */}
            <div className="rounded-2xl border border-secondary/30 bg-surface/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-secondary">
                <span className="inline-flex items-center gap-1">
                  <ChartLine className="h-4 w-4 text-secondary" aria-hidden="true" />
                  Question quality
                </span>
                <span className="text-xs font-semibold text-secondary">
                  {qualityLevel.emoji} {qualityLevel.label}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-muted/80 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    normalizedQualityScore >= 85
                      ? 'bg-accent'
                      : normalizedQualityScore >= 65
                        ? 'bg-secondary'
                        : 'bg-secondary/50'
                  }`}
                  style={{ width: `${normalizedQualityScore}%` }}
                />
              </div>
              <p className="text-[0.7rem] text-secondary/80">{qualityHelperText}</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // Early Return
  // ============================================================================

  if (!isOpen) {
    return null;
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-main/90 backdrop-blur animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
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
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose?.();
            }
          }}
          className="relative w-full h-full sm:h-auto sm:max-w-3xl sm:mx-4 sm:rounded-3xl border-0 sm:border border-accent/30 bg-surface shadow-2xl focus:outline-none flex flex-col animate-pop-in"
        >
          {/* Close Button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-accent/80 hover:text-main z-10"
            aria-label="Close intention coach"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto sm:overflow-visible">
            <div className="flex flex-col gap-6 px-4 pb-6 pt-16 sm:pt-8 sm:px-10 sm:pb-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 text-secondary">
                  <Sparkle className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">Guided Intention Coach</span>
                </div>
                <h2 id={titleId} className="mt-2 font-serif text-2xl text-main">Shape a question with clarity</h2>
                <p className="mt-1 text-sm text-muted">
                  Answer three quick prompts and we&apos;ll craft an open-ended question you can drop
                  directly into your reading.
                </p>
              </div>

              {/* Step Navigation & Content */}
              <div className="flex flex-col gap-3">
                {/* Step Progress Indicator */}
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
                            if (el) stepButtonRefs.current[index] = el;
                          }}
                          type="button"
                          id={`step-tab-${entry.id}`}
                          role="tab"
                          aria-selected={index === step}
                          aria-controls={`step-panel-${entry.id}`}
                          tabIndex={index === step ? 0 : -1}
                          className={`rounded-full px-3 py-1 min-h-[44px] min-w-[44px] touch-manipulation transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                            index === step
                              ? 'bg-accent text-main shadow-lg shadow-accent/20'
                              : 'bg-surface-muted text-muted hover:bg-surface-muted/80 hover:text-accent'
                          }`}
                          onClick={() => setStep(index)}
                          onKeyDown={(e) => handleStepKeyDown(e, index)}
                        >
                          <span className="hidden sm:inline">{entry.label}</span>
                          <span className="sm:hidden">{index + 1}</span>
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
                      onClick={() => setTemplatePanelOpen(true)}
                      className="inline-flex items-center justify-center gap-1 rounded-full border border-secondary/40 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-secondary hover:bg-secondary/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
                    >
                      <BookmarkSimple className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                      Templates
                    </button>
                  </div>
                </div>

                {/* Step Panels */}
                <div className="rounded-2xl border border-accent/30 bg-surface-muted/40 p-4 sm:p-5">
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

          {/* Footer - OUTSIDE scrollable area for proper sticky behavior */}
          <div className="flex-shrink-0 bg-surface border-t border-accent/20 sm:border-t-0 pt-4 sm:pt-0 px-4 sm:px-10 pb-safe sm:pb-6">
            {historyStatus && (
              <p className="text-xs text-error text-center sm:text-left mb-2">
                {historyStatus}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted hidden sm:block">
                <p>
                  {summary.topicLabel} · {summary.timeframeLabel} · {summary.depthLabel}
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-accent/20 px-4 py-2.5 sm:py-2 text-sm text-main transition disabled:opacity-40 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none touch-manipulation"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canGoNext()}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-secondary/60 bg-secondary/20 px-5 py-2.5 sm:py-2 text-sm font-medium text-secondary transition disabled:opacity-50 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none touch-manipulation"
                  >
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={(!questionText && !guidedQuestion) || questionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-secondary/60 bg-secondary/80 px-5 py-2.5 sm:py-2 text-sm font-semibold text-white transition disabled:opacity-50 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none touch-manipulation"
                  >
                    <span>Use question</span>
                    <Sparkle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Template Panel Overlay */}
          {isTemplatePanelOpen && (
            <div
              className="absolute inset-0 z-40 flex items-stretch bg-surface/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setTemplatePanelOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setTemplatePanelOpen(false);
                }
              }}
              aria-label="Close template panel backdrop"
            >
              <div
                role="dialog"
                aria-modal="false"
                aria-label="Template library"
                className="ml-auto h-full w-full sm:w-[26rem] bg-surface border-l border-accent/30 p-5 sm:p-6 overflow-y-auto shadow-[0_0_45px_rgba(0,0,0,0.6)] animate-slide-in-right"
                onClick={event => event.stopPropagation()}
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-secondary">
                      <BookmarkSimple className="h-4 w-4 text-secondary" aria-hidden="true" />
                      Template library
                    </p>
                    <p className="text-sm text-muted">
                      Save this configuration or reapply a favorite blend anytime.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplatePanelOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-secondary/40 p-1 text-secondary hover:bg-secondary/10"
                    aria-label="Close template panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Panel Content */}
                <div className="mt-5 space-y-6">
                  {/* Save Current Setup Section */}
                  <section className="space-y-3">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Save current setup</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={newTemplateLabel}
                          onChange={event => setNewTemplateLabel(event.target.value)}
                          placeholder="Template name"
                          className="flex-1 rounded-full border border-accent/20 bg-surface/70 px-3 py-2 text-sm text-main focus:outline-none focus:ring-1 focus:ring-secondary/60"
                        />
                        <button
                          type="button"
                          onClick={handleSaveTemplate}
                          className="inline-flex items-center justify-center gap-1 rounded-full border border-secondary/60 bg-secondary/10 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/20 transition"
                        >
                          <Sparkle className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                          Save
                        </button>
                      </div>
                      <p className="text-[0.65rem] text-secondary/70">
                        {templates.length}/{MAX_TEMPLATES} templates saved · oldest entry is replaced when you add more than {MAX_TEMPLATES}.
                      </p>
                    </div>
                    {templateStatus && (
                      <p className="text-xs text-secondary/80">{templateStatus}</p>
                    )}
                  </section>

                  {/* Saved Templates Section */}
                  <section className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Saved templates</p>
                    {templates.length === 0 ? (
                      <p className="text-xs text-muted">
                        Nothing saved yet. Create a label above to store this blend for later.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {templates.map(template => (
                          <div
                            key={template.id}
                            className="rounded-2xl border border-accent/20 bg-surface-muted/70 p-3 flex flex-col gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => handleApplyTemplate(template)}
                              className="text-left"
                            >
                              <p className="text-sm font-semibold text-main">{template.label}</p>
                              <p className="text-xs text-muted">
                                {[
                                  getTopicLabel(template.topic),
                                  getTimeframeLabel(template.timeframe),
                                  getDepthLabel(template.depth)
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || 'Custom mix'}
                              </p>
                              {template.customFocus && (
                                <p className="mt-1 text-xs text-secondary/80">{template.customFocus}</p>
                              )}
                              {template.savedQuestion && (
                                <p className="mt-2 text-xs text-muted">{template.savedQuestion}</p>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="self-start text-xs text-error hover:text-error/80 underline decoration-dotted"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Recent Questions Section */}
                  <section className="space-y-3">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent/80">
                      <ClockCounterClockwise className="h-4 w-4 text-secondary" aria-hidden="true" />
                      Recent questions
                    </p>
                    {questionHistory.length === 0 ? (
                      <p className="text-xs text-muted">No recent pulls yet—log a question to see it here.</p>
                    ) : (
                      <div className="space-y-2">
                        {questionHistory.slice(0, 6).map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleApplyHistoryQuestion(item)}
                            className="w-full text-left rounded-2xl border border-accent/20 bg-surface-muted/70 px-4 py-2 text-sm text-muted hover:border-secondary/50 transition"
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
      </FocusTrap>
    </div>
  );
}
