import { memo } from 'react';
import { FALLBACK_IMAGE, getCardImage, getCardThumbnailSrcSet, getCardTinyImage } from '../../../../../lib/cardLookup';
import { styles, cn } from '../../EntryCard.primitives';

/**
 * Card artwork for the journal. The art is never dimmed or covered: the card's
 * name and position are written beside it, and its control carries the
 * accessible name. Rider-Waite-Smith scans use their 360 px rendition; `tiny`
 * art (about 40 CSS px or less) uses the 120 px rendition every deck has, and
 * falls back to the full image if that file is missing.
 */
export const CardThumbnail = memo(function CardThumbnail({
  card,
  size,
  isReversed = false,
  active = false,
  loading = 'lazy',
  showReversedBadge = true,
  tiny = false,
  className
}) {
  const cardImage = getCardImage(card);
  const tinyImage = tiny ? getCardTinyImage(cardImage) : null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-(--border-warm-light) bg-(--panel-dark-2)',
        'shadow-[0_8px_18px_-10px_rgba(0,0,0,0.55)]',
        active && 'ring-2 ring-(--brand-primary)',
        className
      )}
      style={{ width: size.width, height: size.height }}
    >
      <img
        src={tinyImage || cardImage}
        srcSet={tinyImage ? undefined : getCardThumbnailSrcSet(cardImage)}
        sizes={tinyImage ? undefined : `${size.width}px`}
        alt=""
        width={size.width}
        height={size.height}
        className={cn('h-full w-full object-cover', isReversed && 'rotate-180')}
        loading={loading}
        decoding="async"
        onError={(event) => {
          const target = event.currentTarget;
          if (!target || target.dataset.fallback) return;
          // A missing small rendition falls back to the card's own image first.
          if (tinyImage && !target.dataset.tinyFailed) {
            target.dataset.tinyFailed = 'true';
            target.src = cardImage;
            return;
          }
          target.dataset.fallback = 'true';
          target.removeAttribute('srcset');
          target.src = FALLBACK_IMAGE;
        }}
      />
      {isReversed && showReversedBadge && (
        <span aria-hidden="true" className={cn(styles.reversedBadgeSolid, 'absolute right-1 top-1')}>
          Rev
        </span>
      )}
    </div>
  );
});
