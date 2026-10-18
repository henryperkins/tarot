import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { computeSeed, drawSpread } from '../lib/deck';
import { playFlip, unlockAudio } from '../lib/audio';
import { DEFAULT_SPREAD_KEY, normalizeSpreadKey, getSpreadInfo } from '../data/spreads';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { useHaptic } from './useHaptic';
import {
  GUEST_DRAFT_OWNER,
  clearQuestionDraft,
  getQuestionDraftOwner,
  loadQuestionDraft,
  saveQuestionDraft
} from '../lib/questionDraft';
import { clearReadingSnapshot, loadReadingSnapshot, snapshotBelongsTo } from '../lib/readingSnapshot';
import { getSpreadFromDepth } from '../utils/personalization';
import { resolveFallbackSpreadKey } from '../utils/spreadEntitlements';
import { getKnownDeckStyleId, getSnapshotDeckStyleId } from '../lib/readingDeck.js';

const SKIP_RITUAL_DEFAULTS = {
  knockTimes: [100, 200, 300],
  knockCount: 3
};

export function useTarotState(speak) {
  const { includeMinors, deckSize, personalization, deckStyleId } = usePreferences();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { user, loading: authLoading } = useAuth();
  const { vibrate } = useHaptic();
  const questionDraftOwner = getQuestionDraftOwner(user?.id || null);
  // A reading interrupted by a reload, a discarded tab or a sign-in redirect
  // resumes where it was (see lib/readingSnapshot). The owner is checked once
  // auth settles; restoring first avoids flashing the setup screen.
  const [initialSnapshot] = useState(() => loadReadingSnapshot());
  const [selectedSpreadState, setSelectedSpreadState] = useState(() => initialSnapshot?.spreadKey || DEFAULT_SPREAD_KEY);
  const [hasUserSelectedSpread, setHasUserSelectedSpread] = useState(() => Boolean(initialSnapshot));
  const autoSelectedSpread = (!hasUserSelectedSpread && personalization?.preferredSpreadDepth)
    ? getSpreadFromDepth(personalization.preferredSpreadDepth)
    : null;
  const selectedSpread = normalizeSpreadKey(autoSelectedSpread || selectedSpreadState);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleTimeoutRef = useRef(null);
  const shuffleGenerationRef = useRef(0);
  const invalidatePendingShuffle = useCallback(() => {
    shuffleGenerationRef.current += 1;
    if (shuffleTimeoutRef.current !== null) clearTimeout(shuffleTimeoutRef.current);
    shuffleTimeoutRef.current = null;
  }, []);
  const cancelShuffle = useCallback(() => {
    invalidatePendingShuffle();
    setIsShuffling(false);
  }, [invalidatePendingShuffle]);
  const setSelectedSpread = useCallback((nextKey) => {
    cancelShuffle();
    setSelectedSpreadState(normalizeSpreadKey(nextKey));
  }, [cancelShuffle]);
  const [draw, setDraw] = useState(() => ({
    reading: initialSnapshot?.reading ?? null,
    drawIncludeMinors: initialSnapshot?.drawIncludeMinors ?? null,
    drawDeckStyleId: getSnapshotDeckStyleId(initialSnapshot)
  }));
  const { reading, drawIncludeMinors, drawDeckStyleId } = draw;
  const readingDeckStyleId = reading
    ? drawDeckStyleId || 'rws-1909'
    : getKnownDeckStyleId(deckStyleId) || 'rws-1909';
  // Keep scope and cards atomic. Imported/legacy readings have unknown scope
  // unless their saved metadata explicitly records it.
  const setReading = useCallback((cards, includeMinorsAtDraw = null, deckAtDraw = null) => {
    cancelShuffle();
    setDraw(current => ({
      reading: typeof cards === 'function' ? cards(current.reading) : cards,
      drawIncludeMinors: typeof includeMinorsAtDraw === 'boolean' ? includeMinorsAtDraw : null,
      drawDeckStyleId: getKnownDeckStyleId(deckAtDraw)
    }));
  }, [cancelShuffle]);
  const [revealedCards, setRevealedCards] = useState(() => new Set(initialSnapshot?.revealed || []));
  const [isSpreadDealt, setIsSpreadDealt] = useState(() => Boolean(initialSnapshot?.isSpreadDealt));
  const [dealIndex, setDealIndex] = useState(() => initialSnapshot?.dealIndex ?? 0);

  const [hasKnocked, setHasKnocked] = useState(() => Boolean(initialSnapshot?.ritual?.hasKnocked));
  const [knockCount, setKnockCount] = useState(() => initialSnapshot?.ritual?.knockCount ?? 0);
  const [hasCut, setHasCut] = useState(() => Boolean(initialSnapshot?.ritual?.hasCut));
  const [cutIndex, setCutIndex] = useState(() => (
    Number.isInteger(initialSnapshot?.ritual?.cutIndex) ? initialSnapshot.ritual.cutIndex : Math.floor(deckSize / 2)
  ));
  const [hasConfirmedSpread, setHasConfirmedSpread] = useState(() => Boolean(initialSnapshot?.hasConfirmedSpread));
  const [sessionSeed, setSessionSeed] = useState(() => initialSnapshot?.sessionSeed ?? null);
  const [userQuestion, setUserQuestion] = useState(() => initialSnapshot?.question || '');
  const [deckAnnouncement, setDeckAnnouncement] = useState('');
  // Knocks have no time limit; the value stays 0 for the ritual controls that read it.
  const knockCadenceResetAt = 0;
  const questionDraftSyncRef = useRef({ restored: false, owner: null });
  const [restoreReady, setRestoreReady] = useState(false);
  const [snapshotRevision, setSnapshotRevision] = useState(0);

  const knockTimesRef = useRef(initialSnapshot?.ritual?.knockTimes || []);
  const deckAnnouncementTimeoutRef = useRef(null);
  const deckSizeInitializedRef = useRef(false);
  const restoredCutIndexRef = useRef(Number.isInteger(initialSnapshot?.ritual?.cutIndex));
  const shouldSkipRitual = personalization?.showRitualSteps === false;

  // Invalidate before timers can run after a committed owner/spread change,
  // including automatic spread selection that does not use the public setter.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cancel work belonging to the previous committed context
    cancelShuffle();
  }, [selectedSpread, questionDraftOwner, authLoading, cancelShuffle]);

  // Keep the question someone is writing through a reload, for this tab only
  // (see lib/questionDraft). Restore once auth has settled, so one account's
  // question never shows while another is still loading.
  useEffect(() => {
    if (authLoading) return;
    const sync = questionDraftSyncRef.current;
    if (!sync.restored) {
      sync.restored = true;
      sync.owner = questionDraftOwner;
      if (initialSnapshot && !snapshotBelongsTo(initialSnapshot, questionDraftOwner)) {
        // Another account's reading must never stay on screen.
        clearReadingSnapshot();
        // eslint-disable-next-line react-hooks/set-state-in-effect -- drops a restored reading once auth settles
        setReading(null);
        setIsSpreadDealt(false);
        setRevealedCards(new Set());
        setDealIndex(0);
        setSessionSeed(null);
        setUserQuestion('');
        knockTimesRef.current = [];
        setSnapshotRevision(revision => revision + 1);
      }
      const draft = loadQuestionDraft(questionDraftOwner);
      if (draft) {
        // A question set meanwhile (a journal suggestion, a typed word) wins.
        setUserQuestion(current => current || draft);
      }
      setRestoreReady(true);
      return;
    }
    if (sync.owner === questionDraftOwner) return;
    const previousOwner = sync.owner;
    sync.owner = questionDraftOwner;
    // Signing in keeps the question; signing out or switching accounts forgets it.
    if (previousOwner !== GUEST_DRAFT_OWNER) {
      clearQuestionDraft();
      clearReadingSnapshot();
      setUserQuestion('');
      setReading(null);
      setIsSpreadDealt(false);
      setRevealedCards(new Set());
      setDealIndex(0);
      setSessionSeed(null);
      setHasConfirmedSpread(false);
      setHasKnocked(false);
      setKnockCount(0);
      setHasCut(false);
      knockTimesRef.current = [];
      setSnapshotRevision(revision => revision + 1);
    }
  }, [authLoading, questionDraftOwner, initialSnapshot, setReading]);

  useEffect(() => {
    if (!questionDraftSyncRef.current.restored) return;
    saveQuestionDraft(questionDraftOwner, userQuestion);
  }, [questionDraftOwner, userQuestion]);

  // Keep cut index centered on active deck and announce deck scope changes
  useEffect(() => {
    const scheduleReset = () => {
      const nextCutIndex = Math.floor(deckSize / 2);

      if (!deckSizeInitializedRef.current) {
        deckSizeInitializedRef.current = true;
        // A restored cut is part of that reading's seed; keep it.
        if (!restoredCutIndexRef.current) setCutIndex(nextCutIndex);
        return;
      }

      setCutIndex(nextCutIndex);
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
      invalidatePendingShuffle();
    };
  }, [invalidatePendingShuffle]);

  // Three knocks at the person's own pace. The times still seed the draw, but
  // there is no deadline: a slow tapper, VoiceOver or Switch Control user
  // completes the ritual the same way as anyone else.
  const handleKnock = useCallback(() => {
    if (hasKnocked) return;
    if (typeof performance === 'undefined') return;
    const knocks = [...knockTimesRef.current, performance.now()].slice(-3);
    knockTimesRef.current = knocks;
    setKnockCount(knocks.length);
    if (knocks.length >= 3) {
      setHasKnocked(true);
      vibrate([18, 40, 18]);
    }
  }, [hasKnocked, vibrate]);

  const applyCut = useCallback(() => {
    setHasCut(true);
    vibrate(12);
  }, [vibrate]);

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
    setIsSpreadDealt(false);
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
  }, [setReading]);

  const selectSpread = useCallback((key) => {
    setHasUserSelectedSpread(true);
    setSelectedSpread(key);
    resetReadingState(false); // Keep question
    // Reset cut index to deck center
    setCutIndex(Math.floor(deckSize / 2));
  }, [setSelectedSpread, resetReadingState, deckSize]);

  // Enforce spread entitlements (e.g., after logout/downgrade) to avoid hitting
  // the reading API with a spread that isn't available on the current plan.
  useEffect(() => {
    if (subscriptionLoading) return;
    if (!subscription?.canUseSpread) return;
    if (subscription.canUseSpread(selectedSpread)) return;

    const fallbackKey = resolveFallbackSpreadKey(selectedSpread, subscription?.config?.spreads);
    if (!fallbackKey || fallbackKey === selectedSpread) return;
    // Defer to next frame to avoid synchronous setState cascade
    requestAnimationFrame(() => selectSpread(fallbackKey));
  }, [subscriptionLoading, subscription, selectedSpread, selectSpread]);

  const shuffle = useCallback((onShuffleComplete) => {
    const currentSpread = selectedSpread;
    if (!hasConfirmedSpread) {
      setHasConfirmedSpread(true);
    }

    resetReadingState(false);
    // Reset intentionally invalidates the previous generation; this draw owns
    // the new one. External reset/replacement can invalidate it immediately.
    const generation = shuffleGenerationRef.current;
    setIsShuffling(true);
    if (onShuffleComplete) onShuffleComplete(); // Callback to clear external state like vision/analysis
    if (generation !== shuffleGenerationRef.current) return;

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
      if (generation !== shuffleGenerationRef.current) return;
      setReading(cards, includeMinors, getKnownDeckStyleId(deckStyleId) || 'rws-1909');
      setIsShuffling(false);
      setSessionSeed(nextSessionSeed);

      if (shouldAutoComplete) {
        setKnockCount(SKIP_RITUAL_DEFAULTS.knockCount);
        setHasKnocked(true);
        setHasCut(true);
      }
    }, 1200);
  }, [selectedSpread, hasConfirmedSpread, hasKnocked, hasCut, userQuestion, cutIndex, includeMinors, deckStyleId, resetReadingState, shouldSkipRitual, deckSize, setReading]);

  const shortLineForCard = useCallback((card, position) => {
    const meaning = card.isReversed ? card.reversed : card.upright;
    const first = meaning.split(',')[0];
    return `${position}: ${card.name} - ${first}.`;
  }, []);

  const dealSpread = useCallback(() => {
    if (!reading?.length || isShuffling || isSpreadDealt) return;
    // Ritual choices made at the table are applied when its cards are committed.
    const useSeed = Boolean(hasKnocked || hasCut || userQuestion.trim() || shouldSkipRitual);
    const seed = computeSeed({ cutIndex, knockTimes: knockTimesRef.current, userQuestion });
    setReading(drawSpread({ spreadKey: selectedSpread, useSeed, seed, includeMinors }), includeMinors, getKnownDeckStyleId(deckStyleId) || 'rws-1909');
    setSessionSeed(useSeed ? seed : null);
    setIsSpreadDealt(true);
  }, [reading, isShuffling, isSpreadDealt, hasKnocked, hasCut, userQuestion, shouldSkipRitual, cutIndex, selectedSpread, includeMinors, deckStyleId, setReading]);

  const resetReveals = useCallback(() => {
    setRevealedCards(new Set());
    setDealIndex(0);
  }, []);

  const dealNext = useCallback(() => {
    if (!reading || !isSpreadDealt) return;
    const spreadInfo = getSpreadInfo(selectedSpread);
    const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : reading.length;
    const next = reading.findIndex((_, index) => index < maxCards && !revealedCards.has(index));
    if (next < 0) return;

    void unlockAudio();
    setRevealedCards(prev => new Set([...prev, next]));
    setDealIndex(prev => Math.max(prev, next + 1));

    vibrate(10);
    playFlip();

    const position = spreadInfo?.positions?.[next] || `Position ${next + 1}`;

    if (speak) {
      void speak(shortLineForCard(reading[next], position), 'card-reveal');
    }
  }, [reading, isSpreadDealt, revealedCards, selectedSpread, speak, shortLineForCard, vibrate]);

  const revealCard = useCallback((index) => {
    if (!reading || !isSpreadDealt || !reading[index]) return;
    if (revealedCards.has(index)) return;
    const spreadInfo = getSpreadInfo(selectedSpread);
    const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : reading.length;
    if (index >= maxCards) return;

    void unlockAudio();
    setRevealedCards(prev => new Set([...prev, index]));
    setDealIndex(prev => Math.max(prev, index + 1));

    vibrate(10);
    playFlip();

    const position = spreadInfo?.positions?.[index] || `Position ${index + 1}`;

    if (speak) {
      void speak(shortLineForCard(reading[index], position), 'card-reveal');
    }
  }, [reading, isSpreadDealt, revealedCards, selectedSpread, speak, shortLineForCard, vibrate]);

  const revealAll = useCallback(() => {
    if (!reading || !isSpreadDealt || reading.length === 0) return;
    const spreadInfo = getSpreadInfo(selectedSpread);
    const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : reading.length;
    const visibleCount = Math.min(reading.length, maxCards);
    const allIndices = new Set(Array.from({ length: visibleCount }, (_, index) => index));
    setRevealedCards(allIndices);
    setDealIndex(visibleCount);
  }, [reading, isSpreadDealt, selectedSpread]);

  return {
    selectedSpread,
    setSelectedSpread,
    selectSpread,
    reading,
    drawIncludeMinors,
    drawDeckStyleId,
    readingDeckStyleId,
    setReading,
    isShuffling,
    isSpreadDealt,
    setIsSpreadDealt,
    dealSpread,
    resetReveals,
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
    knockCadenceResetAt,
    shuffle,
    handleKnock,
    applyCut,
    dealNext,
    revealCard,
    revealAll,
    onSpreadConfirm,
    resetReadingState,
    knockTimesRef,
    shouldSkipRitual,
    // Reading snapshot plumbing for ReadingContext (lib/readingSnapshot).
    initialSnapshot,
    snapshotOwner: questionDraftOwner,
    hasUserSelectedSpread,
    restoreReady,
    snapshotRevision
  };
}
