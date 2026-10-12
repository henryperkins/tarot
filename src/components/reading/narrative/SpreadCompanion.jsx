import { useEffect, useRef, useState } from 'react';
import { CardTouchArt } from './CardTouchArt';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './NarrativeCardFocus';
import { railColumns } from './spreadCompanionLayout';
import '../../../styles/narrative-card-touch.css';

function cardLabel(card) {
  return `${card.positionLabel}: ${card.name}${card.isReversed ? ', reversed' : ''}`;
}

// Height over width of the deck's card frame ("16 / 31" is a Marseille card).
function frameRatio(frame) {
  const [width, height] = String(frame || '').split('/').map(Number);
  return width > 0 && height > 0 ? Number((height / width).toFixed(3)) : 1.72;
}

// The rail fits the whole spread into one screen.
function railVars(cards) {
  const cols = railColumns(cards.length);
  return { '--rail-cols': cols, '--rail-rows': Math.ceil(cards.length / cols), '--card-ratio': frameRatio(cards[0]?.frame) };
}

/**
 * Counts each time a card comes into the reader's hand, so the light that
 * crosses it plays once per arrival rather than once per paragraph.
 */
function useArrival(state) {
  const [arrival, setArrival] = useState({ count: 0, touched: false });
  const touched = state === 'touched';
  if (touched !== arrival.touched) {
    setArrival({ count: arrival.count + (touched ? 1 : 0), touched });
  }
  return arrival.count;
}

function RailCard({ card, focus, api }) {
  const state = focus.cardStates?.states.get(card.index)?.state || null;
  const arrival = useArrival(state);
  return (
    <li className="spread-companion__item" data-state={state || undefined}>
      <button
        type="button"
        className="spread-companion__card"
        data-state={state || undefined}
        aria-current={state === 'touched' ? 'true' : undefined}
        aria-label={`${cardLabel(card)}. Open card`}
        onClick={() => api?.selectCard(card.index)}
        onPointerEnter={() => api?.setSpreadHover(card.index)}
        onPointerLeave={() => api?.setSpreadHover(null)}
        onFocus={() => api?.setSpreadHover(card.index)}
        onBlur={() => api?.setSpreadHover(null)}
      >
        <CardTouchArt card={card} state={state} trace={focus.trace} touchKey={String(arrival)} calm={focus.calm} />
      </button>
      <span className="spread-companion__label" aria-hidden="true">
        {card.shortLabel}
        {card.isReversed ? <span className="spread-companion__orientation">Reversed</span> : null}
      </span>
    </li>
  );
}

/**
 * The querent's whole spread, kept beside the reading on wide screens.
 */
export function SpreadCompanion() {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const cards = focus?.cards || [];
  if (cards.length === 0) return null;

  return (
    <aside
      className="spread-companion spread-companion--rail"
      aria-label="Your cards"
      data-count={cards.length}
      data-cols={railColumns(cards.length)}
      data-focus={focus.cardStates ? 'true' : undefined}
      data-calm={focus.calm ? 'true' : undefined}
      style={railVars(cards)}
    >
      <ol className="spread-companion__list">
        {cards.map((card) => (
          <RailCard key={card.index} card={card} focus={focus} api={api} />
        ))}
      </ol>
    </aside>
  );
}

/**
 * The card set into the paragraph that opens its passage, so the picture sits
 * beside the words that describe it.
 */
export function CardTouchPlate({ cardIndex }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const card = focus?.cards?.find((candidate) => candidate.index === cardIndex);
  const state = card ? focus.cardStates?.states.get(cardIndex)?.state || null : null;
  const arrival = useArrival(state);
  if (!card) return null;

  return (
    <button
      type="button"
      className="card-touch-plate"
      data-card-index={cardIndex}
      data-state={state || undefined}
      data-calm={focus.calm ? 'true' : undefined}
      aria-label={`${cardLabel(card)}. Open card`}
      onClick={() => api?.selectCard(cardIndex)}
    >
      <CardTouchArt card={card} state={state} trace={focus.trace} touchKey={String(arrival)} calm={focus.calm} />
      <span className="card-touch-plate__caption" data-long={card.positionLabel.length > 18 ? 'true' : undefined} aria-hidden="true">
        {card.positionLabel}
        {card.isReversed ? <span className="card-touch-plate__orientation"> · Reversed</span> : null}
      </span>
    </button>
  );
}

function isOnScreen(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const height = window.innerHeight || 0;
  // Mostly visible: the detail being shown has to be there to be seen.
  const visible = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
  return visible > rect.height * 0.6;
}

/**
 * When the reading returns to a card whose plate has scrolled away ("one
 * pitcher back into the pool"), a small copy of that card comes forward at the
 * edge of the screen, shows the detail, and goes back. Narrow screens only;
 * wide screens keep the whole spread in view.
 */
export function CardEcho() {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const ref = useRef(null);
  const [echo, setEcho] = useState(null);
  const trace = focus?.trace || null;
  const traceKey = trace?.key || null;

  useEffect(() => {
    // Measure after layout: whether the card's own plate is where the reader
    // can see it decides who shows the detail.
    const frame = window.requestAnimationFrame(() => {
      const host = ref.current?.closest('.narrative-panel__layout') || document;
      const plate = trace ? host.querySelector(`.card-touch-plate[data-card-index="${trace.card}"]`) : null;
      // No plate (wide screens, or a card without a passage of its own) or a
      // plate in view: the card itself shows the detail.
      const needed = Boolean(plate && window.getComputedStyle(plate).display !== 'none' && !isOnScreen(plate));
      setEcho((current) => {
        if (needed) return { card: trace.card, trace, leaving: false };
        return current ? { ...current, leaving: true } : null;
      });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new trace key is the trigger
  }, [traceKey]);

  useEffect(() => {
    if (!echo?.leaving) return undefined;
    const timer = window.setTimeout(() => setEcho(null), 420);
    return () => window.clearTimeout(timer);
  }, [echo]);

  const card = echo ? focus?.cards?.find((candidate) => candidate.index === echo.card) : null;

  return (
    <div ref={ref} className="card-echo" data-visible={card && !echo.leaving ? 'true' : undefined} aria-hidden="true">
      {card ? (
        <button
          type="button"
          tabIndex={-1}
          className="card-echo__card"
          onClick={() => api?.selectCard(card.index)}
        >
          <CardTouchArt card={card} state="touched" trace={echo.trace} touchKey={echo.trace.key} calm={focus.calm} />
          <span className="card-echo__caption">
            {card.name}
            {card.isReversed ? <span className="card-echo__orientation">Reversed</span> : null}
          </span>
        </button>
      ) : null}
    </div>
  );
}
