import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Drop, Flame, Sparkle, Wind, Leaf } from '@phosphor-icons/react';
import { getOrientationMeaning } from '../lib/cardLookup';

const MIN_WIDTH = 260;
const MAX_WIDTH = 320;
const ELEMENT_ICON_MAP = {
  fire: Flame,
  water: Drop,
  air: Wind,
  earth: Leaf,
  spirit: Sparkle
};

function inferElement(card) {
  const suit = (card?.suit || '').toLowerCase();
  if (suit === 'wands') return 'fire';
  if (suit === 'cups') return 'water';
  if (suit === 'swords') return 'air';
  if (suit === 'pentacles') return 'earth';
  return 'spirit';
}

function getKeywordPills(card, meaningText) {
  const phrase = String(meaningText || '').trim();
  if (!phrase) return [];
  const entries = phrase
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (entries.length > 0) return entries;
  const fallback = String(card?.name || '').replace(/^The /, '').split(' ').slice(0, 2).join(' ');
  return fallback ? [fallback] : [];
}

function resolvePosition(anchorRect) {
  if (!anchorRect || typeof window === 'undefined') {
    return { top: 16, left: 16, transform: 'none', placement: 'below' };
  }

  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(vw * 0.74)));
  const centerX = anchorRect.left + (anchorRect.width / 2);
  const left = Math.max(12, Math.min(vw - width - 12, centerX - (width / 2)));
  const placeAbove = anchorRect.top > vh * 0.42;
  const top = placeAbove
    ? Math.max(12, anchorRect.top - 16)
    : Math.min(vh - 12, anchorRect.bottom + 14);

  return {
    width,
    left,
    top,
    transform: placeAbove ? 'translateY(-100%)' : 'translateY(0)',
    placement: placeAbove ? 'above' : 'below'
  };
}

export function CardInfoPopover({
  open = false,
  card = null,
  positionLabel = '',
  anchorRect = null,
  onClose
}) {
  const panelRef = useRef(null);

  const meaning = useMemo(() => getOrientationMeaning(card), [card]);
  const element = useMemo(() => inferElement(card), [card]);
  const ElementIcon = ELEMENT_ICON_MAP[element] || Sparkle;
  const keywords = useMemo(() => getKeywordPills(card, meaning), [card, meaning]);
  const popoverPos = useMemo(() => resolvePosition(anchorRect), [anchorRect]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const node = panelRef.current;
      if (!node || node.contains(event.target)) return;
      onClose?.();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, onClose]);

  if (!open || !card || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] pointer-events-none"
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        className={`card-info-popover pointer-events-auto p-3 sm:p-4 text-main ${popoverPos.placement === 'above' ? 'card-info-popover--above' : 'card-info-popover--below'}`}
        style={{
          position: 'fixed',
          width: popoverPos.width,
          left: popoverPos.left,
          top: popoverPos.top,
          transform: popoverPos.transform
        }}
        role="dialog"
        aria-label={`${card.name} card information`}
        onMouseLeave={() => onClose?.()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4
              className="text-lg leading-tight"
              style={{ fontFamily: '"Cormorant Garamond", serif' }}
            >
              {card.name}
            </h4>
            {positionLabel ? (
              <p className="text-2xs uppercase tracking-[0.14em] text-muted mt-1">{positionLabel}</p>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2 py-1 text-2xs uppercase tracking-[0.14em]">
            <ElementIcon className="w-3.5 h-3.5" />
            {element}
          </span>
        </div>

        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-2xs text-main/90"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : null}

        {meaning ? (
          <div className="mt-3">
            <p
              className="text-sm text-main/90 leading-relaxed"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {meaning}
            </p>
          </div>
        ) : null}

        <div className="mt-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs border ${
              card?.isReversed
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-secondary/20 border-secondary/40 text-secondary'
            }`}
          >
            {card?.isReversed ? 'Reversed' : 'Upright'}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CardInfoPopover;
