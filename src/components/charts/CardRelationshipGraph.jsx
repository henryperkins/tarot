import { memo, useLayoutEffect, useRef, useState } from 'react';
import { separateLabelBoxes } from './labelSeparation.js';

/**
 * CardRelationshipGraph - the archetypal triads and dyads among a reading's
 * cards, drawn around a circle and written out as a list.
 *
 * The drawing is decorative; the list carries the same relationships as text.
 * Card names are HTML labels, so they stay legible at every width instead of
 * scaling with the drawing.
 *
 * @param {Object} props
 * @param {Array} props.cards - The reading's cards, in spread order
 * @param {{ triads: Array, dyads: Array }} props.web - From resolvePatternWeb()
 */
const EMPTY_OFFSETS = [];
const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 200;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const RADIUS = 58;
/** Name every card up to this many; beyond it, only the connected ones. */
const MAX_LABELLED = 5;
const LABEL_GAP = '0.625rem';

const listFormat = typeof Intl !== 'undefined' && Intl.ListFormat
  ? new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })
  : null;

function joinNames(names) {
  return listFormat ? listFormat.format(names) : names.join(', ');
}

function cardName(card) {
  return card?.displayName || card?.name || card?.card || 'Card';
}

function sentenceCase(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function nodePositions(count) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
    return { x: CENTER_X + RADIUS * Math.cos(angle), y: CENTER_Y + RADIUS * Math.sin(angle) };
  });
}

// Names sit beside their node, on the side away from the centre. Names wrap
// between words; a single long word may run into the section's padding
// rather than break mid-word.
function labelStyle({ x, y }) {
  const left = (x / VIEW_WIDTH) * 100;
  const top = (y / VIEW_HEIGHT) * 100;
  if (x >= CENTER_X - 0.5) {
    return {
      left: `${left}%`,
      top: `${top}%`,
      transform: `translate(${LABEL_GAP}, -50%)`,
      maxWidth: `calc(${100 - left}% - ${LABEL_GAP} - 0.25rem)`
    };
  }
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(calc(-100% - ${LABEL_GAP}), -50%)`,
    maxWidth: `calc(${left}% - ${LABEL_GAP} - 0.25rem)`,
    textAlign: 'right'
  };
}

function RelationshipGlyph({ kind }) {
  return (
    <svg viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-(--brand-primary)" aria-hidden="true" focusable="false">
      {kind === 'triad' ? (
        <path d="M8 2.5 13.5 13h-11Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      ) : (
        <>
          <line x1="2.5" y1="8" x2="13.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2.5" strokeLinecap="round" />
          <circle cx="2.5" cy="8" r="1.75" fill="currentColor" />
          <circle cx="13.5" cy="8" r="1.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

const CardRelationshipGraph = memo(function CardRelationshipGraph({ cards = [], web }) {
  const triads = web?.triads || [];
  const dyads = web?.dyads || [];
  const nodes = nodePositions(cards.length);
  const linked = new Set([...triads, ...dyads].flatMap((relationship) => relationship.indices));
  const labelled = !cards.length || (!triads.length && !dyads.length)
    ? []
    : cards.length <= MAX_LABELLED
      ? cards.map((_, index) => index)
      : [...linked].sort((a, b) => a - b);
  const labelSignature = labelled.map((index) => `${index}:${cardName(cards[index])}`).join('|');
  const labelCount = labelled.length;
  const labelRefs = useRef([]);
  const plotRef = useRef(null);
  const passes = useRef({ key: '', count: 0 });
  const [layoutMeasure, setLayoutMeasure] = useState('');
  const layoutKey = `${labelSignature}@${layoutMeasure}`;
  const [offsetState, setOffsetState] = useState({ key: '', offsets: EMPTY_OFFSETS });
  const offsets = offsetState.key === layoutKey ? offsetState.offsets : EMPTY_OFFSETS;

  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot || labelCount < 2) return undefined;
    const measure = () => {
      const sizes = labelRefs.current.slice(0, labelCount).map((element) => (
        element ? `${element.offsetWidth}x${element.offsetHeight}` : '0'
      )).join(',');
      const next = `${Math.round(plot.clientWidth)}|${sizes}`;
      setLayoutMeasure((current) => (current === next ? current : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(plot);
    labelRefs.current.slice(0, labelCount).forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [labelCount, labelSignature]);

  useLayoutEffect(() => {
    if (!layoutMeasure) return undefined;
    if (passes.current.key !== layoutKey) {
      passes.current = { key: layoutKey, count: 0 };
    }
    if (passes.current.count > 8) return undefined;
    const elements = labelRefs.current.slice(0, labelCount);
    if (elements.length < 2 || elements.some((element) => !element)) return undefined;
    const plotRect = plotRef.current?.getBoundingClientRect();
    const boxes = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    });
    const shifts = separateLabelBoxes(boxes, plotRect ? {
      bounds: { x: plotRect.left, y: plotRect.top, w: plotRect.width, h: plotRect.height }
    } : undefined);
    if (shifts.every((shift) => Math.hypot(shift.x, shift.y) < 0.5)) return undefined;
    passes.current.count += 1;
    setOffsetState({
      key: layoutKey,
      offsets: elements.map((_, index) => ({
        x: (offsets[index]?.x || 0) + shifts[index].x,
        y: (offsets[index]?.y || 0) + shifts[index].y
      }))
    });
    return undefined;
  }, [layoutKey, labelCount, offsets, layoutMeasure]);

  if (!cards.length || (!triads.length && !dyads.length)) return null;
  const relationships = [
    ...triads.map((triad) => ({ kind: 'triad', key: `triad-${triad.id}`, indices: triad.indices, detail: triad.theme })),
    ...dyads.map((dyad) => ({ kind: 'dyad', key: `dyad-${dyad.key}`, indices: dyad.indices, detail: sentenceCase(dyad.theme || dyad.category) }))
  ];

  return (
    <figure className="m-0">
      <div ref={plotRef} className="relative mx-auto w-full max-w-[22rem]" style={{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          {triads.map((triad) => (
            <polygon
              key={`triad-${triad.id}`}
              points={triad.indices.map((index) => `${nodes[index].x},${nodes[index].y}`).join(' ')}
              fill="var(--brand-primary)"
              fillOpacity="0.1"
              stroke="var(--brand-primary)"
              strokeOpacity="0.75"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ))}
          {dyads.map((dyad) => {
            const [from, to] = dyad.indices.map((index) => nodes[index]);
            return (
              <line
                key={`dyad-${dyad.key}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--brand-primary)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            );
          })}
          {nodes.map((node, index) => (
            <circle
              key={`node-${index}`}
              cx={node.x}
              cy={node.y}
              r={linked.has(index) ? 4.5 : 3}
              fill={linked.has(index) ? 'var(--brand-primary)' : 'var(--text-muted)'}
              fillOpacity={linked.has(index) ? 1 : 0.55}
            />
          ))}
        </svg>
        {labelled.map((index, labelIndex) => {
          const placement = labelStyle(nodes[index]);
          const offset = offsets[labelIndex] || { x: 0, y: 0 };
          return (
            <span
              key={`label-${index}`}
              ref={(node) => { labelRefs.current[labelIndex] = node; }}
              aria-hidden="true"
              className={`pointer-events-none absolute text-xs leading-snug ${
                linked.has(index) ? 'font-medium text-(--text-main)' : 'text-(--text-muted)'
              }`}
              style={{
                ...placement,
                transform: `${placement.transform} translate(${offset.x}px, ${offset.y}px)`
              }}
            >
              {cardName(cards[index])}
            </span>
          );
        })}
      </div>

      <figcaption className="mt-4">
        <ul className="max-w-[34em] space-y-2.5">
          {relationships.map((relationship) => (
            <li key={relationship.key} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <RelationshipGlyph kind={relationship.kind} />
              <p className="min-w-0 wrap-break-word">
                <span className="sr-only">{relationship.kind === 'triad' ? 'Three-card pattern: ' : 'Card pair: '}</span>
                <span className="block font-semibold text-(--text-main)">
                  {joinNames(relationship.indices.map((index) => cardName(cards[index])))}
                </span>
                {relationship.detail && (
                  <span className="block text-(--text-muted)">
                    <span className="sr-only">: </span>
                    {relationship.detail}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
});

export default CardRelationshipGraph;
