import { useId } from 'react';
import { getCardTouchPoints } from '../../../data/cardTouchPoints.js';

// The light layer's coordinate box follows the RWS artwork's proportions
// (about 0.59), so a spot's radius reads as a circle on the card.
const BOX_WIDTH = 100;
const BOX_HEIGHT = 170;

/**
 * One spread card as artwork that can be touched: lifted by its container,
 * and lit where the reading describes something drawn on it. The image and
 * its light rotate together when the card is reversed.
 */
export function CardTouchArt({ card, state = null, touches = [], touchKey = '', calm = false }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const points = touches.length ? getCardTouchPoints(card.canonicalName).filter((point) => touches.includes(point.id)) : [];
  const spots = points.flatMap((point, order) => point.spots.map(([x, y, r], index) => ({
    key: `${point.id}-${index}`,
    order,
    cx: x * BOX_WIDTH,
    cy: y * BOX_HEIGHT,
    r: r * BOX_WIDTH
  })));
  const origin = spots[0] ? { x: spots[0].cx / BOX_WIDTH, y: spots[0].cy / BOX_HEIGHT } : { x: 0.5, y: 0.5 };

  return (
    <span className="card-touch" data-state={state || undefined} data-lit={spots.length ? 'true' : undefined}>
      <span
        className={`card-touch__art${card.isReversed ? ' card-touch__art--reversed' : ''}`}
        style={card.frame ? { aspectRatio: card.frame } : undefined}
      >
        <img className="card-touch__image" src={card.image} alt="" loading="lazy" decoding="async" draggable="false" />
        <svg
          className="card-touch__light"
          viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id={`${id}-glow`}>
              <stop offset="0%" style={{ stopColor: 'rgb(var(--card-touch-light))', stopOpacity: 0.62 }} />
              <stop offset="55%" style={{ stopColor: 'rgb(var(--card-touch-light))', stopOpacity: 0.2 }} />
              <stop offset="100%" style={{ stopColor: 'rgb(var(--card-touch-light))', stopOpacity: 0 }} />
            </radialGradient>
            <radialGradient id={`${id}-opening`}>
              <stop offset="0%" stopColor="black" />
              <stop offset="55%" stopColor="black" />
              <stop offset="100%" stopColor="white" />
            </radialGradient>
            <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX_WIDTH} height={BOX_HEIGHT}>
              <rect width={BOX_WIDTH} height={BOX_HEIGHT} fill="white" />
              {spots.map((spot) => (
                <circle key={spot.key} cx={spot.cx} cy={spot.cy} r={spot.r * 1.35} fill={`url(#${id}-opening)`} />
              ))}
            </mask>
          </defs>
          <rect className="card-touch__veil" width={BOX_WIDTH} height={BOX_HEIGHT} mask={`url(#${id}-mask)`} />
          {spots.map((spot) => (
            <circle
              key={`${touchKey}-${spot.key}`}
              className="card-touch__glow"
              cx={spot.cx}
              cy={spot.cy}
              r={spot.r}
              fill={`url(#${id}-glow)`}
              style={{ animationDelay: `${spot.order * 140}ms` }}
            />
          ))}
        </svg>
        {state === 'touched' && !calm ? (
          <span
            key={touchKey}
            className="card-touch__bloom"
            style={{ '--touch-x': `${origin.x * 100}%`, '--touch-y': `${origin.y * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
      </span>
    </span>
  );
}
