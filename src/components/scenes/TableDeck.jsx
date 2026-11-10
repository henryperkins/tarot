import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { CardBack } from '../CardBack';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  KNOCKS_NEEDED,
  clampCut,
  cutAtPosition,
  cutRange,
  cutValueText,
  knockLabel,
  ritualStatus
} from '../../lib/tableRitual';

export const TABLE_RITUAL_INVITE_ID = 'reading-table-ritual-invite';

// Keys a range input moves by itself; Enter is left for committing.
const ADJUST_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/**
 * The deck on the reading table. Before Deal it carries the optional ritual,
 * with nothing to open: the deck's face is knocked on and its stacked edge is
 * cut, then Deal commits the cards. Readers who hide ritual steps in Settings
 * see only the deck. The status line keeps one element through Deal, so its
 * change to the reveal count is announced.
 */
export function TableDeck({
  deckRef,
  isSpreadDealt,
  showRitual,
  knockCount = 0,
  onKnock,
  cutIndex,
  hasCut = false,
  deckSize,
  onCut,
  revealedCount = 0,
  visibleCount = 0
}) {
  const ritualOpen = showRitual && !isSpreadDealt;
  const status = isSpreadDealt
    ? `${revealedCount} of ${visibleCount} cards revealed`
    : ritualOpen
      ? ritualStatus({ knockCount, hasCut, cutIndex, deckSize })
      : 'Your deck is ready. Deal when you feel ready.';

  return (
    <div className="reading-table__deck-area">
      <div className={`reading-table__deck-row${ritualOpen ? ' reading-table__deck-row--ritual' : ''}`}>
        {ritualOpen
          ? <KnockDeck deckRef={deckRef} knockCount={knockCount} onKnock={onKnock} />
          : <div ref={deckRef} className="reading-table__deck" aria-hidden="true"><CardBack /></div>}
        {ritualOpen && (
          <>
            <p id={TABLE_RITUAL_INVITE_ID} className="table-ritual__invite">
              Knock three times and cut where it feels right, or simply deal.
            </p>
            <p className="table-ritual__why">
              Your question, the timing of your knocks and where you cut together set this shuffle.
            </p>
            <CutEdge cutIndex={cutIndex} hasCut={hasCut} deckSize={deckSize} onCut={onCut} />
          </>
        )}
        <p className="reading-table__status" role="status">{status}</p>
      </div>
    </div>
  );
}

function KnockDeck({ deckRef, knockCount, onKnock }) {
  const faceRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const knocked = knockCount >= KNOCKS_NEEDED;

  const knock = () => {
    if (knocked) return;
    onKnock?.();
    const face = faceRef.current;
    if (prefersReducedMotion || typeof face?.animate !== 'function') return;
    // A knuckle on the deck: it gives a little under the knock and settles.
    face.animate([
      { translate: '0 0', scale: 1 },
      { translate: '0 3px', scale: 0.975, offset: 0.3 },
      { translate: '0 0', scale: 1 }
    ], { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  };

  return (
    <div ref={deckRef} className="table-ritual__deck">
      <button
        ref={faceRef}
        type="button"
        className="table-ritual__face"
        aria-label={knockLabel(knockCount)}
        aria-disabled={knocked || undefined}
        data-table-ritual-start
        onKeyDown={event => {
          // A held key repeats its click; each knock is the reader's own.
          if (event.key === 'Enter' && event.repeat) event.preventDefault();
        }}
        onClick={knock}
      >
        <CardBack as="span" />
      </button>
      <span className="table-ritual__knocks" aria-hidden="true">
        {Array.from({ length: KNOCKS_NEEDED }, (_, index) => (
          <span key={index} className="table-ritual__knock" data-knocked={index < knockCount || undefined} />
        ))}
      </span>
    </div>
  );
}

function CutEdge({ cutIndex, hasCut, deckSize, onCut }) {
  const { min, max, size } = cutRange(deckSize);
  const committed = clampCut(cutIndex, size);
  const [preview, setPreview] = useState(committed);
  // Follow the committed cut when it changes elsewhere (a re-cut, a new deck size).
  const [followed, setFollowed] = useState(committed);
  if (followed !== committed) {
    setFollowed(committed);
    setPreview(committed);
  }
  const [dragging, setDragging] = useState(false);
  // Where a mouse or pen hovering over the edge would cut, before it presses.
  const [hovered, setHovered] = useState(null);
  const edgeRef = useRef(null);
  const inputRef = useRef(null);
  const pointerIdRef = useRef(null);
  // Arrow keys move the cut without making it; Enter or leaving the edge does.
  const keyboardPendingRef = useRef(false);

  const commit = value => {
    keyboardPendingRef.current = false;
    const cut = clampCut(value, size);
    setPreview(cut);
    onCut?.(cut);
  };

  // Screen readers on phones adjust the value directly, with no key presses:
  // the native change event is their release.
  const commitAdjustment = useEffectEvent(value => {
    if (keyboardPendingRef.current || pointerIdRef.current !== null) return;
    commit(value);
  });
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    const handleChange = () => commitAdjustment(Number(input.value));
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, []);

  const valueAt = clientX => cutAtPosition(clientX, edgeRef.current?.getBoundingClientRect(), size);

  const handlePointerDown = event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    keyboardPendingRef.current = false;
    setDragging(true);
    setPreview(valueAt(event.clientX));
    // Keep the pointer from selecting text; keyboard use continues from here.
    if (event.pointerType === 'mouse') event.preventDefault();
    inputRef.current?.focus({ preventScroll: true });
  };

  const handlePointerMove = event => {
    if (event.pointerId === pointerIdRef.current) {
      setPreview(valueAt(event.clientX));
    } else if (pointerIdRef.current === null && event.pointerType !== 'touch') {
      setHovered(valueAt(event.clientX));
    }
  };

  const finishPointer = (event, keep) => {
    if (event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    setDragging(false);
    if (keep) commit(valueAt(event.clientX));
    else setPreview(committed);
  };

  const handleKeyDown = event => {
    if (ADJUST_KEYS.has(event.key)) {
      keyboardPendingRef.current = true;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(Number(event.currentTarget.value));
    } else if (event.key === 'Escape' && keyboardPendingRef.current) {
      keyboardPendingRef.current = false;
      setPreview(committed);
    }
  };

  const handleBlur = event => {
    if (keyboardPendingRef.current) commit(Number(event.currentTarget.value));
  };

  const isSet = hasCut && !dragging && preview === committed;

  return (
    <div
      ref={edgeRef}
      className="table-ritual__edge"
      data-cut={isSet ? 'set' : undefined}
      data-dragging={dragging || undefined}
      style={{ '--cut': preview / size, '--cards': size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={event => finishPointer(event, true)}
      onPointerCancel={event => finishPointer(event, false)}
      onPointerLeave={() => setHovered(null)}
    >
      <input
        ref={inputRef}
        type="range"
        className="table-ritual__edge-input"
        min={min}
        max={max}
        step={1}
        value={preview}
        aria-label="Cut the deck"
        aria-valuetext={cutValueText(preview, size)}
        onChange={event => setPreview(clampCut(Number(event.target.value), size))}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <span className="table-ritual__edge-cards" aria-hidden="true" />
      {hovered !== null && !dragging && hovered !== preview && (
        <span className="table-ritual__edge-ghost" style={{ '--at': hovered / size }} aria-hidden="true">
          <span className="table-ritual__edge-value">{hovered}</span>
        </span>
      )}
      <span className="table-ritual__edge-marker" aria-hidden="true">
        <span className="table-ritual__edge-value">{preview}</span>
      </span>
    </div>
  );
}
