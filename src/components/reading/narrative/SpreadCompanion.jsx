import { useEffect, useId, useRef, useState } from 'react';
import { CardTouchArt } from './CardTouchArt';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './NarrativeCardFocus';
import { railColumns } from './spreadCompanionLayout';
import '../../../styles/narrative-card-touch.css';

// Matches the spread insights' card links ("View The Star — Future").
function cardLabel(card) {
  return `View ${card.name} — ${card.positionLabel}${card.isReversed ? ' (reversed)' : ''}`;
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
 * What the card is and where it lies: its name, then its position in the
 * spread and whether it was drawn reversed.
 */
function CardCaption({ card, position = card.positionLabel }) {
  return (
    <span className="card-caption" data-long={position.length > 18 ? 'true' : undefined} aria-hidden="true">
      <span className="card-caption__name">{card.name}</span>
      <span className="card-caption__position">
        {position}
        {card.isReversed ? <span className="card-caption__orientation"> · Reversed</span> : null}
      </span>
    </span>
  );
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

function SpreadCard({ card, focus, api }) {
  const state = focus.cardStates?.states.get(card.index)?.state || null;
  const arrival = useArrival(state);
  return (
    <li className="spread-companion__item" data-state={state || undefined}>
      <button
        type="button"
        className="spread-companion__card"
        data-card-index={card.index}
        data-state={state || undefined}
        aria-current={state === 'touched' ? 'true' : undefined}
        aria-label={cardLabel(card)}
        aria-haspopup="dialog"
        onClick={(event) => api?.selectCard(card.index, { triggerElement: event.currentTarget })}
        onPointerEnter={() => api?.setSpreadHover(card.index)}
        onPointerLeave={() => api?.setSpreadHover(null)}
        onFocus={() => api?.setSpreadHover(card.index)}
        onBlur={() => api?.setSpreadHover(null)}
      >
        <CardTouchArt card={card} state={state} trace={focus.trace} touchKey={String(arrival)} calm={focus.calm} />
        <CardCaption card={card} position={card.shortLabel} />
      </button>
    </li>
  );
}

/**
 * Marks a row that scrolls sideways, and whether its end is in view, so a
 * fade can show there are more cards.
 */
function useSideScroll(ref, count) {
  const [scroll, setScroll] = useState({ overflow: false, end: true });
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const overflow = element.scrollWidth > element.clientWidth + 1;
      const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
      setScroll((previous) => (previous.overflow === overflow && previous.end === end ? previous : { overflow, end }));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer?.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [ref, count]);
  return scroll;
}

/**
 * The querent's whole spread.
 *
 * - rail: kept beside the reading on wide screens.
 * - row: laid out above the reading on narrower screens, in the page (it
 *   scrolls away with the text above it). It is always there, so every card
 *   can be found and opened even where the reading never names it.
 */
export function SpreadCompanion({ variant = 'rail' }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const headingId = useId();
  const scrollerRef = useRef(null);
  const cards = focus?.cards || [];
  const scroll = useSideScroll(scrollerRef, cards.length);
  if (cards.length === 0) return null;

  const list = (
    <ol className="spread-companion__list">
      {cards.map((card) => (
        <SpreadCard key={card.index} card={card} focus={focus} api={api} />
      ))}
    </ol>
  );

  if (variant === 'row') {
    return (
      <section
        className="spread-companion spread-companion--row"
        aria-labelledby={headingId}
        data-count={cards.length}
        data-focus={focus.cardStates ? 'true' : undefined}
        data-calm={focus.calm ? 'true' : undefined}
        style={{ '--row-count': cards.length }}
      >
        {/* Labeled like the question above it, rather than as a heading in the reading's outline. */}
        <p id={headingId} className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Your cards</p>
        <div
          ref={scrollerRef}
          className="spread-companion__scroller"
          data-overflow={scroll.overflow ? 'true' : undefined}
          data-at-end={scroll.end ? 'true' : undefined}
        >
          {list}
        </div>
      </section>
    );
  }

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
      {list}
    </aside>
  );
}

/**
 * Whether a plate has come into view yet: each card is laid down as the
 * reader reaches its passage, once.
 */
function useDealt(ref, calm) {
  const [dealt, setDealt] = useState(calm || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const element = ref.current;
    if (dealt || !element) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setDealt(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, dealt]);
  return dealt || calm;
}

/**
 * The card set into the paragraph that opens its passage, so the picture sits
 * beside the words that describe it. A note the querent left on the card sits
 * under it, and lights when the reading takes up their words.
 */
export function CardTouchPlate({ cardIndex }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const ref = useRef(null);
  const card = focus?.cards?.find((candidate) => candidate.index === cardIndex);
  const state = card ? focus.cardStates?.states.get(cardIndex)?.state || null : null;
  const arrival = useArrival(state);
  const dealt = useDealt(ref, Boolean(focus?.calm));
  if (!card) return null;
  const noting = focus.personal?.card === cardIndex;

  return (
    <button
      ref={ref}
      type="button"
      className="card-touch-plate"
      data-card-index={cardIndex}
      data-state={state || undefined}
      data-deal={dealt ? 'in' : 'pending'}
      data-calm={focus.calm ? 'true' : undefined}
      aria-label={cardLabel(card)}
      aria-haspopup="dialog"
      onClick={(event) => api?.selectCard(cardIndex, { triggerElement: event.currentTarget })}
    >
      <CardTouchArt card={card} state={state} trace={focus.trace} touchKey={String(arrival)} calm={focus.calm} />
      <CardCaption card={card} />
      {card.reflection ? (
        <span className="card-touch-plate__note" data-noting={noting ? 'true' : undefined} aria-hidden="true">
          <span className="card-touch-plate__note-label">Your note</span>
          <span className="card-touch-plate__note-text">{card.reflection}</span>
        </span>
      ) : null}
    </button>
  );
}
