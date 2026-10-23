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
import { getQuestionFramingSuggestions, buildLocalQuestionRefinement } from '../lib/questionFraming';
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
  runCoachTemplateMutation,
  undoCoachTemplateSave
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
/** Opening wording belongs to this reading and this owner, ahead of defaults. */
function resolveOpeningState({ userId, suggestedTopic, initialQuestion }) {
  const entryQuestion = typeof initialQuestion === 'string' ? initialQuestion.slice(0, USER_QUESTION_MAX_LENGTH) : '';
  const draft = loadCoachDraft(userId);
  if (draft && (draft.entryQuestion ?? draft.originalQuestion ?? '') === entryQuestion) {
    return { ...draft, autoQuestionEnabled: draft.questionText?.trim() ? false : draft.autoQuestionEnabled, resumed: true };
  }
  let saved = {};
  try {
    const candidate = JSON.parse(localStorage.getItem(coachPrefsKey(userId)) || '{}');
    if (candidate.timestamp && Date.now() - candidate.timestamp < TIMING.PREFS_EXPIRY) saved = candidate;
  } catch { /* Storage is optional; the reader's wording is not. */ }
  return {
    step: entryQuestion.trim() ? REVIEW_STEP : 0,
    topic: saved.lastTopic || suggestedTopic,
    timeframe: saved.lastTimeframe || INTENTION_TIMEFRAME_OPTIONS[1].value,
    depth: saved.lastDepth || INTENTION_DEPTH_OPTIONS[1].value,
    customFocus: '', useCreative: false, remixCount: 0,
    entryQuestion, originalQuestion: entryQuestion, previousQuestion: '',
    questionText: entryQuestion, questionOrigin: entryQuestion.trim() ? 'reader' : 'guided',
    autoQuestionEnabled: !entryQuestion.trim(), prefillSource: null, resumed: false
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
  initialQuestion = '',
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
    ? resolveOpeningState({ userId, suggestedTopic, initialQuestion })
    : null));

  const [step, setStep] = useState(openingState?.step ?? 0);
  // A request token, not a boolean: applying another suggestion while already
  // on the review step must move focus back to the editor again.
  const [reviewFocusRequest, setReviewFocusRequest] = useState(openingState?.step === REVIEW_STEP ? 1 : 0);
  const [topic, setTopic] = useState(openingState?.topic ?? suggestedTopic);
  const [timeframe, setTimeframe] = useState(openingState?.timeframe ?? INTENTION_TIMEFRAME_OPTIONS[1].value);
  const [depth, setDepth] = useState(openingState?.depth ?? INTENTION_DEPTH_OPTIONS[1].value);
  const [customFocus, setCustomFocus] = useState(openingState?.customFocus ?? '');
  const [useCreative, setUseCreative] = useState(openingState?.useCreative ?? false);
  const [questionText, setQuestionText] = useState(openingState?.questionText ?? '');
  const [originalQuestion, setOriginalQuestion] = useState(openingState?.originalQuestion || '');
  const [previousQuestion, setPreviousQuestion] = useState(openingState?.previousQuestion || '');
  const [questionOrigin, setQuestionOrigin] = useState(openingState?.questionOrigin || (openingState?.questionText ? 'reader' : 'guided'));
  const [generation, setGeneration] = useState(null);
  const [generationRequest, setGenerationRequest] = useState(null);
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
      recommendation: prefillRecommendation?.question ? prefillRecommendation : loadCoachRecommendation(userId),
      templates: loadCoachTemplates(userId),
      history: loadCoachHistory(undefined, userId),
      stats: snapshot?.stats || insights?.stats || null,
      meta: snapshot?.stats ? snapshot.meta || null : null
    };
  });
  const [templates, setTemplates] = useState(storageSnapshot.templates);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [templateStatus, setTemplateStatus] = useState('');
  const [templateUndo, setTemplateUndo] = useState(null);
  const [questionHistory, setQuestionHistory] = useState(storageSnapshot.history);
  const coachStats = storageSnapshot.stats;
  const coachStatsMeta = storageSnapshot.meta;
  const personalizedSuggestions = useMemo(
    () => {
      const suggestions = buildPersonalizedSuggestions(coachStats, questionHistory, personalization?.focusAreas);
      const recommendation = storageSnapshot.recommendation;
      return recommendation?.question ? [{ ...recommendation, id: 'journal-recommendation', source: 'journal',
        label: recommendation.label || 'From your journal', topic: recommendation.topicValue,
        timeframe: recommendation.timeframeValue, depth: recommendation.depthValue }, ...suggestions] : suggestions;
    },
    [coachStats, questionHistory, personalization?.focusAreas, storageSnapshot.recommendation]
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

  const requestReviewFocus = useCallback(() => {
    setReviewFocusRequest(request => request + 1);
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

  const generationInputs = useMemo(() => ({
    topic, timeframe, depth, customFocus, seed: questionSeed,
    focusAreas: personalization?.focusAreas, spreadKey: selectedSpread
  }), [topic, timeframe, depth, customFocus, questionSeed, personalization?.focusAreas, selectedSpread]);
  const currentQuestion = autoQuestionEnabled ? guidedQuestion : questionText;
  const questionLoading = Boolean(generationRequest);
  const questionError = generation?.error || '';
  const astroHighlights = generation?.forecast?.highlights || [];
  const astroWindowDays = generation?.forecast?.days || null;
  const astroSource = generation?.forecast?.source || null;
  const hasQuestion = Boolean(currentQuestion.trim());
  const isManualQuestion = !autoQuestionEnabled;
  const framingSuggestions = useMemo(() => getQuestionFramingSuggestions(currentQuestion), [currentQuestion]);

  // A setting is configuration, never permission to replace the editor.
  const releasePrefill = useCallback(() => {
    if (questionOrigin === 'reader' || !autoQuestionEnabled) {
      setQuestionText(currentQuestion);
      setAutoQuestionEnabled(false);
    }
    setGenerationRequest(null);
    setGeneration(null);
    setPrefillSource(null);
  }, [currentQuestion, questionOrigin, autoQuestionEnabled]);

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

  const suggestionPageCount = useMemo(() => {
    if (personalizedSuggestions.length === 0) return 0;
    return Math.ceil(personalizedSuggestions.length / SUGGESTIONS_PER_PAGE);
  }, [personalizedSuggestions.length]);

  const visibleSuggestions = useMemo(() => {
    if (personalizedSuggestions.length === 0) return [];
    const start = suggestionsPage * SUGGESTIONS_PER_PAGE;
    return personalizedSuggestions.slice(start, start + SUGGESTIONS_PER_PAGE);
  }, [personalizedSuggestions, suggestionsPage]);

  const handleSaveTemplate = useCallback(async () => {
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
    const payload = {
      label,
      topic,
      timeframe,
      depth,
      customFocus,
      useCreative,
      savedQuestion: trimmedQuestion
    };
    const result = await runCoachTemplateMutation(userId, () => saveCoachTemplate(payload, userId));
    if (result.success) {
      setTemplates(result.templates);
      setTemplateUndo(result.undoToken);
      const status = result.replacedTemplate
        ? `Template saved; replaced "${result.replacedTemplate.label}". You can undo this replacement.`
        : 'Template saved';
      setTemplateStatus(status);
      setNewTemplateLabel('');
      if (!result.undoToken) scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
    } else if (result.error) {
      setTemplateStatus(result.error);
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
    }
  }, [
    newTemplateLabel,
    currentQuestion,
    topic,
    timeframe,
    depth,
    customFocus,
    useCreative,
    userId,
    scheduleTimeout
  ]);

  const handleUndoTemplateSave = useCallback(async () => {
    if (!templateUndo) return;
    const result = await runCoachTemplateMutation(userId, () => undoCoachTemplateSave(templateUndo, userId));
    if (result.success) {
      setTemplates(result.templates);
      setTemplateUndo(null);
      setTemplateStatus('Replacement undone. Your previous template is restored.');
    } else setTemplateStatus(result.error || 'Could not undo this replacement.');
  }, [templateUndo, userId]);

  const handleApplyTemplate = useCallback((template) => {
    if (!template) return;
    setGenerationRequest(null);
    setQuestionOrigin('reader');
    if (!originalQuestion && template.savedQuestion) setOriginalQuestion(template.savedQuestion);
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
    requestReviewFocus();
    announce(template.savedQuestion
      ? `Template "${template.label}" applied. ${template.savedQuestion}`
      : `Template "${template.label}" applied.`);
  }, [
    topic,
    timeframe,
    depth,
    originalQuestion,
    releasePrefill,
    clearAstroForecast,
    requestReviewFocus,
    announce
  ]);

  const handleDeleteTemplate = useCallback(async (templateId) => {
    const removed = templates.find(template => template.id === templateId);
    const result = await runCoachTemplateMutation(userId, () => deleteCoachTemplate(templateId, userId));
    if (result.success) {
      setTemplates(result.templates);
      setTemplateUndo(null);
      setTemplateStatus(removed?.label ? `Removed "${removed.label}"` : 'Template removed');
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_SHORT);
    } else if (result.error) {
      setTemplateStatus(result.error);
      scheduleTimeout(() => setTemplateStatus(''), TIMING.STATUS_DISPLAY_MEDIUM);
    }
  }, [templates, userId, scheduleTimeout]);

  const handleApplySuggestion = useCallback((suggestion, resolvedQuestion = '') => {
    if (!suggestion) return;
    setGenerationRequest(null);
    setQuestionOrigin('reader');
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
    // The card and the editor must show one question. Suggestions without
    // saved wording use the exact preview the reader just selected instead of
    // asking the generator for a different variant.
    const exactQuestion = suggestion.question || resolvedQuestion;
    if (exactQuestion) {
      if (!originalQuestion) setOriginalQuestion(exactQuestion);
      setQuestionText(exactQuestion);
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
    originalQuestion,
    releasePrefill,
    clearAstroForecast
  ]);

  const handleSuggestionPick = useCallback((suggestion, preview) => {
    if (!suggestion) return;
    const resolvedQuestion = suggestion.question || preview || '';
    handleApplySuggestion(suggestion, resolvedQuestion);
    setStep(REVIEW_STEP);
    requestReviewFocus();
    announce(resolvedQuestion
      ? `Suggestion applied. ${resolvedQuestion}`
      : `Suggestion "${suggestion.label}" applied.`);
  }, [handleApplySuggestion, requestReviewFocus, announce]);

  const handleApplyHistoryQuestion = useCallback((historyItem) => {
    if (!historyItem) return;
    handleApplySuggestion({
      label: 'Recent question',
      question: historyItem.question
    });
    setTemplatePanelOpen(false);
    setStep(REVIEW_STEP);
    requestReviewFocus();
    announce(`Recent question applied. ${historyItem.question}`);
  }, [handleApplySuggestion, requestReviewFocus, announce]);

  const editQuestion = useCallback((text) => {
    setGenerationRequest(null);
    setAutoQuestionEnabled(false);
    setQuestionOrigin('reader');
    setQuestionText(text.slice(0, USER_QUESTION_MAX_LENGTH));
    setPrefillSource(null);
    clearAstroForecast();
  }, [clearAstroForecast]);

  const remixQuestion = useCallback(() => {
    const nextCount = remixCount + 1;
    setPreviousQuestion(currentQuestion);
    setPrefillSource(null);
    setAutoQuestionEnabled(false);
    setQuestionText(currentQuestion);
    setRemixCount(nextCount);
    clearAstroForecast();
    const inputs = { ...generationInputs, seed: `${questionSeed}|${nextCount}`,
      // AI always refines the displayed artifact, even when the wizard wrote
      // its first version. Local fresh generation can still use the settings.
      questionText: useCreative || questionOrigin === 'reader' ? currentQuestion : '' };
    if (useCreative && canUseAIQuestions) {
      setGenerationRequest({ inputs });
      announce('Refining your question. You can keep editing.');
    } else {
      setGenerationRequest(null);
      const question = inputs.questionText ? buildLocalQuestionRefinement(inputs.questionText) : buildGuidedQuestion(inputs);
      setQuestionText(question);
      announce(question === currentQuestion ? 'Your wording is preserved. You can refine it in the editor.' : `New wording: ${question}`);
    }
  }, [remixCount, currentQuestion, generationInputs, questionSeed, questionOrigin, useCreative, canUseAIQuestions, clearAstroForecast, announce]);

  const setCreativeMode = useCallback((enabled) => {
    releasePrefill();
    setUseCreative(enabled);
  }, [releasePrefill]);

  const restorePreviousQuestion = useCallback(() => {
    if (!previousQuestion) return;
    editQuestion(previousQuestion);
    setPreviousQuestion('');
    setStep(REVIEW_STEP);
    requestReviewFocus();
    announce('Your previous wording is restored.');
  }, [previousQuestion, editQuestion, requestReviewFocus, announce]);

  const restoreOriginalQuestion = useCallback(() => {
    if (!originalQuestion) return;
    setPreviousQuestion(currentQuestion);
    editQuestion(originalQuestion);
    setStep(REVIEW_STEP);
    requestReviewFocus();
    announce('Your original question is restored.');
  }, [originalQuestion, currentQuestion, editQuestion, requestReviewFocus, announce]);

  const startFresh = useCallback(() => {
    setPreviousQuestion(currentQuestion);
    setGenerationRequest(null);
    setGeneration(null);
    setPrefillSource(null);
    setQuestionText('');
    setQuestionOrigin('guided');
    setAutoQuestionEnabled(true);
    setCustomFocus('');
    setUseCreative(false);
    setStep(0);
    announce('Start a new question. Your original question is still available to restore.');
  }, [currentQuestion, announce]);

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
      if (step + 1 === REVIEW_STEP) requestReviewFocus();
      announceStep(step + 1);
    }
  }, [step, canGoNext, announceStep, requestReviewFocus]);

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
      entryQuestion: openingState.entryQuestion,
      originalQuestion, previousQuestion, questionOrigin,
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

  // Only an explicit generation action starts a request. Every edit/configuration
  // change disposes it; a late result cannot replace newer reader wording.
  useEffect(() => {
    if (!generationRequest) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { question, source, forecast } = await buildCreativeQuestion(generationRequest.inputs, { signal: controller.signal, userId });
        if (cancelled || controller.signal.aborted) return;
        const error = source === 'local-preserved' ? 'Your wording is kept as written. You can edit it directly or try again.'
          : ['local', 'local-fallback', 'api-fallback', 'local-template'].includes(source) ? 'Using a guided question for now.' : '';
        setQuestionText(question);
        setQuestionOrigin('reader');
        setGeneration({ error, forecast });
        setGenerationRequest(null);
        announce(`${question}${error ? ` ${error}` : ''}`);
      } catch (error) {
        if (cancelled || error?.name === 'AbortError') return;
        setGenerationRequest(null);
        setGeneration({ error: 'Refinement is unavailable right now. Your wording is kept.', forecast: null });
        announce('Refinement is unavailable right now. Your wording is kept.');
      }
    }, TIMING.CREATIVE_DEBOUNCE);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [generationRequest, userId, announce]);

  const value = {
    isOpen,
    selectedSpread,
    spreadQuestionContext,
    onClose,
    canUseAIQuestions,
    originalQuestion, previousQuestion, framingSuggestions,
    startFresh, restoreOriginalQuestion, restorePreviousQuestion,
    templateUndo, handleUndoTemplateSave,
    step,
    setStep,
    reviewFocusRequest,
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
    hasQuestion,
    isManualQuestion,
    summary,
    footerSummary,
    footerSummaryCompact,
    questionContextChips,
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
    requestReviewFocus,
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
