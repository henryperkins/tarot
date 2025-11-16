import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, RotateCcw, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { MAJOR_ARCANA } from './data/majorArcana';
import { MINOR_ARCANA } from './data/minorArcana';
import { SPREADS } from './data/spreads';
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
import { GlobalNav } from './components/GlobalNav';
import { useNavigate } from 'react-router-dom';
import { useJournal } from './hooks/useJournal';
import { getDeckPool, computeSeed, computeRelationships, drawSpread } from './lib/deck';
import {
  initAudio,
  toggleAmbience,
  playFlip,
  speakText,
  cleanupAudio,
  pauseTTS,
  resumeTTS,
  stopTTS as stopNarration,
  subscribeToTTS,
  getCurrentTTSState,
  unlockAudio
} from './lib/audio';
import { formatReading, splitIntoParagraphs } from './lib/formatting';
import './styles/tarot.css';

const PREPARE_SECTIONS_STORAGE_KEY = 'tarot-prepare-sections';
const DEFAULT_PREPARE_SECTIONS = {
  intention: false,
  experience: false,
  ritual: false
};

const STEP_PROGRESS_STEPS = [
  { id: 'spread', label: 'Spread' },
  { id: 'intention', label: 'Question' },
  { id: 'ritual', label: 'Ritual (optional)' },
  { id: 'reading', label: 'Reading' }
];

export default function TarotReading() {
  const [selectedSpread, setSelectedSpread] = useState('single');
  const [reading, setReading] = useState(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [revealedCards, setRevealedCards] = useState(new Set());
  const [includeMinors, setIncludeMinors] = useState(true); // Full 78-card deck by default
  // Store both raw markdown and formatted versions for UI and TTS
  const [personalReading, setPersonalReading] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [analyzingText, setAnalyzingText] = useState('');
  const [hasKnocked, setHasKnocked] = useState(false);
  const [knockCount, setKnockCount] = useState(0);
  const [hasCut, setHasCut] = useState(false);
  const [sessionSeed, setSessionSeed] = useState(null);
  const [hasConfirmedSpread, setHasConfirmedSpread] = useState(false);
  const [cutIndex, setCutIndex] = useState(Math.floor(MAJOR_ARCANA.length / 2));
  const [dealIndex, setDealIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-voice-enabled');
      return saved === 'true';
    }
    return false;
  });
  const [reflections, setReflections] = useState({});
  const [ambienceOn, setAmbienceOn] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tarot-ambience-enabled');
      return saved === 'true';
    }
    return false;
  });
  const [theme, setTheme] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tarot-theme') || 'dark';
    }
    return 'dark';
  });
  const [reversalFramework, setReversalFramework] = useState(null);
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [ttsState, setTtsState] = useState(() => getCurrentTTSState());
  const [ttsAnnouncement, setTtsAnnouncement] = useState('');
  const [journalStatus, setJournalStatus] = useState(null);
  const [minorsFallbackWarning, setMinorsFallbackWarning] = useState(false);
  const [allowPlaceholderCycle, setAllowPlaceholderCycle] = useState(true);
  const [showVoicePrompt, setShowVoicePrompt] = useState(false);
  const [deckAnnouncement, setDeckAnnouncement] = useState('');
  const [isIntentionCoachOpen, setIsIntentionCoachOpen] = useState(false);
  const [prepareSectionsOpen, setPrepareSectionsOpen] = useState(() => {
    if (typeof sessionStorage === 'undefined') {
      return { ...DEFAULT_PREPARE_SECTIONS };
    }
    try {
      const stored = sessionStorage.getItem(PREPARE_SECTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_PREPARE_SECTIONS,
          ...parsed
        };
      }
    } catch (error) {
      console.debug('Unable to load prepare panel state:', error);
    }
    return { ...DEFAULT_PREPARE_SECTIONS };
  });
  const navigate = useNavigate(); // For journal navigation

  const knockTimesRef = useRef([]);
  const shuffleTimeoutRef = useRef(null);
  const spreadSectionRef = useRef(null);
  const prepareSectionRef = useRef(null);
  const readingSectionRef = useRef(null);
  const deckAnnouncementTimeoutRef = useRef(null);
  const deckSizeInitializedRef = useRef(false);
  const stepSectionRefs = {
    spread: spreadSectionRef,
    intention: prepareSectionRef,
    ritual: prepareSectionRef,
    reading: readingSectionRef
  };

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showAllHighlights, setShowAllHighlights] = useState(false);

  const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const handleStepNav = stepId => {
    const target = stepSectionRefs[stepId]?.current;
    if (target && typeof target.scrollIntoView === 'function') {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      target.scrollIntoView({
        behavior,
        block: 'start'
      });
    }
  };

  const togglePrepareSection = section => {
    setPrepareSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleQuestionFocus = () => {
    setAllowPlaceholderCycle(false);
  };

  const handleQuestionBlur = () => {
    if (!userQuestion.trim()) {
      setAllowPlaceholderCycle(true);
    }
  };

  const handlePlaceholderRefresh = () => {
    setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length);
  };

  const handleCoachApply = guidedQuestion => {
    if (!guidedQuestion) return;
    setUserQuestion(guidedQuestion);
    setAllowPlaceholderCycle(false);
    setIsIntentionCoachOpen(false);
  };

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

  // Rotate example intention placeholder (unless user is interacting)
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

  useEffect(() => {
    setShowAllHighlights(false);
  }, [selectedSpread, reading]);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(
        PREPARE_SECTIONS_STORAGE_KEY,
        JSON.stringify(prepareSectionsOpen)
      );
    } catch (error) {
      console.debug('Unable to persist prepare panel state:', error);
    }
  }, [prepareSectionsOpen]);

  // Initialize shared audio once on mount and clean up on unmount
  useEffect(() => {
    initAudio();
    return () => {
      cleanupAudio();
    };
  }, []);

  // Persist voice setting to localStorage
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-voice-enabled', voiceOn.toString());
    }
  }, [voiceOn]);

  // Persist ambience setting to localStorage
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-ambience-enabled', ambienceOn.toString());
    }
  }, [ambienceOn]);

  // Sync theme preference with the DOM and localStorage
  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root) {
      root.classList.toggle('light', theme === 'light');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tarot-theme', theme);
    }
  }, [theme]);

  // Check API health on mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  useEffect(() => {
    if (!journalStatus) return;
    const timeout = setTimeout(() => setJournalStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [journalStatus]);

  useEffect(() => {
    const unsubscribe = subscribeToTTS(state => {
      setTtsState(state);

      const isAnnounceContext =
        state.context === 'full-reading' ||
        state.context === 'card-reveal';

      let baseMessage =
        state.message ||
        (state.status === 'completed'
          ? (state.context === 'card-reveal'
            ? 'Card narration finished.'
            : 'Narration finished.')
          : state.status === 'paused'
            ? (state.context === 'card-reveal'
              ? 'Card narration paused.'
              : 'Narration paused.')
            : state.status === 'playing'
              ? (state.context === 'card-reveal'
                ? 'Card narration playing.'
                : 'Narration playing.')
              : state.status === 'loading'
                ? (state.context === 'card-reveal'
                  ? 'Preparing card narration.'
                  : 'Preparing narration.')
                : state.status === 'stopped'
                  ? 'Narration stopped.'
                  : state.status === 'error'
                    ? 'Narration unavailable.'
                    : '');

      const announcement = isAnnounceContext ? baseMessage : '';
      setTtsAnnouncement(announcement);
    });
    return unsubscribe;
  }, []);

  async function checkApiHealth() {
    try {
      // Check tarot-reading API health
      const tarotHealth = await fetch('/api/tarot-reading').catch(() => null);
      const ttsHealth = await fetch('/api/tts').catch(() => null);

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
      }
    } catch (err) {
      // Silently fail - health check is non-critical
      console.debug('API health check failed:', err);
    }
  }

  // Keep ambience in sync with toggle
  useEffect(() => {
    toggleAmbience(ambienceOn);
  }, [ambienceOn]);

  // Stop TTS when voice is toggled off
  useEffect(() => {
    if (!voiceOn) {
      stopNarration();
    }
  }, [voiceOn]);

  useEffect(() => {
    if (voiceOn) {
      setShowVoicePrompt(false);
    }
  }, [voiceOn]);

  // Active deck size based on toggle (with dataset safety handled in getDeckPool)
  const { deckSize, minorsDataIncomplete } = useMemo(() => {
    const pool = getDeckPool(includeMinors);

    return {
      deckSize: pool.length,
      minorsDataIncomplete:
        includeMinors && pool.length === MAJOR_ARCANA.length
    };
  }, [includeMinors]);

  // Sync Minor Arcana dataset warning outside render phase
  useEffect(() => {
    setMinorsFallbackWarning(minorsDataIncomplete);
  }, [minorsDataIncomplete]);

  // Keep cut index centered on active deck and announce deck scope changes
  useEffect(() => {
    const nextCutIndex = Math.floor(deckSize / 2);
    setCutIndex(nextCutIndex);

    if (!deckSizeInitializedRef.current) {
      deckSizeInitializedRef.current = true;
      return;
    }

    setHasCut(false);
    setHasKnocked(false);
    setKnockCount(0);
    knockTimesRef.current = [];
    const announcement = `Deck now ${deckSize} cards. Cut index reset to ${nextCutIndex}.`;
    setDeckAnnouncement(announcement);
    if (deckAnnouncementTimeoutRef.current) {
      clearTimeout(deckAnnouncementTimeoutRef.current);
    }
    deckAnnouncementTimeoutRef.current = setTimeout(() => {
      setDeckAnnouncement('');
    }, 4000);
  }, [deckSize]);

  useEffect(() => () => {
    if (deckAnnouncementTimeoutRef.current) {
      clearTimeout(deckAnnouncementTimeoutRef.current);
    }
  }, []);

  // Server-centric spread analysis (Strategy C)
  const [spreadAnalysis, setSpreadAnalysis] = useState(null);
  const [themes, setThemes] = useState(null);
  const [analysisContext, setAnalysisContext] = useState(null);

  // Local fallback relationships: only used when server does not provide canonical relationships.
  const relationships = useMemo(() => {
    if (!reading || !reading.length) return [];
    if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
      // Canonical server relationships take precedence.
      return [];
    }
    return computeRelationships(reading || []);
  }, [reading, spreadAnalysis]);

  function handleKnock() {
    if (hasKnocked) return;
    if (typeof performance === 'undefined') return;
    const now = performance.now();
    const recent = knockTimesRef.current.filter(timestamp => now - timestamp < 2000);
    recent.push(now);
    knockTimesRef.current = recent;
    setKnockCount(Math.min(recent.length, 3));
    if (recent.length >= 3) {
      setHasKnocked(true);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([18, 40, 18]);
      }
    }
  }

  function applyCut() {
    setHasCut(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
  }

  async function speak(text, context = 'default') {
    await speakText({
      text,
      enabled: voiceOn,
      context,
      voice: 'nova' // Default voice for mystical tarot readings
      // speed: defaults to 1.1 (engaging pace) in tts.js backend
      // stream: defaults to false (complete audio, with caching) in audio.js
    });
  }

  function shortLineForCard(card, position) {
    const meaning = card.isReversed ? card.reversed : card.upright;
    const first = meaning.split(',')[0];
    return `${position}: ${card.name} - ${first}.`;
  }

  function dealNext() {
    if (!reading) return;
    if (dealIndex >= reading.length) return;
    void unlockAudio();
    const next = dealIndex;
    setRevealedCards(prev => new Set([...prev, next]));
    setDealIndex(next + 1);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
    playFlip();
    const spreadInfo = SPREADS[selectedSpread];
    const position = spreadInfo.positions[next] || `Position ${next + 1}`;
    void speak(shortLineForCard(reading[next], position), 'card-reveal');
  }

  // Use the journal hook for saving
  const { saveEntry } = useJournal();

  async function saveReading() {
    if (!reading) {
      setJournalStatus({
        type: 'error',
        message: 'Draw your cards before saving to the journal.'
      });
      return;
    }
    if (!personalReading || personalReading.isError) {
      setJournalStatus({
        type: 'error',
        message: 'Generate a personalized narrative before saving to the journal.'
      });
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
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(12);
        }
        setJournalStatus({
          type: 'success',
          message: 'Saved to your journal.'
        });
      } else {
        setJournalStatus({
          type: 'error',
          message: result.error || 'Unable to save to your journal. Please try again.'
        });
      }
    } catch (error) {
      console.error('Failed to save tarot reading', error);
      setJournalStatus({
        type: 'error',
        message: 'Unable to save to your journal. Please try again.'
      });
    }
  }

  const isPersonalReadingError = Boolean(personalReading?.isError);
  const fullReadingText = !isPersonalReadingError
    ? personalReading?.raw || personalReading?.normalized || ''
    : '';
  const isNarrationAvailable = Boolean(fullReadingText);
  const isPersonalReadingContext = ttsState.context === 'full-reading';
  const personalStatus = isPersonalReadingContext ? ttsState.status : 'idle';
  const personalProvider = isPersonalReadingContext ? ttsState.provider : null;
  const personalMessage = isPersonalReadingContext ? ttsState.message : null;
  const isTtsLoading = personalStatus === 'loading';
  const isTtsPlaying = personalStatus === 'playing';
  const isTtsPaused = personalStatus === 'paused';
  const isTtsError = personalStatus === 'error';
  const isTtsFallback = personalProvider === 'fallback';
  const playButtonLabel = isTtsLoading
    ? 'Preparing narration...'
    : isTtsPlaying
      ? 'Pause narration'
      : isTtsPaused
        ? 'Resume narration'
        : 'Read this aloud';
  const playButtonAriaLabel = isTtsLoading
    ? 'Preparing personal reading narration'
    : isTtsPlaying
      ? 'Pause personal reading narration'
      : isTtsPaused
        ? 'Resume personal reading narration'
        : 'Read your personal tarot reading aloud';
  const playButtonDisabled =
    !isNarrationAvailable ||
    (isTtsLoading && !isTtsPaused && !isTtsPlaying);
  const showStopButton =
    isPersonalReadingContext && voiceOn && isNarrationAvailable && (isTtsPlaying || isTtsPaused || isTtsLoading);

  const inlineStatusMessage = isPersonalReadingError
    ? 'Personalized reading unavailable. Generate a new narrative to enable narration and saving.'
    : !voiceOn
      ? 'Voice narration is off. Use the prompt below to enable it before listening.'
      : !isNarrationAvailable
        ? null
        : isTtsError
          ? personalMessage || 'Unable to play audio right now.'
          : isTtsFallback
            ? 'Voice service is unavailable right now, so you will hear a gentle chime instead of narration.'
            : isTtsLoading
              ? 'Preparing audio...'
              : isTtsPaused
                ? 'Narration paused.'
                : personalStatus === 'completed'
                  ? 'Narration finished.'
                  : personalStatus === 'stopped'
                    ? 'Narration stopped.'
                    : null;

  const helperId = inlineStatusMessage ? 'personal-reading-tts-helper' : undefined;
  const journalStatusId = journalStatus ? 'personal-reading-journal-status' : undefined;
  const canSaveReading = Boolean(reading && personalReading && !isPersonalReadingError);
  const liveRegionMessage = [ttsAnnouncement, journalStatus?.message].filter(Boolean).join(' ');
  const baseMobileActionButtonClass =
    'flex-1 min-w-[7.5rem] inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed';
  const mobileActionButtonVariants = {
    primary: 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/40 hover:bg-amber-400',
    secondary: 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/40 hover:bg-emerald-500/25',
    ghost: 'bg-slate-900/60 text-amber-200 border border-amber-200/30 hover:bg-slate-900/80'
  };
  const getMobileActionButtonClass = variant =>
    `${baseMobileActionButtonClass} ${mobileActionButtonVariants[variant] || mobileActionButtonVariants.secondary}`;

  const handleNarrationButtonClick = async () => {
    if (!voiceOn) {
      setShowVoicePrompt(true);
      return;
    }
    if (!isNarrationAvailable || isPersonalReadingError) return;
    if (isTtsLoading && !isTtsPaused && !isTtsPlaying) return;

    if (isTtsPlaying) {
      pauseTTS();
      return;
    }

    const unlocked = await unlockAudio();
    if (!unlocked) {
      return;
    }

    if (isTtsPaused) {
      void resumeTTS();
      return;
    }

    void speak(fullReadingText, 'full-reading');
  };

  const handleNarrationStop = () => {
    stopNarration();
  };

  const handleVoicePromptEnable = async () => {
    setVoiceOn(true);
    setShowVoicePrompt(false);
    if (!fullReadingText) return;
    const unlocked = await unlockAudio();
    if (!unlocked) return;
    setTimeout(() => {
      void speak(fullReadingText, 'full-reading');
    }, 120);
  };

  const handleViewJournal = () => {
    navigate('/journal'); // Navigate to journal view
  };

  const shuffle = () => {
    const currentSpread = selectedSpread;

    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current);
    }

    setIsShuffling(true);
    if (!hasConfirmedSpread) {
      setHasConfirmedSpread(true);
    }
    setReading(null);
    setRevealedCards(new Set());
    setPersonalReading(null);
    setThemes(null);
    setSpreadAnalysis(null);
    setAnalysisContext(null);
    setAnalyzingText('');
    setIsGenerating(false);
    setDealIndex(0);
    setReflections({});
    setHasKnocked(false);
    setKnockCount(0);
    setHasCut(false);
    setJournalStatus(null);
    setSessionSeed(null);

    if (typeof performance !== 'undefined') {
      const now = performance.now();
      knockTimesRef.current = knockTimesRef.current.filter(timestamp => now - timestamp < 2000);
    }

    const seed = computeSeed({
      cutIndex,
      knockTimes: knockTimesRef.current,
      userQuestion
    });

    const useSeed = Boolean(hasKnocked || hasCut || (userQuestion && userQuestion.trim()));
    const nextSessionSeed = useSeed ? seed : null;

    const cards = drawSpread({
      spreadKey: currentSpread,
      useSeed,
      seed,
      includeMinors
    });
  
    shuffleTimeoutRef.current = setTimeout(() => {
      if (selectedSpread !== currentSpread) {
        setIsShuffling(false);
        return;
      }
      setReading(cards);
      setIsShuffling(false);
      setSessionSeed(nextSessionSeed);
    }, 1200);
  };

  useEffect(
    () => () => {
      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current);
      }
    },
    []
  );

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

    try {
      const spreadInfo = SPREADS[selectedSpread];

      const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];

      const cardsInfo = reading.map((card, idx) => {
        const originalCard = allCards.find(item => item.name === card.name) || card;
        const meaningText = card.isReversed ? originalCard.reversed : originalCard.upright;
        const position = spreadInfo.positions[idx] || `Position ${idx + 1}`;

        // Preserve backward compatibility for Majors while enriching Minors.
        const suit = originalCard.suit || null;
        const rank = originalCard.rank || null;
        const rankValue =
          typeof originalCard.rankValue === 'number' ? originalCard.rankValue : null;

        return {
          position,
          card: card.name,
          orientation: card.isReversed ? 'Reversed' : 'Upright',
          meaning: meaningText,
          number: card.number,
          // New Minor Arcana metadata for backend analysis:
          // Provided as null for Majors so spreadAnalysis/narrativeBuilder can branch cleanly.
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

      const response = await fetch('/api/tarot-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadInfo: { name: spreadInfo.name },
          cardsInfo,
          userQuestion,
          reflectionsText,
          reversalFrameworkOverride: reversalFramework
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Tarot reading API error:', response.status, errText);
        throw new Error('Failed to generate reading');
      }

      const data = await response.json();
      if (!data?.reading || !data.reading.trim()) {
        throw new Error('Empty reading returned');
      }

      // Persist server-side themes and spreadAnalysis as single source of truth when present
      setThemes(data.themes || null);
      setSpreadAnalysis(data.spreadAnalysis || null);
      setAnalysisContext(data.context || null);

      // Format reading for both UI display and TTS narration
      const formatted = formatReading(data.reading.trim());
      formatted.isError = false;
      setPersonalReading(formatted);
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

  // Derive displayable spread highlights from canonical server analysis when available.
  const derivedHighlights = useMemo(() => {
    if (!reading || revealedCards.size !== (reading?.length || 0)) return null;

    if (spreadAnalysis && Array.isArray(spreadAnalysis.relationships)) {
      const notes = [];

      // Deck scope from themes if provided
      if (themes) {
        const deckScope = includeMinors
          ? 'Full deck (Major + Minor Arcana).'
          : 'Major Arcana focus (archetypal themes).';
        notes.push({
          key: 'deck-scope',
          icon: '-',
          title: 'Deck scope:',
          text: deckScope
        });

        // Suit / element dominance
        if (themes.dominantSuit || themes.suitFocus) {
          notes.push({
            key: 'suit-dominance',
            icon: '♠',
            title: 'Suit Dominance:',
            text: themes.suitFocus ||
              `A strong presence of ${themes.dominantSuit} suggests this suit's themes are central to your situation.`
          });
        }

        if (themes.elementalBalance) {
          notes.push({
            key: 'elemental-balance',
            icon: '⚡',
            title: 'Elemental Balance:',
            text: themes.elementalBalance
          });
        }

        // Reversal framework
        if (themes.reversalDescription) {
          notes.push({
            key: 'reversal-framework',
            icon: '⤴',
            title: 'Reversal Lens:',
            text: `${themes.reversalDescription.name} — ${themes.reversalDescription.description}`
          });
        }
      }

      // Relationships from server analysis
      spreadAnalysis.relationships.forEach((rel, index) => {
        if (!rel || !rel.summary) return;
        let title = 'Pattern';
        let icon = '•';

        if (rel.type === 'sequence') {
          title = 'Story Flow';
          icon = '→';
        } else if (rel.type === 'elemental-run' || rel.type === 'elemental') {
          title = 'Elemental Pattern';
          icon = '⚡';
        } else if (rel.type === 'axis') {
          title = rel.axis || 'Axis Insight';
          icon = '⇄';
        } else if (rel.type === 'nucleus') {
          title = 'Heart of the Matter';
          icon = '★';
        } else if (rel.type === 'timeline') {
          title = 'Timeline';
          icon = '⏱';
        } else if (rel.type === 'consciousness-axis') {
          title = 'Conscious ↔ Subconscious';
          icon = '☯';
        } else if (rel.type === 'staff-axis') {
          title = 'Advice ↔ Outcome';
          icon = '⚖';
        } else if (rel.type === 'cross-check') {
          title = 'Cross-Check';
          icon = '✦';
        }

        notes.push({
          key: `rel-${index}-${rel.type || 'rel'}`,
          icon,
          title,
          text: rel.summary
        });
      });

      // Position notes (e.g., axes / roles) if provided
      if (Array.isArray(spreadAnalysis.positionNotes)) {
        spreadAnalysis.positionNotes.forEach((pos, idx) => {
          if (!pos || !pos.notes || pos.notes.length === 0) return;
          notes.push({
            key: `pos-${idx}`,
            icon: '□',
            title: `Position ${pos.index + 1} – ${pos.label}:`,
            text: pos.notes.join(' ')
          });
        });
      }

      return notes;
    }

    // Fallback: no spreadAnalysis → let legacy computeRelationships drive highlights
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
      text: includeMinors
        ? 'Full deck (Major + Minor Arcana).'
        : 'Major Arcana focus (archetypal themes).'
    });

    const reversedIdx = reading
      .map((card, index) => (card.isReversed ? index : -1))
      .filter(index => index >= 0);

    if (reversedIdx.length > 0) {
      const spreadInfo = SPREADS[selectedSpread];
      const positions = reversedIdx
        .map(index => spreadInfo.positions[index] || `Card ${index + 1}`)
        .join(', ');
      const hasCluster = reversedIdx.some((idx, j) => j > 0 && idx === reversedIdx[j - 1] + 1);
      let text = `${positions}. These often point to inner processing, timing delays, or tension in the theme.`;
      if (hasCluster) {
        text += ' Consecutive reversals suggest the theme persists across positions.';
      }
      items.push({
        key: 'reversal-summary',
        icon: '⤴',
        title: `Reversed cards (${reversedIdx.length}):`,
        text
      });
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
      items.push({
        key: `relationship-${relationship.type || 'pattern'}-${index}`,
        icon: meta.icon,
        title: meta.title,
        text: relationship.text
      });
    });

    return items;
  }, [reading, revealedCards, includeMinors, selectedSpread, relationships]);

  const highlightItems =
    derivedHighlights && derivedHighlights.length > 0 ? derivedHighlights : fallbackHighlights;

  const renderHighlightItem = item => (
    <div key={item.key} className="flex items-start gap-3">
      <div className="text-amber-300 mt-1" aria-hidden="true">
        {item.icon}
      </div>
      <div className="text-amber-100/85 text-sm leading-snug">
        <span className="font-semibold text-amber-200">{item.title}</span> {item.text}
      </div>
    </div>
  );

  const revealCard = index => {
    if (!reading || !reading[index]) return;
    if (revealedCards.has(index)) return;
    void unlockAudio();
    setRevealedCards(prev => new Set([...prev, index]));
    setDealIndex(prev => Math.max(prev, index + 1));
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
    playFlip();
    const spreadInfo = SPREADS[selectedSpread];
    const position = spreadInfo.positions[index] || `Position ${index + 1}`;
    void speak(shortLineForCard(reading[index], position), 'card-reveal');
  };

  const revealAll = () => {
    if (!reading || reading.length === 0) return;
    const allIndices = new Set(Array.from({ length: reading.length }, (_, index) => index));
    setRevealedCards(allIndices);
    setDealIndex(reading.length);
  };

  const deckSummaryLabel = useMemo(
    () => `${deckSize}${minorsDataIncomplete ? ' (Major Arcana only)' : ''}`,
    [deckSize, minorsDataIncomplete]
  );

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

    return {
      intention: questionSummary,
      experience: `Voice: ${voiceOn ? 'On' : 'Off'} · Ambience: ${ambienceOn ? 'On' : 'Off'} · Deck: ${deckSummaryLabel}`,
      ritual: ritualSummary
    };
  }, [userQuestion, voiceOn, ambienceOn, deckSummaryLabel, knockCount, hasCut, cutIndex]);

  const prepareSectionLabels = {
    intention: {
      title: 'Intention',
      helper: 'Optional guiding prompt before you draw.'
    },
    experience: {
      title: 'Experience & preferences',
      helper: 'Voice, ambience, theme, reversals, and deck scope.'
    },
    ritual: {
      title: 'Ritual (optional)',
      helper: 'Knock, cut, or skip if that is not part of your practice.'
    }
  };

  const hasQuestion = Boolean(userQuestion && userQuestion.trim().length > 0);
  const hasRitualProgress = hasKnocked || hasCut || knockCount > 0;
  const hasReading = Boolean(reading && reading.length > 0);
  const allCardsRevealed = hasReading && revealedCards.size === reading.length;
  const hasNarrative = Boolean(personalReading);
  const narrativeInProgress = isGenerating && !personalReading;
  const { stepIndicatorLabel, stepIndicatorHint, activeStep } = useMemo(() => {
    if (hasNarrative) {
      return {
        stepIndicatorLabel: 'Reflect on your narrative',
        stepIndicatorHint: 'Read through the personalized guidance and save anything that resonates.',
        activeStep: 'reading'
      };
    }

    if (narrativeInProgress) {
      return {
        stepIndicatorLabel: 'Weaving your narrative',
        stepIndicatorHint: 'Hang tight while we compose your personalized reading.',
        activeStep: 'reading'
      };
    }

    if (hasReading) {
      if (allCardsRevealed) {
        return {
          stepIndicatorLabel: 'Explore your spread',
          stepIndicatorHint: 'Review the card insights below or generate a personalized narrative.',
          activeStep: 'reading'
        };
      }

      return {
        stepIndicatorLabel: 'Reveal your cards',
        stepIndicatorHint: 'Flip each card to unfold the story of your spread.',
        activeStep: 'reading'
      };
    }

    if (!hasConfirmedSpread) {
      return {
        stepIndicatorLabel: 'Choose your spread',
        stepIndicatorHint: 'Tap a spread that matches your focus to begin shaping the reading.',
        activeStep: 'spread'
      };
    }

    if (!hasQuestion || !hasRitualProgress) {
      return {
        stepIndicatorLabel: 'Prepare your reading',
        stepIndicatorHint: 'Set an intention, tune experience preferences, or complete the optional ritual.',
        activeStep: !hasQuestion ? 'intention' : 'ritual'
      };
    }

    return {
      stepIndicatorLabel: 'Draw your cards',
      stepIndicatorHint: 'When you feel ready, draw the cards to begin your reading.',
      activeStep: 'reading'
    };
  }, [
    hasNarrative,
    narrativeInProgress,
    hasReading,
    allCardsRevealed,
    hasQuestion,
    hasRitualProgress,
    hasConfirmedSpread
  ]);

  const mobileActionBarButtons = (() => {
    const buttons = [];
    const phaseLabel = stepIndicatorLabel;

    if (isShuffling) {
      buttons.push({
        key: 'shuffling',
        label: 'Shuffling…',
        onClick: null,
        disabled: true,
        variant: 'primary',
        phaseLabel
      });
      return buttons;
    }

    if (!reading) {
      buttons.push({
        key: 'draw',
        label: 'Draw cards',
        onClick: shuffle,
        disabled: false,
        variant: 'primary',
        phaseLabel
      });
      return buttons;
    }

    if (reading && revealedCards.size < reading.length) {
      buttons.push({
        key: 'reveal-next',
        label: `Reveal next (${Math.min(dealIndex + 1, reading.length)}/${reading.length})`,
        onClick: dealNext,
        disabled: false,
        variant: 'primary',
        phaseLabel
      });

      if (reading.length > 1) {
        buttons.push({
          key: 'reveal-all',
          label: 'Reveal all cards',
          onClick: revealAll,
          disabled: false,
          variant: 'secondary',
          phaseLabel
        });
      }

      return buttons;
    }

    if (reading && revealedCards.size === reading.length) {
      if (canSaveReading) {
        buttons.push({
          key: 'save',
          label: 'Save to journal',
          onClick: saveReading,
          disabled: false,
          variant: 'primary',
          phaseLabel
        });
      }

      buttons.push({
        key: 'shuffle-ready',
        label: 'Start a new reading',
        onClick: shuffle,
        disabled: false,
        variant: canSaveReading ? 'secondary' : 'primary',
        phaseLabel
      });

      return buttons;
    }

    return buttons;
  })();

  return (
    <div className="app-shell min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 pt-6 pb-28 sm:py-8 lg:py-10">
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveRegionMessage}
        </div>
        {/* Header */}
        <header aria-labelledby="mystic-tarot-heading">
          <div className="text-center mb-6 sm:mb-8 mystic-heading-wrap">
            <h1
              id="mystic-tarot-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-serif text-amber-200"
            >
              Mystic Tarot
            </h1>
            <p className="mt-2 text-amber-100/80 text-sm sm:text-base md:text-lg">
              Seek guidance from the ancient wisdom of the cards.
            </p>
          </div>
        </header>

        <div className="full-bleed sticky top-0 z-30 py-3 sm:py-4 mb-6 bg-slate-950/95 backdrop-blur border-y border-slate-800/70 px-4 sm:px-5 md:px-6">
          <GlobalNav />
          <StepProgress
            steps={STEP_PROGRESS_STEPS}
            activeStep={activeStep}
            onSelect={handleStepNav}
          />
          {isShuffling && (
            <div
              className="mt-2 flex items-center gap-2 text-amber-200/80 text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug"
              role="status"
              aria-live="polite"
            >
              <RotateCcw className="w-3.5 h-3.5 animate-spin text-amber-300" aria-hidden="true" />
              <span>Shuffling the deck...</span>
            </div>
          )}
        </div>

        {/* API Health Banner */}
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
              {!apiHealthBanner.anthropic && (
                <div>• Claude AI: Using local composer</div>
              )}
              {!apiHealthBanner.azure && (
                <div>• Azure TTS: Using local audio</div>
              )}
              <div className="mt-1">All readings remain fully functional with local fallbacks.</div>
            </div>
          </div>
        )}

        {/* Minors Fallback Warning */}
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
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">
              {stepIndicatorLabel}
            </p>
            <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">
              {stepIndicatorHint}
            </p>
          </div>

          <div className="max-w-5xl mx-auto space-y-6">
            <div
              aria-label="Choose your spread"
              ref={spreadSectionRef}
              id="step-spread"
              className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]"
            >
              <div className="mb-3 sm:mb-4">
                <h2 className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">
                  Spread
                </h2>
                <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">
                  Choose a spread to shape the depth and focus of your reading.
                </p>
              </div>
              <SpreadSelector
                selectedSpread={selectedSpread}
                setSelectedSpread={setSelectedSpread}
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
                deckSize={deckSize}
                onSpreadConfirm={() => setHasConfirmedSpread(true)}
              />
            </div>

            <section
              aria-label="Prepare your reading"
              ref={prepareSectionRef}
              id="step-intention"
              className="modern-surface p-4 sm:p-6 scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]"
            >
              <header className="mb-4 space-y-1">
                <h2 className="text-lg font-serif text-amber-200">Prepare your reading</h2>
                <p className="text-xs text-amber-100/70">
                  Capture an intention, tune the experience controls, and complete the optional ritual from one panel.
                </p>
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
                    <button
                      type="button"
                      onClick={() => togglePrepareSection(section)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      aria-expanded={prepareSectionsOpen[section]}
                    >
                      <div>
                        <p className="text-amber-200 font-serif text-sm">
                          {prepareSectionLabels[section].title}
                        </p>
                        <p className="text-xs text-amber-100/70">
                          {prepareSummaries[section]}
                        </p>
                      </div>
                      {prepareSectionsOpen[section] ? (
                        <ChevronUp className="w-4 h-4 text-amber-300" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-amber-300" />
                      )}
                    </button>
                    {prepareSectionsOpen[section] && (
                      <div className="px-4 pb-4 pt-2">
                        {section === 'intention' && (
                          <QuestionInput
                            userQuestion={userQuestion}
                            setUserQuestion={setUserQuestion}
                            placeholderIndex={placeholderIndex}
                            onFocus={handleQuestionFocus}
                            onBlur={handleQuestionBlur}
                            onPlaceholderRefresh={handlePlaceholderRefresh}
                            onLaunchCoach={() => setIsIntentionCoachOpen(true)}
                          />
                        )}
                        {section === 'experience' && (
                          <SettingsToggles
                            voiceOn={voiceOn}
                            setVoiceOn={setVoiceOn}
                            ambienceOn={ambienceOn}
                            setAmbienceOn={setAmbienceOn}
                            reversalFramework={reversalFramework}
                            setReversalFramework={setReversalFramework}
                            theme={theme}
                            setTheme={setTheme}
                            includeMinors={includeMinors}
                            setIncludeMinors={setIncludeMinors}
                            deckSize={deckSize}
                            minorsDataIncomplete={minorsDataIncomplete}
                          />
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
                            deckSize={deckSize}
                            onSkip={shuffle}
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

        <section
          ref={readingSectionRef}
          id="step-reading"
          className="scroll-mt-[6.5rem] sm:scroll-mt-[7.5rem]"
          aria-label="Draw and explore your reading"
        >
          <div className="mb-4 sm:mb-5">
            <p className="text-xs-plus sm:text-sm uppercase tracking-[0.18em] text-emerald-300/85">
              Reading
            </p>
            <p className="mt-1 text-amber-100/80 text-xs sm:text-sm">
              Draw and reveal your cards, explore the spread, and weave your narrative.
            </p>
          </div>
          {/* Primary CTA: only visible before a spread exists */}
          {!reading && (
            <div className="hidden sm:block text-center mb-8 sm:mb-10">
              <button
                onClick={shuffle}
                disabled={isShuffling}
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg"
              >
                <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                <span>{isShuffling ? 'Shuffling the Cards...' : 'Draw Cards'}</span>
              </button>
            </div>
          )}

          {/* Reading Display */}
          {reading && (
            <div className="space-y-8">
              {/* Intention */}
              {userQuestion && (
                <div className="text-center">
                  <p className="text-amber-100/80 text-sm italic">Intention: {userQuestion}</p>
                </div>
              )}

              {/* Spread Name + Guidance */}
              <div className="text-center text-amber-200 font-serif text-2xl mb-2">
                {SPREADS[selectedSpread].name}
              </div>
              {reading.length > 1 && (
                <p className="text-center text-amber-100/85 text-xs-plus sm:text-sm mb-4">
                  Reveal in order for a narrative flow, or follow your intuition and reveal randomly.
                </p>
              )}

              {/* Reveal All / Reset Reveals */}
              {revealedCards.size < reading.length && (
                <div className="hidden sm:block text-center">
                  <button
                    type="button"
                    onClick={revealAll}
                    className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-amber-900/40 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base"
                  >
                    <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Reveal All Cards</span>
                  </button>
                  <p className="text-amber-300/80 text-xs sm:text-sm mt-2 sm:mt-3">
                    {revealedCards.size} of {reading.length} cards revealed
                  </p>
                </div>
              )}
              {revealedCards.size > 0 && (
                <div className="text-center mt-3 sm:mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setRevealedCards(new Set());
                      setDealIndex(0);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-amber-300/50 text-amber-100/80 text-xs sm:text-sm hover:text-amber-50 hover:border-amber-200/70 transition"
                  >
                    <span className="hidden xs:inline">Reset reveals (keep this spread)</span>
                    <span className="xs:hidden">Reset reveals</span>
                  </button>
                </div>
              )}

              {/* Deal next card (adaptive CTA copy) */}
              {reading && revealedCards.size < reading.length && (
                <div className="hidden sm:block text-center">
                  <button
                    onClick={dealNext}
                    className="mt-3 inline-flex items-center justify-center bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg shadow-amber-900/30 transition-all text-sm sm:text-base"
                  >
                    <span>
                      Reveal Next Card ({Math.min(dealIndex + 1, reading.length)}/{reading.length})
                    </span>
                  </button>
                </div>
              )}

              {/* Cards Grid via canonical ReadingGrid + Card */}
              <ReadingGrid
                selectedSpread={selectedSpread}
                reading={reading}
                revealedCards={revealedCards}
                revealCard={revealCard}
                reflections={reflections}
                setReflections={setReflections}
              />

              {/* Dynamic Insights */}
              {revealedCards.size === reading.length && highlightItems.length > 0 && (
                <div className="modern-surface p-4 sm:p-6 border border-emerald-400/40 space-y-4">
                  <h3 className="text-base sm:text-lg font-serif text-amber-200 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                    Spread Highlights
                  </h3>
                  <div className="sm:hidden space-y-3">
                    {highlightItems
                      .slice(0, showAllHighlights ? highlightItems.length : 3)
                      .map(renderHighlightItem)}
                    {highlightItems.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllHighlights(prev => !prev)}
                        className="text-emerald-300 text-sm underline underline-offset-4"
                      >
                        {showAllHighlights ? 'Hide extra insights' : 'See all insights'}
                      </button>
                    )}
                  </div>
                  <div className="hidden sm:flex sm:flex-col sm:gap-3">
                    {highlightItems.map(renderHighlightItem)}
                  </div>
                </div>
              )}

              {/* Generate Personal Reading Button */}
              {!personalReading && revealedCards.size === reading.length && (
                <div className="text-center">
                  <button
                    onClick={generatePersonalReading}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-5 sm:px-8 py-3 sm:py-4 rounded-xl shadow-xl shadow-emerald-900/40 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base md:text-lg leading-snug"
                  >
                    <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${isGenerating ? 'motion-safe:animate-pulse' : ''}`} />
                    {isGenerating ? (
                      <span className="text-sm sm:text-base">
                        Weaving your personalized reflection from this spread...
                      </span>
                    ) : (
                      <span>Create Personal Narrative</span>
                    )}
                  </button>
                  <HelperToggle className="mt-3 max-w-xl mx-auto">
                    <p>
                      Reveal all cards to unlock a tailored reflection that weaves positions, meanings, and your notes into
                      one coherent story.
                    </p>
                  </HelperToggle>
                </div>
              )}

              {/* Analyzing Preview */}
              {isGenerating && analyzingText && (
                <div className="max-w-3xl mx-auto text-center">
                  <div className="ai-panel-modern">
                    <div className="ai-panel-text" aria-live="polite">
                      {analyzingText}
                    </div>
                    <HelperToggle className="mt-3">
                      <p>
                        This reflection is generated from your spread and question to support insight, not to decide for you.
                      </p>
                    </HelperToggle>
                  </div>
                </div>
              )}

            {personalReading && !isPersonalReadingError && themes?.knowledgeGraph?.narrativeHighlights?.length > 0 && (
              <SpreadPatterns themes={themes} />
            )}

            {/* Personal Reading Display */}
            {personalReading && (
               <div className="bg-gradient-to-r from-slate-900/80 via-slate-950/95 to-slate-900/80 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-emerald-400/40 shadow-2xl shadow-emerald-900/40 max-w-5xl mx-auto">
                <h3 className="text-xl sm:text-2xl font-serif text-amber-200 mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" />
                  Your Personalized Narrative
                  </h3>
                  <HelperToggle className="mt-3 max-w-2xl mx-auto">
                    <p>
                      This narrative braids together your spread positions, card meanings, and reflections into a single through-line.
                      Read slowly, notice what resonates, and treat it as a mirror—not a script.
                    </p>
                  </HelperToggle>
                  {userQuestion && (
                    <div className="bg-slate-950/85 rounded-lg p-4 mb-4 border border-emerald-400/40">
                      <p className="text-amber-300/85 text-xs sm:text-sm italic">
                        Anchor: {userQuestion}
                      </p>
                    </div>
                  )}
                {/* Render Markdown when available, otherwise fall back to normalized paragraphs */}
                {personalReading.hasMarkdown ? (
                  <MarkdownRenderer content={personalReading.raw} />
                ) : (
                  <div className="text-amber-100 leading-relaxed space-y-2 sm:space-y-3 md:space-y-4 max-w-none mx-auto text-left">
                    {personalReading.paragraphs && personalReading.paragraphs.length > 0 ? (
                      personalReading.paragraphs.map((para, idx) => (
                        <p
                            key={idx}
                            className="text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose"
                          >
                            {para}
                          </p>
                        ))
                      ) : (
                        <p className="text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose whitespace-pre-line">
                          {personalReading.normalized || personalReading.raw || ''}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                    {canSaveReading && (
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={handleNarrationButtonClick}
                          className="px-3 sm:px-4 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/85 hover:bg-slate-900/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 text-xs sm:text-sm"
                          disabled={playButtonDisabled}
                          aria-label={playButtonAriaLabel}
                          aria-describedby={helperId}
                        >
                          <span className="hidden xs:inline">{playButtonLabel}</span>
                          <span className="xs:hidden">{isTtsLoading ? 'Loading...' : isTtsPlaying ? 'Pause' : isTtsPaused ? 'Resume' : 'Play'}</span>
                        </button>
                        {showStopButton && (
                          <button
                            type="button"
                            onClick={handleNarrationStop}
                            className="px-2 sm:px-3 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/70 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                            disabled={!isTtsPlaying && !isTtsPaused && !isTtsLoading}
                            aria-label="Stop personal reading narration"
                          >
                            Stop
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={saveReading}
                          className="hidden sm:inline-flex px-3 sm:px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm hover:bg-emerald-500/25 hover:text-emerald-100 transition"
                          aria-describedby={journalStatusId}
                        >
                          <span className="hidden xs:inline">Save this narrative to your journal</span>
                          <span className="xs:hidden">Save to journal</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleViewJournal}
                          className="px-3 sm:px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs sm:text-sm hover:bg-amber-500/25 hover:text-amber-100 transition"
                        >
                          View Journal
                        </button>
                      </div>
                    )}
                    {inlineStatusMessage && (
                      <p
                        id="personal-reading-tts-helper"
                        className="text-amber-200/75 text-xs text-center max-w-sm"
                      >
                        {inlineStatusMessage}
                      </p>
                    )}
                    {showVoicePrompt && (
                      <div
                        className="text-xs text-amber-100/85 bg-slate-900/70 border border-amber-400/30 rounded-lg px-3 py-2 text-center space-y-2"
                        aria-live="polite"
                      >
                        <p>Voice narration is disabled. Turn it on?</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleVoicePromptEnable}
                            className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30 text-xs"
                          >
                            Enable voice & play
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowVoicePrompt(false)}
                            className="px-3 py-1.5 rounded-full border border-slate-600/50 text-amber-100/80 hover:text-amber-50 text-xs"
                          >
                            Maybe later
                          </button>
                        </div>
                      </div>
                    )}
                    {journalStatus && (
                      <p
                        id={journalStatusId}
                        role="status"
                        aria-live="polite"
                        className={`text-xs text-center max-w-sm ${journalStatus.type === 'success'
                            ? 'text-emerald-200'
                            : 'text-rose-200'
                          }`}
                      >
                        {journalStatus.message}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-amber-500/20 flex flex-col gap-2 sm:gap-3 items-center">
                    <HelperToggle>
                      <p className="text-center">
                        This reading considered card combinations, positions, emotional arcs, and your reflections to provide
                        personalized guidance.
                      </p>
                    </HelperToggle>
                  </div>
                </div>
              )}

              {/* General Guidance */}
              {!personalReading && !isGenerating && (
                <div className="bg-gradient-to-r from-slate-900/80 to-slate-950/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-emerald-400/40 max-w-2xl mx-auto">
                  <h3 className="text-lg sm:text-xl font-serif text-amber-200 mb-2 sm:mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                    Interpretation Guidance
                  </h3>
                  <HelperToggle className="mt-2">
                    <p>
                      Notice how the cards speak to one another. Consider themes, repetitions, contrasts, and where your
                      attention is drawn. Trust your intuition as much as any description.
                    </p>
                    <p className="mt-2">
                      This reading offers reflective guidance only. It is not a substitute for medical, mental health, legal, financial, or safety advice.
                      If your situation involves health, legal risk, abuse, or crisis, consider reaching out to qualified professionals or trusted support services.
                    </p>
                  </HelperToggle>
                </div>
              )}

              {/* Draw New Reading CTA */}
              <div className="hidden sm:block text-center mt-6 sm:mt-8">
                <button
                  onClick={shuffle}
                  disabled={isShuffling}
                  className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg"
                >
                  <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
                  <span className="hidden xs:inline">{isShuffling ? 'Shuffling the Cards...' : 'Draw New Reading'}</span>
                  <span className="xs:hidden">{isShuffling ? 'Shuffling...' : 'New Reading'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Initial State */}
          {!reading && !isShuffling && (
            <div className="text-center py-16 px-4">
              <p className="text-amber-100/80 text-lg font-serif">
                Focus on your question, then draw your cards when you're ready.
              </p>
            </div>
          )}
      </section>
      </main>
      {mobileActionBarButtons.length > 0 && (
        <nav className="mobile-action-bar sm:hidden" aria-label="Primary mobile actions">
          <div className="flex flex-wrap gap-2">
            {mobileActionBarButtons.map(button => (
              <button
                key={button.key}
                type="button"
                onClick={button.onClick || undefined}
                disabled={button.disabled}
                className={`${getMobileActionButtonClass(button.variant)} flex flex-col items-center text-center gap-0.5 py-2`}
                aria-label={button.ariaLabel || `${button.phaseLabel || stepIndicatorLabel || ''} ${button.label}`.trim()}
              >
                <span className="text-[0.55rem] uppercase tracking-[0.18em] text-amber-100/70">
                  {button.phaseLabel || stepIndicatorLabel || 'Current step'}
                </span>
                <span className="text-sm font-semibold">
                  {button.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}
      {isIntentionCoachOpen && (
      <GuidedIntentionCoach
        isOpen={isIntentionCoachOpen}
        onClose={() => setIsIntentionCoachOpen(false)}
        onApply={handleCoachApply}
      />
      )}
    </div>
  );
}
