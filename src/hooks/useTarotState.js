import { useState, useRef, useEffect, useCallback } from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { computeSeed, drawSpread } from '../lib/deck';
import { playFlip, unlockAudio } from '../lib/audio';
import { DEFAULT_SPREAD_KEY, normalizeSpreadKey, getSpreadInfo } from '../data/spreads';
import { usePreferences } from '../contexts/PreferencesContext';
import { getSpreadFromDepth } from '../utils/personalization';

const SKIP_RITUAL_DEFAULTS = {
  knockTimes: [100, 200, 300],
  knockCount: 3
};

export function useTarotState(speak) {
  const { includeMinors, deckSize, personalization } = usePreferences();
  const [selectedSpreadState, setSelectedSpreadState] = useState(DEFAULT_SPREAD_KEY);
  const [hasUserSelectedSpread, setHasUserSelectedSpread] = useState(false);
  const selectedSpread = normalizeSpreadKey(selectedSpreadState);
  const setSelectedSpread = useCallback((nextKey) => {
    setSelectedSpreadState(normalizeSpreadKey(nextKey));
  }, []);
  const [reading, setReading] = useState(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [revealedCards, setRevealedCards] = useState(new Set());
  const [dealIndex, setDealIndex] = useState(0);

  const [hasKnocked, setHasKnocked] = useState(false);
  const [knockCount, setKnockCount] = useState(0);
  const [hasCut, setHasCut] = useState(false);
  const [cutIndex, setCutIndex] = useState(Math.floor(deckSize / 2));
  const [hasConfirmedSpread, setHasConfirmedSpread] = useState(false);
  const [sessionSeed, setSessionSeed] = useState(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [deckAnnouncement, setDeckAnnouncement] = useState('');

  const knockTimesRef = useRef([]);
  const shuffleTimeoutRef = useRef(null);
  const deckAnnouncementTimeoutRef = useRef(null);
  const deckSizeInitializedRef = useRef(false);
  const shouldSkipRitual = personalization?.showRitualSteps === false;

  // Keep cut index centered on active deck and announce deck scope changes
  useEffect(() => {
    const scheduleReset = () => {
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
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      const frameId = window.requestAnimationFrame(scheduleReset);
      return () => window.cancelAnimationFrame(frameId);
    }

    const timeoutId = setTimeout(scheduleReset, 0);
    return () => clearTimeout(timeoutId);
  }, [deckSize]);

  useEffect(() => {
    return () => {
      if (deckAnnouncementTimeoutRef.current) {
        clearTimeout(deckAnnouncementTimeoutRef.current);
      }
      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current);
      }
    };
  }, []);

  const handleKnock = useCallback(() => {
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
  }, [hasKnocked]);

  const applyCut = useCallback(() => {
    setHasCut(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
  }, []);

  const onSpreadConfirm = useCallback((key) => {
    setHasConfirmedSpread(true);
    if (key) {
      // spreadSelector handles setSelectedSpread, but we can ensure sync if needed
      // though strictly spreadSelector could call this just to flag confirmation
    }
  }, []);

  const resetReadingState = useCallback((resetQuestion = false) => {
    // Does NOT reset userQuestion unless specified, to preserve intention
    setReading(null);
    setRevealedCards(new Set());
    setDealIndex(0);
    setHasKnocked(false);
    setKnockCount(0);
    setHasCut(false);
    setSessionSeed(null);
    knockTimesRef.current = [];
    if (resetQuestion) {
      setUserQuestion('');
    }
  }, []);

  useEffect(() => {
    if (!hasUserSelectedSpread && personalization?.preferredSpreadDepth) {
      const preferred = getSpreadFromDepth(personalization.preferredSpreadDepth);
      setSelectedSpreadState(preferred);
    }
  }, [hasUserSelectedSpread, personalization?.preferredSpreadDepth]);

  const selectSpread = useCallback((key) => {
    setHasUserSelectedSpread(true);
    setSelectedSpread(key);
    resetReadingState(false); // Keep question
    // Reset cut index to deck center
    setCutIndex(Math.floor(deckSize / 2));
  }, [setSelectedSpread, resetReadingState, deckSize]);

  const shuffle = useCallback((onShuffleComplete) => {
    const currentSpread = selectedSpread;

    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current);
    }

    setIsShuffling(true);
    if (!hasConfirmedSpread) {
      setHasConfirmedSpread(true);
    }

    resetReadingState(false);
    if (onShuffleComplete) onShuffleComplete(); // Callback to clear external state like vision/analysis

    if (typeof performance !== 'undefined') {
      const now = performance.now();
      knockTimesRef.current = knockTimesRef.current.filter(timestamp => now - timestamp < 2000);
    }

    let effectiveKnockTimes = knockTimesRef.current;
    let effectiveCutIndex = cutIndex;
    const shouldAutoComplete = shouldSkipRitual && !hasKnocked;

    if (shouldAutoComplete) {
      effectiveKnockTimes = [...SKIP_RITUAL_DEFAULTS.knockTimes];
      effectiveCutIndex = Math.floor(deckSize / 2);
      knockTimesRef.current = effectiveKnockTimes;
      setCutIndex(effectiveCutIndex);
    }

    const seed = computeSeed({
      cutIndex: effectiveCutIndex,
      knockTimes: effectiveKnockTimes,
      userQuestion
    });

    // Use deterministic seed when the user performs any ritual or sets a question.
    const useSeed = Boolean(hasKnocked || hasCut || (userQuestion && userQuestion.trim()) || shouldAutoComplete);
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

      if (shouldAutoComplete) {
        setKnockCount(SKIP_RITUAL_DEFAULTS.knockCount);
        setHasKnocked(true);
        setHasCut(true);
      }
    }, 1200);
  }, [selectedSpread, hasConfirmedSpread, hasKnocked, hasCut, userQuestion, cutIndex, includeMinors, resetReadingState, shouldSkipRitual, deckSize]);

  const shortLineForCard = useCallback((card, position) => {
    const meaning = card.isReversed ? card.reversed : card.upright;
    const first = meaning.split(',')[0];
    return `${position}: ${card.name} - ${first}.`;
  }, []);

  const dealNext = useCallback(() => {
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

    const spreadInfo = getSpreadInfo(selectedSpread);
    const position = spreadInfo?.positions?.[next] || `Position ${next + 1}`;

    if (speak) {
      void speak(shortLineForCard(reading[next], position), 'card-reveal');
    }
  }, [reading, dealIndex, selectedSpread, speak, shortLineForCard]);

  const revealCard = useCallback((index) => {
    if (!reading || !reading[index]) return;
    if (revealedCards.has(index)) return;

    void unlockAudio();
    setRevealedCards(prev => new Set([...prev, index]));
    setDealIndex(prev => Math.max(prev, index + 1));

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
    playFlip();

    const spreadInfo = getSpreadInfo(selectedSpread);
    const position = spreadInfo?.positions?.[index] || `Position ${index + 1}`;

    if (speak) {
      void speak(shortLineForCard(reading[index], position), 'card-reveal');
    }
  }, [reading, revealedCards, selectedSpread, speak, shortLineForCard]);

  const revealAll = useCallback(() => {
    if (!reading || reading.length === 0) return;
    const allIndices = new Set(Array.from({ length: reading.length }, (_, index) => index));
    setRevealedCards(allIndices);
    setDealIndex(reading.length);
  }, [reading]);

  return {
    selectedSpread,
    setSelectedSpread,
    selectSpread,
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
    setSessionSeed,
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
    knockTimesRef,
    shouldSkipRitual
  };
}
