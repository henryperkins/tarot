/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from './PreferencesContext';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import {
  INTENTION_TOPIC_OPTIONS,
  INTENTION_TIMEFRAME_OPTIONS,
  INTENTION_DEPTH_OPTIONS,
  buildGuidedQuestion,
  buildCreativeQuestion,
  getCoachSummary
} from '../lib/intentionCoach';
import { scoreQuestion, getQualityLevel } from '../lib/questionQuality';
import {
  buildSourceDetailFromSignals,
  loadCoachRecommendation,
  loadStoredJournalInsights,
  loadCoachStatsSnapshot
} from '../lib/journalInsights';
import {
  loadCoachTemplates,
  saveCoachTemplate,
  deleteCoachTemplate,
  loadCoachHistory,
  recordCoachQuestion,
  MAX_TEMPLATES
} from '../lib/coachStorage';
import { buildPersonalizedSuggestions, describePrefillSource } from '../lib/coachSuggestions';
import {
  COACH_PREFS_KEY,
  FOCUS_AREA_TO_TOPIC,
  SUGGESTIONS_PER_PAGE,
  SPREAD_TO_TOPIC_MAP,
  TIMING
} from '../lib/coachConstants';

const GuidedIntentionCoachContext = createContext(null);

export function GuidedIntentionCoachProvider({
  isOpen,
  selectedSpread,
  onClose,
  onApply,
  prefillRecommendation = null,
  children
}) {
  const { personalization } = usePreferences();
  const { user } = useAuth();
  const { canUseAIQuestions } = useSubscription();
  const userId = user?.id || null;

  const [step, setStep] = useState(0);

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
  const [coachStatsMeta, setCoachStatsMeta] = useState(null);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState([]);
  const [suggestionsPage, setSuggestionsPage] = useState(0);
  const [isSuggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [remixCount, setRemixCount] = useState(0);
  const [astroHighlights, setAstroHighlights] = useState([]);
  const [astroWindowDays, setAstroWindowDays] = useState(null);
  const [astroSource, setAstroSource] = useState(null);
  const timeoutRefs = useRef([]);
  const hasInitializedRef = useRef(false);

  const coachSnapshotLabel = useMemo(() => {
    if (!coachStatsMeta) return '';
    const parts = [];
    if (coachStatsMeta.filterLabel) {
      parts.push(coachStatsMeta.filterLabel);
    }
    if (typeof coachStatsMeta.entryCount === 'number') {
      parts.push(`${coachStatsMeta.entryCount} entries`);
    }
    return parts.join(' · ');
  }, [coachStatsMeta]);

  const coachSnapshotDetail = useMemo(() => {
    return buildSourceDetailFromSignals(coachStatsMeta?.signalsUsed);
  }, [coachStatsMeta]);

  const releasePrefill = useCallback(() => {
    if (prefillSource) {
      setPrefillSource(null);
      setAutoQuestionEnabled(true);
    }
  }, [prefillSource]);

  const clearAstroForecast = useCallback(() => {
    setAstroHighlights([]);
    setAstroWindowDays(null);
    setAstroSource(null);
  }, []);

  const scheduleTimeout = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter(timeoutId => timeoutId !== id);
      callback();
    }, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(id => clearTimeout(id));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  const prefillSourceDescription = useMemo(
    () => describePrefillSource(prefillSource),
    [prefillSource]
  );

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

  const summary = getCoachSummary({ topic, timeframe, depth });
  const footerSummary = isManualQuestion
    ? 'Custom question'
    : `${summary.topicLabel} · ${summary.timeframeLabel} · ${summary.depthLabel}`;
  const footerSummaryCompact = isManualQuestion
    ? 'Custom question'
    : `${summary.topicLabel} · ${summary.timeframeLabel}`;

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

  const handleSaveTemplate = useCallback(() => {
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
  }, [
    newTemplateLabel,
    questionText,
    guidedQuestion,
    templates,
    topic,
    timeframe,
    depth,
    customFocus,
    useCreative,
    userId,
    scheduleTimeout
  ]);

  const handleApplyTemplate = useCallback((template) => {
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
  }, [
    topic,
    timeframe,
    depth,
    releasePrefill,
    clearAstroForecast
  ]);

  const handleDeleteTemplate = useCallback((templateId) => {
    const result = deleteCoachTemplate(templateId, userId);
    if (result.success) {
      setTemplates(result.templates);
      setTemplateStatus('Template removed');
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_SHORT);
    } else if (result.error) {
      setTemplateStatus(result.error);
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
    }
  }, [userId, scheduleTimeout]);

  const handleApplySuggestion = useCallback((suggestion) => {
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
  }, [
    topic,
    timeframe,
    depth,
    releasePrefill,
    clearAstroForecast
  ]);

  const handleSuggestionPick = useCallback((suggestion) => {
    handleApplySuggestion(suggestion);
    setStep(2);
  }, [handleApplySuggestion]);

  const handleApplyHistoryQuestion = useCallback((historyItem) => {
    if (!historyItem) return;
    handleApplySuggestion({
      label: 'Recent question',
      question: historyItem.question
    });
  }, [handleApplySuggestion]);

  const canGoNext = useCallback(() => {
    if (step === 0) return Boolean(topic);
    if (step === 1) return Boolean(timeframe);
    if (step === 2) return Boolean(depth);
    return false;
  }, [step, topic, timeframe, depth]);

  const goNext = useCallback(() => {
    if (step < 2 && canGoNext()) {
      setStep(step + 1);
    }
  }, [step, canGoNext]);

  const goBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleApply = useCallback(async () => {
    const finalQuestion = questionText || guidedQuestion;
    if (!finalQuestion) return;

    const historyResult = recordCoachQuestion(finalQuestion, undefined, userId);

    if (historyResult?.history) {
      setQuestionHistory(historyResult.history);
      setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, historyResult.history, personalization?.focusAreas));
      setSuggestionsPage(0);
    }

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

    if (historyResult?.success) {
      setHistoryStatus('');
    } else {
      const message =
        historyResult?.error ||
        'Your question was used, but we could not save it to recent history. Check storage permissions and try again.';
      setHistoryStatus(message);
    }

    onApply?.(finalQuestion);
    onClose?.();
  }, [
    questionText,
    guidedQuestion,
    userId,
    coachStats,
    personalization?.focusAreas,
    topic,
    timeframe,
    depth,
    onApply,
    onClose
  ]);

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

  useEffect(() => {
    if (!isOpen) return;
    setPersonalizedSuggestions(buildPersonalizedSuggestions(coachStats, questionHistory, personalization?.focusAreas));
    setSuggestionsPage(0);
  }, [coachStats, questionHistory, isOpen, personalization?.focusAreas]);

  useEffect(() => {
    const totalPages = Math.max(0, Math.ceil(personalizedSuggestions.length / SUGGESTIONS_PER_PAGE) - 1);
    setSuggestionsPage(prev => Math.min(prev, totalPages));
  }, [personalizedSuggestions]);

  useEffect(() => {
    if (!isOpen) {
      setTemplateStatus('');
      setNewTemplateLabel('');
      setTemplatePanelOpen(false);
      setHistoryStatus('');
      setSuggestionsPage(0);
      clearAllTimeouts();
    }
  }, [isOpen, clearAllTimeouts]);

  useEffect(() => {
    if (!historyStatus) return;
    const timeoutId = scheduleTimeout(() => setHistoryStatus(''), TIMING.STATUS_DISPLAY_LONG);
    return () => clearTimeout(timeoutId);
  }, [historyStatus, scheduleTimeout]);

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
  }, [
    guidedQuestion,
    useCreative,
    isOpen,
    autoQuestionEnabled,
    questionSeed,
    topic,
    timeframe,
    depth,
    customFocus,
    personalization?.focusAreas,
    userId
  ]);

  const value = {
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
    historyStatus,
    autoQuestionEnabled,
    prefillSource,
    templates,
    newTemplateLabel,
    templateStatus,
    questionHistory,
    coachStats,
    coachStatsMeta,
    personalizedSuggestions,
    suggestionsPage,
    isSuggestionsExpanded,
    isTemplatePanelOpen,
    remixCount,
    astroHighlights,
    astroWindowDays,
    astroSource,
    coachSnapshotLabel,
    coachSnapshotDetail,
    focusAreaSuggestedTopic,
    spreadSuggestedTopic,
    suggestedTopic,
    prefillSourceDescription,
    guidedQuestion,
    questionQuality,
    isManualQuestion,
    qualityLevel,
    summary,
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
    setUseCreative,
    setAutoQuestionEnabled,
    setQuestionText,
    setQuestionLoading,
    setQuestionError,
    setPrefillSource,
    setTemplates,
    setNewTemplateLabel,
    setTemplateStatus,
    setQuestionHistory,
    setCoachStats,
    setCoachStatsMeta,
    setPersonalizedSuggestions,
    setSuggestionsPage,
    setSuggestionsExpanded,
    setTemplatePanelOpen,
    setRemixCount,
    setAstroHighlights,
    setAstroWindowDays,
    setAstroSource,
    releasePrefill,
    clearAstroForecast,
    handleSaveTemplate,
    handleApplyTemplate,
    handleDeleteTemplate,
    handleApplySuggestion,
    handleSuggestionPick,
    handleApplyHistoryQuestion,
    canGoNext,
    goNext,
    goBack,
    handleApply
  };

  return (
    <GuidedIntentionCoachContext.Provider value={value}>
      {children}
    </GuidedIntentionCoachContext.Provider>
  );
}

export function useGuidedIntentionCoach() {
  const context = useContext(GuidedIntentionCoachContext);
  if (!context) {
    throw new Error('useGuidedIntentionCoach must be used within GuidedIntentionCoachProvider');
  }
  return context;
}
