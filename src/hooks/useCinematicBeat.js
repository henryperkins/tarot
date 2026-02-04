import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BEAT_CLASS_MAP = {
  opening: 'narrative-beat--opening',
  cards: 'narrative-beat--cards',
  pivot: 'narrative-beat--pivot',
  tension: 'narrative-beat--tension',
  resolution: 'narrative-beat--resolution',
  synthesis: 'narrative-beat--synthesis',
  guidance: 'narrative-beat--guidance'
};

const DEFAULT_BEAT_DURATION_MS = 900;

export function useCinematicBeat({ reasoning, totalCards = 0, durationMs = DEFAULT_BEAT_DURATION_MS, onBeat } = {}) {
  const [activeBeat, setActiveBeat] = useState('');
  const timeoutRef = useRef(null);

  const clearBeat = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveBeat('');
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    clearBeat();
  }, [clearBeat, reasoning, totalCards]);

  const triggerBeat = useCallback((beatKey) => {
    if (!beatKey) return;
    setActiveBeat(beatKey);
    onBeat?.(beatKey);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setActiveBeat('');
    }, durationMs);
  }, [durationMs, onBeat]);

  const pivotIndex = typeof reasoning?.pivotCard?.index === 'number'
    ? reasoning.pivotCard.index
    : null;

  const tensionPositions = useMemo(() => {
    const positions = new Set();
    const tensions = Array.isArray(reasoning?.tensions) ? reasoning.tensions : [];
    tensions.forEach((tension) => {
      if (!Array.isArray(tension?.positions)) return;
      tension.positions.forEach((pos) => {
        if (typeof pos === 'number') {
          positions.add(pos);
        }
      });
    });
    return positions;
  }, [reasoning]);

  const notifyCardMention = useCallback((index) => {
    if (typeof index !== 'number' || index < 0) return;

    if (pivotIndex !== null && index === pivotIndex) {
      triggerBeat('pivot');
      return;
    }

    if (tensionPositions.has(index)) {
      triggerBeat('tension');
      return;
    }

    if (totalCards > 0 && index === totalCards - 1) {
      triggerBeat('resolution');
    }
  }, [pivotIndex, tensionPositions, totalCards, triggerBeat]);

  const notifyCompletion = useCallback(() => {
    if (reasoning?.narrativeArc?.key && reasoning.narrativeArc.key !== 'unfolding') {
      triggerBeat('resolution');
      return;
    }
    triggerBeat('synthesis');
  }, [reasoning, triggerBeat]);

  const notifySectionEnter = useCallback((sectionKey) => {
    if (!sectionKey) return;
    switch (sectionKey) {
      case 'opening':
        triggerBeat('opening');
        break;
      case 'cards':
        triggerBeat('cards');
        break;
      case 'synthesis':
        triggerBeat('synthesis');
        break;
      case 'guidance':
        triggerBeat('guidance');
        break;
      default:
        break;
    }
  }, [triggerBeat]);

  const beatClassName = activeBeat ? (BEAT_CLASS_MAP[activeBeat] || '') : '';

  return {
    beatClassName,
    notifyCardMention,
    notifyCompletion,
    notifySectionEnter,
    clearBeat
  };
}
