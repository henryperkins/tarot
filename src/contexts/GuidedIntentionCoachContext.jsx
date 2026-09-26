/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from './PreferencesContext';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useToast } from './ToastContext';
import { USER_QUESTION_MAX_LENGTH } from '../../shared/contracts/readingSchema.js';
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

/**
 * What the coach shows when it opens: the unfinished draft from a session that
 * was dismissed, otherwise the last-used settings plus any journal
 * recommendation.
 */
function resolveOpeningState({ userId, suggestedTopic, prefillRecommendation }) {
  const draft = loadCoachDraft(userId);
  if (draft) {
    return { ...draft, resumed: draft.step > 0 };
  }

  let topic = suggestedTopic;
  let timeframe = INTENTION_TIMEFRAME_OPTIONS[1].value;
  let depth = INTENTION_DEPTH_OPTIONS[1].value;
  try {
    const saved = JSON.parse(localStorage.getItem(COACH_PREFS_KEY) || '{}');
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
  const { publish: publishToast } = useToast();
  const userId = user?.id || null;

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
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  // A resumed draft is the one thing a fresh mount has to say on its own.
  const [pendingAnnouncement, setPendingAnnouncement] = useState(
    openingState?.resumed ? { message: RESUMED_MESSAGE } : null
  );
  const [autoQuestionEnabled, setAutoQuestionEnabled] = useState(openingState?.autoQuestionEnabled ?? true);
  const [prefillSource, setPrefillSource] = useState(openingState?.prefillSource ?? null);
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
  const [templatePanelIntent, setTemplatePanelIntent] = useState('browse');
  const [remixCount, setRemixCount] = useState(openingState?.remixCount ?? 0);
  const [astroHighlights, setAstroHighlights] = useState([]);
  const [astroWindowDays, setAstroWindowDays] = useState(null);
  const [astroSource, setAstroSource] = useState(null);
  const timeoutRefs = useRef([]);
  const hasInitializedRef = useRef(Boolean(openingState));
  const sessionUserIdRef = useRef(userId);
  // Prefix for announcing the next generated question, set by explicit
  // actions (Remix, the AI toggle) and consumed once generation settles.
  const pendingQuestionAnnouncementRef = useRef(null);
  const skipNextGenerationRef = useRef(false);
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

  const remixQuestion = useCallback(() => {
    setPrefillSource(null);
    setAutoQuestionEnabled(true);
    setQuestionError('');
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
    const finalQuestion = (questionText || guidedQuestion || '').slice(0, USER_QUESTION_MAX_LENGTH);
    if (!finalQuestion.trim()) return;

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
    questionText,
    guidedQuestion,
    userId,
    coachStats,
    personalization?.focusAreas,
    topic,
    timeframe,
    depth,
    publishToast,
    onApply,
    onClose
  ]);

  // Latest committed session, kept as a draft when the coach closes without
  // applying a question (swipe, Escape, backdrop, close button). Declared
  // before the opening effect below so that effect can clear it: in the commit
  // that starts a new session, these values still belong to the old one.
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
      questionText,
      autoQuestionEnabled,
      prefillSource
    };
  });

  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    // A session belongs to the account that opened it. If the account changes
    // while the coach is open, the draft cleanup below has already kept the
    // old session for the old account; start over as the new one.
    if (hasInitializedRef.current && sessionUserIdRef.current === userId) {
      return;
    }

    // Reopened without remounting, or the account changed. The generator's
    // run in this same commit still sees the previous session and would
    // overwrite the opening question queued here, so it sits that one run out.
    hasInitializedRef.current = true;
    sessionUserIdRef.current = userId;
    skipNextGenerationRef.current = true;

    const opening = resolveOpeningState({ userId, suggestedTopic, prefillRecommendation });
    openingSnapshotRef.current = opening;
    // Nothing of the new session has rendered yet, so nothing to keep if the
    // coach closes before it does.
    draftSnapshotRef.current = null;
    setStep(opening.step);
    setTopic(opening.topic);
    setTimeframe(opening.timeframe);
    setDepth(opening.depth);
    setCustomFocus(opening.customFocus);
    setUseCreative(opening.useCreative);
    setRemixCount(opening.remixCount);
    setQuestionText(opening.questionText);
    setAutoQuestionEnabled(opening.autoQuestionEnabled);
    setPrefillSource(opening.prefillSource);
    setQuestionError('');
    setQuestionLoading(false);
    if (!opening.autoQuestionEnabled) {
      clearAstroForecast();
    }
    if (opening.resumed) {
      announce(RESUMED_MESSAGE);
    }
  }, [isOpen, suggestedTopic, prefillRecommendation, userId, clearAstroForecast, announce]);

  useEffect(() => {
    if (!isOpen) return undefined;
    appliedRef.current = false;
    return () => {
      const session = draftSnapshotRef.current;
      if (!appliedRef.current && session && !isUnchangedCoachSession(session, openingSnapshotRef.current)) {
        saveCoachDraft(userId, session);
      }
      draftSnapshotRef.current = null;
    };
  }, [isOpen, userId]);

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
      setAnnouncement('');
      setPendingAnnouncement(null);
      setSuggestionsPage(0);
      clearAllTimeouts();
    }
  }, [isOpen, clearAllTimeouts]);

  useEffect(() => {
    const controller = new AbortController();
    let timerId = null;
    let isCancelled = false;

    const safeSetState = (setter, value) => {
      if (!isCancelled) setter(value);
    };

    // Speak the settled question only when an explicit action asked for it.
    const settleAnnouncement = (buildMessage) => {
      const prefix = pendingQuestionAnnouncementRef.current;
      if (!prefix || isCancelled) return;
      pendingQuestionAnnouncementRef.current = null;
      announce(buildMessage(prefix));
    };

    if (!isOpen) {
      setQuestionText('');
      setAstroHighlights([]);
      setAstroWindowDays(null);
      setAstroSource(null);
      return () => { isCancelled = true; };
    }

    if (skipNextGenerationRef.current) {
      skipNextGenerationRef.current = false;
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
      settleAnnouncement(prefix => `${prefix}: ${guidedQuestion}`);
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
          settleAnnouncement(prefix => (isLocalFallback
            ? `${prefix}: ${creative} Using on-device generator for now.`
            : `${prefix}: ${creative}`));

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
          settleAnnouncement(() => `Personalized mode is temporarily unavailable. Guided question: ${guidedQuestion}`);
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
        settleAnnouncement(() => `Personalized mode is temporarily unavailable. Guided question: ${guidedQuestion}`);
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
    userId,
    announce
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
    announce,
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
