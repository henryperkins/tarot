import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId, useSyncExternalStore } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  ChartLine,
  ArrowLeft,
  ArrowRight,
  Check,
  BookmarkSimple,
  ClockCounterClockwise,
  ArrowsClockwise,
  Info,
  Sparkle,
  MagicWand,
  X
} from '@phosphor-icons/react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSwipeDismiss } from '../hooks/useSwipeDismiss';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Tooltip } from './Tooltip';
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
import { MOBILE_COACH_DIALOG_ID } from './MobileActionBar';
import { buildThemeQuestion, normalizeThemeLabel } from '../lib/themeText';
import { subscribeToViewport, getViewportOffset, getServerViewportOffset } from './MobileActionBar';

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

// Map onboarding focus areas to intention topics
const FOCUS_AREA_TO_TOPIC = {
  love: 'relationships',
  career: 'career',
  self_worth: 'growth',
  healing: 'wellbeing',
  creativity: 'career',
  spirituality: 'growth'
};

const FOCUS_AREA_SUGGESTIONS = {
  love: {
    label: 'Love & relationships',
    topic: 'relationships',
    timeframe: 'week',
    depth: 'guided',
    customFocus: 'my closest relationships'
  },
  career: {
    label: 'Career & money',
    topic: 'career',
    timeframe: 'month',
    depth: 'guided',
    customFocus: 'my career direction and finances'
  },
  self_worth: {
    label: 'Self-worth & confidence',
    topic: 'growth',
    timeframe: 'month',
    depth: 'lesson',
    customFocus: 'my self-worth and confidence'
  },
  healing: {
    label: 'Healing & growth',
    topic: 'wellbeing',
    timeframe: 'season',
    depth: 'lesson',
    customFocus: 'my healing and balance'
  },
  creativity: {
    label: 'Creativity & projects',
    topic: 'career',
    timeframe: 'month',
    depth: 'guided',
    customFocus: 'my creative projects'
  },
  spirituality: {
    label: 'Spiritual path',
    topic: 'growth',
    timeframe: 'season',
    depth: 'deep',
    customFocus: 'my spiritual path'
  }
};

const baseOptionClass =
  'text-left rounded-2xl border bg-surface-muted/50 px-4 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
const infoButtonClass =
  'inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-full text-secondary/70 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

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

function buildPersonalizedSuggestions(stats, history = [], focusAreas = []) {
  const suggestions = [];
  const hasJournalSignals = Boolean(
    (Array.isArray(stats?.frequentCards) && stats.frequentCards.length > 0)
    || (Array.isArray(stats?.recentThemes) && stats.recentThemes.length > 0)
    || (Array.isArray(stats?.contextBreakdown) && stats.contextBreakdown.length > 0)
  );

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
      const label = normalizeThemeLabel(theme);
      if (!label) return;
      const themeQuestion = buildThemeQuestion(label);
      suggestions.push({
        id: `theme-${idx}`,
        label: `Lean into: ${label}`,
        helper: 'Recent journal theme',
        question: themeQuestion,
        topic: 'growth',
        timeframe: 'open',
        depth: 'lesson',
        customFocus: label
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

  if (!hasJournalSignals) {
    const normalizedFocusAreas = Array.isArray(focusAreas)
      ? focusAreas.map(area => (typeof area === 'string' ? area.trim() : '')).filter(Boolean)
      : [];

    normalizedFocusAreas.slice(0, 3).forEach((area, idx) => {
      const suggestion = FOCUS_AREA_SUGGESTIONS[area];
      if (!suggestion) return;
      suggestions.push({
        id: `focus-${area}-${idx}`,
        label: suggestion.label,
        helper: 'Based on your focus areas',
        topic: suggestion.topic,
        timeframe: suggestion.timeframe,
        depth: suggestion.depth,
        customFocus: suggestion.customFocus
      });
    });
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
  const isLandscape = useLandscape();
  const prefersReducedMotion = useReducedMotion();
  const { personalization } = usePreferences();
  const { user } = useAuth();
  const { canUseAIQuestions } = useSubscription();
  const userId = user?.id || null;
  const [step, setStep] = useState(0);

  // Determine suggested topic from focus areas, falling back to spread
  const focusAreaSuggestedTopic = useMemo(() => {
    if (!Array.isArray(personalization?.focusAreas)) return null;
    for (const area of personalization.focusAreas) {
      const mapped = FOCUS_AREA_TO_TOPIC[area];
      if (mapped) return mapped;
    }
    return null;
  }, [personalization?.focusAreas]);

  const spreadSuggestedTopic = useMemo(() => {
    return SPREAD_TO_TOPIC_MAP[selectedSpread] || null;
  }, [selectedSpread]);

  const suggestedTopic = useMemo(() => {
    return focusAreaSuggestedTopic || spreadSuggestedTopic || INTENTION_TOPIC_OPTIONS[0].value;
  }, [focusAreaSuggestedTopic, spreadSuggestedTopic]);

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
  const [_coachStatsMeta, setCoachStatsMeta] = useState(null);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState([]);
  const [suggestionsPage, setSuggestionsPage] = useState(0);
  const [isSuggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [remixCount, setRemixCount] = useState(0);
  const [astroHighlights, setAstroHighlights] = useState([]);
  const [astroWindowDays, setAstroWindowDays] = useState(null);
  const [astroSource, setAstroSource] = useState(null);
  const viewportOffset = useSyncExternalStore(
    subscribeToViewport,
    getViewportOffset,
    getServerViewportOffset
  );
  const effectiveOffset = Math.max(0, viewportOffset);

  // Refs
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const depthSectionRef = useRef(null);
  const customFocusRef = useRef(null);
  const stepButtonRefs = useRef([]);
  const titleId = useId();
  const timeoutRefs = useRef([]);
  const hasInitializedRef = useRef(false);

  // Use modal accessibility hook for scroll lock, escape key, and focus restoration
  // trapFocus: false because FocusTrap library handles focus trapping
  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    trapFocus: false,
    initialFocusRef: closeButtonRef,
  });

  // Swipe-to-dismiss for mobile (swipe down to close)
  const isSmallScreen = useSmallScreen();
  const { handlers: swipeDismissHandlers, style: swipeDismissStyle, isDragging } = useSwipeDismiss({
    onDismiss: onClose,
    threshold: 120,
    resistance: 0.5
  });

  useEffect(() => {
    if (!isOpen) return;
    setSuggestionsExpanded(!isSmallScreen);
  }, [isOpen, isSmallScreen]);

  // Android back button dismisses coach on mobile
  useAndroidBackGuard(isOpen, {
    onBack: onClose,
    enabled: isSmallScreen,
    guardId: 'intentionCoach'
  });

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

  const clearAstroForecast = useCallback(() => {
    setAstroHighlights([]);
    setAstroWindowDays(null);
    setAstroSource(null);
  }, []);

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

  const _refreshSuggestions = () => {
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory, personalization?.focusAreas));
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

  const isManualQuestion = !autoQuestionEnabled && Boolean((questionText || '').trim());

  const qualityLevel = useMemo(
    () => getQualityLevel(questionQuality.score),
    [questionQuality.score]
  );

  // Celebrate when the coached question reaches "Excellent" quality.
  const [showExcellentBurst, setShowExcellentBurst] = useState(false);
  const prevQualityScoreRef = useRef(questionQuality.score);

  useEffect(() => {
    const prev = prevQualityScoreRef.current;
    prevQualityScoreRef.current = questionQuality.score;

    if (prefersReducedMotion) return;
    if (prev < 85 && questionQuality.score >= 85) {
      setShowExcellentBurst(true);
      const timeout = setTimeout(() => setShowExcellentBurst(false), 650);
      return () => clearTimeout(timeout);
    }
  }, [questionQuality.score, prefersReducedMotion]);

  const summary = getCoachSummary({ topic, timeframe, depth });
  const footerSummary = isManualQuestion
    ? 'Custom question'
    : `${summary.topicLabel} · ${summary.timeframeLabel} · ${summary.depthLabel}`;
  const footerSummaryCompact = isManualQuestion
    ? 'Custom question'
    : `${summary.topicLabel} · ${summary.timeframeLabel}`;

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

  const questionContextChips = useMemo(() => {
    const chips = [];
    if (isManualQuestion) {
      chips.push({ label: 'Custom question', type: 'Mode' });
      if (customFocus?.trim()) {
        chips.push({ label: customFocus.trim(), type: 'Detail', action: 'focus' });
      }
      return chips;
    }
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
  }, [summary.topicLabel, summary.timeframeLabel, summary.depthLabel, customFocus, isManualQuestion]);

  const qualityHelperText = useMemo(() => {
    if (questionQuality.score >= 85) return 'Excellent - ready to anchor into your spread.';
    const primaryTip = questionQuality.feedback[0];
    if (primaryTip) return primaryTip;
    if (questionQuality.score >= 65) return 'Add one more detail for extra clarity.';
    if (questionQuality.score >= 40) return 'Sharpen the focus to strengthen it.';
    return 'Try reframing it from a curious, open-ended angle.';
  }, [questionQuality.feedback, questionQuality.score]);

  const qualityHighlights = useMemo(() => {
    const highlights = [];
    if (questionQuality.openEnded) highlights.push('Open-ended');
    if (questionQuality.specific) highlights.push('Specific');
    if (questionQuality.actionable) highlights.push('Actionable');
    if (questionQuality.timeframe) highlights.push('Timeframe');
    return highlights;
  }, [questionQuality.actionable, questionQuality.openEnded, questionQuality.specific, questionQuality.timeframe]);

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
    const result = saveCoachTemplate(payload, userId);
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
      clearAstroForecast();
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
    const result = deleteCoachTemplate(templateId, userId);
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
      clearAstroForecast();
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

  const handleSuggestionPick = (suggestion) => {
    handleApplySuggestion(suggestion);
    setStep(2);
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
    const historyResult = recordCoachQuestion(finalQuestion, undefined, userId);

    // Update history state with the new list
    if (historyResult?.history) {
      setQuestionHistory(historyResult.history);
      // Refresh suggestions with the NEW history immediately
      setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, historyResult.history, personalization?.focusAreas));
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

    // Always close after applying; history failure is non-blocking
    onClose?.();
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

    const recommendation = prefillRecommendation?.question ? prefillRecommendation : loadCoachRecommendation(userId);
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
      clearAstroForecast();
    }
  }, [isOpen, suggestedTopic, prefillRecommendation, userId, clearAstroForecast]);

  // Load templates and history when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setTemplates(loadCoachTemplates(userId));
    const history = loadCoachHistory(undefined, userId);
    setQuestionHistory(history);
    const insights = loadStoredJournalInsights(userId);
    const snapshot = loadCoachStatsSnapshot(userId);
    if (snapshot?.stats) {
      setCoachStats(snapshot.stats);
      setCoachStatsMeta(snapshot.meta || null);
    } else {
      setCoachStats(insights?.stats || null);
      setCoachStatsMeta(null);
    }
  }, [isOpen, userId]);

  // Build personalized suggestions when stats/history change
  useEffect(() => {
    if (!isOpen) return;
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory, personalization?.focusAreas));
    setSuggestionsPage(0);
  }, [coachStats, questionHistory, isOpen, personalization?.focusAreas]);

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
      setAstroHighlights([]);
      setAstroWindowDays(null);
      setAstroSource(null);
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
      setAstroHighlights([]);
      setAstroWindowDays(null);
      setAstroSource(null);
      return () => { isCancelled = true; };
    }

    setQuestionLoading(true);
    setQuestionError('');

    timerId = setTimeout(async () => {
      try {
        const { question: creative, source, forecast } = await buildCreativeQuestion({
          topic,
          timeframe,
          depth,
          customFocus,
          seed: questionSeed,
          focusAreas: personalization?.focusAreas
        }, { signal: controller.signal, userId });

        if (isCancelled || controller.signal.aborted) {
          return;
        }

        if (creative) {
          safeSetState(setQuestionText, creative);
          const isLocalFallback = source === 'local' || source === 'local-fallback' || source === 'api-fallback' || source === 'local-template';
          safeSetState(setQuestionError, isLocalFallback ? 'Using on-device generator for now.' : '');

          if (forecast?.highlights?.length) {
            safeSetState(setAstroHighlights, forecast.highlights);
            safeSetState(setAstroWindowDays, forecast.days || (timeframe === 'season' ? 90 : 30));
            safeSetState(setAstroSource, forecast.source || null);
          } else {
            safeSetState(setAstroHighlights, []);
            safeSetState(setAstroWindowDays, null);
            safeSetState(setAstroSource, null);
          }
        } else {
          safeSetState(setQuestionText, guidedQuestion);
          safeSetState(setQuestionError, 'Personalized mode is temporarily unavailable. Showing guided version.');
          safeSetState(setAstroHighlights, []);
          safeSetState(setAstroWindowDays, null);
          safeSetState(setAstroSource, null);
        }
      } catch (error) {
        if (error?.name === 'AbortError' || isCancelled) {
          return;
        }
        safeSetState(setQuestionText, guidedQuestion);
        safeSetState(setQuestionError, 'Personalized mode is temporarily unavailable. Showing guided version.');
        safeSetState(setAstroHighlights, []);
        safeSetState(setAstroWindowDays, null);
        safeSetState(setAstroSource, null);
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
  }, [guidedQuestion, useCreative, isOpen, autoQuestionEnabled, questionSeed, topic, timeframe, depth, customFocus, personalization?.focusAreas, userId]);

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
                {focusAreaSuggestedTopic && option.value === focusAreaSuggestedTopic && (
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
                    Based on your interests
                  </span>
                )}
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
                {canUseAIQuestions ? (
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
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-surface/30 px-3 py-1.5 text-[0.7rem] text-secondary/60 select-none" title="Upgrade to Plus or Pro for AI-powered personalization">
                    <MagicWand className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                    <span className="font-medium">AI Personalization</span>
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-accent">Plus</span>
                  </span>
                )}
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
              <p className="text-[0.65rem] text-secondary/70">
                Creative mode uses journal themes and recent questions when available.
              </p>
            </div>

            {prefillSource && prefillSourceDescription && (
              <p className="text-xs text-secondary/80">
                <span className="font-semibold text-secondary">Auto-filled</span> from {prefillSourceDescription}.
              </p>
            )}
            {questionLoading && (
              <p className={`text-xs text-accent/80 ${prefersReducedMotion ? '' : 'animate-pulse'}`}>Weaving a personalized prompt…</p>
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
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={(!questionText && !guidedQuestion) || questionLoading}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-secondary/50 bg-secondary/20 px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkle className="h-4 w-4" />
                  Use this question
                </button>
                <button
                  type="button"
                  onClick={() => setTemplatePanelOpen(true)}
                  className="text-[0.7rem] text-secondary/80 underline decoration-secondary/40 underline-offset-4 transition hover:text-secondary"
                >
                  Save as template
                </button>
              </div>
            </div>

            {astroHighlights.length > 0 && (
              <div className="rounded-2xl border border-secondary/30 bg-surface/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-secondary/80">
                  <span className="inline-flex items-center gap-2 uppercase tracking-[0.2em]">
                    <MagicWand className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                    Astro window{astroWindowDays ? ` · ${astroWindowDays} days` : ''}
                  </span>
                  {astroSource && <span className="text-[0.65rem] text-secondary/60">{astroSource}</span>}
                </div>
                <ul className="grid gap-1 text-sm text-main text-left">
                  {astroHighlights.map((item, idx) => (
                    <li key={`astro-${idx}`} className="flex items-start gap-2">
                      <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-secondary/70" aria-hidden="true" />
                      <span className="leading-snug text-secondary/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Question Quality Indicator */}
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
                    <Info className="h-3.5 w-3.5" />
                  </Tooltip>
                </span>
                <span className="text-xs font-semibold text-secondary">
                  <span className="relative inline-flex items-center">
                    <span aria-hidden="true">{qualityLevel.emoji}</span>
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
              <div className="h-2 w-full rounded-full bg-surface-muted/80 overflow-hidden">
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
              <p className="text-[0.7rem] text-secondary/80">{qualityHelperText}</p>
              {qualityHighlights.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-[0.6rem] uppercase tracking-[0.3em] text-secondary/60">
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

  // ============================================================================
  // Early Return
  // ============================================================================

  if (!isOpen) {
    return null;
  }

  const contentPaddingTop = isSmallScreen
    ? 'calc(env(safe-area-inset-top, 0px) + 0.5rem)'
    : null;
  const shouldApplySafeAreaX = isSmallScreen || isLandscape;
  const safeAreaXStyle = shouldApplySafeAreaX
    ? {
      paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
    }
    : null;
  const contentPaddingStyle = contentPaddingTop || safeAreaXStyle
    ? {
      ...(contentPaddingTop ? { paddingTop: contentPaddingTop } : null),
      ...(safeAreaXStyle || {})
    }
    : undefined;
  const footerPaddingStyle = effectiveOffset || safeAreaXStyle
    ? {
      ...(effectiveOffset ? { paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${effectiveOffset + 16}px)` } : null),
      ...(safeAreaXStyle || {})
    }
    : undefined;

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div
      className={`fixed inset-0 z-[70] flex ${isSmallScreen ? 'items-end' : 'items-center'} justify-center`}
      style={isSmallScreen ? {
        paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
        paddingBottom: effectiveOffset ? `${effectiveOffset}px` : undefined
      } : undefined}
    >
      {/* Backdrop */}
      <div
        className={`${isSmallScreen ? 'mobile-drawer-overlay' : 'bg-main/90 backdrop-blur'} absolute inset-0 ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
        onClick={onClose}
        aria-hidden="true"
      />

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
          id={MOBILE_COACH_DIALOG_ID}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative w-full flex flex-col focus:outline-none ${
            isSmallScreen
              ? `mobile-drawer ${prefersReducedMotion ? '' : 'animate-slide-up'}`
              : `h-auto ${isLandscape ? 'max-h-[98vh]' : 'max-h-[90vh]'} max-w-3xl mx-4 rounded-3xl border border-secondary/30 bg-surface shadow-2xl ${prefersReducedMotion ? '' : 'animate-pop-in'}`
          }`}
          style={{
            ...(isSmallScreen ? {
              maxHeight: 'calc(100% - 8px)',
              transform: isDragging && swipeDismissStyle?.transform ? swipeDismissStyle.transform : undefined,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            } : undefined)
          }}
          {...(isSmallScreen ? swipeDismissHandlers : {})}
        >
          {/* Swipe handle indicator - mobile only */}
          {isSmallScreen && (
            <div className="mobile-drawer__handle" aria-hidden="true" />
          )}

          {/* Header with close button */}
          <div className={isSmallScreen ? 'mobile-drawer__header px-4 pt-3 pb-3' : 'relative'}>
            <div className={`flex items-start justify-between gap-3 ${isSmallScreen ? '' : 'px-4 pt-8 sm:px-10 sm:pt-6'}`}>
              <div className="space-y-1">
                <p className={isSmallScreen ? 'mobile-drawer__eyebrow' : 'flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary'}>
                  <Sparkle className="w-3.5 h-3.5" aria-hidden="true" />
                  Guided Intention Coach
                </p>
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

              {/* Close Button */}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className={isSmallScreen ? 'mobile-drawer__close' : 'absolute top-4 right-4 sm:top-6 sm:right-6 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-muted hover:text-main hover:bg-surface-muted/50 z-10 touch-manipulation transition-colors'}
                aria-label="Close intention coach"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className={`flex-1 overflow-y-auto overscroll-contain min-h-0 ${isSmallScreen ? 'mobile-drawer__body' : ''}`}>
            <div
              className={`flex flex-col gap-6 px-4 pb-6 sm:px-10 sm:pb-6 ${isLandscape ? 'pt-4 gap-4' : 'pt-4 sm:pt-6'}`}
              style={!isSmallScreen ? contentPaddingStyle : undefined}
            >
              {personalizedSuggestions.length > 0 && (
                <section className="rounded-2xl border border-secondary/30 bg-surface-muted/40 p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Suggested for you</p>
                      <p className="text-xs text-muted">
                        {isSuggestionsExpanded
                          ? 'Based on your journal trends and recent questions.'
                          : `${personalizedSuggestions.length} suggestions ready. Tap to peek.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-secondary">
                      {isSuggestionsExpanded && suggestionPageCount > 1 && (
                        <div className="flex items-center gap-2 text-xs text-secondary">
                          <button
                            type="button"
                            onClick={() => setSuggestionsPage(prev => (prev - 1 + suggestionPageCount) % suggestionPageCount)}
                            className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-2 py-1 hover:bg-secondary/10 transition"
                            aria-label="Previous suggestions"
                          >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <span className="text-[0.65rem] uppercase tracking-[0.3em] text-secondary/70">
                            {suggestionsPage + 1}/{suggestionPageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSuggestionsPage(prev => (prev + 1) % suggestionPageCount)}
                            className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-2 py-1 hover:bg-secondary/10 transition"
                            aria-label="Next suggestions"
                          >
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSuggestionsExpanded(prev => !prev)}
                        aria-expanded={isSuggestionsExpanded}
                        aria-controls="coach-suggestions"
                        className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-3 py-1 hover:bg-secondary/10 transition"
                      >
                        {isSuggestionsExpanded ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  {isSuggestionsExpanded && (
                    <div id="coach-suggestions" className="grid gap-3 sm:grid-cols-2 max-h-[16rem] sm:max-h-[20rem] overflow-y-auto pr-1">
                      {visibleSuggestions.map(suggestion => {
                        const preview = buildSuggestionPreview(suggestion);
                        const chips = [
                          getTopicLabel(suggestion.topic),
                          getTimeframeLabel(suggestion.timeframe),
                          getDepthLabel(suggestion.depth)
                        ].filter(Boolean);
                        return (
                          <button
                            key={suggestion.id || suggestion.label}
                            type="button"
                            onClick={() => handleSuggestionPick(suggestion)}
                            className="rounded-2xl border border-accent/20 bg-surface/70 p-3 text-left transition hover:border-secondary/60 hover:bg-surface-muted/60"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-main">{suggestion.label}</p>
                                {suggestion.helper && (
                                  <p className="text-xs text-secondary/80 mt-1">{suggestion.helper}</p>
                                )}
                              </div>
                              <span className="text-[0.6rem] uppercase tracking-[0.3em] text-secondary/70">Use</span>
                            </div>
                            {preview && (
                              <p className="mt-2 text-sm text-main/90">{preview}</p>
                            )}
                            {chips.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-[0.3em] text-secondary/60">
                                {chips.map(chip => (
                                  <span key={`${suggestion.id || suggestion.label}-${chip}`} className="rounded-full border border-secondary/30 px-2 py-1">
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

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
                              ? 'bg-accent text-surface shadow-lg shadow-accent/20'
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

          {/* Footer - OUTSIDE scrollable area for proper sticky behavior */}
          <div
            className={`flex-shrink-0 ${isSmallScreen ? 'mobile-drawer__footer' : 'bg-surface border-t border-accent/20 sm:border-t-0 px-4 sm:px-10 pb-safe sm:pb-6'} ${isLandscape ? 'pt-2' : isSmallScreen ? '' : 'pt-4 sm:pt-0'}`}
            style={!isSmallScreen ? footerPaddingStyle : undefined}
          >
            {historyStatus && (
              <p className="text-xs text-error text-center sm:text-left mb-2">
                {historyStatus}
              </p>
            )}
            <div className={`flex sm:flex-row sm:items-center sm:justify-between ${isLandscape ? 'flex-row items-center gap-2' : 'flex-col gap-3'}`}>
              <div className={`text-xs text-muted ${isLandscape ? 'block' : 'hidden sm:block'}`}>
                <p>
                  {isLandscape ? footerSummaryCompact : footerSummary}
                </p>
              </div>
              <div className={`flex items-center w-full sm:w-auto ${isLandscape ? 'gap-2 flex-1 justify-end' : 'gap-3'}`}>
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0}
                  className={`inline-flex items-center justify-center gap-1 rounded-full border border-accent/20 text-sm text-main transition disabled:opacity-40 min-h-[44px] sm:min-h-0 touch-manipulation ${isLandscape ? 'px-3 py-2 flex-none' : 'px-4 py-2.5 sm:py-2 flex-1 sm:flex-none'}`}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {!isLandscape && <span>Back</span>}
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canGoNext()}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border border-secondary/60 bg-secondary/20 text-sm font-medium text-secondary transition disabled:opacity-50 min-h-[44px] sm:min-h-0 touch-manipulation ${isLandscape ? 'px-4 py-2 flex-none' : 'px-5 py-2.5 sm:py-2 flex-1 sm:flex-none'}`}
                  >
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={(!questionText && !guidedQuestion) || questionLoading}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border border-secondary/60 bg-secondary/80 text-sm font-semibold text-surface transition disabled:opacity-50 min-h-[44px] sm:min-h-0 touch-manipulation ${isLandscape ? 'px-4 py-2 flex-none' : 'px-5 py-2.5 sm:py-2 flex-1 sm:flex-none'}`}
                  >
                    <span>{isLandscape ? 'Use' : 'Use question'}</span>
                    <Sparkle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Template Panel Overlay */}
          {isTemplatePanelOpen && (
            <div
              className={`absolute inset-0 z-40 flex items-stretch bg-surface/70 backdrop-blur-sm ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
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
                className={`ml-auto h-full w-full sm:w-[26rem] bg-surface border-l border-accent/30 p-5 sm:p-6 overflow-y-auto shadow-[0_0_45px_rgba(0,0,0,0.6)] ${prefersReducedMotion ? '' : 'animate-slide-in-right'}`}
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
