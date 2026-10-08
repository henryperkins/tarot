/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from './PreferencesContext';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useToast } from './ToastContext';
import { USER_QUESTION_MAX_LENGTH } from '../../shared/contracts/readingRequestLimits.js';
import { resolveSpreadQuestionContext } from '../../shared/coach/spreadQuestions.js';
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
  clearCoachDraft,
  isUnchangedCoachSession,
  loadCoachDraft,
  saveCoachDraft
} from '../lib/coachDraft';
import {
  COACH_PREFS_KEY,
  FOCUS_AREA_TO_TOPIC,
  STEPS,
  SUGGESTIONS_PER_PAGE,
  SPREAD_TO_TOPIC_MAP,
  TIMING
} from '../lib/coachConstants';

const GuidedIntentionCoachContext = createContext(null);
const REVIEW_STEP = STEPS.length - 1;
const RESUMED_MESSAGE = 'Picked up where you left off.';
const coachPrefsKey = userId => userId ? `${COACH_PREFS_KEY}_${userId}` : COACH_PREFS_KEY;

/**
 * What the coach shows when it opens: the unfinished draft from a session that
 * was dismissed, otherwise the last-used settings plus any journal
 * recommendation.
 */
function resolveOpeningState({ userId, suggestedTopic, prefillRecommendation }) {
  const draft = loadCoachDraft(userId);
  if (draft) {
    // A restored intention belongs to the reader, even if it was generated.
    // Explicit Remix or setting changes release it for generation again.
    return { ...draft, autoQuestionEnabled: draft.questionText?.trim() ? false : draft.autoQuestionEnabled, resumed: draft.step > 0 };
  }

  let topic = suggestedTopic;
  let timeframe = INTENTION_TIMEFRAME_OPTIONS[1].value;
  let depth = INTENTION_DEPTH_OPTIONS[1].value;
  try {
    const saved = JSON.parse(localStorage.getItem(coachPrefsKey(userId)) || '{}');
    const isRecent = saved.timestamp && (Date.now() - saved.timestamp) < TIMING.PREFS_EXPIRY;
    if (isRecent) {
      topic = saved.lastTopic || topic;
      timeframe = saved.lastTimeframe || timeframe;
      depth = saved.lastDepth || depth;
    }
  } catch (error) {
    console.warn('Could not load coach preferences:', error);
  }

  const opening = {
    step: 0,
    topic,
    timeframe,
    depth,
    customFocus: '',
    useCreative: false,
    remixCount: 0,
    questionText: '',
    autoQuestionEnabled: true,
    prefillSource: null,
    resumed: false
  };

  const recommendation = prefillRecommendation?.question ? prefillRecommendation : loadCoachRecommendation(userId);
  if (!recommendation?.question) return opening;

  return {
    ...opening,
    topic: recommendation.topicValue || topic,
    timeframe: recommendation.timeframeValue || timeframe,
    depth: recommendation.depthValue || depth,
    questionText: recommendation.question,
    autoQuestionEnabled: false,
    prefillSource: recommendation
  };
}

export function GuidedIntentionCoachProvider(props) {
  const { user } = useAuth();
  const { personalizationReady } = usePreferences();
  // Owner-scoped preferences settle asynchronously; initialize once they belong
  // to this owner, rather than pinning the previous account's suggested topic.
  if (!props.isOpen || !personalizationReady) return null;
  return <CoachSession key={user?.id || 'anon'} {...props} userId={user?.id || null} />;
}

function CoachSession({
  isOpen,
  selectedSpread,
  onClose,
  onApply,
  prefillRecommendation = null,
  children,
  userId
}) {
  const { personalization } = usePreferences();
  const { canUseAIQuestions } = useSubscription();
  const { publish: publishToast } = useToast();

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

  const spreadQuestionContext = useMemo(
    () => resolveSpreadQuestionContext(selectedSpread),
    [selectedSpread]
  );

  // Resolved before the first render, so the opening question is in place
  // from the start instead of racing the question generator's first run.
  const [openingState] = useState(() => (isOpen
    ? resolveOpeningState({ userId, suggestedTopic, prefillRecommendation })
    : null));

  const [step, setStep] = useState(openingState?.step ?? 0);
  const [topic, setTopic] = useState(openingState?.topic ?? suggestedTopic);
  const [timeframe, setTimeframe] = useState(openingState?.timeframe ?? INTENTION_TIMEFRAME_OPTIONS[1].value);
  const [depth, setDepth] = useState(openingState?.depth ?? INTENTION_DEPTH_OPTIONS[1].value);
  const [customFocus, setCustomFocus] = useState(openingState?.customFocus ?? '');
  const [useCreative, setUseCreative] = useState(openingState?.useCreative ?? false);
  const [questionText, setQuestionText] = useState(openingState?.questionText ?? '');
  const [generation, setGeneration] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  // A resumed draft is the one thing a fresh mount has to say on its own.
  const [pendingAnnouncement, setPendingAnnouncement] = useState(
    openingState?.resumed ? { message: RESUMED_MESSAGE } : null
  );
  const [autoQuestionEnabled, setAutoQuestionEnabled] = useState(openingState?.autoQuestionEnabled ?? true);
  const [prefillSource, setPrefillSource] = useState(openingState?.prefillSource ?? null);
  const [storageSnapshot] = useState(() => {
    const snapshot = loadCoachStatsSnapshot(userId);
    const insights = loadStoredJournalInsights(userId);
    return {
      templates: loadCoachTemplates(userId),
      history: loadCoachHistory(undefined, userId),
      stats: snapshot?.stats || insights?.stats || null,
      meta: snapshot?.stats ? snapshot.meta || null : null
    };
  });
  const [templates, setTemplates] = useState(storageSnapshot.templates);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [templateStatus, setTemplateStatus] = useState('');
  const [questionHistory, setQuestionHistory] = useState(storageSnapshot.history);
  const coachStats = storageSnapshot.stats;
  const coachStatsMeta = storageSnapshot.meta;
  const personalizedSuggestions = useMemo(
    () => buildPersonalizedSuggestions(coachStats, questionHistory, personalization?.focusAreas),
    [coachStats, questionHistory, personalization?.focusAreas]
  );
  const [pageSelection, setPageSelection] = useState(null);
  const suggestionsPage = pageSelection?.source === personalizedSuggestions
    ? Math.min(pageSelection.page, Math.max(0, Math.ceil(personalizedSuggestions.length / SUGGESTIONS_PER_PAGE) - 1)) : 0;
  const setSuggestionsPage = useCallback(value => {
    setPageSelection({ source: personalizedSuggestions, page: typeof value === 'function' ? value(suggestionsPage) : value });
  }, [personalizedSuggestions, suggestionsPage]);
  const [isSuggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [isTemplatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [templatePanelIntent, setTemplatePanelIntent] = useState('browse');
  const [remixCount, setRemixCount] = useState(openingState?.remixCount ?? 0);

  const timeoutRefs = useRef([]);
  // Prefix for announcing the next generated question, set by explicit
  // actions (Remix, the AI toggle) and consumed once generation settles.
  const pendingQuestionAnnouncementRef = useRef(null);
  const openingSnapshotRef = useRef(openingState);
  const draftSnapshotRef = useRef(null);
  const appliedRef = useRef(false);

  const coachSnapshotLabel = useMemo(() => {
    if (!coachStatsMeta) return '';
    const parts = [];
    if (coachStatsMeta.filterLabel) {
      parts.push(coachStatsMeta.filterLabel);
    }
    if (typeof coachStatsMeta.entryCount === 'number') {
      parts.push(`${coachStatsMeta.entryCount} ${coachStatsMeta.entryCount === 1 ? 'entry' : 'entries'}`);
    }
    return parts.join(' · ');
  }, [coachStatsMeta]);

  const coachSnapshotDetail = useMemo(() => {
    return buildSourceDetailFromSignals(coachStatsMeta?.signalsUsed);
  }, [coachStatsMeta]);

  const releasePrefill = useCallback(() => {
    setPrefillSource(null);
    setAutoQuestionEnabled(true);
  }, []);

  const clearAstroForecast = useCallback(() => {
    setGeneration(null);
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

  // Clear the live region, then speak after a beat so a repeated message is
  // read again. Delivered by an effect so a remount (StrictMode included)
  // reschedules it instead of losing it.
  const announce = useCallback((message) => {
    if (!message) return;
    setAnnouncement('');
    setPendingAnnouncement({ message });
  }, []);

  useEffect(() => {
    if (!pendingAnnouncement) return undefined;
    const timerId = setTimeout(() => {
      setAnnouncement(pendingAnnouncement.message);
      setPendingAnnouncement(null);
    }, TIMING.ANNOUNCE_DELAY);
    return () => clearTimeout(timerId);
  }, [pendingAnnouncement]);

  const announceNextQuestion = useCallback((prefix) => {
    pendingQuestionAnnouncementRef.current = prefix;
  }, []);

  const prefillSourceDescription = useMemo(
    () => describePrefillSource(prefillSource),
    [prefillSource]
  );

  const questionSeed = useMemo(() => {
    return `${topic}|${timeframe}|${depth}|${customFocus}|${remixCount}`;
  }, [topic, timeframe, depth, customFocus, remixCount]);

  const guidedQuestion = useMemo(
    () => buildGuidedQuestion({ topic, timeframe, depth, customFocus, seed: questionSeed, spreadKey: selectedSpread }),
    [topic, timeframe, depth, customFocus, questionSeed, selectedSpread]
  );

  // An empty edited question belongs to the reader too; only automatic mode
  // can fall back to the generated wording.
  const generationInputs = useMemo(() => ({
    topic, timeframe, depth, customFocus, seed: questionSeed,
    focusAreas: personalization?.focusAreas, spreadKey: selectedSpread,
    useCreative, autoQuestionEnabled
  }), [topic, timeframe, depth, customFocus, questionSeed, personalization?.focusAreas, selectedSpread, useCreative, autoQuestionEnabled]);
  const activeGeneration = autoQuestionEnabled && useCreative && generation?.inputs === generationInputs ? generation : null;
  const currentQuestion = autoQuestionEnabled ? activeGeneration?.question || guidedQuestion : questionText;
  const questionLoading = autoQuestionEnabled && useCreative && !activeGeneration;
  const questionError = activeGeneration?.error || '';
  const astroHighlights = activeGeneration?.forecast?.highlights || [];
  const astroWindowDays = activeGeneration?.forecast?.days || null;
  const astroSource = activeGeneration?.forecast?.source || null;

  const questionQuality = useMemo(
    () => scoreQuestion(currentQuestion),
    [currentQuestion]
  );

  const isManualQuestion = !autoQuestionEnabled;

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
    // The spread is chosen on the page, not in the coach, so this chip is a
    // label with nowhere to go.
    if (spreadQuestionContext) {
      chips.push({ label: spreadQuestionContext.shortName, type: 'Spread' });
    }
    if (customFocus?.trim()) {
      chips.push({ label: customFocus.trim(), type: 'Detail', action: 'focus' });
    }
    return chips;
  }, [summary.topicLabel, summary.timeframeLabel, summary.depthLabel, spreadQuestionContext, customFocus, isManualQuestion]);

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
    const trimmedQuestion = currentQuestion.trim();
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
        ? `Template saved (oldest archived to keep ${MAX_TEMPLATES} max).`
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
    currentQuestion,
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
    setPrefillSource({
      source: 'template',
      label: template.label
    });
    // Close the library and land on the review step, where the result shows.
    setTemplatePanelOpen(false);
    setStep(REVIEW_STEP);
    announce(template.savedQuestion
      ? `Template "${template.label}" applied. ${template.savedQuestion}`
      : `Template "${template.label}" applied.`);
  }, [
    topic,
    timeframe,
    depth,
    releasePrefill,
    clearAstroForecast,
    announce
  ]);

  const handleDeleteTemplate = useCallback((templateId) => {
    const removed = templates.find(template => template.id === templateId);
    const result = deleteCoachTemplate(templateId, userId);
    if (result.success) {
      setTemplates(result.templates);
      setTemplateStatus(removed?.label ? `Removed "${removed.label}"` : 'Template removed');
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_SHORT);
    } else if (result.error) {
      setTemplateStatus(result.error);
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
    }
  }, [templates, userId, scheduleTimeout]);

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
    if (!suggestion) return;
    handleApplySuggestion(suggestion);
    setStep(REVIEW_STEP);
    announce(suggestion.question
      ? `Suggestion applied. ${suggestion.question}`
      : `Suggestion "${suggestion.label}" applied.`);
  }, [handleApplySuggestion, announce]);

  const handleApplyHistoryQuestion = useCallback((historyItem) => {
    if (!historyItem) return;
    handleApplySuggestion({
      label: 'Recent question',
      question: historyItem.question
    });
    setTemplatePanelOpen(false);
    setStep(REVIEW_STEP);
    announce(`Recent question applied. ${historyItem.question}`);
  }, [handleApplySuggestion, announce]);

  const editQuestion = useCallback((text) => {
    // Disabling generation also aborts any pending AI request in its effect.
    // Future automatic questions require an explicit Remix or setting change.
    setAutoQuestionEnabled(false);
    setQuestionText(text.slice(0, USER_QUESTION_MAX_LENGTH));
    setPrefillSource(null);
    pendingQuestionAnnouncementRef.current = null;
    clearAstroForecast();
  }, [clearAstroForecast]);

  const remixQuestion = useCallback(() => {
    setPrefillSource(null);
    setAutoQuestionEnabled(true);
    setRemixCount(count => count + 1);
    announceNextQuestion('New question');
  }, [announceNextQuestion]);

  const setCreativeMode = useCallback((enabled) => {
    releasePrefill();
    setUseCreative(enabled);
    setAutoQuestionEnabled(true);
    announceNextQuestion(enabled ? 'Personalized question' : 'Guided question');
  }, [releasePrefill, announceNextQuestion]);

  const openTemplatePanel = useCallback((intent = 'browse') => {
    setTemplatePanelIntent(intent === 'save' ? 'save' : 'browse');
    setTemplatePanelOpen(true);
  }, []);

  const closeTemplatePanel = useCallback(() => {
    setTemplatePanelOpen(false);
  }, []);

  const canGoNext = useCallback(() => {
    if (step === 0) return Boolean(topic);
    if (step === 1) return Boolean(timeframe);
    if (step === 2) return Boolean(depth);
    return false;
  }, [step, topic, timeframe, depth]);

  // Footer navigation moves focus nowhere, so name the new step aloud.
  const announceStep = useCallback((index) => {
    const entry = STEPS[index];
    if (entry) announce(`Step ${index + 1} of ${STEPS.length}: ${entry.label}`);
  }, [announce]);

  const goNext = useCallback(() => {
    if (step < REVIEW_STEP && canGoNext()) {
      setStep(step + 1);
      announceStep(step + 1);
    }
  }, [step, canGoNext, announceStep]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
      announceStep(step - 1);
    }
  }, [step, announceStep]);

  const handleApply = useCallback(async () => {
    // Every source is bounded, but an over-long question would only fail with
    // a 400 after the ritual, so trim it to the server contract here.
    const finalQuestion = currentQuestion.slice(0, USER_QUESTION_MAX_LENGTH);
    if (!finalQuestion.trim()) return;

    const historyResult = recordCoachQuestion(finalQuestion, undefined, userId);

    if (historyResult?.history) {
      setQuestionHistory(historyResult.history);
    }

    try {
      const prefs = {
        lastTopic: topic,
        lastTimeframe: timeframe,
        lastDepth: depth,
        timestamp: Date.now()
      };
      localStorage.setItem(coachPrefsKey(userId), JSON.stringify(prefs));
    } catch (error) {
      console.warn('Could not save coach preferences:', error);
    }

    if (!historyResult?.success) {
      // The coach closes below, so the warning has to outlive it.
      publishToast({
        type: 'warning',
        title: 'Not saved to recent questions',
        description: historyResult?.error ||
          'Your question was used, but we could not save it to recent history. Check storage permissions and try again.'
      });
    }

    appliedRef.current = true;
    clearCoachDraft(userId);
    onApply?.(finalQuestion);
    onClose?.();
  }, [
    currentQuestion,
    userId,
    topic,
    timeframe,
    depth,
    publishToast,
    onApply,
    onClose
  ]);

  // Latest committed session, kept as a draft when the coach closes without
  // applying a question. Each owner has a separate mounted session and refs;
  // disposal therefore snapshots only the previous owner's displayed wording.
  useEffect(() => {
    if (!isOpen) return;
    draftSnapshotRef.current = {
      step,
      topic,
      timeframe,
      depth,
      customFocus,
      useCreative,
      remixCount,
      questionText: currentQuestion,
      autoQuestionEnabled,
      prefillSource
    };
  });

  useEffect(() => {
    const opening = openingSnapshotRef.current;
    return () => {
      const session = draftSnapshotRef.current;
      if (!appliedRef.current && session && !isUnchangedCoachSession(session, opening)) {
        saveCoachDraft(userId, session);
      }
    };
  }, [userId]);

  // Only asynchronous creative generation lives in an effect. Guided wording,
  // loading and forecast visibility come from the current session inputs.
  useEffect(() => {
    if (!autoQuestionEnabled) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    const settleAnnouncement = (message) => {
      const prefix = pendingQuestionAnnouncementRef.current;
      if (!prefix || cancelled) return;
      pendingQuestionAnnouncementRef.current = null;
      announce(`${prefix}: ${message}`);
    };
    const timer = setTimeout(async () => {
      if (!useCreative) {
        settleAnnouncement(guidedQuestion);
        return;
      }
      try {
        const { question, source, forecast } = await buildCreativeQuestion(generationInputs, {
          signal: controller.signal, userId
        });
        if (cancelled || controller.signal.aborted) return;
        const local = ['local', 'local-fallback', 'api-fallback', 'local-template'].includes(source);
        const error = !question
          ? 'Personalized mode is temporarily unavailable. Showing guided version.'
          : local ? 'Using on-device generator for now.' : '';
        setGeneration({ inputs: generationInputs, question: question || guidedQuestion, error, forecast: question ? forecast : null });
        settleAnnouncement(`${question || guidedQuestion}${error ? ` ${error}` : ''}`);
      } catch (error) {
        if (error?.name === 'AbortError' || cancelled) return;
        const message = 'Personalized mode is temporarily unavailable. Showing guided version.';
        setGeneration({ inputs: generationInputs, question: guidedQuestion, error: message, forecast: null });
        settleAnnouncement(`${guidedQuestion} ${message}`);
      }
    }, useCreative ? TIMING.CREATIVE_DEBOUNCE : TIMING.ANNOUNCE_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [autoQuestionEnabled, useCreative, generationInputs, guidedQuestion, userId, announce]);

  const value = {
    isOpen,
    selectedSpread,
    spreadQuestionContext,
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
    templatePanelIntent,
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
    currentQuestion,
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
    setPrefillSource,
    setTemplates,
    setNewTemplateLabel,
    setTemplateStatus,
    setQuestionHistory,
    setSuggestionsPage,
    setSuggestionsExpanded,
    setTemplatePanelOpen,
    setRemixCount,
    releasePrefill,
    clearAstroForecast,
    announce,
    editQuestion,
    remixQuestion,
    setCreativeMode,
    openTemplatePanel,
    closeTemplatePanel,
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
