import { useId, useMemo, useRef } from 'react';
import { getCardTouchPoints } from '../../../data/cardTouchPoints.js';
import { getVectorGestureDetails, projectGestureFrame } from '../../../data/cardGestureArtwork.js';
import { useCardGestureMotion } from './useCardGestureMotion.js';

// The light layer's coordinate box follows the RWS artwork's proportions
// (about 0.59), so a spot's radius reads as a circle on the card.
const BOX_WIDTH = 100;
const BOX_HEIGHT = 170;

/**
 * One spread card as artwork that can be touched: lifted by its container,
 * and lit where the reading describes something drawn on it. The image and
 * its light rotate together when the card is reversed.
 */
export function CardTouchArt({ card, state = null, touches = [], touchKey = '', calm = false, gesture = null, presence = 1, dynamic = false, motionOwner = false, crop = false }) {
  if (gesture) return <GestureArtwork card={card} gesture={gesture} presence={presence} dynamic={dynamic} motionOwner={motionOwner} crop={crop} calm={calm} />;
  return <LegacyCardTouchArt card={card} state={state} touches={touches} touchKey={touchKey} calm={calm} />;
}

function GestureArtwork({ card, gesture, presence, dynamic, motionOwner, crop, calm }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const root = useRef(null);
  const details = useMemo(() => card.artworkEdition === 'rws-immanuelle-vector'
    ? getVectorGestureDetails(card.canonicalName).filter(({ id }) => gesture.detailIds.includes(id)) : [], [card.canonicalName, card.artworkEdition, gesture.detailIds]);
  const motion = useMemo(() => ({ details }), [details]);
  const frame = crop && details.length === 1 ? projectGestureFrame(details[0].frame, card.isReversed) : { x: .5, y: .5, zoom: .39 };
  const masks = details.flatMap(detail => detail.maskSpots);
  useCardGestureMotion({ elementRef: root, runId: gesture.runId, sourceRevision: gesture.sourceRevision,
    associationId: gesture.associationId, gesture: motion, phase: gesture.phase,
    reducedMotion: calm, canMove: motionOwner && gesture.canMove });
  return (
    <span ref={root} data-gesture-art data-gesture-owner={motionOwner ? card.occurrenceId : undefined}
      data-card-name={card.canonicalName} className="gesture-art" data-held={gesture.held ? 'true' : undefined}
      data-active={gesture.active ? 'true' : undefined}
      data-dynamic={dynamic ? 'true' : undefined}
      data-calm={calm ? 'true' : undefined} data-crop={crop ? 'true' : undefined}
      style={{ '--presence': presence, visibility: presence > 0 ? 'visible' : 'hidden', '--crop-x': `${(0.5 - frame.x) * 100}%`, '--crop-y': `${(0.5 - frame.y) * 100}%`, '--crop-zoom': frame.zoom }}>
      <span className="gesture-art__plane">
        <span className="gesture-art__upright" data-reversed={card.isReversed ? 'true' : undefined}>
          <img className="gesture-art__image" src={card.image} alt="" decoding="async" draggable="false" />
          {masks.length > 0 && <>
            <svg className="gesture-art__light" viewBox="0 0 1086 1810" aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id={`${id}-soft`}><stop offset="0" stopColor="white" /><stop offset=".56" stopColor="white" stopOpacity=".85" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
                <radialGradient id={`${id}-surround-soft`}><stop offset="0" stopColor="black" /><stop offset=".56" stopColor="black" stopOpacity=".85" /><stop offset="1" stopColor="black" stopOpacity="0" /></radialGradient>
                <mask id={`${id}-mask`}><rect width="1086" height="1810" fill="black" />{masks.map((spot, index) => <ellipse key={index} cx={spot.x * 1086} cy={spot.y * 1810} rx={spot.rx * 1086} ry={spot.ry * 1810} fill={`url(#${id}-soft)`} />)}</mask>
                <mask id={`${id}-surround-mask`}><rect width="1086" height="1810" fill="white" />{masks.map((spot, index) => <ellipse key={index} cx={spot.x * 1086} cy={spot.y * 1810} rx={spot.rx * 1086} ry={spot.ry * 1810} fill={`url(#${id}-surround-soft)`} />)}</mask>
              </defs>
              {/* Local contrast survives a fully bright base image and reduced motion. */}
              <rect className="gesture-art__surround" width="1086" height="1810" mask={`url(#${id}-surround-mask)`} />
              <image href={card.image} width="1086" height="1810" preserveAspectRatio="none" mask={`url(#${id}-mask)`} />
              {details.flatMap(detail => detail.traces.map((path, index) => <path key={`${detail.id}-${index}`} data-gesture-finite d={path} className="gesture-art__trace" />))}
            </svg>
            <svg className="gesture-art__water" viewBox="0 0 1086 1810" aria-hidden="true" focusable="false">
              {details.filter(detail => detail.motionRecipe?.kind === 'water').map(detail => {
                const recipe = detail.motionRecipe;
                const prefix = `${id}-${detail.id}`;
                return <g key={detail.id} data-water-detail={detail.id}>
                  <defs>
                    <clipPath id={`${prefix}-stream`}><path d={recipe.clips.stream} /></clipPath>
                    {recipe.clips.pool && <clipPath id={`${prefix}-pool`}><path d={recipe.clips.pool} /></clipPath>}
                    {recipe.rivulets && <mask id={`${prefix}-land`}><rect width="1086" height="1810" fill="black" />{recipe.rivulets.map((path, index) => <path key={index} d={path} fill="none" stroke="white" strokeWidth={recipe.rivuletMaskWidth} strokeLinecap="round" />)}</mask>}
                  </defs>
                  <g clipPath={`url(#${prefix}-stream)`}>{recipe.streams.map((path, index) => <path key={index} d={path} data-gesture-water className="gesture-art__flow" style={{ animationDuration: `${.9 + index * .12}s` }} />)}</g>
                  {recipe.ripples && <g clipPath={`url(#${prefix}-pool)`}>{[0, 1, 2, 3].map(index => <ellipse key={index} data-gesture-water className="gesture-art__ripple" {...recipe.ripples[0]} style={{ animationDelay: `${index * -.75}s` }} />)}</g>}
                  {recipe.rivulets && <g mask={`url(#${prefix}-land)`}>{recipe.rivulets.map((path, index) => <path key={index} d={path} data-gesture-water className="gesture-art__rivulet" />)}</g>}
                </g>;
              })}
            </svg>
          </>}
        </span>
      </span>
    </span>
  );
}

function LegacyCardTouchArt({ card, state, touches, touchKey, calm }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const points = touches.length ? getCardTouchPoints(card.canonicalName, { artworkEdition: card.artworkEdition }).filter((point) => touches.includes(point.id)) : [];
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
