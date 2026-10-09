import { useEffect, useRef, useState } from 'react';
import { CardTouchArt } from './CardTouchArt';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './NarrativeCardFocus';
import { railColumns } from './spreadCompanionLayout';
import '../../../styles/narrative-card-touch.css';
import { getCardPresence } from './narrativeGestureState.js';

function cardLabel(card) {
  return `${card.positionLabel}: ${card.name}, ${card.isReversed ? 'reversed' : 'upright'}`;
}

// Height over width of the deck's card frame ("16 / 31" is a Marseille card).
function frameRatio(frame) {
  const [width, height] = String(frame || '').split('/').map(Number);
  return width > 0 && height > 0 ? Number((height / width).toFixed(3)) : 1.72;
}

// The rail fits the whole spread into one screen; the row shares the screen
// width between the cards.
function layoutVars(variant, cards) {
  const count = cards.length;
  if (variant === 'row') return { '--row-count': count };
  const cols = railColumns(count);
  return { '--rail-cols': cols, '--rail-rows': Math.ceil(count / cols), '--card-ratio': frameRatio(cards[0]?.frame) };
}

/**
 * The querent's cards, kept beside the reading. The rail stays in view on
 * wide screens; the row opens the reading on narrower ones.
 */
export function SpreadCompanion({ variant = 'rail' }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const cards = focus?.cards || [];
  if (cards.length === 0) return null;
  if (focus.studyRequested) return variant === 'rail' ? <GestureCompanion focus={focus} api={api} /> : null;
  const { cardStates, calm } = focus;

  return (
    <aside
      className={`spread-companion spread-companion--${variant}`}
      aria-label="Your cards"
      data-count={cards.length}
      data-cols={variant === 'rail' ? railColumns(cards.length) : undefined}
      data-focus={cardStates ? 'true' : undefined}
      data-calm={calm ? 'true' : undefined}
      style={layoutVars(variant, cards)}
    >
      <ol className="spread-companion__list">
        {cards.map((card) => {
          const entry = cardStates?.states.get(card.index);
          const state = entry?.state || null;
          return (
            <li key={card.index} className="spread-companion__item" data-state={state || undefined}>
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
                <CardTouchArt
                  card={card}
                  state={state}
                  touches={entry?.touches || []}
                  touchKey={cardStates?.key || ''}
                  calm={calm}
                />
              </button>
              <span className="spread-companion__label" aria-hidden="true">
                {card.shortLabel}
                {card.isReversed ? <span className="spread-companion__orientation">Reversed</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function GestureCompanion({ focus, api }) {
  const { cards, introductions, gestureSource: source, calm } = focus;
  const state = focus.studyEnabled ? focus.gestureState : { ...focus.gestureState, current: null, introduced: [], pending: null, phase: 'static' };
  const root = useRef(null);
  const windowRef = useRef(null);
  const [artVisible, setArtVisible] = useState(false);
  const current = state.current;
  const [layers, setLayers] = useState({ id: current?.id, current, departing: null, exitId: 0 });
  if (layers.id !== current?.id) setLayers({ id: current?.id, current, departing: calm ? null : layers.current,
    exitId: layers.exitId + 1 });
  useEffect(() => {
    if (!layers.departing) return undefined;
    const exitId = layers.exitId;
    const timer = setTimeout(() => setLayers(previous => previous.exitId === exitId ? { ...previous, departing: null } : previous), 300);
    return () => clearTimeout(timer);
  }, [layers.departing, layers.exitId]);
  useEffect(() => {
    const element = windowRef.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(entries => setArtVisible(entries[0].isIntersecting), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    current?.targets.forEach(({ occurrenceId }) => api.reportVisibility({ kind: 'artwork', id: occurrenceId, visible: artVisible }));
  }, [artVisible, current?.targets, api]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') api.releaseAssociation(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [api]);
  const eligibleCards = cards.filter(card => state.introduced.includes(card.occurrenceId));
  const moveShelfFocus = (event, occurrenceId) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = eligibleCards.findIndex(card => card.occurrenceId === occurrenceId);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? eligibleCards.length - 1 : Math.max(0, Math.min(eligibleCards.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
    root.current?.querySelectorAll('[data-gesture-shelf] button:not(:disabled)')[next]?.focus();
  };
  const present = (association, departing = false) => {
    if (!association) return null;
    return <div className={`gesture-focus-layer${departing ? ' gesture-focus-layer--departing' : ''}`}
      key={departing ? `departing-${layers.exitId}` : association.id} aria-hidden={departing ? true : undefined} inert={departing ? true : undefined}
      data-pair={association.targets.length > 1 ? 'true' : undefined}>
      {association.targets.map(target => {
        const card = cards.find(item => item.occurrenceId === target.occurrenceId);
        if (!card) return null;
        const introduction = introductions.find(item => item.occurrenceId === target.occurrenceId);
        const presence = getCardPresence({ introduction, visibleEnd: state.visibleEnd, inspected: Boolean(state.held), reducedMotion: calm });
        const frameIds = target.detailIds.length > 1 && association.targets.length === 1 && card.canonicalName !== 'The Star' ? target.detailIds : [target.detailIds];
        return <button key={target.occurrenceId} type="button" className="gesture-focus-card"
          data-focus-card data-occurrence-id={target.occurrenceId} data-details={target.detailIds.join(' ')}
          tabIndex={departing || !state.introduced.includes(target.occurrenceId) ? -1 : 0} disabled={departing || !state.introduced.includes(target.occurrenceId)}
          aria-label={cardLabel(card)} aria-pressed={Boolean(state.held)}
          onClick={() => state.held ? api.releaseAssociation() : association.id.startsWith('identity-') ? api.holdCard(target.occurrenceId) : api.holdAssociation(association.id)}>
          {frameIds.map((ids, index) => <CardTouchArt key={index} card={card} crop presence={presence} calm={calm}
            motionOwner={!departing && index === 0}
            gesture={{ runId: source.runId, sourceRevision: source.sourceRevision, associationId: association.id,
              detailIds: Array.isArray(ids) ? ids : [ids], phase: departing ? 'static' : state.phase,
              held: Boolean(state.held), active: !departing, canMove: artVisible && state.canMove }} />)}
        </button>;
      })}
    </div>;
  };
  const personalContext = current?.personalContext;
  return <aside ref={root} className="gesture-companion" aria-label="Your cards" data-calm={calm ? 'true' : undefined}>
    <ol data-gesture-shelf className="gesture-shelf" style={{ '--shelf-count': cards.length }}>
      {cards.map(card => {
        const introduced = state.introduced.includes(card.occurrenceId);
        const selected = current?.targets.some(target => target.occurrenceId === card.occurrenceId);
        const presence = getCardPresence({ introduction: introductions.find(item => item.occurrenceId === card.occurrenceId), visibleEnd: state.visibleEnd,
          inspected: state.held?.occurrenceId === card.occurrenceId, reducedMotion: calm });
        return <li key={card.occurrenceId} data-introduced={introduced ? 'true' : 'false'}>
          <button type="button" className="gesture-shelf-card" aria-label={cardLabel(card)} disabled={!introduced}
            data-occurrence-id={card.occurrenceId} aria-current={selected ? 'true' : undefined}
            onKeyDown={event => moveShelfFocus(event, card.occurrenceId)} onClick={() => api.holdCard(card.occurrenceId)}>
            <CardTouchArt card={card} presence={presence} calm={calm} gesture={{ runId: source.runId, sourceRevision: source.sourceRevision,
              associationId: 'shelf', detailIds: [], phase: 'static', held: state.held?.occurrenceId === card.occurrenceId, active: selected, canMove: false }} />
          </button><span className="gesture-shelf-label">{card.shortLabel}</span>
        </li>;
      })}
    </ol>
    <div ref={windowRef} data-gesture-window className="gesture-window" data-association={current?.id || ''} data-phase={state.phase}
      data-held={state.held ? 'true' : undefined} data-pending={state.pending || ''}>
      {focus.studyEnabled && !calm && present(layers.departing, true)}{present(current)}
    </div>
    <div className="gesture-context" aria-live="off">{personalContext ? <span>“{personalContext.quote}”</span> : null}</div>
  </aside>;
}

/**
 * The card set into the paragraph that opens its passage, for screens too
 * narrow to keep the whole spread beside the text.
 */
export function CardTouchPlate({ cardIndex }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const card = focus?.cards?.find((candidate) => candidate.index === cardIndex);
  if (!card) return null;
  const entry = focus.cardStates?.states.get(cardIndex);
  const state = entry?.state || null;

  return (
    <button
      type="button"
      className="card-touch-plate"
      data-state={state || undefined}
      data-calm={focus.calm ? 'true' : undefined}
      aria-label={`${cardLabel(card)}. Open card`}
      onClick={() => api?.selectCard(cardIndex)}
    >
      <CardTouchArt
        card={card}
        state={state}
        touches={entry?.touches || []}
        touchKey={focus.cardStates?.key || ''}
        calm={focus.calm}
      />
    </button>
  );
}
