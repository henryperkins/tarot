import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sparkles, RotateCcw, Star, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { SPREADS } from './data/spreads';
import { MAJOR_ARCANA } from './data/majorArcana';
import { MINOR_ARCANA } from './data/minorArcana';
import { EXAMPLE_QUESTIONS } from './data/exampleQuestions';
import { SpreadSelector } from './components/SpreadSelector';
import { QuestionInput } from './components/QuestionInput';
import { SettingsToggles } from './components/SettingsToggles';
import { RitualControls } from './components/RitualControls';
import { ReadingGrid } from './components/ReadingGrid';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { StepProgress } from './components/StepProgress';
import { HelperToggle } from './components/HelperToggle';
import { SpreadPatterns } from './components/SpreadPatterns';
import { GuidedIntentionCoach } from './components/GuidedIntentionCoach';
import { PatternHighlightBanner } from './components/PatternHighlightBanner';
import { loadCoachRecommendation, saveCoachRecommendation } from './lib/journalInsights';
import { GlobalNav } from './components/GlobalNav';
import { VisionValidationPanel } from './components/VisionValidationPanel';
import { DeckSelector } from './components/DeckSelector';
import { FeedbackPanel } from './components/FeedbackPanel';
import { MobileSettingsDrawer } from './components/MobileSettingsDrawer';
import { useNavigate } from 'react-router-dom';
import { useJournal } from './hooks/useJournal';
import { computeRelationships } from './lib/deck';
import { formatReading } from './lib/formatting';
import './styles/tarot.css';
import { canonicalCardKey, canonicalizeCardName } from '../shared/vision/cardNameMapping.js';

// Hooks & Contexts
import { usePreferences } from './contexts/PreferencesContext';
import { useAudioController } from './hooks/useAudioController';
import { useVisionAnalysis } from './hooks/useVisionAnalysis';
import { useTarotState } from './hooks/useTarotState';

const STEP_PROGRESS_STEPS = [
  { id: 'spread', label: 'Spread' },
  { id: 'intention', label: 'Question' },
  { id: 'ritual', label: 'Ritual (optional)' },
  { id: 'reading', label: 'Reading' }
];

export default function TarotReading() {
  // --- 1. Global Preferences (Context) ---
  const {
    // Theme
    theme,
    // Audio
    voiceOn,
    ambienceOn,
    // Deck & Reversals
    deckStyleId,
    setDeckStyleId,
    includeMinors,
    deckSize,
    minorsDataIncomplete,
    reversalFramework,
    // UI State
    prepareSectionsOpen,
    togglePrepareSection
  } = usePreferences();

  // --- 2. Audio Controller (Hook) ---
  const {
    ttsState,
    ttsAnnouncement,
    showVoicePrompt,
    setShowVoicePrompt,
    speak,
    handleNarrationButtonClick,
    handleNarrationStop,
    handleVoicePromptEnable
  } = useAudioController();

  // --- 3. Core Tarot State (Hook) ---
  // This manages shuffle, deal, reveal logic, and ritual state
  const {
    selectedSpread,
    setSelectedSpread,
    reading,
    setReading,
    isShuffling,
    revealedCards,
    setRevealedCards,
    dealIndex,
    setDealIndex,
    hasKnocked,
    setHasKnocked,
    knockCount,
    setKnockCount,
    hasCut,
    setHasCut,
    cutIndex,
    setCutIndex,
    hasConfirmedSpread,
    setHasConfirmedSpread,
    sessionSeed,
    setSessionSeed, // used in journal
    userQuestion,
    setUserQuestion,
    deckAnnouncement,
    shuffle,
    handleKnock,
    applyCut,
    dealNext,
    revealCard,
    revealAll,
    onSpreadConfirm,
    resetReadingState,
    knockTimesRef
  } = useTarotState(speak);

  // --- 4. Vision Analysis (Hook) ---
  const {
    visionResults,
    visionConflicts,
    isVisionReady,
    hasVisionData,
    handleVisionResults,
    handleRemoveVisionResult,
    handleClearVisionResults,
    ensureVisionProof,
    resetVisionProof,
    setVisionResults,
    setVisionConflicts,
    feedbackVisionSummary,
    getVisionConflictsForCards
  } = useVisionAnalysis(reading);

  // --- 5. Local View State & Wiring ---
  // Reading Generation / Analysis State
  const [personalReading, setPersonalReading] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analyzingText, setAnalyzingText] = useState('');
  const [spreadAnalysis, setSpreadAnalysis] = useState(null);
  const [themes, setThemes] = useState(null);
  const [analysisContext, setAnalysisContext] = useState(null);
  const [readingMeta, setReadingMeta] = useState({
    requestId: null,
    provider: null,
    spreadKey: null,
    spreadName: null,
    deckStyle: null,
    userQuestion: null
  });
  // UI Specifics
  const [journalStatus, setJournalStatus] = useState(null);
  const [reflections, setReflections] = useState({});
  const [minorsFallbackWarning, setMinorsFallbackWarning] = useState(false);
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [coachRecommendation, setCoachRecommendation] = useState(null);
  const [isIntentionCoachOpen, setIsIntentionCoachOpen] = useState(false);
  const [allowPlaceholderCycle, setAllowPlaceholderCycle] = useState(true);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [lastCardsForFeedback, setLastCardsForFeedback] = useState([]);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  const navigate = useNavigate();
  const spreadSectionRef = useRef(null);
  const prepareSectionRef = useRef(null);
  const readingSectionRef = useRef(null);

  const stepSectionRefs = {
    spread: spreadSectionRef,
    intention: prepareSectionRef,
    ritual: prepareSectionRef,
    reading: readingSectionRef
  };

  const visionResearchEnabled = import.meta.env?.VITE_ENABLE_VISION_RESEARCH === 'true';

  // --- Effects & Helpers ---

  // Reset analysis state when Shuffle is triggered
  const handleShuffle = useCallback(() => {
    shuffle(() => {
      setPersonalReading(null);
      setThemes(null);
      setSpreadAnalysis(null);
      setAnalysisContext(null);
      setAnalyzingText('');
      setIsGenerating(false);
      setJournalStatus(null);
      setReflections({});
      setVisionResults([]);
      setVisionConflicts([]);
      resetVisionProof();
    });
  }, [shuffle, setVisionResults, setVisionConflicts, resetVisionProof]);

  // Sync Minor Arcana dataset warning
  useEffect(() => {
    setMinorsFallbackWarning(minorsDataIncomplete);
  }, [minorsDataIncomplete]);

  // Check API health
  useEffect(() => {
    async function checkApiHealth() {
      try {
        const [tarotHealth, ttsHealth] = await Promise.all([
          fetch('/api/health/tarot-reading', { method: 'GET', cache: 'no-store' }).catch(() => null),
          fetch('/api/health/tts', { method: 'GET', cache: 'no-store' }).catch(() => null)
        ]);
        const anthropicAvailable = tarotHealth?.ok ?? false;
        const azureAvailable = ttsHealth?.ok ?? false;
        if (!anthropicAvailable || !azureAvailable) {
          setApiHealthBanner({
            anthropic: anthropicAvailable,
            azure: azureAvailable,
            message: 'Using local services' +
              (!anthropicAvailable ? ' (Claude unavailable)' : '') +
              (!azureAvailable ? ' (Azure TTS unavailable)' : '')
          });
        } else {
          setApiHealthBanner(null);
        }
      } catch (err) {
        console.debug('API health check failed:', err);
      }
    }
    checkApiHealth();
  }, []);

  // Coach Recommendation Loading
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rec = loadCoachRecommendation();
    if (rec?.question) {
      setCoachRecommendation(rec);
    }
  }, []);

  // Coach Shortcut
  useEffect(() => {
    function handleCoachShortcut(event) {
      if (event.defaultPrevented) return;
      if (isIntentionCoachOpen) return;
      const target = event.target;
      const tagName = target?.tagName;
      const isTypingTarget =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTypingTarget) return;

      if ((event.key === 'g' || event.key === 'G') && event.shiftKey) {
        event.preventDefault();
        setIsIntentionCoachOpen(true);
      }
    }
    window.addEventListener('keydown', handleCoachShortcut);
    return () => {
      window.removeEventListener('keydown', handleCoachShortcut);
    };
  }, [isIntentionCoachOpen]);

  // Placeholder Cycle
  useEffect(() => {
    const trimmedQuestion = userQuestion.trim();
    if (!allowPlaceholderCycle || trimmedQuestion) {
      return undefined;
    }
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [allowPlaceholderCycle, userQuestion]);

  // Clear Journal Status Timeout
  useEffect(() => {
    if (!journalStatus) return;
    const timeout = setTimeout(() => setJournalStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [journalStatus]);

  // Reset Highlights on Spread Change
  useEffect(() => {
    setShowAllHighlights(false);
  }, [selectedSpread, reading]);

  // --- Handlers ---

  const handleDeckChange = (newDeckId) => {
    setDeckStyleId(newDeckId);
    setVisionResults([]);
    setVisionConflicts([]);
    resetVisionProof();
  };

  const handleSpreadSelection = (key) => {
    setSelectedSpread(key);
    // Reset Reading State driven by SpreadSelector
    // Note: SpreadSelector component currently does this via individual props
    // We will update SpreadSelector next to use cleaner props or context
    // For now, we are passing setters to SpreadSelector in the return below
    // but we need manual resets here if we change how SpreadSelector works
    resetReadingState(false); // Keep question
    setPersonalReading(null);
    setJournalStatus(null);
    setReflections({});
    setAnalyzingText('');
    setIsGenerating(false);
  };

  const handleCoachApply = (guidedQuestion) => {
    if (!guidedQuestion) return;
    setUserQuestion(guidedQuestion);
    setAllowPlaceholderCycle(false);
    setIsIntentionCoachOpen(false);
  };

  const applyCoachRecommendation = useCallback(() => {
    if (!coachRecommendation) return;
    setUserQuestion(coachRecommendation.question || '');
    if (coachRecommendation.spreadKey && SPREADS[coachRecommendation.spreadKey]) {
      setSelectedSpread(coachRecommendation.spreadKey);
    }
    setIsIntentionCoachOpen(true);
    saveCoachRecommendation(null);
    setCoachRecommendation(null);
  }, [coachRecommendation, setSelectedSpread, setUserQuestion]);

  const dismissCoachRecommendation = useCallback(() => {
    saveCoachRecommendation(null);
    setCoachRecommendation(null);
  }, []);

  const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const handleStepNav = (stepId) => {
    const target = stepSectionRefs[stepId]?.current;
    if (target && typeof target.scrollIntoView === 'function') {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      target.scrollIntoView({
        behavior,
        block: 'start'
      });
    }
  };

  // --- Logic: Reading Generation ---

  const generatePersonalReading = async () => {
    if (!reading || reading.length === 0) {
      const errorMsg = 'Please draw your cards before requesting a personalized reading.';
      const formattedError = formatReading(errorMsg);
      formattedError.isError = true;
      setPersonalReading(formattedError);
      setJournalStatus({
        type: 'error',
        message: 'Draw and reveal your cards before requesting a personalized narrative.'
      });
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    setAnalyzingText('');
    setPersonalReading(null);
    setJournalStatus(null);
    setReadingMeta((prev) => ({ ...prev, requestId: null }));
    setLastCardsForFeedback([]);

    try {
      const spreadInfo = SPREADS[selectedSpread];
      const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];

      const cardsInfo = reading.map((card, idx) => {
        const originalCard = allCards.find(item => item.name === card.name) || card;
        const meaningText = card.isReversed ? originalCard.reversed : originalCard.upright;
        const position = spreadInfo.positions[idx] || `Position ${idx + 1}`;

        const suit = originalCard.suit || null;
        const rank = originalCard.rank || null;
        const rankValue =
          typeof originalCard.rankValue === 'number' ? originalCard.rankValue : null;
        const canonicalName = canonicalizeCardName(originalCard.name, deckStyleId) || originalCard.name;
        const canonicalKey = canonicalCardKey(canonicalName || originalCard.name, deckStyleId);

        return {
          position,
          card: card.name,
          canonicalName,
          canonicalKey,
          aliases: Array.isArray(originalCard.aliases) ? originalCard.aliases : [],
          orientation: card.isReversed ? 'Reversed' : 'Upright',
          meaning: meaningText,
          number: card.number,
          suit,
          rank,
          rankValue
        };
      });

      const reflectionsText = Object.entries(reflections)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([index, text]) => {
          if (typeof text !== 'string' || !text.trim()) return '';
          const idx = Number(index);
          const position = cardsInfo[idx]?.position || `Position ${idx + 1}`;
          return `${position}: ${text.trim()}`;
        })
        .filter(Boolean)
        .join('\n');

      const cardNames = cardsInfo.map(card => card.card).join(', ');
      setAnalyzingText(`Analyzing: ${cardNames}...\n\nWeaving your personalized reflection from this spread...`);

      const shouldAttachVisionProof = visionResearchEnabled && visionResults.length > 0;
      if (shouldAttachVisionProof) {
        const conflicts = getVisionConflictsForCards(cardsInfo, visionResults, deckStyleId);
        setVisionConflicts(conflicts);
        if (conflicts.length > 0) {
          setJournalStatus({
            type: 'info',
            message: 'Research Telemetry: Vision model detected a mismatch between uploaded image and digital card.'
          });
        }
      } else if (visionConflicts.length > 0) {
        setVisionConflicts([]);
      }

      let proof = null;
      if (shouldAttachVisionProof) {
        try {
          setAnalyzingText((prev) => `${prev}\nValidating your card photos for research telemetry...`);
          proof = await ensureVisionProof();
        } catch (proofError) {
          setJournalStatus({
            type: 'warning',
            message: proofError.message || 'Vision verification failed. Skipping research telemetry for this reading.'
          });
        }
      }

      const requestPayload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: null
      };

      const payload = {
        spreadInfo: { name: spreadInfo.name },
        cardsInfo,
        userQuestion,
        reflectionsText,
        reversalFrameworkOverride: reversalFramework,
        deckStyle: deckStyleId
      };
      if (proof) {
        payload.visionProof = proof;
      }
      requestPayload.body = JSON.stringify(payload);

      const response = await fetch('/api/tarot-reading', requestPayload);

      if (!response.ok) {
        const errText = await response.text();
        console.error('Tarot reading API error:', response.status, errText);
        throw new Error('Failed to generate reading');
      }

      const data = await response.json();
      if (!data?.reading || !data.reading.trim()) {
        throw new Error('Empty reading returned');
      }

      setThemes(data.themes || null);
      setSpreadAnalysis(data.spreadAnalysis || null);
      setAnalysisContext(data.context || null);

      const formatted = formatReading(data.reading.trim());
      formatted.isError = false;
      setPersonalReading(formatted);
      setLastCardsForFeedback(
        cardsInfo.map((card) => ({
          position: card.position,
          card: card.card,
          orientation: card.orientation
        }))
      );
      setReadingMeta({
        requestId: data.requestId || null,
        provider: data.provider || 'local',
        spreadKey: selectedSpread,
        spreadName: spreadInfo.name,
        deckStyle: deckStyleId,
        userQuestion,
        graphContext: data.themes?.knowledgeGraph || null
      });
    } catch (error) {
      console.error('generatePersonalReading error:', error);
      const errorMsg = 'Unable to generate reading at this time. Please try again in a moment.';
      const formattedError = formatReading(errorMsg);
      formattedError.isError = true;
      setPersonalReading(formattedError);
      setJournalStatus({
        type: 'error',
        message: 'Unable to generate your narrative right now. Please try again shortly.'
      });
    } finally {
      setIsGenerating(false);
      setAnalyzingText('');
    }
  };

  // --- Logic: Analysis Highlights ---

  // Local fallback relationships
  const relationships = useMemo(() => {
    if (!reading || !reading.length) return [];
    if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
      return []; // Server analysis takes precedence
    }
    return computeRelationships(reading || []);
  }, [reading, spreadAnalysis]);

  // Highlights Memoization
  const derivedHighlights = useMemo(() => {
    if (!reading || revealedCards.size !== (reading?.length || 0)) return null;
    if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
      const notes = [];
      if (themes) {
        const deckScope = includeMinors
          ? 'Full deck (Major + Minor Arcana).'
          : 'Major Arcana focus (archetypal themes).';
        notes.push({ key: 'deck-scope', icon: '-', title: 'Deck scope:', text: deckScope });
        if (themes.dominantSuit || themes.suitFocus) {
          notes.push({ key: 'suit-dominance', icon: '♠', title: 'Suit Dominance:', text: themes.suitFocus || `A strong presence of ${themes.dominantSuit} suggests this suit's themes are central to your situation.` });
        }
        if (themes.elementalBalance) {
          notes.push({ key: 'elemental-balance', icon: '⚡', title: 'Elemental Balance:', text: themes.elementalBalance });
        }
        if (themes.reversalDescription) {
          notes.push({ key: 'reversal-framework', icon: '⤴', title: 'Reversal Lens:', text: `${themes.reversalDescription.name} — ${themes.reversalDescription.description}` });
        }
      }
      spreadAnalysis.relationships.forEach((rel, index) => {
        if (!rel || !rel.summary) return;
        let title = 'Pattern';
        let icon = '•';
        const typeMap = {
          'sequence': { title: 'Story Flow', icon: '→' },
          'elemental-run': { title: 'Elemental Pattern', icon: '⚡' },
          'elemental': { title: 'Elemental Pattern', icon: '⚡' },
          'axis': { title: rel.axis || 'Axis Insight', icon: '⇄' },
          'nucleus': { title: 'Heart of the Matter', icon: '★' },
          'timeline': { title: 'Timeline', icon: '⏱' },
          'consciousness-axis': { title: 'Conscious ↔ Subconscious', icon: '☯' },
          'staff-axis': { title: 'Advice ↔ Outcome', icon: '⚖' },
          'cross-check': { title: 'Cross-Check', icon: '✦' }
        };
        if (typeMap[rel.type]) {
          title = typeMap[rel.type].title;
          icon = typeMap[rel.type].icon;
        }
        notes.push({ key: `rel-${index}-${rel.type || 'rel'}`, icon, title, text: rel.summary });
      });
      if (Array.isArray(spreadAnalysis.positionNotes)) {
        spreadAnalysis.positionNotes.forEach((pos, idx) => {
          if (!pos || !pos.notes || pos.notes.length === 0) return;
          notes.push({ key: `pos-${idx}`, icon: '□', title: `Position ${pos.index + 1} – ${pos.label}:`, text: pos.notes.join(' ') });
        });
      }
      return notes;
    }
    return null;
  }, [reading, revealedCards, spreadAnalysis, themes, includeMinors]);

  const fallbackHighlights = useMemo(() => {
    const totalCards = reading?.length ?? 0;
    if (!reading || totalCards === 0 || revealedCards.size !== totalCards) {
      return [];
    }
    const items = [];
    items.push({
      key: 'deck-scope',
      icon: '-',
      title: 'Deck scope:',
      text: includeMinors ? 'Full deck (Major + Minor Arcana).' : 'Major Arcana focus (archetypal themes).'
    });
    const reversedIdx = reading.map((card, index) => (card.isReversed ? index : -1)).filter(index => index >= 0);
    if (reversedIdx.length > 0) {
      const spreadInfo = SPREADS[selectedSpread];
      const positions = reversedIdx.map(index => spreadInfo.positions[index] || `Card ${index + 1}`).join(', ');
      const hasCluster = reversedIdx.some((idx, j) => j > 0 && idx === reversedIdx[j - 1] + 1);
      let text = `${positions}. These often point to inner processing, timing delays, or tension in the theme.`;
      if (hasCluster) text += ' Consecutive reversals suggest the theme persists across positions.';
      items.push({ key: 'reversal-summary', icon: '⤴', title: `Reversed cards (${reversedIdx.length}):`, text });
    }
    const relationshipMeta = {
      sequence: { icon: '→', title: 'Sequence:' },
      'reversal-heavy': { icon: '⚠', title: 'Reversal Pattern:' },
      'reversal-moderate': { icon: '•', title: 'Reversal Pattern:' },
      'reversed-court-cluster': { icon: '👑', title: 'Court Dynamics:' },
      'consecutive-reversals': { icon: '↔', title: 'Pattern Flow:' },
      'suit-dominance': { icon: '♠', title: 'Suit Dominance:' },
      'suit-run': { icon: '→', title: 'Suit Run:' },
      'court-cluster': { icon: '👥', title: 'Court Cards:' },
      'court-pair': { icon: '👥', title: 'Court Cards:' },
      'court-suit-focus': { icon: '👥', title: 'Court Cards:' },
      pairing: { icon: '>', title: 'Card Connection:' },
      arc: { icon: '>', title: 'Card Connection:' }
    };
    relationships.forEach((relationship, index) => {
      if (!relationship?.text) return;
      const meta = relationshipMeta[relationship.type] || { icon: '✦', title: 'Pattern:' };
      items.push({ key: `relationship-${relationship.type || 'pattern'}-${index}`, icon: meta.icon, title: meta.title, text: relationship.text });
    });
    return items;
  }, [reading, revealedCards, includeMinors, selectedSpread, relationships]);

  const highlightItems = useMemo(() => {
    if (Array.isArray(derivedHighlights) && derivedHighlights.length > 0) return derivedHighlights;
    if (Array.isArray(fallbackHighlights) && fallbackHighlights.length > 0) return fallbackHighlights;
    return [];
  }, [derivedHighlights, fallbackHighlights]);

  // --- Logic: Journal Saving ---

  const { saveEntry } = useJournal({ autoLoad: false });

  async function saveReading() {
    if (!reading) {
      setJournalStatus({ type: 'error', message: 'Draw your cards before saving to the journal.' });
      return;
    }
    if (!personalReading || personalReading.isError) {
      setJournalStatus({ type: 'error', message: 'Generate a personalized narrative before saving to the journal.' });
      return;
    }
    const entry = {
      spread: SPREADS[selectedSpread].name,
      spreadKey: selectedSpread,
      question: userQuestion || '',
      cards: reading.map((card, index) => ({
        position: SPREADS[selectedSpread].positions[index] || `Position ${index + 1}`,
        name: card.name,
        number: card.number,
        orientation: card.isReversed ? 'Reversed' : 'Upright'
      })),
      personalReading: personalReading?.raw || personalReading?.normalized || '',
      themes: themes || null,
      reflections: reflections || {},
      context: analysisContext || null,
      provider: personalReading?.provider || 'local',
      sessionSeed
    };
    try {
      const result = await saveEntry(entry);
      if (result.success) {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
        setJournalStatus({ type: 'success', message: 'Saved to your journal.' });
      } else {
        setJournalStatus({ type: 'error', message: result.error || 'Unable to save to your journal. Please try again.' });
      }
    } catch (error) {
      console.error('Failed to save tarot reading', error);
      setJournalStatus({ type: 'error', message: 'Unable to save to your journal. Please try again.' });
    }
  }


  // --- Logic: UI State Builders ---

  const prepareSummaries = useMemo(() => {
    const trimmedQuestion = userQuestion.trim();
    const questionSummary = trimmedQuestion
      ? `Intention: ${trimmedQuestion.length > 60 ? `${trimmedQuestion.slice(0, 57)}…` : trimmedQuestion}`
      : 'Intention: Blank';
    const knockSummary = knockCount >= 3 ? 'Knocks ready' : `Knocks ${knockCount}/3`;
    const cutSummary = hasCut ? `Cut ${cutIndex}` : 'Cut pending';
    const ritualSummary = knockCount === 0 && !hasCut
      ? 'Ritual: Skipped'
      : `Ritual: ${knockSummary} · ${cutSummary}`;
    const deckSummaryLabel = `${deckSize}${minorsDataIncomplete ? ' (Major Arcana only)' : ''}`;

    return {
      intention: questionSummary,
      experience: `Voice: ${voiceOn ? 'On' : 'Off'} · Ambience: ${ambienceOn ? 'On' : 'Off'} · Deck: ${deckSummaryLabel}`,
      ritual: ritualSummary
    };
  }, [userQuestion, voiceOn, ambienceOn, deckSize, minorsDataIncomplete, knockCount, hasCut, cutIndex]);

  const prepareSectionLabels = {
    intention: { title: 'Intention', helper: 'Optional guiding prompt before you draw.' },
    experience: { title: 'Experience & preferences', helper: 'Voice, ambience, theme, reversals, and deck scope.' },
    ritual: { title: 'Ritual (optional)', helper: 'Knock, cut, or skip if that is not part of your practice.' }
  };

  // Determine Active Step for StepProgress
  const hasQuestion = Boolean(userQuestion && userQuestion.trim().length > 0);
  const hasRitualProgress = hasKnocked || hasCut || knockCount > 0;
  const hasReading = Boolean(reading && reading.length > 0);
  const allCardsRevealed = hasReading && revealedCards.size === reading.length;
  const hasNarrative = Boolean(personalReading && !personalReading.isError);
  const narrativeInProgress = isGenerating && !personalReading;
  const needsNarrativeGeneration = allCardsRevealed && (!personalReading || personalReading.isError);
  const isPersonalReadingError = Boolean(personalReading?.isError);
  const fullReadingText = !isPersonalReadingError ? personalReading?.raw || personalReading?.normalized || '' : '';

  const { stepIndicatorLabel, stepIndicatorHint, activeStep } = useMemo(() => {
    if (hasNarrative) return { stepIndicatorLabel: 'Reflect on your narrative', stepIndicatorHint: 'Read through the personalized guidance and save anything that resonates.', activeStep: 'reading' };
    if (narrativeInProgress) return { stepIndicatorLabel: 'Weaving your narrative', stepIndicatorHint: 'Hang tight while we compose your personalized reading.', activeStep: 'reading' };
    if (hasReading) {
      if (allCardsRevealed) return { stepIndicatorLabel: 'Explore your spread', stepIndicatorHint: 'Review the card insights below or generate a personalized narrative.', activeStep: 'reading' };
      return { stepIndicatorLabel: 'Reveal your cards', stepIndicatorHint: 'Flip each card to unfold the story of your spread.', activeStep: 'reading' };
    }
    if (!hasConfirmedSpread) return { stepIndicatorLabel: 'Choose your spread', stepIndicatorHint: 'Tap a spread that matches your focus to begin shaping the reading.', activeStep: 'spread' };
    if (!hasQuestion || !hasRitualProgress) return { stepIndicatorLabel: 'Prepare your reading', stepIndicatorHint: 'Set an intention, tune experience preferences, or complete the optional ritual.', activeStep: !hasQuestion ? 'intention' : 'ritual' };
    return { stepIndicatorLabel: 'Draw your cards', stepIndicatorHint: 'When you feel ready, draw the cards to begin your reading.', activeStep: 'reading' };
  }, [hasNarrative, narrativeInProgress, hasReading, allCardsRevealed, hasQuestion, hasRitualProgress, hasConfirmedSpread]);


  // --- Render Helper Wrappers ---

  const handleNarrationWrapper = () => handleNarrationButtonClick(fullReadingText, isPersonalReadingError);
  const handleVoicePromptWrapper = () => handleVoicePromptEnable(fullReadingText);

  return (
    <div className="app-shell min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 pt-6 pb-28 sm:py-8 lg:py-10">
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {[ttsAnnouncement, journalStatus?.message].filter(Boolean).join(' ')}
        </div>

        {/* Header */}
        <header aria-labelledby="mystic-tarot-heading">
          <div className="text-center mb-6 sm:mb-8 mystic-heading-wrap">
            <h1 id="mystic-tarot-heading" className="text-3xl sm:text-4xl md:text-5xl font-serif text-amber-200">
              Mystic Tarot
            </h1>
            <p className="mt-2 text-amber-100/80 text-sm sm:text-base md:text-lg">
              Seek guidance from the ancient wisdom of the cards.
            </p>
          </div>
        </header>

        <div className="full-bleed sticky top-0 z-30 py-3 sm:py-4 mb-6 bg-slate-950/95 backdrop-blur border-y border-slate-800/70 px-4 sm:px-5 md:px-6">
          <GlobalNav />
          <StepProgress steps={STEP_PROGRESS_STEPS} activeStep={activeStep} onSelect={handleStepNav} />
          {isShuffling && (
            <div className="mt-2 flex items-center gap-2 text-amber-200/80 text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug" role="status" aria-live="polite">
              <RotateCcw className="w-3.5 h-3.5 animate-spin text-amber-300" aria-hidden="true" />
              <span>Shuffling the deck...</span>
            </div>
          )}
        </div>

        {apiHealthBanner && (
          <div className="mb-6 p-4 bg-amber-900/30 border border-amber-500/50 rounded-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
              <div className="text-amber-200 text-xs sm:text-sm">
                <span className="font-semibold">Service Status:</span>{' '}
                <span className="sm:hidden">Local fallbacks active</span>
                <span className="hidden sm:inline">{apiHealthBanner.message}</span>
              </div>
            </div>
            <div className="mt-2 text-amber-300/80 text-xs">
              {!apiHealthBanner.anthropic && <div>• Claude AI: Using local composer</div>}
              {!apiHealthBanner.azure && <div>• Azure TTS: Using local audio</div>}
              <div className="mt-1">All readings remain fully functional with local fallbacks.</div>
            </div>
          </div>
        )}

        {minorsFallbackWarning && (
          <div className="mb-6 p-4 bg-rose-900/30 border border-rose-500/50 rounded-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-rose-400 animate-pulse"></div>
              <div className="text-rose-200 text-xs sm:text-sm">
                <span className="font-semibold">Deck Data Warning:</span> Minor Arcana data incomplete. Using Major Arcana only.
              </div>
            </div>
            <div className="mt-2 text-rose-300/80 text-xs">
              <div>• Please check the Minor Arcana dataset for missing or malformed cards</div>
              <div>• Full deck readings will be available once data is restored</div>
            </div>
          </div>
        )}

        {/* Step 1–3: Spread + Prepare */}
        <section className="mb-6 xl:mb-4" aria-label="Reading setup">
          <div className="mb-4 sm:mb-5">
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">{stepIndicatorLabel}</p>
            <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">{stepIndicatorHint}</p>
          </div>

          <div className="max-w-5xl mx-auto space-y-6">
            <div className="modern-surface p-4 sm:p-6" aria-label="Choose your physical deck">
              <DeckSelector selectedDeck={deckStyleId} onDeckChange={handleDeckChange} />
            </div>

            <div aria-label="Choose your spread" ref={spreadSectionRef} id="step-spread" className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]">
              <div className="mb-3 sm:mb-4">
                <h2 className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">Spread</h2>
                <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">Choose a spread to shape the depth and focus of your reading.</p>
              </div>
              <SpreadSelector
                selectedSpread={selectedSpread}
                setSelectedSpread={handleSpreadSelection}
                setReading={setReading}
                setRevealedCards={setRevealedCards}
                setPersonalReading={setPersonalReading}
                setJournalStatus={setJournalStatus}
                setAnalyzingText={setAnalyzingText}
                setIsGenerating={setIsGenerating}
                setDealIndex={setDealIndex}
                setReflections={setReflections}
                setHasKnocked={setHasKnocked}
                setHasCut={setHasCut}
                setCutIndex={setCutIndex}
                knockTimesRef={knockTimesRef}
                onSpreadConfirm={onSpreadConfirm}
              />
            </div>

            <section aria-label="Prepare your reading" ref={prepareSectionRef} id="step-intention" className="hidden sm:block modern-surface p-4 sm:p-6 scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]">
              <header className="mb-4 space-y-1">
                <h2 className="text-lg font-serif text-amber-200">Prepare your reading</h2>
                <p className="text-xs text-amber-100/70">Capture an intention, tune the experience controls, and complete the optional ritual from one panel.</p>
              </header>
              <div className="text-[0.75rem] sm:text-xs text-amber-100/80 bg-slate-950/60 border border-slate-800/70 rounded-lg px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
                <span>{prepareSummaries.intention}</span>
                <span className="hidden xs:inline">·</span>
                <span>{prepareSummaries.experience}</span>
                <span className="hidden xs:inline">·</span>
                <span>{prepareSummaries.ritual}</span>
              </div>
              <div className="mt-4 space-y-3">
                {(['intention', 'experience', 'ritual']).map(section => (
                  <div key={section} className="rounded-xl border border-slate-800/60 bg-slate-950/70 overflow-hidden">
                    <button type="button" onClick={() => togglePrepareSection(section)} className="w-full flex items-center justify-between px-4 py-3 text-left" aria-expanded={prepareSectionsOpen[section]}>
                      <div>
                        <p className="text-amber-200 font-serif text-sm">{prepareSectionLabels[section].title}</p>
                        <p className="text-xs text-amber-100/70">{prepareSummaries[section]}</p>
                      </div>
                      {prepareSectionsOpen[section] ? <ChevronUp className="w-4 h-4 text-amber-300" /> : <ChevronDown className="w-4 h-4 text-amber-300" />}
                    </button>
                    {prepareSectionsOpen[section] && (
                      <div className="px-4 pb-4 pt-2">
                        {section === 'intention' && (
                          <>
                            <QuestionInput
                              userQuestion={userQuestion}
                              setUserQuestion={setUserQuestion}
                              placeholderIndex={placeholderIndex}
                              onFocus={() => setAllowPlaceholderCycle(false)}
                              onBlur={() => !userQuestion.trim() && setAllowPlaceholderCycle(true)}
                              onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
                              onLaunchCoach={() => setIsIntentionCoachOpen(true)}
                            />
                            {coachRecommendation && (
                              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Journal suggestion</p>
                                <p className="mt-2 font-serif text-base text-amber-50">{coachRecommendation.question}</p>
                                {coachRecommendation.spreadName && <p className="text-xs text-emerald-200/80 mt-1">Suggested spread: {coachRecommendation.spreadName}</p>}
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <button type="button" onClick={applyCoachRecommendation} className="rounded-full border border-emerald-400/50 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10">Open in intention coach</button>
                                  <button type="button" onClick={dismissCoachRecommendation} className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-100 hover:bg-amber-500/10">Dismiss</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {section === 'experience' && (
                          <SettingsToggles />
                        )}
                        {section === 'ritual' && (
                          <RitualControls
                            hasKnocked={hasKnocked}
                            handleKnock={handleKnock}
                            cutIndex={cutIndex}
                            setCutIndex={setCutIndex}
                            hasCut={hasCut}
                            applyCut={applyCut}
                            knocksCount={knockCount}
                            onSkip={handleShuffle}
                            deckAnnouncement={deckAnnouncement}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section ref={readingSectionRef} id="step-reading" className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]" aria-label="Draw and explore your reading">
          <div className="mb-4 sm:mb-5">
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">Reading</p>
            <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">Draw and reveal your cards, explore the spread, and weave your narrative.</p>
          </div>
          {/* Primary CTA */}
          {!reading && (
            <div className="hidden sm:block text-center mb-8 sm:mb-10">
              <button onClick={handleShuffle} disabled={isShuffling} className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                <span>{isShuffling ? 'Shuffling the Cards...' : 'Draw Cards'}</span>
              </button>
            </div>
          )}

          {visionResearchEnabled && (
            <div className="mb-6">
              <VisionValidationPanel
                deckStyle={deckStyleId}
                onResults={handleVisionResults}
                onRemoveResult={handleRemoveVisionResult}
                onClearResults={handleClearVisionResults}
                conflicts={visionConflicts}
                results={visionResults}
              />
            </div>
          )}

          {/* Reading Display */}
          {reading && (
            <div className="space-y-8">
              {userQuestion && (<div className="text-center"><p className="text-amber-100/80 text-sm italic">Intention: {userQuestion}</p></div>)}
              <div className="text-center text-amber-200 font-serif text-2xl mb-2">{SPREADS[selectedSpread].name}</div>
              {reading.length > 1 && (<p className="text-center text-amber-100/85 text-xs-plus sm:text-sm mb-4">Reveal in order for a narrative flow, or follow your intuition and reveal randomly.</p>)}

              {revealedCards.size < reading.length && (
                <div className="hidden sm:block text-center">
                  <button type="button" onClick={revealAll} className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-amber-900/40 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5" /><span>Reveal All Cards</span>
                  </button>
                  <p className="text-amber-300/80 text-xs sm:text-sm mt-2 sm:mt-3">{revealedCards.size} of {reading.length} cards revealed</p>
                </div>
              )}
              {revealedCards.size > 0 && (
                <div className="text-center mt-3 sm:mt-4">
                  <button type="button" onClick={() => { setRevealedCards(new Set()); setDealIndex(0); }} className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-amber-300/50 text-amber-100/80 text-xs sm:text-sm hover:text-amber-50 hover:border-amber-200/70 transition">
                    <span className="hidden xs:inline">Reset reveals (keep this spread)</span><span className="xs:hidden">Reset reveals</span>
                  </button>
                </div>
              )}
              {reading && revealedCards.size < reading.length && (
                <div className="hidden sm:block text-center">
                  <button onClick={dealNext} className="mt-3 inline-flex items-center justify-center bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-amber-900/30 transition-all text-sm sm:text-base">
                    <span>Reveal Next Card ({Math.min(dealIndex + 1, reading.length)}/{reading.length})</span>
                  </button>
                </div>
              )}

              <ReadingGrid
                selectedSpread={selectedSpread}
                reading={reading}
                revealedCards={revealedCards}
                revealCard={revealCard}
                reflections={reflections}
                setReflections={setReflections}
              />

              {revealedCards.size === reading.length && highlightItems.length > 0 && (
                <div className="modern-surface p-4 sm:p-6 border border-emerald-400/40 space-y-4">
                  <h3 className="text-base sm:text-lg font-serif text-amber-200 mb-3 flex items-center gap-2"><Star className="w-4 h-4 sm:w-5 sm:h-5" />Spread Highlights</h3>
                  <div className="sm:hidden space-y-3">
                    {highlightItems.slice(0, showAllHighlights ? highlightItems.length : 3).map(item => (
                      <div key={item.key} className="flex items-start gap-3">
                        <div className="text-amber-300 mt-1" aria-hidden="true">{item.icon}</div>
                        <div className="text-amber-100/85 text-sm leading-snug"><span className="font-semibold text-amber-200">{item.title}</span> {item.text}</div>
                      </div>
                    ))}
                    {highlightItems.length > 3 && (
                      <button type="button" onClick={() => setShowAllHighlights(prev => !prev)} className="text-emerald-300 text-sm underline underline-offset-4">{showAllHighlights ? 'Hide extra insights' : 'See all insights'}</button>
                    )}
                  </div>
                  <div className="hidden sm:flex sm:flex-col sm:gap-3">
                    {highlightItems.map(item => (
                      <div key={item.key} className="flex items-start gap-3">
                        <div className="text-amber-300 mt-1" aria-hidden="true">{item.icon}</div>
                        <div className="text-amber-100/85 text-sm leading-snug"><span className="font-semibold text-amber-200">{item.title}</span> {item.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!personalReading && revealedCards.size === reading.length && (
                <div className="text-center">
                  <button onClick={generatePersonalReading} disabled={isGenerating} className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-5 sm:px-8 py-3 sm:py-4 rounded-xl shadow-xl shadow-emerald-900/40 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base md:text-lg">
                    <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${isGenerating ? 'motion-safe:animate-pulse' : ''}`} />
                    {isGenerating ? <span className="text-sm sm:text-base">Weaving your personalized reflection from this spread...</span> : <span>Create Personal Narrative</span>}
                  </button>
                  {hasVisionData && !isVisionReady && <p className="mt-3 text-sm text-amber-100/80">⚠️ Vision data has conflicts - research telemetry may be incomplete.</p>}
                  <HelperToggle className="mt-3 max-w-xl mx-auto"><p>Reveal all cards to unlock a tailored reflection that weaves positions, meanings, and your notes into one coherent story.</p></HelperToggle>
                </div>
              )}

              {isGenerating && analyzingText && (
                <div className="max-w-3xl mx-auto text-center">
                  <div className="ai-panel-modern">
                    <div className="ai-panel-text" aria-live="polite">{analyzingText}</div>
                    <HelperToggle className="mt-3"><p>This reflection is generated from your spread and question to support insight, not to decide for you.</p></HelperToggle>
                  </div>
                </div>
              )}

              {personalReading && !isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length > 0 && (
                <SpreadPatterns themes={themes} />
              )}

              {personalReading && (
                <div className="bg-gradient-to-r from-slate-900/80 via-slate-950/95 to-slate-900/80 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-emerald-400/40 shadow-2xl shadow-emerald-900/40 max-w-5xl mx-auto">
                  <h3 className="text-xl sm:text-2xl font-serif text-amber-200 mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />Your Personalized Narrative</h3>
                  <HelperToggle className="mt-3 max-w-2xl mx-auto"><p>This narrative braids together your spread positions, card meanings, and reflections into a single through-line. Read slowly, notice what resonates, and treat it as a mirror—not a script.</p></HelperToggle>
                  {userQuestion && (<div className="bg-slate-950/85 rounded-lg p-4 mb-4 border border-emerald-400/40"><p className="text-amber-300/85 text-xs sm:text-sm italic">Anchor: {userQuestion}</p></div>)}
                  {readingMeta?.graphContext?.narrativeHighlights && <PatternHighlightBanner patterns={readingMeta.graphContext.narrativeHighlights} />}
                  {personalReading.hasMarkdown ? <MarkdownRenderer content={personalReading.raw} /> : (
                    <div className="text-amber-100 leading-relaxed space-y-2 sm:space-y-3 md:space-y-4 max-w-none mx-auto text-left">
                      {personalReading.paragraphs && personalReading.paragraphs.length > 0 ? personalReading.paragraphs.map((para, idx) => (<p key={idx} className="text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose">{para}</p>)) : <p className="text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose whitespace-pre-line">{personalReading.normalized || personalReading.raw || ''}</p>}
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                    {reading && personalReading && !isPersonalReadingError && (
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                        <button type="button" onClick={handleNarrationWrapper} className="px-3 sm:px-4 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/85 hover:bg-slate-900/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 text-xs sm:text-sm" disabled={!fullReadingText || (ttsState.status === 'loading' && ttsState.status !== 'paused' && ttsState.status !== 'playing')}>
                          <span className="hidden xs:inline">{ttsState.status === 'loading' ? 'Preparing narration...' : ttsState.status === 'playing' ? 'Pause narration' : ttsState.status === 'paused' ? 'Resume narration' : 'Read this aloud'}</span>
                          <span className="xs:hidden">{ttsState.status === 'loading' ? 'Loading...' : ttsState.status === 'playing' ? 'Pause' : ttsState.status === 'paused' ? 'Resume' : 'Play'}</span>
                        </button>
                        {(voiceOn && fullReadingText && (ttsState.status === 'playing' || ttsState.status === 'paused' || ttsState.status === 'loading')) && (
                          <button type="button" onClick={handleNarrationStop} className="px-2 sm:px-3 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/70 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm">Stop</button>
                        )}
                        <button type="button" onClick={saveReading} className="hidden sm:inline-flex px-3 sm:px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm hover:bg-emerald-500/25 hover:text-emerald-100 transition"><span className="hidden xs:inline">Save this narrative to your journal</span><span className="xs:hidden">Save to journal</span></button>
                        <button type="button" onClick={() => navigate('/journal')} className="px-3 sm:px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs sm:text-sm hover:bg-amber-500/25 hover:text-amber-100 transition">View Journal</button>
                      </div>
                    )}
                    {showVoicePrompt && (
                      <div className="text-xs text-amber-100/85 bg-slate-900/70 border border-amber-400/30 rounded-lg px-3 py-2 text-center space-y-2" aria-live="polite">
                        <p>Voice narration is disabled. Turn it on?</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button type="button" onClick={handleVoicePromptWrapper} className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30 text-xs">Enable voice & play</button>
                          <button type="button" onClick={() => setShowVoicePrompt(false)} className="px-3 py-1.5 rounded-full border border-slate-600/50 text-amber-100/80 hover:text-amber-50 text-xs">Maybe later</button>
                        </div>
                      </div>
                    )}
                    {journalStatus && <p role="status" aria-live="polite" className={`text-xs text-center max-w-sm ${journalStatus.type === 'success' ? 'text-emerald-200' : 'text-rose-200'}`}>{journalStatus.message}</p>}
                  </div>
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-amber-500/20 flex flex-col gap-2 sm:gap-3 items-center">
                    <HelperToggle><p className="text-center">This reading considered card combinations, positions, emotional arcs, and your reflections to provide personalized guidance.</p></HelperToggle>
                  </div>
                  <div className="mt-6 w-full max-w-2xl">
                    <FeedbackPanel
                      requestId={readingMeta.requestId}
                      spreadKey={readingMeta.spreadKey || selectedSpread}
                      spreadName={readingMeta.spreadName || SPREADS[selectedSpread]?.name}
                      deckStyle={readingMeta.deckStyle || deckStyleId}
                      provider={readingMeta.provider}
                      userQuestion={readingMeta.userQuestion || userQuestion}
                      cards={lastCardsForFeedback}
                      visionSummary={feedbackVisionSummary}
                    />
                  </div>
                </div>
              )}

              {!personalReading && !isGenerating && (
                <div className="bg-gradient-to-r from-slate-900/80 to-slate-950/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-emerald-400/40 max-w-2xl mx-auto">
                  <h3 className="text-lg sm:text-xl font-serif text-amber-200 mb-2 sm:mb-3 flex items-center gap-2"><Star className="w-4 h-4 sm:w-5 sm:h-5" />Interpretation Guidance</h3>
                  <HelperToggle className="mt-2">
                    <p>Notice how the cards speak to one another. Consider themes, repetitions, contrasts, and where your attention is drawn. Trust your intuition as much as any description.</p>
                    <p className="mt-2">This reading offers reflective guidance only. It is not a substitute for medical, mental health, legal, financial, or safety advice. If your situation involves health, legal risk, abuse, or crisis, consider reaching out to qualified professionals or trusted support services.</p>
                  </HelperToggle>
                </div>
              )}

              <div className="hidden sm:block text-center mt-6 sm:mt-8">
                <button onClick={handleShuffle} disabled={isShuffling} className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                  <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                  <span className="hidden xs:inline">{isShuffling ? 'Shuffling the Cards...' : 'Draw New Reading'}</span>
                  <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'New Reading'}</span>
                </button>
              </div>
            </div>
          )}

          {!reading && !isShuffling && (
            <div className="text-center py-16 px-4">
              <p className="text-amber-100/80 text-lg font-serif">Focus on your question, then draw your cards when you're ready.</p>
            </div>
          )}
        </section>
      </main>

      {/* Mobile Nav - Keeping internal logic simple for now */}
      {!isIntentionCoachOpen && (
        <nav className="mobile-action-bar sm:hidden" aria-label="Primary mobile actions">
          <div className="flex flex-wrap gap-2">
            {isShuffling && <button disabled className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-amber-500 text-slate-950 shadow-lg flex-col gap-0.5 opacity-50"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Shuffling...</span></button>}

            {!isShuffling && !reading && (
              <>
                <button onClick={() => setIsMobileSettingsOpen(true)} className="flex-none w-[3.5rem] inline-flex items-center justify-center rounded-xl px-0 py-2.5 text-sm font-semibold transition bg-slate-900/60 text-amber-200 border border-amber-200/30 hover:bg-slate-900/80 flex-col gap-0.5" aria-label="Settings">
                  <Settings className="w-5 h-5" />
                </button>
                <button onClick={handleShuffle} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-amber-500 text-slate-950 shadow-lg hover:bg-amber-400 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Draw cards</span></button>
              </>
            )}

            {reading && revealedCards.size < reading.length && (
              <>
                <button onClick={dealNext} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-amber-500 text-slate-950 shadow-lg hover:bg-amber-400 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Reveal next ({Math.min(dealIndex + 1, reading.length)}/{reading.length})</span></button>
                {reading.length > 1 && <button onClick={revealAll} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-emerald-500/15 text-emerald-100 border border-emerald-400/40 hover:bg-emerald-500/25 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Reveal all</span></button>}
              </>
            )}

            {reading && revealedCards.size === reading.length && (
              <>
                {needsNarrativeGeneration && <button onClick={generatePersonalReading} disabled={isGenerating} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-amber-500 text-slate-950 shadow-lg hover:bg-amber-400 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">{isGenerating ? 'Weaving...' : 'Create narrative'}</span></button>}
                {hasNarrative && !isPersonalReadingError && <button onClick={saveReading} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-amber-500 text-slate-950 shadow-lg hover:bg-amber-400 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">Save to journal</span></button>}
                <button onClick={handleShuffle} className="flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition bg-slate-900/60 text-amber-200 border border-amber-200/30 hover:bg-slate-900/80 flex-col gap-0.5"><span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">{stepIndicatorLabel}</span><span className="text-sm font-semibold">New reading</span></button>
              </>
            )}
          </div>
        </nav>
      )}

      <MobileSettingsDrawer isOpen={isMobileSettingsOpen} onClose={() => setIsMobileSettingsOpen(false)}>
        <div className="space-y-8">
          {/* Intention Section */}
          <section>
            <h3 className="text-sm uppercase tracking-widest text-emerald-300/80 mb-3">Intention</h3>
            <QuestionInput
              userQuestion={userQuestion}
              setUserQuestion={setUserQuestion}
              placeholderIndex={placeholderIndex}
              onFocus={() => setAllowPlaceholderCycle(false)}
              onBlur={() => !userQuestion.trim() && setAllowPlaceholderCycle(true)}
              onPlaceholderRefresh={() => setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)}
              onLaunchCoach={() => {
                setIsMobileSettingsOpen(false);
                setIsIntentionCoachOpen(true);
              }}
            />
            {coachRecommendation && (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Journal suggestion</p>
                <p className="mt-2 font-serif text-base text-amber-50">{coachRecommendation.question}</p>
                {coachRecommendation.spreadName && <p className="text-xs text-emerald-200/80 mt-1">Suggested spread: {coachRecommendation.spreadName}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button type="button" onClick={() => { applyCoachRecommendation(); setIsMobileSettingsOpen(false); }} className="rounded-full border border-emerald-400/50 px-3 py-1 text-emerald-100 hover:bg-emerald-500/10">Open in intention coach</button>
                  <button type="button" onClick={dismissCoachRecommendation} className="rounded-full border border-amber-400/40 px-3 py-1 text-amber-100 hover:bg-amber-500/10">Dismiss</button>
                </div>
              </div>
            )}
          </section>

          {/* Experience Section */}
          <section>
            <h3 className="text-sm uppercase tracking-widest text-emerald-300/80 mb-3">Experience</h3>
            <SettingsToggles />
          </section>

          {/* Ritual Section */}
          <section>
            <h3 className="text-sm uppercase tracking-widest text-emerald-300/80 mb-3">Ritual</h3>
            <RitualControls
              hasKnocked={hasKnocked}
              handleKnock={handleKnock}
              cutIndex={cutIndex}
              setCutIndex={setCutIndex}
              hasCut={hasCut}
              applyCut={applyCut}
              knocksCount={knockCount}
              onSkip={() => {
                handleShuffle();
                setIsMobileSettingsOpen(false);
              }}
              deckAnnouncement={deckAnnouncement}
            />
          </section>
        </div>
      </MobileSettingsDrawer>

      {isIntentionCoachOpen && (
        <GuidedIntentionCoach
          isOpen={isIntentionCoachOpen}
          selectedSpread={selectedSpread}
          onClose={() => setIsIntentionCoachOpen(false)}
          onApply={handleCoachApply}
        />
      )}
    </div>
  );
}
