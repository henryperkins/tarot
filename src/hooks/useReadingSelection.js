import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useReadingSelection({
    readingIdentity,
    reading,
    revealedCards,
    visibleCount,
    spreadPositions,
    prefersReducedMotion,
    notifyCardMention
}) {
    const [selectionState, setSelectionState] = useState({ key: readingIdentity, value: null });
    const [mentionPulseState, setMentionPulseState] = useState({ key: readingIdentity, value: null });
    const mentionPulseRef = useRef(0);
    const mentionPulseTimeoutRef = useRef(null);
    const [focusedCardData, setFocusedCardData] = useState(null);
    const [recentlyClosedIndex, setRecentlyClosedIndex] = useState(-1);
    const recentlyClosedTimeoutRef = useRef(null);

    const selectedCardData = selectionState.key === readingIdentity ? selectionState.value : null;
    const setSelectedCardData = useCallback((value) => {
        setSelectionState({ key: readingIdentity, value });
    }, [readingIdentity]);

    const narrativeMentionPulse = mentionPulseState.key === readingIdentity ? mentionPulseState.value : null;
    const setNarrativeMentionPulse = useCallback((value) => {
        setMentionPulseState({ key: readingIdentity, value });
    }, [readingIdentity]);

    const activeFocusedCardData = useMemo(() => {
        if (!focusedCardData) return null;
        if (focusedCardData.readingKey && focusedCardData.readingKey !== readingIdentity) return null;
        if (!revealedCards.has(focusedCardData.index)) return null;
        return focusedCardData;
    }, [focusedCardData, readingIdentity, revealedCards]);

    const handleNarrativeHighlight = useCallback((phrase) => {
        if (!phrase || !Array.isArray(reading) || visibleCount === 0) return;
        const normalized = phrase.toLowerCase();
        const matchIndex = reading.findIndex((card) => (
            typeof card?.name === 'string' && card.name.toLowerCase() === normalized
        ));
        if (matchIndex < 0 || matchIndex >= visibleCount) return;

        mentionPulseRef.current += 1;
        setNarrativeMentionPulse({ id: mentionPulseRef.current, index: matchIndex });
        notifyCardMention?.(matchIndex);

        if (mentionPulseTimeoutRef.current) {
            window.clearTimeout(mentionPulseTimeoutRef.current);
        }
        mentionPulseTimeoutRef.current = window.setTimeout(() => {
            setNarrativeMentionPulse(null);
            mentionPulseTimeoutRef.current = null;
        }, 1100);
    }, [reading, visibleCount, setNarrativeMentionPulse, notifyCardMention]);

    const handleCardClick = useCallback((card, position, index) => {
        if (!revealedCards.has(index)) return;
        const payload = { card, position, index, readingKey: readingIdentity };
        setFocusedCardData(payload);
    }, [revealedCards, readingIdentity]);

    const handleOpenModalFromPanel = useCallback((cardData) => {
        if (!cardData) return;
        setSelectedCardData(cardData);
    }, [setSelectedCardData]);

    const handleCloseDetail = useCallback(() => {
        if (!focusedCardData) {
            if (recentlyClosedTimeoutRef.current) {
                window.clearTimeout(recentlyClosedTimeoutRef.current);
                recentlyClosedTimeoutRef.current = null;
            }
            setSelectedCardData(null);
            return;
        }

        const idx = focusedCardData.index;
        setFocusedCardData(null);
        setSelectedCardData(null);
        setRecentlyClosedIndex(idx);

        if (recentlyClosedTimeoutRef.current) {
            window.clearTimeout(recentlyClosedTimeoutRef.current);
        }

        const target = document.getElementById(`spread-slot-${idx}`);
        if (target?.scrollIntoView) {
            target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'center' });
        }

        recentlyClosedTimeoutRef.current = window.setTimeout(() => {
            setRecentlyClosedIndex(-1);
            recentlyClosedTimeoutRef.current = null;
        }, 900);
    }, [focusedCardData, prefersReducedMotion, setSelectedCardData]);

    const revealedIndicesSorted = useMemo(() => {
        if (!reading || !revealedCards) return [];
        return Array.from(revealedCards).sort((a, b) => a - b);
    }, [reading, revealedCards]);

    const navigationData = useMemo(() => {
        const currentIndex = activeFocusedCardData?.index ?? selectedCardData?.index ?? -1;
        if (currentIndex < 0 || revealedIndicesSorted.length === 0) {
            return { canPrev: false, canNext: false, label: '', currentPos: -1 };
        }

        const posInList = revealedIndicesSorted.indexOf(currentIndex);
        if (posInList < 0) {
            return { canPrev: false, canNext: false, label: '', currentPos: -1 };
        }

        const canPrev = posInList > 0;
        const canNext = posInList < revealedIndicesSorted.length - 1;
        const label = `${posInList + 1} of ${revealedIndicesSorted.length}`;
        return { canPrev, canNext, label, currentPos: posInList };
    }, [activeFocusedCardData, selectedCardData, revealedIndicesSorted]);

    const handleNavigateCard = useCallback((direction) => {
        const { currentPos, canPrev, canNext } = navigationData;
        if (currentPos < 0) return;

        let nextPos = currentPos;
        if (direction === 'prev' && canPrev) {
            nextPos = currentPos - 1;
        } else if (direction === 'next' && canNext) {
            nextPos = currentPos + 1;
        } else {
            return;
        }

        const nextIndex = revealedIndicesSorted[nextPos];
        if (nextIndex == null || !reading?.[nextIndex]) return;

        const card = reading[nextIndex];
        const position = spreadPositions?.[nextIndex] || `Position ${nextIndex + 1}`;
        const payload = { card, position, index: nextIndex, readingKey: readingIdentity };

        if (activeFocusedCardData) {
            setFocusedCardData(payload);
        }
        if (selectedCardData) {
            setSelectedCardData(payload);
        }
    }, [
        navigationData,
        revealedIndicesSorted,
        reading,
        spreadPositions,
        readingIdentity,
        activeFocusedCardData,
        selectedCardData,
        setSelectedCardData
    ]);

    useEffect(() => () => {
        if (mentionPulseTimeoutRef.current) {
            window.clearTimeout(mentionPulseTimeoutRef.current);
        }
        if (recentlyClosedTimeoutRef.current) {
            window.clearTimeout(recentlyClosedTimeoutRef.current);
            recentlyClosedTimeoutRef.current = null;
        }
    }, []);

    return {
        selectedCardData,
        setSelectedCardData,
        narrativeMentionPulse,
        activeFocusedCardData,
        recentlyClosedIndex,
        handleNarrativeHighlight,
        handleCardClick,
        handleOpenModalFromPanel,
        handleCloseDetail,
        navigationData,
        handleNavigateCard
    };
}
