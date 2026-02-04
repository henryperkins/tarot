import { memo } from 'react';
import { FALLBACK_IMAGE, getCardImage } from '../../../../../lib/cardLookup';
import { styles, cn } from '../../EntryCard.primitives';

export const CardThumbnail = memo(function CardThumbnail({
  card,
  size,
  suitColor,
  isReversed,
  showLabels = true,
  showPosition = true,
  showName = true,
  showPositionOverlay = false,
  isActive = false,
  loading = 'lazy',
  className,
  nameMaxWidth = 84
}) {
  const name = card?.name || 'Unknown card';
  const position = card?.position || 'Position';
  const cardImage = getCardImage(card);
  const shouldShowPosition = showLabels && showPosition;
  const shouldShowName = showLabels && showName;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {shouldShowPosition && (
        <span className="text-2xs uppercase tracking-wider text-[color:var(--text-muted)]">
          {position}
        </span>
      )}
      <div
        className="relative"
        style={{ width: size.width, height: size.height }}
      >
        <div
          className="relative z-10 overflow-hidden rounded-md border border-[color:var(--border-warm-light)] shadow-md"
          style={{ width: size.width, height: size.height }}
        >
          {showPositionOverlay && (
            <span
              className={cn(
                'pointer-events-none absolute inset-0 z-0 flex items-center justify-center px-2 text-2xs uppercase tracking-[0.22em] text-[color:var(--text-muted)] opacity-0 transition duration-150',
                'bg-[color:var(--panel-dark-2)]/60 backdrop-blur-[2px]',
                'group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100',
                isActive && 'opacity-100'
              )}
              aria-hidden="true"
            >
              <span className="rounded-full border border-[color:var(--border-warm-subtle)] bg-[color:var(--panel-dark-3)]/70 px-2 py-0.5 text-2xs text-[color:var(--text-main)] shadow-[0_10px_22px_-16px_rgba(0,0,0,0.7)]">
                {position}
              </span>
            </span>
          )}
          <span
            className="absolute left-0 top-0 z-10 h-full w-[3px]"
            style={{ backgroundColor: suitColor }}
            aria-hidden="true"
          />
          <img
            src={cardImage}
            alt={`${name}${isReversed ? ' (Reversed)' : ''}`}
            className={cn(
              'relative z-10 h-full w-full object-cover transition-opacity duration-300 ease-out',
              'group-hover:opacity-70 group-focus-visible:opacity-70 group-active:opacity-60',
              isActive && 'opacity-60',
              isReversed && 'rotate-180'
            )}
            loading={loading}
            decoding="async"
            onError={(event) => {
              const target = event.currentTarget;
              if (!target) return;
              target.onerror = null;
              target.src = FALLBACK_IMAGE;
            }}
          />
          {isReversed && (
            <span className={cn(styles.reversedBadge, 'absolute right-1 top-1 z-20 text-2xs')}>
              Rev
            </span>
          )}
        </div>
      </div>
      {shouldShowName && (
        <span
          className="text-xs font-medium text-main truncate"
          style={{ maxWidth: `${nameMaxWidth}px` }}
        >
          {name}
        </span>
      )}
    </div>
  );
});
