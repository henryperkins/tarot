import { useId, useMemo } from 'react';
import { getCardTouchPoints } from '../../../data/cardTouchPoints.js';
import { frameRatio, lensFor } from './cardTouchMotion.js';

// The light layer's coordinate box is 100 units wide and as tall as the
// deck's card frame, so a spot's radius reads as a circle on the card.
const BOX_WIDTH = 100;

/**
 * One spread card as artwork a reader's hand can find: lifted by its
 * container, swept by a little light when the reading turns to it, and leaning
 * in on the part of the picture the words describe. The picture, its light
 * and the lens rotate together when the card is reversed.
 */
export function CardTouchArt({ card, state = null, trace = null, touchKey = '', calm = false }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ratio = frameRatio(card.frame);
  const boxHeight = BOX_WIDTH * ratio;
  const traced = trace && trace.card === card.index ? trace : null;

  const spots = useMemo(() => {
    if (!traced) return [];
    const wanted = new Set(traced.points);
    return getCardTouchPoints(card.canonicalName)
      .filter((point) => wanted.has(point.id))
      .flatMap((point) => point.spots);
  }, [card.canonicalName, traced]);

  const lens = calm ? null : lensFor(spots, ratio);
  const lensStyle = lens
    ? { '--lens-zoom': lens.zoom, '--lens-x': lens.tx, '--lens-y': lens.ty }
    : undefined;

  return (
    <span
      className="card-touch"
      data-state={state || undefined}
      data-lit={spots.length ? 'true' : undefined}
      data-leaning={lens ? 'true' : undefined}
    >
      <span
        className={`card-touch__art${card.isReversed ? ' card-touch__art--reversed' : ''}`}
        style={card.frame ? { aspectRatio: card.frame } : undefined}
      >
        <span className="card-touch__lens" style={lensStyle}>
          <img className="card-touch__image" src={card.image} alt="" loading="lazy" decoding="async" draggable="false" />
          <svg
            className="card-touch__light"
            viewBox={`0 0 ${BOX_WIDTH} ${boxHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <radialGradient id={`${id}-glow`}>
                <stop offset="0%" style={{ stopColor: 'rgb(var(--card-touch-light))', stopOpacity: 0.2 }} />
                <stop offset="55%" style={{ stopColor: 'rgb(var(--card-touch-light))', stopOpacity: 0.08 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(var(--card-touch-light))', stopOpacity: 0 }} />
              </radialGradient>
              <radialGradient id={`${id}-opening`}>
                <stop offset="0%" stopColor="black" />
                <stop offset="38%" stopColor="black" />
                <stop offset="100%" stopColor="white" />
              </radialGradient>
              <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX_WIDTH} height={boxHeight}>
                <rect width={BOX_WIDTH} height={boxHeight} fill="white" />
                {spots.map(([x, y, r], index) => (
                  <circle key={index} cx={x * BOX_WIDTH} cy={y * boxHeight} r={r * BOX_WIDTH * 1.85} fill={`url(#${id}-opening)`} />
                ))}
              </mask>
            </defs>
            <rect className="card-touch__veil" width={BOX_WIDTH} height={boxHeight} mask={`url(#${id}-mask)`} />
            {spots.map(([x, y, r], index) => (
              <circle
                key={`${traced?.key || ''}-${index}`}
                className="card-touch__glow"
                cx={x * BOX_WIDTH}
                cy={y * boxHeight}
                r={r * BOX_WIDTH}
                fill={`url(#${id}-glow)`}
                style={{ animationDelay: `${index * 160}ms` }}
              />
            ))}
          </svg>
        </span>
        {state === 'touched' && !calm ? (
          <span key={touchKey} className="card-touch__sheen" aria-hidden="true" />
        ) : null}
      </span>
    </span>
  );
}
