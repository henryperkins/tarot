import { useState, useCallback, useMemo } from 'react';
import { getSpreadInfo } from '../data/spreads';
import { Card } from './Card';
import { Tooltip } from './Tooltip';
import { getOrientationMeaning } from '../lib/cardLookup';

/**
 * Mini-map grid positions for different spreads.
 * Each position has x, y coordinates (0-based grid) and optional special styling.
 */
const SPREAD_MINIMAP_LAYOUTS = {
  single: [{ x: 0, y: 0 }],
  threeCard: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 }
  ],
  fiveCard: [
    { x: 1, y: 0 },    // Core (top center)
    { x: 0, y: 1 },    // Challenge (left)
    { x: 1, y: 1 },    // Hidden (center)
    { x: 2, y: 1 },    // Support (right)
    { x: 1, y: 2 }     // Direction (bottom center)
  ],
  decision: [
    { x: 1, y: 0 },    // Heart
    { x: 0, y: 1 },    // Path A
    { x: 2, y: 1 },    // Path B
    { x: 1, y: 1.5 },  // Clarity
    { x: 1, y: 2 }     // Free Will
  ],
  relationship: [
    { x: 0, y: 0 },    // You
    { x: 2, y: 0 },    // Them
    { x: 1, y: 1 }     // Connection
  ],
  celtic: [
    { x: 1, y: 1 },    // Present
    { x: 1, y: 1, overlay: true }, // Challenge (crossing)
    { x: 0, y: 1 },    // Past
    { x: 2, y: 1 },    // Future
    { x: 1, y: 0 },    // Conscious
    { x: 1, y: 2 },    // Subconscious
    { x: 3, y: 2 },    // Advice
    { x: 3, y: 1.5 },  // External
    { x: 3, y: 1 },    // Hopes/Fears
    { x: 3, y: 0.5 }   // Outcome
  ]
};

/**
 * Get short position labels for mini-map display.
 */
function getShortLabel(position) {
  if (!position) return '';
  const parts = position.split(/\s*[—–\-:/]\s*/);
  const label = (parts[0] || position).trim();
  return label.length <= 10 ? label : `${label.slice(0, 8)}...`;
}

/**
 * Interactive mini-map component for landscape split view.
 * Shows spread layout with clickable slots to select cards for inspection.
 */
function InteractiveMiniMap({
  spreadKey,
  cards,
  revealedIndices,
  inspectedIndex,
  onSlotClick
}) {
  const layout = SPREAD_MINIMAP_LAYOUTS[spreadKey] || SPREAD_MINIMAP_LAYOUTS.threeCard;
  const spreadInfo = getSpreadInfo(spreadKey);

  // Calculate grid bounds for positioning
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layout.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
    return { minX, maxX, minY, maxY };
  }, [layout]);

  const gridWidth = bounds.maxX - bounds.minX + 1;
  const gridHeight = bounds.maxY - bounds.minY + 1;

  return (
    <div
      className="relative w-full h-full p-2"
      role="listbox"
      aria-label={`${spreadInfo?.name || 'Spread'} card selector`}
    >
      {/* Grid container */}
      <div
        className="relative w-full h-full"
        style={{ aspectRatio: `${gridWidth} / ${gridHeight}` }}
      >
        {layout.slice(0, cards.length).map((pos, idx) => {
          const card = cards[idx];
          const isRevealed = revealedIndices?.has?.(idx) || false;
          const isActive = idx === inspectedIndex;
          const position = spreadInfo?.positions?.[idx] || `Position ${idx + 1}`;
          const shortLabel = getShortLabel(position);

          // Calculate position as percentage
          const leftPercent = ((pos.x - bounds.minX) / gridWidth) * 100 + (100 / gridWidth / 2);
          const topPercent = ((pos.y - bounds.minY) / gridHeight) * 100 + (100 / gridHeight / 2);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSlotClick(idx)}
              role="option"
              aria-selected={isActive}
              aria-label={`${position}${card ? `: ${card.name}${card.isReversed ? ' reversed' : ''}` : ''}`}
              className={`
                absolute transform -translate-x-1/2 -translate-y-1/2
                flex flex-col items-center justify-center gap-0.5
                rounded-lg border-2 transition-all touch-manipulation
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${pos.overlay ? 'rotate-90 scale-75' : ''}
                ${isActive
                  ? 'border-primary/80 bg-primary/20 ring-2 ring-primary/60 shadow-lg z-10'
                  : card
                    ? isRevealed
                      ? 'border-secondary/50 bg-secondary/15 hover:border-secondary/70'
                      : 'border-primary/40 bg-primary/10 hover:border-primary/60'
                    : 'border-accent/20 bg-surface/40'
                }
              `}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                width: `${Math.min(85 / gridWidth, 45)}%`,
                aspectRatio: '2/3',
                maxWidth: '60px'
              }}
            >
              {/* Position number */}
              <span className={`
                text-[10px] font-bold
                ${isActive ? 'text-primary' : 'text-muted'}
              `}>
                {idx + 1}
              </span>

              {/* Card indicator */}
              {card && (
                <span className={`
                  text-[8px] font-medium truncate max-w-full px-0.5
                  ${isRevealed ? 'text-secondary' : 'text-primary/70'}
                `}>
                  {isRevealed ? card.name.charAt(0) : '?'}
                </span>
              )}

              {/* Short position label */}
              <span className="text-[7px] text-muted/70 truncate max-w-full px-0.5">
                {shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Spread name */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
        <span className="text-[9px] text-muted/60 bg-surface/60 px-2 py-0.5 rounded-full border border-accent/10">
          {spreadInfo?.tag || spreadKey}
        </span>
      </div>
    </div>
  );
}

/**
 * LandscapeSplitView - Split-dashboard layout for landscape mobile.
 *
 * Structure:
 * ┌──────────────────────────────────────────────┐
 * │  Mini-map (40%)   │   Inspection View (60%)  │
 * │                   │                          │
 * │  [1] [2] [3]      │   ┌──────────────────┐   │
 * │      [4]          │   │                  │   │
 * │  [5] [6] [7]      │   │   Selected Card  │   │
 * │                   │   │   + Reflection   │   │
 * │                   │   │                  │   │
 * │                   │   └──────────────────┘   │
 * └──────────────────────────────────────────────┘
 */
export function LandscapeSplitView({
  selectedSpread,
  reading,
  revealedCards,
  revealCard,
  reflections,
  setReflections,
  onCardClick,
  openReflectionIndex,
  onRequestOpenReflection
}) {
  // Track which card is being inspected in the right pane
  const [inspectedIndex, setInspectedIndex] = useState(0);

  const spreadInfo = getSpreadInfo(selectedSpread);

  // Handle slot selection from mini-map
  const handleSlotClick = useCallback((index) => {
    setInspectedIndex(index);
  }, []);

  // Get the currently inspected card
  const inspectedCard = reading?.[inspectedIndex];
  const inspectedPosition = spreadInfo?.positions?.[inspectedIndex] || `Position ${inspectedIndex + 1}`;
  const inspectedRoleKey = spreadInfo?.roleKeys?.[inspectedIndex] || null;
  const isInspectedRevealed = revealedCards?.has?.(inspectedIndex) || false;

  // Tooltip content for mini-map
  const getCardTakeaway = useCallback((card) => {
    const meaning = getOrientationMeaning(card);
    if (!meaning) return '';
    const firstClause = meaning.split(/[.;]| — | – | - /)[0];
    const text = firstClause.trim();
    return text.length <= 50 ? text : `${text.slice(0, 47).trimEnd()}...`;
  }, []);

  if (!reading || reading.length === 0) return null;

  return (
    <div
      className="landscape-split-view flex w-full h-full gap-2 animate-fade-in"
      style={{ minHeight: '200px', maxHeight: '320px' }}
    >
      {/* Left pane: Interactive mini-map (40%) */}
      <div className="landscape-split-minimap w-[40%] flex-shrink-0 bg-surface/40 rounded-xl border border-accent/15 overflow-hidden">
        <InteractiveMiniMap
          spreadKey={selectedSpread}
          cards={reading}
          revealedIndices={revealedCards}
          inspectedIndex={inspectedIndex}
          onSlotClick={handleSlotClick}
        />
      </div>

      {/* Right pane: Card inspection (60%) */}
      <div className="landscape-split-inspection flex-1 overflow-y-auto scrollbar-none">
        {inspectedCard && (
          <Tooltip
            content={isInspectedRevealed ? (
              <div className="space-y-1 text-left leading-snug">
                <strong className="block text-accent text-sm">{inspectedPosition}</strong>
                <p className="text-xs-plus text-muted">
                  {inspectedCard.name}{inspectedCard.isReversed ? ' (Reversed)' : ''}
                </p>
                <p className="text-xs-plus text-main/90">
                  {getCardTakeaway(inspectedCard) || 'Card revealed'}
                </p>
              </div>
            ) : null}
            position="top"
            asChild
            enableClick={false}
            autoHideMs={null}
            triggerClassName="block h-full"
          >
            <Card
              card={inspectedCard}
              index={inspectedIndex}
              isRevealed={isInspectedRevealed}
              onReveal={revealCard}
              position={inspectedPosition}
              roleKey={inspectedRoleKey}
              reflections={reflections}
              setReflections={setReflections}
              onCardClick={onCardClick}
              openReflectionIndex={openReflectionIndex}
              onRequestOpenReflection={onRequestOpenReflection}
              staggerDelay={0}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default LandscapeSplitView;
