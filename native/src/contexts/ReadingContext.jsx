import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ReadingContext = createContext(null);

export function ReadingProvider({ children }) {
  const [selectedSpread, setSelectedSpread] = useState(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [reading, setReading] = useState([]);
  const [revealedCards, setRevealedCards] = useState(new Set());
  const [isShuffling, setIsShuffling] = useState(false);
  const [knockCount, setKnockCount] = useState(0);
  const [hasCut, setHasCut] = useState(false);
  const [cutIndex, setCutIndex] = useState(null);
  const shuffleTimeoutRef = useRef(null);

  const revealCard = useCallback((index) => {
    setRevealedCards((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const resetReveals = useCallback(() => setRevealedCards(new Set()), []);

  const handleKnock = useCallback(() => {
    setKnockCount((prev) => Math.min(prev + 1, 3));
  }, []);

  const applyCut = useCallback((index) => {
    const nextIndex = typeof index === 'number'
      ? index
      : Math.floor(Math.random() * 3) + 1;
    setHasCut(true);
    setCutIndex(nextIndex);
  }, []);

  const resetRitual = useCallback(() => {
    setKnockCount(0);
    setHasCut(false);
    setCutIndex(null);
  }, []);

  const skipRitual = useCallback(() => {
    setKnockCount(3);
    setHasCut(true);
    setCutIndex((prev) => prev ?? 1);
  }, []);

  const dealNext = useCallback(() => {
    if (reading.length === 0) return;
    setRevealedCards((prev) => {
      const nextIndex = reading.findIndex((_, index) => !prev.has(index));
      if (nextIndex === -1) return prev;
      const next = new Set(prev);
      next.add(nextIndex);
      return next;
    });
  }, [reading]);

  const shuffleReading = useCallback(() => {
    resetReveals();
    resetRitual();
    setIsShuffling(true);

    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current);
    }
    shuffleTimeoutRef.current = setTimeout(() => {
      setIsShuffling(false);
      shuffleTimeoutRef.current = null;
    }, 300);
  }, [resetReveals, resetRitual]);

  useEffect(() => {
    return () => {
      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({
    selectedSpread,
    setSelectedSpread,
    userQuestion,
    setUserQuestion,
    reading,
    setReading,
    revealedCards,
    setRevealedCards,
    revealCard,
    resetReveals,
    dealNext,
    shuffleReading,
    knockCount,
    handleKnock,
    hasCut,
    cutIndex,
    applyCut,
    resetRitual,
    skipRitual,
    isShuffling,
    setIsShuffling
  }), [
    selectedSpread,
    userQuestion,
    reading,
    revealedCards,
    revealCard,
    resetReveals,
    dealNext,
    shuffleReading,
    knockCount,
    handleKnock,
    hasCut,
    cutIndex,
    applyCut,
    resetRitual,
    skipRitual,
    isShuffling
  ]);

  return (
    <ReadingContext.Provider value={value}>
      {children}
    </ReadingContext.Provider>
  );
}

export function useReading() {
  const context = useContext(ReadingContext);
  if (!context) {
    throw new Error('useReading must be used within ReadingProvider');
  }
  return context;
}
