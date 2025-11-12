import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, RotateCcw, Star } from 'lucide-react';
import { MAJOR_ARCANA } from './data/majorArcana';
import { SPREADS } from './data/spreads';
import { EXAMPLE_QUESTIONS } from './data/exampleQuestions';
import { SpreadSelector } from './components/SpreadSelector';
import { QuestionInput } from './components/QuestionInput';
import { SettingsToggles } from './components/SettingsToggles';
import { RitualControls } from './components/RitualControls';
import { ReadingGrid } from './components/ReadingGrid';
import { computeSeed, computeRelationships, drawSpread } from './lib/deck';
import { initAudio, toggleAmbience, playFlip, speakText, cleanupAudio } from './lib/audio';
import { formatReading, splitIntoParagraphs } from './lib/formatting';
import './styles/tarot.css';

export default function TarotReading() {
  const [selectedSpread, setSelectedSpread] = useState('single');
  const [reading, setReading] = useState(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [revealedCards, setRevealedCards] = useState(new Set());
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
  const [apiHealthBanner, setApiHealthBanner] = useState(null);

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

  const relationships = useMemo(() => computeRelationships(reading || []), [reading]);

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
    if (!reading) return;
    if (typeof localStorage === 'undefined') return;

    const entry = {
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
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const list = Array.isArray(stored) ? stored : [];
      list.unshift(entry);
      if (list.length > 100) {
        list.length = 100;
      }
      localStorage.setItem(key, JSON.stringify(list));
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    } catch (error) {
      console.error('Failed to save tarot reading', error);
    }
  }

  const shuffle = () => {
    const currentSpread = selectedSpread;

    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current);
    }

    setIsShuffling(true);
    setReading(null);
    setRevealedCards(new Set());
    setPersonalReading('');
    setAnalyzingText('');
    setIsGenerating(false);
    setDealIndex(0);
    setReflections({});

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
        seed
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
      setPersonalReading(formatReading(errorMsg));
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    setAnalyzingText('');
    setPersonalReading(null);

    try {
      const spreadInfo = SPREADS[selectedSpread];

      const cardsInfo = reading.map((card, idx) => {
        const originalCard = MAJOR_ARCANA.find(item => item.name === card.name) || card;
        const meaningText = card.isReversed ? originalCard.reversed : originalCard.upright;
        const position = spreadInfo.positions[idx] || `Position ${idx + 1}`;
        return {
          position,
          card: card.name,
          orientation: card.isReversed ? 'Reversed' : 'Upright',
          meaning: meaningText,
          number: card.number
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
          reflectionsText
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
      setPersonalReading(formatted);
    } catch (error) {
      console.error('generatePersonalReading error:', error);
      const errorMsg = 'Unable to generate reading at this time. Please try again in a moment.';
      setPersonalReading(formatReading(errorMsg));
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 text-amber-50">
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
              <div className="text-amber-200 text-sm">
                <span className="font-semibold">Service Status:</span> {apiHealthBanner.message}
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
                setAnalyzingText={setAnalyzingText}
                setIsGenerating={setIsGenerating}
                setDealIndex={setDealIndex}
                setReflections={setReflections}
                setHasKnocked={setHasKnocked}
                setHasCut={setHasCut}
                setCutIndex={setCutIndex}
                knockTimesRef={knockTimesRef}
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
              <div className="bg-indigo-900/40 backdrop-blur rounded-lg p-6 border border-amber-500/30 space-y-4">
                <h3 className="text-lg font-serif text-amber-200 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Spread Highlights
                </h3>
                <div className="space-y-3 text-amber-100/85 text-sm leading-relaxed">
                 <div className="flex items-start gap-3">
                   <div className="text-amber-300 mt-1">-</div>
                   <div>
                     <span className="font-semibold text-amber-200">Deck scope:</span>{' '}
                     Major Arcana focus (archetypal themes).
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
                       <div className="text-purple-400 mt-1">-</div>
                       <div>
                         <span className="font-semibold text-purple-300">
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
                  className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 rounded-lg shadow-lg transition-all flex items-center gap-3 mx-auto text-lg"
                >
                  <Sparkles className={`w-5 h-5 ${isGenerating ? 'motion-safe:animate-pulse' : ''}`} />
                  {isGenerating
                    ? 'Weaving your personalized reflection from this spread...'
                    : 'Get Personalized Reading'}
                </button>
                <p className="text-purple-300/75 text-sm mt-3">
                  Reveal all cards to unlock your personalized narrative. Use it as reflection, not fixed prediction.
                </p>
              </div>
            )}

            {/* Analyzing Preview */}
            {isGenerating && analyzingText && (
              <div className="max-w-3xl mx-auto text-center">
                <div className="bg-purple-900/40 backdrop-blur rounded-lg p-6 border border-purple-500/30">
                  <div className="text-purple-200/90 text-sm whitespace-pre-line italic" aria-live="polite">
                    {analyzingText}
                  </div>
                  <p className="text-purple-200/70 text-[11px] mt-2">
                    This reflection is generated from your spread and question to support insight, not to decide for you.
                  </p>
                </div>
              </div>
            )}

            {/* Personal Reading Display */}
            {personalReading && (
              <div className="bg-gradient-to-r from-purple-900/60 to-indigo-900/60 backdrop-blur rounded-lg p-8 border border-amber-500/40 max-w-3xl mx-auto">
                <h3 className="text-2xl font-serif text-amber-200 mb-2 flex items-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  Your Personal Reading
                </h3>
                <p className="text-amber-200/70 text-xs mb-4">
                  A narrative mirror for reflection, not a fixed prediction. Let it support your own judgment and agency.
                </p>
                {userQuestion && (
                  <div className="bg-indigo-950/60 rounded-lg p-4 mb-4 border border-amber-500/20">
                    <p className="text-amber-300/80 text-sm italic">Question: {userQuestion}</p>
                  </div>
                )}
                {/* Render normalized text as natural paragraphs */}
                <div className="text-amber-100/90 leading-relaxed space-y-4">
                  {personalReading.paragraphs && personalReading.paragraphs.length > 0 ? (
                    personalReading.paragraphs.map((para, idx) => (
                      <p key={idx} className="text-base leading-loose">
                        {para}
                      </p>
                    ))
                  ) : (
                    <p className="text-base leading-loose whitespace-pre-line">
                      {personalReading.normalized || personalReading.raw || ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => {
                      // Use raw markdown - audio.js will normalize and prepare for TTS
                      void speak(personalReading.raw || personalReading.normalized || '', 'full-reading');
                    }}
                    className="px-4 py-2 rounded-lg border border-amber-500/40 bg-indigo-950/60 hover:bg-indigo-900/60 disabled:opacity-40"
                    disabled={!voiceOn}
                    title={voiceOn ? 'Read aloud' : 'Enable Reader voice above'}
                  >
                    Read this aloud
                  </button>
                </div>
                <div className="mt-6 pt-6 border-t border-amber-500/20 flex flex-col gap-3 items-center">
                  <p className="text-amber-200/70 text-xs italic text-center">
                    This reading considered card combinations, positions, emotional arcs, and your reflections to provide
                    personalized guidance.
                  </p>
                  <button
                    onClick={saveReading}
                    className="mt-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-indigo-950 font-semibold px-6 py-3 rounded-lg shadow-lg transition-all"
                  >
                    Save to Journal
                  </button>
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
              <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/60 backdrop-blur rounded-lg p-6 border border-amber-500/30 max-w-2xl mx-auto">
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