import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../../../hooks/useModalA11y';
import { CardTouchArt } from './CardTouchArt';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './narrativeFocusContext.js';
import { railColumns } from './spreadCompanionLayout';
import '../../../styles/narrative-card-touch.css';
import { getVectorGestureFrames } from '../../../data/cardGestureArtwork.js';
import { getCardPresence } from './narrativeGestureState.js';
import { NarrativePersonalContext } from './NarrativePersonalContext';

function originalContextProps(focus) {
  const context = focus.originalContext || {};
  return { question: context.question, reflections: context.reflections ?? context.reflectionsText,
    cards: context.cards || focus.cards };
}

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
      data-app-secondary={variant === 'rail' ? '2' : undefined}
      data-chrome-min-width="1180"
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
      <NarrativePersonalContext {...originalContextProps(focus)} />
    </aside>
  );
}

// Engines without :focus-visible cannot tell keyboard focus apart; treat it as keyboard.
function keyboardFocus(element) {
  try { return element.matches(':focus-visible'); } catch { return true; }
}

function GestureCompanion({ focus, api }) {
  const { cards, introductions, gestureSource: source, calm } = focus;
  const state = focus.studyEnabled ? focus.gestureState : { ...focus.gestureState, current: null, introduced: [], pending: null, phase: 'static' };
  const root = useRef(null);
  const windowRef = useRef(null);
  const contextRef = useRef(null);
  const current = state.current;
  const personalContext = current?.personalContext;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  // Only the reader's held selection opens this view. Automatic cues never
  // cover the prose or move its scroll position.
  const mobileInspection = narrow && Boolean(state.held && current);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const dialogTitleId = useId();
  const closeInspection = useCallback(() => api.releaseAssociation(), [api]);
  const getFallbackFocus = useCallback(() => {
    const selectedOccurrenceId = state.held?.occurrenceId || current?.targets?.[0]?.occurrenceId;
    if (selectedOccurrenceId && root.current) {
      const match = root.current.querySelector(`[data-gesture-shelf] button[data-occurrence-id="${selectedOccurrenceId}"]:not(:disabled)`);
      if (match) return match;
    }
    return root.current?.querySelector('[data-gesture-shelf] button:not(:disabled)') || null;
  }, [state.held, current?.targets]);
  useLayoutEffect(() => {
    if (mobileInspection) returnFocusRef.current = document.activeElement;
  }, [mobileInspection]);
  useModalA11y(mobileInspection, {
    onClose: closeInspection,
    containerRef: dialogRef,
    returnFocusRef,
    initialFocusSelector: '[data-card-inspection-close]',
    getFallbackFocus,
    scrollLockStrategy: 'simple',
    isolateBackground: true
  });
  const [artVisible, setArtVisible] = useState(false);
  // Keyboard or assistive-technology focus inside the stage is an inspection:
  // automatic turns pause instead of replacing the card under that cursor.
  // Pointer focus is not: a clicked button keeps focus without a visible ring,
  // and suspending there would let unseen connections scroll away.
  const stageFocused = useRef(false);
  const reportStageFocus = useCallback(focused => {
    if (focused === stageFocused.current) return;
    stageFocused.current = focused;
    api.reportInspection({ kind: 'stage-focus', active: focused });
  }, [api]);
  const containsInspectionFocus = target => Boolean(windowRef.current?.contains(target)
    || (personalContext && contextRef.current?.contains(target)));
  // A focused card removed by an explicit change fires no blur in every engine.
  useEffect(() => { if (stageFocused.current && !containsInspectionFocus(document.activeElement)) reportStageFocus(false); });
  useEffect(() => () => { if (stageFocused.current) api.reportInspection({ kind: 'stage-focus', active: false }); }, [api]);
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
  }, [mobileInspection]);
  useEffect(() => {
    current?.targets.forEach(({ occurrenceId }) => api.reportVisibility({ kind: 'artwork', id: occurrenceId, visible: artVisible }));
  }, [artVisible, current?.targets, api]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape' && !event.defaultPrevented) api.releaseAssociation(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [api]);
  const eligibleCards = cards.filter(card => state.introduced.includes(card.occurrenceId) || state.availableOccurrences.includes(card.occurrenceId));
  const eligibleOccurrences = new Set(eligibleCards.map(card => card.occurrenceId));
  const moveShelfFocus = (event, occurrenceId) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = eligibleCards.findIndex(card => card.occurrenceId === occurrenceId);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? eligibleCards.length - 1 : Math.max(0, Math.min(eligibleCards.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
    root.current?.querySelectorAll('[data-gesture-shelf] button:not(:disabled)')[next]?.focus();
  };
  const present = (association, departing = false, inDialog = false) => {
    if (!association) return null;
    return <div className={`gesture-focus-layer${departing ? ' gesture-focus-layer--departing' : ''}`}
      key={departing ? `departing-${layers.exitId}` : association.id} aria-hidden={departing ? true : undefined} inert={departing ? true : undefined}
      data-pair={association.targets.length > 1 ? 'true' : undefined}>
      {association.targets.map(target => {
        const card = cards.find(item => item.occurrenceId === target.occurrenceId);
        if (!card) return null;
        const introduction = introductions.find(item => item.occurrenceId === target.occurrenceId);
        const presence = getCardPresence({ introduction, visibleEnd: state.visibleEnd, inspected: Boolean(state.held), reducedMotion: calm });
        const frameIds = getVectorGestureFrames(card.canonicalName, target.detailIds, { paired: association.targets.length > 1 });
        return <button key={target.occurrenceId} type="button" className="gesture-focus-card"
          data-focus-card data-occurrence-id={target.occurrenceId} data-details={target.detailIds.join(' ')}
          tabIndex={departing || !eligibleOccurrences.has(target.occurrenceId) ? -1 : 0} disabled={departing || !eligibleOccurrences.has(target.occurrenceId)}
          aria-label={cardLabel(card)} aria-pressed={Boolean(state.held)}
          onClick={() => state.held ? api.releaseAssociation() : association.id.startsWith('identity-') ? api.holdCard(target.occurrenceId) : api.holdAssociation(association.id)}>
          {frameIds.map((ids, index) => {
            const hasDetails = Array.isArray(ids) ? ids.length > 0 : Boolean(ids);
            const crop = inDialog ? hasDetails : true;
            return <CardTouchArt key={index} card={card} crop={crop} presence={presence} dynamic={introduction?.dynamic} calm={calm}
              motionOwner={!departing && index === 0}
              gesture={{ runId: source.runId, sourceRevision: source.sourceRevision, associationId: association.id,
                detailIds: Array.isArray(ids) ? ids : [ids], phase: departing ? 'static' : state.phase,
                held: Boolean(state.held), active: !departing, canMove: artVisible && state.canMove }} />;
          })}
        </button>;
      })}
    </div>;
  };
  const fullArtActions = state.held && api.canInspectCard ? <div className="flex flex-wrap gap-2">
    {current?.targets.map(target => {
      const card = cards.find(item => item.occurrenceId === target.occurrenceId);
      if (!card || !eligibleOccurrences.has(target.occurrenceId)) return null;
      return <button key={target.occurrenceId} type="button" aria-haspopup="dialog"
        className="min-h-touch rounded-lg border border-secondary/40 px-3 py-2 text-sm"
        onClick={() => {
          const trigger = Array.from(document.querySelectorAll('[data-gesture-id]'))
            .find(element => element.dataset.gestureId === current.id)
            || root.current?.querySelector(`[data-gesture-shelf] [data-occurrence-id="${target.occurrenceId}"]`);
          api.releaseAssociation();
          api.selectCard(card.index, { gestureId: current.id, occurrenceId: target.occurrenceId,
            phrase: current.passage?.quote, touchIds: target.detailIds, triggerElement: trigger });
        }}>Open {card.name}</button>;
    })}
  </div> : null;
  return <aside ref={root} className="gesture-companion" data-app-secondary="2" data-chrome-min-width="1100" aria-label="Your cards" data-calm={calm ? 'true' : undefined}>
    <ol data-gesture-shelf className="gesture-shelf" style={{ '--shelf-count': cards.length, '--shelf-columns': Math.min(cards.length, 5) }}>
      {cards.map(card => {
        const introduced = state.introduced.includes(card.occurrenceId);
        const available = eligibleOccurrences.has(card.occurrenceId);
        const selected = current?.targets.some(target => target.occurrenceId === card.occurrenceId);
        const introduction = introductions.find(item => item.occurrenceId === card.occurrenceId);
        const presence = card.inspectionAvailable ? 1 : getCardPresence({ introduction, visibleEnd: state.visibleEnd,
          inspected: state.held?.occurrenceId === card.occurrenceId, reducedMotion: calm });
        return <li key={card.occurrenceId} data-introduced={introduced ? 'true' : 'false'} data-available={available ? 'true' : 'false'}>
          <button type="button" className="gesture-shelf-card" aria-label={cardLabel(card)} disabled={!available}
            data-occurrence-id={card.occurrenceId} aria-current={selected ? 'true' : undefined}
            onKeyDown={event => moveShelfFocus(event, card.occurrenceId)} onClick={event => {
              event.currentTarget.focus({ preventScroll: true });
              api.holdCard(card.occurrenceId);
            }}>
            <CardTouchArt card={card} presence={presence} dynamic={introduction?.dynamic} calm={calm} gesture={{ runId: source.runId, sourceRevision: source.sourceRevision,
              associationId: 'shelf', detailIds: [], phase: 'static', held: state.held?.occurrenceId === card.occurrenceId, active: selected, canMove: false }} />
          </button><span className="gesture-shelf-label">{card.shortLabel}</span>
        </li>;
      })}
    </ol>
    {mobileInspection ? <div className="gesture-inspection-placeholder" aria-hidden="true" /> : null}
    {mobileInspection ? createPortal(
      <div className="reading-personal-context__overlay">
        <div data-modal-backdrop aria-hidden="true" className="reading-personal-context__backdrop" onClick={closeInspection} />
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}
          className="reading-personal-context__dialog gesture-inspection-dialog">
          <div className="reading-personal-context__header">
            <h2 id={dialogTitleId}>Card detail</h2>
            <button type="button" data-card-inspection-close className="reading-personal-context__close"
              onClick={closeInspection}>Back to reading</button>
          </div>
          <div ref={windowRef} data-gesture-window className="gesture-window" data-association={current?.id || ''}
            data-phase="static" data-held="true">
            {present(current, false, true)}
          </div>
          {fullArtActions}
          {personalContext ? <p className="gesture-inspection-context">“{personalContext.quote}”</p> : null}
        </section>
      </div>, document.body
    ) : <div ref={windowRef} data-gesture-window className="gesture-window" data-association={current?.id || ''} data-phase={state.phase}
      data-held={state.held ? 'true' : undefined} data-pending={state.pending || ''}
      onFocus={event => reportStageFocus(keyboardFocus(event.target))}
      onBlur={event => { if (!containsInspectionFocus(event.relatedTarget)) reportStageFocus(false); }}>
      {focus.studyEnabled && !calm && present(layers.departing, true, false)}{present(current, false, false)}
    </div>}
    {!mobileInspection && fullArtActions}
    <div ref={contextRef} className="gesture-context" aria-live="off" role={personalContext ? 'region' : undefined}
      aria-label={personalContext ? 'Related personal context' : undefined} tabIndex={personalContext ? 0 : undefined}
      onFocus={event => reportStageFocus(keyboardFocus(event.target))}
      onBlur={event => { if (!containsInspectionFocus(event.relatedTarget)) reportStageFocus(false); }}>
      {personalContext ? <span>“{personalContext.quote}”</span> : null}
    </div>
    <NarrativePersonalContext {...originalContextProps(focus)} />
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
