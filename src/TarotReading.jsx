import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, RotateCcw, Star } from 'lucide-react';
import { MAJOR_ARCANA } from './data/majorArcana';
import { MINOR_ARCANA } from './data/minorArcana';
import { SPREADS } from './data/spreads';
import { EXAMPLE_QUESTIONS } from './data/exampleQuestions';
import { SpreadSelector } from './components/SpreadSelector';
import { QuestionInput } from './components/QuestionInput';
import { SettingsToggles } from './components/SettingsToggles';
import { RitualControls } from './components/RitualControls';
import { ReadingGrid } from './components/ReadingGrid';
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
  getCurrentTTSState
} from './lib/audio';
import { formatReading, splitIntoParagraphs } from './lib/formatting';
import './styles/tarot.css';

export default function TarotReading() {
  const [selectedSpread, setSelectedSpread] = useState('single');
  const [reading, setReading] = useState(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [revealedCards, setRevealedCards] = useState(new Set());
  const [includeMinors, setIncludeMinors] = useState(false);
  // Store both raw markdown and formatted versions for UI and TTS
  const [personalReading, setPersonalReading] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [analyzingText, setAnalyzingText] = useState('');
  const [hasKnocked, setHasKnocked] = useState(false);
  const [hasCut, setHasCut] = useState(false);
  const [cutIndex, setCutIndex] = useState(Math.floor(MAJOR_ARCANA.length / 2));
  const [dealIndex, setDealIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const [reflections, setReflections] = useState({});
  const [ambienceOn, setAmbienceOn] = useState(false);
  const [reversalFramework, setReversalFramework] = useState(null);
  const [apiHealthBanner, setApiHealthBanner] = useState(null);
  const [ttsState, setTtsState] = useState(() => getCurrentTTSState());
  const [ttsAnnouncement, setTtsAnnouncement] = useState('');
  const [journalStatus, setJournalStatus] = useState(null);

  const knockTimesRef = useRef([]);
  const shuffleTimeoutRef = useRef(null);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotate example intention placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Initialize shared audio once on mount and clean up on unmount
  useEffect(() => {
    initAudio();
    return () => {
      cleanupAudio();
    };
  }, []);

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
      const isFullReading = state.context === 'full-reading';
      const announcement = isFullReading
        ? state.message ||
          (state.status === 'completed'
            ? 'Narration finished.'
            : state.status === 'paused'
              ? 'Narration paused.'
              : state.status === 'playing'
                ? 'Narration playing.'
                : state.status === 'loading'
                  ? 'Preparing narration.'
                  : state.status === 'stopped'
                    ? 'Narration stopped.'
                    : state.status === 'error'
                      ? 'Narration unavailable.'
                      : '')
        : '';
      setTtsAnnouncement(announcement);
    });
    return unsubscribe;
  }, []);

  async function checkApiHealth() {
    try {
      // Check tarot-reading API health
      const tarotHealth = await fetch('/api/tarot-reading/health').catch(() => null);
      const ttsHealth = await fetch('/api/tts/health').catch(() => null);
      
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

  // Active deck size based on toggle (with dataset safety handled in getDeckPool)
  const deckSize = useMemo(() => getDeckPool(includeMinors).length, [includeMinors]);

  // Keep cut index centered on active deck when no reading in progress
  useEffect(() => {
    if (!reading) {
      setCutIndex(Math.floor(deckSize / 2));
    }
  }, [deckSize, reading]);

  const relationships = useMemo(() => computeRelationships(reading || []), [reading]);

  // Disallow switching deck mode mid-reading/shuffle
  const minorsToggleDisabled =
    !!reading || isShuffling || (revealedCards && revealedCards.size > 0);

  function handleKnock() {
    if (typeof performance === 'undefined') return;
    const now = performance.now();
    const recent = knockTimesRef.current.filter(timestamp => now - timestamp < 2000);
    recent.push(now);
    knockTimesRef.current = recent;
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
      voice: 'nova' // Can be made dynamic via settings later
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

  function saveReading() {
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
    if (typeof localStorage === 'undefined') {
      setJournalStatus({
        type: 'error',
        message: 'This browser does not support journal saving.'
      });
      return;
    }

    const entry = {
      deckMode: includeMinors ? 'full' : 'majors',
      deckVersion: '1.0.0',
      ts: new Date().toISOString(),
      spread: SPREADS[selectedSpread].name,
      question: userQuestion || '',
      cards: reading.map((card, index) => ({
        position: SPREADS[selectedSpread].positions[index] || `Position ${index + 1}`,
        name: card.name,
        number: card.number,
        orientation: card.isReversed ? 'Reversed' : 'Upright'
      })),
      reflections,
      // Save both raw markdown and formatted versions
      personalReading: personalReading?.raw || personalReading?.normalized || '',
      // Keep formatted version for potential future use
      personalReadingFormatted: personalReading
    };

    try {
      const key = 'tarot_journal';
      let list = [];
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            list = parsed;
          }
        } catch (parseError) {
          console.warn('Resetting tarot journal cache due to parse error.', parseError);
        }
      }
      list.unshift(entry);
      if (list.length > 100) {
        list.length = 100;
      }
      localStorage.setItem(key, JSON.stringify(list));
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
      setJournalStatus({
        type: 'success',
        message: 'Saved to your journal.'
      });
    } catch (error) {
      console.error('Failed to save tarot reading', error);
      const quotaError =
        error?.name === 'QuotaExceededError' ||
        error?.code === 22 ||
        error?.code === 1014;
      setJournalStatus({
        type: 'error',
        message: quotaError
          ? 'Storage is full or unavailable. Clear space or exit private browsing, then try again.'
          : 'Unable to save to your journal. Please try again.'
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
    !voiceOn ||
    !isNarrationAvailable ||
    (isTtsLoading && !isTtsPaused && !isTtsPlaying);
  const showStopButton =
    isPersonalReadingContext && voiceOn && isNarrationAvailable && (isTtsPlaying || isTtsPaused || isTtsLoading);

  const inlineStatusMessage = isPersonalReadingError
    ? 'Personalized reading unavailable. Generate a new narrative to enable narration and saving.'
    : !voiceOn
      ? "Turn on 'Reader voice' in Experience settings above to listen to this reading."
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

  const handleNarrationButtonClick = () => {
    if (!voiceOn || !isNarrationAvailable || isPersonalReadingError) return;
    if (isTtsLoading && !isTtsPaused && !isTtsPlaying) return;

    if (isTtsPlaying) {
      pauseTTS();
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

  const shuffle = () => {
    const currentSpread = selectedSpread;

    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current);
    }

    setIsShuffling(true);
    setReading(null);
    setRevealedCards(new Set());
    setPersonalReading(null);
    setAnalyzingText('');
    setIsGenerating(false);
    setDealIndex(0);
    setReflections({});
    setHasKnocked(false);
    setHasCut(false);
    setJournalStatus(null);

    if (typeof performance !== 'undefined') {
      const now = performance.now();
      knockTimesRef.current = knockTimesRef.current.filter(timestamp => now - timestamp < 2000);
    }

    const seed = computeSeed({
      cutIndex,
      knockTimes: knockTimesRef.current,
      userQuestion
    });

    const useSeed = hasKnocked || hasCut || (userQuestion && userQuestion.trim());

    shuffleTimeoutRef.current = setTimeout(() => {
      if (selectedSpread !== currentSpread) {
        setIsShuffling(false);
        return;
      }

      const cards = drawSpread({
        spreadKey: currentSpread,
        useSeed,
        seed,
        includeMinors
      });

      setReading(cards);
      setIsShuffling(false);
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

  const revealCard = index => {
    if (!reading || !reading[index]) return;
    if (revealedCards.has(index)) return;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
        {/* Header */}
        <header aria-labelledby="mystic-tarot-heading">
          <div className="text-center mb-8">
            <h1
              id="mystic-tarot-heading"
              className="text-4xl sm:text-5xl font-serif text-amber-200"
            >
              Mystic Tarot
            </h1>
            <p className="mt-2 text-amber-100/80 text-base sm:text-lg">
              Seek guidance from the ancient wisdom of the cards.
            </p>
          </div>
        </header>

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

        {/* Spread + Controls layout */}
        <section className="mb-6 xl:mb-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1.6fr)] xl:items-start">
            {/* Spread selection (primary) */}
            <div aria-label="Choose your spread">
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
              />
            </div>

            {/* Optional intention and ritual controls */}
            <div className="space-y-4">
              <section aria-label="Your question or intention (optional)">
                <QuestionInput
                  userQuestion={userQuestion}
                  setUserQuestion={setUserQuestion}
                  placeholderIndex={placeholderIndex}
                />
              </section>

              <section aria-label="Experience settings">
                <SettingsToggles
                  voiceOn={voiceOn}
                  setVoiceOn={setVoiceOn}
                  ambienceOn={ambienceOn}
                  setAmbienceOn={setAmbienceOn}
                  includeMinors={includeMinors}
                  setIncludeMinors={setIncludeMinors}
                  minorsToggleDisabled={minorsToggleDisabled}
                  reversalFramework={reversalFramework}
                  setReversalFramework={setReversalFramework}
                />
                <p className="sr-only">
                  Reader voice uses generated audio when enabled. Table ambience plays soft background sound when enabled.
                </p>
              </section>

              <section aria-label="Ritual (optional)">
                <RitualControls
                  hasKnocked={hasKnocked}
                  handleKnock={handleKnock}
                  cutIndex={cutIndex}
                  setCutIndex={setCutIndex}
                  hasCut={hasCut}
                  applyCut={applyCut}
                  knocksCount={Math.min((knockTimesRef.current || []).length, 3)}
                  deckSize={deckSize}
                />
              </section>
            </div>
          </div>
        </section>

        {/* Shuffle Button */}
        <section className="text-center mb-10" aria-label="Draw cards">
          <button
            onClick={shuffle}
            disabled={isShuffling}
            className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-950 font-semibold px-8 py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-3 text-lg"
          >
            <RotateCcw className={`w-5 h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
            {isShuffling ? 'Shuffling the Cards...' : 'Draw Cards'}
          </button>
        </section>

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
              <p className="text-center text-amber-100/70 text-xs mb-4">
                Reveal in order for a narrative flow, or follow your intuition and reveal randomly.
              </p>
            )}

            {/* Reveal All */}
            {revealedCards.size < reading.length && (
              <div className="text-center">
                <button
                  onClick={revealAll}
                  className="bg-amber-600/30 hover:bg-amber-600/50 border-2 border-amber-500 text-amber-200 font-semibold px-6 py-3 rounded-lg shadow-lg transition-all flex items-center gap-3 mx-auto"
                >
                  <Star className="w-5 h-5" />
                  Reveal All Cards
                </button>
                <p className="text-amber-300/80 text-sm mt-3">
                  {revealedCards.size} of {reading.length} cards revealed
                </p>
              </div>
            )}

            {/* Deal next card */}
            {reading && revealedCards.size < reading.length && (
              <div className="text-center">
                <button
                  onClick={dealNext}
                  className="mt-2 bg-amber-600/30 hover:bg-amber-600/50 border-2 border-amber-500 text-amber-200 font-semibold px-6 py-3 rounded-lg shadow-lg transition-all"
                >
                  Deal next card ({dealIndex + 1}/{reading.length})
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
            {revealedCards.size === reading.length && (
              <div className="modern-surface p-6 border border-emerald-400/22 space-y-4">
                <h3 className="text-lg font-serif text-amber-200 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Spread Highlights
                </h3>
                <div className="space-y-3 text-amber-100/85 text-sm leading-relaxed">
                 <div className="flex items-start gap-3">
                   <div className="text-amber-300 mt-1">-</div>
                   <div>
                     <span className="font-semibold text-amber-200">Deck scope:</span>{' '}
                     {includeMinors
                       ? 'Full deck (Major + Minor Arcana).'
                       : 'Major Arcana focus (archetypal themes).'}
                   </div>
                 </div>
                 {(() => {
                   const reversedIdx = reading
                     .map((c, i) => (c.isReversed ? i : -1))
                     .filter(i => i >= 0);
                   if (reversedIdx.length === 0) return null;

                   const positions = reversedIdx
                     .map(i => SPREADS[selectedSpread].positions[i] || `Card ${i + 1}`)
                     .join(', ');

                   const hasCluster = reversedIdx.some(
                     (idx, j) => j > 0 && idx === reversedIdx[j - 1] + 1
                   );

                   return (
                     <div className="flex items-start gap-3">
                       <div className="text-cyan-400 mt-1">-</div>
                       <div>
                         <span className="font-semibold text-cyan-300">
                           Reversed cards ({reversedIdx.length}):
                         </span>{' '}
                         {positions}.
                         <span className="block text-amber-100/70">
                           These often point to inner processing, timing delays, or tension in the theme.
                           {hasCluster &&
                             ' Noticing consecutive reversals suggests the theme persists across positions.'}
                         </span>
                       </div>
                     </div>
                   );
                 })()}
                 {relationships.some(r => r.type === 'sequence') && (
                   <div className="flex items-start gap-3">
                     <div className="text-emerald-400 mt-1">-</div>
                     <div>
                       <span className="font-semibold text-emerald-300">Sequence:</span>{' '}
                       Sequential Majors suggest a natural progression through connected themes.
                     </div>
                   </div>
                 )}
                 {relationships.map((relationship, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="text-cyan-400 mt-1">{'>'}</div>
                      <div>
                        <span className="font-semibold text-cyan-300">Card Connection:</span> {relationship.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Personal Reading Button */}
            {!personalReading && revealedCards.size === reading.length && (
               <div className="text-center">
                 <button
                   onClick={generatePersonalReading}
                   disabled={isGenerating}
                   className="bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold px-8 py-4 rounded-xl shadow-xl shadow-emerald-900/40 transition-all flex items-center gap-3 mx-auto text-base sm:text-lg leading-snug"
                 >
                   <Sparkles className={`w-5 h-5 ${isGenerating ? 'motion-safe:animate-pulse' : ''}`} />
                   {isGenerating ? (
                     <>
                       <span className="hidden sm:inline">
                         Weaving your personalized reflection from this spread...
                       </span>
                       <span className="sm:hidden">
                         Generating reading...
                       </span>
                     </>
                   ) : (
                     'Generate personalized narrative'
                   )}
                 </button>
                 <p className="text-emerald-300/80 text-sm mt-3 max-w-xl mx-auto">
                   Reveal all cards to unlock a tailored reflection that weaves positions, meanings, and your notes into one coherent story.
                 </p>
               </div>
             )}

            {/* Analyzing Preview */}
            {isGenerating && analyzingText && (
               <div className="max-w-3xl mx-auto text-center">
                 <div className="ai-panel-modern">
                   <div className="ai-panel-text" aria-live="polite">
                     {analyzingText}
                   </div>
                   <p className="ai-panel-hint">
                     This reflection is generated from your spread and question to support insight, not to decide for you.
                   </p>
                 </div>
               </div>
             )}

            {/* Personal Reading Display */}
            {personalReading && (
               <div className="bg-gradient-to-r from-slate-900/80 via-slate-950/95 to-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-emerald-400/25 shadow-2xl shadow-emerald-900/40 max-w-3xl mx-auto">
                <h3 className="text-2xl font-serif text-amber-200 mb-2 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-emerald-300" />
                  Your Personalized Narrative
                </h3>
                <p className="text-amber-200/75 text-xs sm:text-sm mb-4 max-w-2xl mx-auto">
                  This narrative braids together your spread positions, card meanings, and reflections into a single through-line.
                  Read slowly, notice what resonates, and treat it as a mirror—not a script.
                </p>
                {userQuestion && (
             <div className="bg-slate-950/85 rounded-lg p-4 mb-4 border border-emerald-400/22">
               <p className="text-amber-300/85 text-xs sm:text-sm italic">
                 Anchor: {userQuestion}
               </p>
             </div>
           )}
                {/* Render normalized text as natural paragraphs with improved readability */}
                <div className="text-amber-100 leading-relaxed space-y-3 sm:space-y-4 max-w-prose mx-auto text-left">
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
                <div className="flex flex-col items-center justify-center gap-3 mt-4">
                  {canSaveReading && (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleNarrationButtonClick}
                        className="px-4 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/85 hover:bg-slate-900/80 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        disabled={playButtonDisabled}
                        aria-label={playButtonAriaLabel}
                        aria-describedby={helperId}
                      >
                        {playButtonLabel}
                      </button>
                      {showStopButton && (
                        <button
                          type="button"
                          onClick={handleNarrationStop}
                          className="px-3 py-2 rounded-lg border border-emerald-400/40 bg-slate-950/70 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={!isTtsPlaying && !isTtsPaused && !isTtsLoading}
                          aria-label="Stop personal reading narration"
                        >
                          Stop narration
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={saveReading}
                        className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm hover:bg-emerald-500/25 hover:text-emerald-100 transition"
                        aria-describedby={journalStatusId}
                      >
                        Save this narrative to your journal
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
                  {journalStatus && (
                    <p
                      id={journalStatusId}
                      role="status"
                      aria-live="polite"
                      className={`text-xs text-center max-w-sm ${
                        journalStatus.type === 'success'
                          ? 'text-emerald-200'
                          : 'text-rose-200'
                      }`}
                    >
                      {journalStatus.message}
                    </p>
                  )}
                  <div className="sr-only" role="status" aria-live="polite">
                    {ttsAnnouncement}
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-amber-500/20 flex flex-col gap-3 items-center">
                  <p className="text-amber-200/70 text-xs italic text-center">
                    This reading considered card combinations, positions, emotional arcs, and your reflections to provide
                    personalized guidance.
                  </p>
                  {canSaveReading && (
                    <button
                      onClick={saveReading}
                      className="mt-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-indigo-950 font-semibold px-6 py-3 rounded-lg shadow-lg transition-all"
                      aria-describedby={journalStatusId}
                    >
                      Save to Journal
                    </button>
                  )}
                  <button
                    onClick={shuffle}
                    className="mt-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-indigo-950 font-semibold px-6 py-3 rounded-lg shadow-lg transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Draw New Reading
                  </button>
                </div>
              </div>
            )}

            {/* General Guidance */}
            {!personalReading && !isGenerating && (
              <div className="bg-gradient-to-r from-slate-900/80 to-slate-950/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-400/20 max-w-2xl mx-auto">
                <h3 className="text-xl font-serif text-amber-200 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Interpretation Guidance
                </h3>
                <p className="text-amber-100/85 leading-relaxed">
                  Notice how the cards speak to one another. Consider themes, repetitions, contrasts, and where your
                  attention is drawn. Trust your intuition as much as any description.
                </p>
              </div>
            )}
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
      </main>
    </div>
  );
}
