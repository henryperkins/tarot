import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

/**
 * Which spread cards the reading is speaking about right now.
 *
 * The reading text reports what it reaches (scroll position, live stream or a
 * pointer on a card name); the spread companion and the inline card plates
 * read the result. State and API live in separate contexts so the Markdown
 * body, which only reports, never re-renders when the focus moves.
 */
const FocusStateContext = createContext(null);
const FocusApiContext = createContext(null);

// A paragraph that names several cards sweeps across them in order, the way a
// reader's hand passes over the spread while summarizing it.
const SWEEP_STEP_MS = 420;

function sameFocus(a, b) {
  return (a?.key ?? null) === (b?.key ?? null);
}

export function NarrativeCardFocusProvider({
  cards = [],
  onSelectCard,
  stable = false,
  children
}) {
  const prefersReducedMotion = useReducedMotion();
  const calm = Boolean(prefersReducedMotion || stable);
  const [scrollFocus, setScrollFocus] = useState(null);
  const [pointerFocus, setPointerFocus] = useState(null);
  const [sweep, setSweep] = useState({ key: null, step: 0 });
  const containerRef = useRef(null);
  const onSelectCardRef = useRef(onSelectCard);

  useEffect(() => {
    onSelectCardRef.current = onSelectCard;
  }, [onSelectCard]);

  const focus = pointerFocus || scrollFocus;

  useEffect(() => {
    if (!focus || focus.mode !== 'sweep' || calm) return undefined;
    const timers = focus.cards.map((_, step) => window.setTimeout(() => {
      setSweep({ key: focus.key, step: step + 1 });
    }, SWEEP_STEP_MS * (step + 1)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [focus, calm]);

  const api = useMemo(() => ({
    setScrollFocus(next) {
      setScrollFocus((previous) => (sameFocus(previous, next) ? previous : next));
    },
    setPointerFocus(next) {
      setPointerFocus((previous) => (sameFocus(previous, next) ? previous : next));
    },
    clearPointerFocus() {
      setPointerFocus(null);
    },
    registerContainer(element) {
      containerRef.current = element;
    },
    // Hovering a card in the spread marks where the text speaks about it.
    setSpreadHover(index) {
      const container = containerRef.current;
      if (!container) return;
      if (Number.isInteger(index)) container.dataset.spreadHover = String(index);
      else delete container.dataset.spreadHover;
    },
    selectCard(index) {
      onSelectCardRef.current?.(index);
    }
  }), []);

  const cardStates = useMemo(() => {
    if (!focus) return null;
    const step = focus.mode === 'sweep' && !calm
      ? (sweep.key === focus.key ? sweep.step : 0)
      : Infinity;
    const touched = focus.mode === 'sweep'
      ? (step < focus.cards.length ? focus.cards[step] : null)
      : focus.primary;
    const states = new Map();
    for (const card of focus.cards) {
      states.set(card, {
        state: card === touched ? 'touched' : 'warm',
        touches: focus.touches?.[card] || []
      });
    }
    return { states, touched, key: `${focus.key}|${touched ?? 'all'}` };
  }, [focus, sweep, calm]);

  const state = useMemo(() => ({ cards, cardStates, calm }), [cards, cardStates, calm]);

  return (
    <FocusApiContext.Provider value={api}>
      <FocusStateContext.Provider value={state}>
        {children}
      </FocusStateContext.Provider>
    </FocusApiContext.Provider>
  );
}

/** Current focus for components that show the cards. */
// eslint-disable-next-line react-refresh/only-export-components -- Context + hook pattern is intentional
export function useNarrativeCardFocus() {
  return useContext(FocusStateContext);
}

/** Stable reporting API; null outside a provider. */
// eslint-disable-next-line react-refresh/only-export-components -- Context + hook pattern is intentional
export function useNarrativeCardFocusApi() {
  return useContext(FocusApiContext);
}
